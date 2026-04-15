import { randomInt } from "node:crypto"

import { prisma } from "@/db/client"
import {
  PostAuctionMode,
  Prisma,
  type Prisma as PrismaNamespace,
} from "@/db/types"
import { enqueueBackgroundJob } from "@/lib/background-jobs"
import { createSystemNotification } from "@/lib/notification-writes"
import { prepareScopedPointDelta, applyPointDelta } from "@/lib/point-center"
import { POINT_LOG_EVENT_TYPES } from "@/lib/point-log-events"

export const POST_AUCTION_SETTLE_BACKGROUND_JOB_NAME = "post-auction.settle"
const POST_AUCTION_TRANSACTION_MAX_RETRIES = 3
const POST_AUCTION_TRANSACTION_RETRY_BASE_DELAY_MS = 25
const DEFAULT_POST_AUCTION_SETTLEMENT_BATCH_SIZE = 100
const MAX_POST_AUCTION_SETTLEMENT_BATCH_SIZE = 500
const DEFAULT_POST_AUCTION_SETTLEMENT_RECOVERY_INTERVAL_MS = 60_000
const DEFAULT_POST_AUCTION_SETTLEMENT_RECOVERY_BATCH_SIZE = 100
const MAX_POST_AUCTION_SETTLEMENT_RECOVERY_BATCH_SIZE = 500

export type AuctionTx = PrismaNamespace.TransactionClient

export function getUserDisplayName(
  user: { username: string; nickname?: string | null } | null | undefined,
) {
  if (!user) {
    return null
  }

  return user.nickname?.trim() || user.username
}

export function getPostAuctionStatusLabel(status: string) {
  switch (status) {
    case "ACTIVE":
      return "进行中"
    case "SETTLING":
      return "结算中"
    case "SETTLED":
      return "已成交"
    case "CANCELLED":
      return "已取消"
    case "FAILED":
      return "流拍"
    case "DRAFT":
    default:
      return "待激活"
  }
}

function isRetryablePostAuctionTransactionError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function sleepWithAbort(ms: number, signal?: AbortSignal) {
  if (!signal) {
    return sleep(ms)
  }

  const activeSignal = signal

  if (activeSignal.aborted) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    const timeoutId = setTimeout(() => {
      activeSignal.removeEventListener("abort", handleAbort)
      resolve()
    }, ms)

    function handleAbort() {
      clearTimeout(timeoutId)
      activeSignal.removeEventListener("abort", handleAbort)
      resolve()
    }

    activeSignal.addEventListener("abort", handleAbort, { once: true })
  })
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number.parseInt(String(value ?? ""), 10)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, parsed))
}

export function resolvePostAuctionSettlementRecoveryIntervalMs() {
  return parsePositiveInteger(
    process.env.POST_AUCTION_SETTLEMENT_RECOVERY_INTERVAL_MS,
    DEFAULT_POST_AUCTION_SETTLEMENT_RECOVERY_INTERVAL_MS,
    5_000,
    60 * 60 * 1_000,
  )
}

export function resolvePostAuctionSettlementRecoveryBatchSize() {
  return parsePositiveInteger(
    process.env.POST_AUCTION_SETTLEMENT_RECOVERY_BATCH_SIZE,
    DEFAULT_POST_AUCTION_SETTLEMENT_RECOVERY_BATCH_SIZE,
    1,
    MAX_POST_AUCTION_SETTLEMENT_RECOVERY_BATCH_SIZE,
  )
}

async function runPostAuctionTransactionWithRetry<T>(execute: () => Promise<T>): Promise<T> {
  let retryCount = 0

  while (true) {
    try {
      return await execute()
    } catch (error) {
      if (
        !isRetryablePostAuctionTransactionError(error)
        || retryCount >= POST_AUCTION_TRANSACTION_MAX_RETRIES
      ) {
        throw error
      }

      const delayMs =
        POST_AUCTION_TRANSACTION_RETRY_BASE_DELAY_MS * 2 ** retryCount
        + randomInt(0, POST_AUCTION_TRANSACTION_RETRY_BASE_DELAY_MS)

      retryCount += 1
      await sleep(delayMs)
    }
  }
}

async function lockPostAuctionById(tx: AuctionTx, auctionId: string) {
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "PostAuction"
    WHERE "id" = ${auctionId}
    FOR UPDATE
  `)
}

async function lockPostAuctionByPostId(tx: AuctionTx, postId: string) {
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "PostAuction"
    WHERE "postId" = ${postId}
    FOR UPDATE
  `)
}

export function runSerializablePostAuctionTransaction<T>(
  callback: (tx: AuctionTx) => Promise<T>,
  options: { auctionId?: string; postId?: string },
) {
  return runPostAuctionTransactionWithRetry(() =>
    prisma.$transaction(
      async (tx) => {
        if (options.auctionId) {
          await lockPostAuctionById(tx, options.auctionId)
        } else if (options.postId) {
          await lockPostAuctionByPostId(tx, options.postId)
        }

        return callback(tx)
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    ),
  )
}

export function enqueuePostAuctionSettlementContinuation(auctionId: string) {
  return enqueueBackgroundJob(POST_AUCTION_SETTLE_BACKGROUND_JOB_NAME, { auctionId })
}

export function enqueuePostAuctionSettlement(auctionId: string, endsAt: Date) {
  const delayMs = Math.max(0, endsAt.getTime() - Date.now())
  return enqueueBackgroundJob(
    POST_AUCTION_SETTLE_BACKGROUND_JOB_NAME,
    { auctionId },
    { delayMs },
  )
}

export async function resolveSellerIncome(
  tx: AuctionTx,
  input: {
    sellerId: number
    beforeBalance: number
    amount: number
    postId: string
    auctionId: string
    pointName: string
  },
) {
  if (input.amount <= 0) {
    return
  }

  const prepared = await prepareScopedPointDelta({
    scopeKey: "POST_AUCTION_SELLER_INCOME",
    baseDelta: input.amount,
    userId: input.sellerId,
  })

  await applyPointDelta({
    tx,
    userId: input.sellerId,
    beforeBalance: input.beforeBalance,
    prepared,
    pointName: input.pointName,
    reason: "[拍卖] 拍卖成交收入",
    eventType: POINT_LOG_EVENT_TYPES.POST_AUCTION_SELLER_INCOME,
    eventData: {
      postId: input.postId,
      auctionId: input.auctionId,
      amount: input.amount,
    },
    relatedType: "POST",
    relatedId: input.postId,
  })
}

export async function refundAuctionPoints(
  tx: AuctionTx,
  input: {
    userId: number
    beforeBalance: number
    amount: number
    postId: string
    auctionId: string
    pointName: string
    scopeKey:
      | "POST_AUCTION_OUTBID_REFUND"
      | "POST_AUCTION_LOSE_REFUND"
      | "POST_AUCTION_WIN_SETTLEMENT"
    eventType:
      | "POST_AUCTION_OUTBID_REFUND"
      | "POST_AUCTION_LOSE_REFUND"
      | "POST_AUCTION_WIN_SETTLEMENT"
    reason: string
  },
) {
  if (input.amount <= 0) {
    return
  }

  const prepared = await prepareScopedPointDelta({
    scopeKey: input.scopeKey,
    baseDelta: input.amount,
    userId: input.userId,
  })

  await applyPointDelta({
    tx,
    userId: input.userId,
    beforeBalance: input.beforeBalance,
    prepared,
    pointName: input.pointName,
    reason: input.reason,
    eventType: input.eventType,
    eventData: {
      postId: input.postId,
      auctionId: input.auctionId,
      amount: input.amount,
    },
    relatedType: "POST",
    relatedId: input.postId,
  })
}

export function resolvePostAuctionSettlementBatchSize() {
  const rawValue = process.env.POST_AUCTION_SETTLEMENT_BATCH_SIZE?.trim()

  if (!rawValue) {
    return DEFAULT_POST_AUCTION_SETTLEMENT_BATCH_SIZE
  }

  const parsed = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_POST_AUCTION_SETTLEMENT_BATCH_SIZE
  }

  return Math.min(MAX_POST_AUCTION_SETTLEMENT_BATCH_SIZE, parsed)
}

export function resolvePostAuctionFinalPrice(input: {
  mode: PostAuctionMode
  pricingRule: string
  startPrice: number
  winningBidAmount: number
  secondBidAmount: number | null
}) {
  return input.mode === PostAuctionMode.SEALED_BID && input.pricingRule === "SECOND_PRICE"
    ? Math.max(input.startPrice, input.secondBidAmount ?? input.startPrice)
    : input.winningBidAmount
}

export function buildPostAuctionPendingSettlementWhere(
  auctionId: string,
  winnerUserId: number,
  finalPrice: number,
): PrismaNamespace.PostAuctionEntryWhereInput {
  return {
    auctionId,
    OR: [
      {
        userId: {
          not: winnerUserId,
        },
        frozenAmount: {
          gt: 0,
        },
      },
      {
        userId: winnerUserId,
        frozenAmount: {
          gt: finalPrice,
        },
      },
    ],
  }
}

export async function notifyPostAuctionFailed(params: {
  sellerId: number
  postId: string
  postTitle: string
}) {
  await createSystemNotification({
    userId: params.sellerId,
    relatedType: "POST",
    relatedId: params.postId,
    title: "拍卖已结束但无人出价",
    content: `你发起的帖子《${params.postTitle}》已结束，本次无人出价，系统已判定为流拍。`,
  })
}

export async function notifyPostAuctionSettled(params: {
  winnerId: number
  sellerId: number
  postId: string
  postTitle: string
  winnerName: string | null
  finalPrice: number
  pointName: string
}) {
  await Promise.all([
    createSystemNotification({
      userId: params.winnerId,
      relatedType: "POST",
      relatedId: params.postId,
      title: "你已成功拍下帖子内容",
      content: `帖子《${params.postTitle}》已结算，成交价为 ${params.finalPrice} ${params.pointName}。你现在可以查看赢家专属内容。`,
    }),
    createSystemNotification({
      userId: params.sellerId,
      relatedType: "POST",
      relatedId: params.postId,
      title: "你的拍卖已成交",
      content: `帖子《${params.postTitle}》已完成结算，赢家为 ${params.winnerName ?? "匿名用户"}，成交价为 ${params.finalPrice} ${params.pointName}。`,
    }),
  ])
}
