import { randomInt } from "node:crypto"

import { prisma } from "@/db/client"
import {
  PostAuctionEntryStatus,
  PostAuctionMode,
  PostAuctionStatus,
  Prisma,
  type Prisma as PrismaNamespace,
} from "@/db/types"
import { apiError } from "@/lib/api-route"
import { enqueueBackgroundJob, registerBackgroundJobHandler } from "@/lib/background-jobs"
import { parseBusinessDateTime } from "@/lib/formatters"
import { createSystemNotification } from "@/lib/notification-writes"
import {
  getPostAuctionModeLabel,
  getPostAuctionPricingRuleLabel,
  normalizePostAuctionMode,
  normalizePostAuctionPricingRule,
  type LocalPostAuctionMode,
  type LocalPostAuctionPricingRule,
} from "@/lib/post-auction-types"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { POINT_LOG_EVENT_TYPES } from "@/lib/point-log-events"
import { getSiteSettings } from "@/lib/site-settings"

const POST_AUCTION_SETTLE_BACKGROUND_JOB_NAME = "post-auction.settle"
const POST_AUCTION_TRANSACTION_MAX_RETRIES = 3
const POST_AUCTION_TRANSACTION_RETRY_BASE_DELAY_MS = 25
const DEFAULT_POST_AUCTION_SETTLEMENT_BATCH_SIZE = 100
const MAX_POST_AUCTION_SETTLEMENT_BATCH_SIZE = 500

type AuctionTx = PrismaNamespace.TransactionClient

export interface NormalizedPostAuctionConfig {
  mode: LocalPostAuctionMode
  pricingRule: LocalPostAuctionPricingRule
  startPrice: number
  incrementStep: number
  startsAt: Date | null
  endsAt: Date
  winnerOnlyContent: string
  winnerOnlyContentPreview: string | null
}

export interface PostAuctionVisibleBidRecord {
  id: string
  userId: number
  userName: string
  amount: number
  createdAt: string
}

export interface PostAuctionParticipantPreview {
  userId: number
  userName: string
  avatarPath: string | null
  isVip: boolean
  vipLevel: number | null
  amount: number | null
  isLeader: boolean
}

export interface PostAuctionParticipantPageItem {
  id: string
  userId: number
  userName: string
  createdAt: string
  amount: number | null
}

export interface PostAuctionSummary {
  id: string
  mode: LocalPostAuctionMode
  modeLabel: string
  status: string
  statusLabel: string
  pricingRule: LocalPostAuctionPricingRule
  pricingRuleLabel: string
  startPrice: number
  incrementStep: number
  startsAt: string | null
  endsAt: string
  participantCount: number
  bidCount: number
  leaderBidAmount: number | null
  leaderUserId: number | null
  winnerUserId: number | null
  winnerUserName: string | null
  winnerAvatarPath: string | null
  winnerIsVip: boolean
  winnerVipLevel: number | null
  winningBidAmount: number | null
  finalPrice: number | null
  settledAt: string | null
  hasStarted: boolean
  hasEnded: boolean
  minNextBidAmount: number
  viewerIsSeller: boolean
  viewerHasJoined: boolean
  viewerBidAmount: number | null
  viewerFrozenAmount: number | null
  viewerStatus: string | null
  viewerIsLeader: boolean
  viewerCanBid: boolean
  viewerCanViewWinnerContent: boolean
  winnerOnlyContentPreview: string | null
  winnerOnlyContent: string | null
  participantPreviews: PostAuctionParticipantPreview[]
}

export interface PostAuctionBidRecordPage {
  items: PostAuctionVisibleBidRecord[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export interface PostAuctionParticipantPage {
  items: PostAuctionParticipantPageItem[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

function getUserDisplayName(user: { username: string; nickname?: string | null } | null | undefined) {
  if (!user) {
    return null
  }

  return user.nickname?.trim() || user.username
}

function getPostAuctionStatusLabel(status: string) {
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

async function runPostAuctionTransactionWithRetry<T>(execute: () => Promise<T>): Promise<T> {
  let retryCount = 0

  while (true) {
    try {
      return await execute()
    } catch (error) {
      if (!isRetryablePostAuctionTransactionError(error) || retryCount >= POST_AUCTION_TRANSACTION_MAX_RETRIES) {
        throw error
      }

      const delayMs = POST_AUCTION_TRANSACTION_RETRY_BASE_DELAY_MS * (2 ** retryCount)
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

function runSerializablePostAuctionTransaction<T>(
  callback: (tx: AuctionTx) => Promise<T>,
  options: { auctionId?: string; postId?: string },
) {
  return runPostAuctionTransactionWithRetry(() => prisma.$transaction(async (tx) => {
    if (options.auctionId) {
      await lockPostAuctionById(tx, options.auctionId)
    } else if (options.postId) {
      await lockPostAuctionByPostId(tx, options.postId)
    }

    return callback(tx)
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  }))
}

export function normalizePostAuctionConfig(
  input: {
    mode: LocalPostAuctionMode
    pricingRule: LocalPostAuctionPricingRule
    startPrice: number
    incrementStep: number
    startsAt: string | null
    endsAt: string
    winnerOnlyContent: string
    winnerOnlyContentPreview: string | null
  } | null | undefined,
) {
  if (!input) {
    return { success: false as const, message: "拍卖配置缺失" }
  }

  const startsAt = input.startsAt ? parseBusinessDateTime(input.startsAt) : null
  const endsAt = parseBusinessDateTime(input.endsAt)
  if (input.startsAt && !startsAt) {
    return { success: false as const, message: "拍卖开始时间格式不正确" }
  }

  if (!endsAt) {
    return { success: false as const, message: "拍卖结束时间格式不正确" }
  }

  if (startsAt && endsAt.getTime() <= startsAt.getTime()) {
    return { success: false as const, message: "结束时间必须晚于开始时间" }
  }

  if (endsAt.getTime() <= Date.now()) {
    return { success: false as const, message: "结束时间必须晚于当前时间" }
  }

  const startPrice = Math.max(1, Math.trunc(input.startPrice))
  const incrementStep = Math.max(1, Math.trunc(input.incrementStep))
  const winnerOnlyContent = input.winnerOnlyContent.trim()
  const winnerOnlyContentPreview = input.winnerOnlyContentPreview?.trim() || null

  if (!winnerOnlyContent) {
    return { success: false as const, message: "赢家专属内容不能为空" }
  }

  return {
    success: true as const,
    data: {
      mode: normalizePostAuctionMode(input.mode),
      pricingRule: normalizePostAuctionPricingRule(input.pricingRule),
      startPrice,
      incrementStep,
      startsAt,
      endsAt,
      winnerOnlyContent,
      winnerOnlyContentPreview,
    } satisfies NormalizedPostAuctionConfig,
  }
}

export function createPostAuctionRecord(
  tx: AuctionTx,
  params: {
    postId: string
    sellerId: number
    config: NormalizedPostAuctionConfig
    active: boolean
  },
) {
  return tx.postAuction.create({
    data: {
      postId: params.postId,
      sellerId: params.sellerId,
      mode: params.config.mode,
      pricingRule: params.config.pricingRule,
      startPrice: params.config.startPrice,
      incrementStep: params.config.incrementStep,
      startsAt: params.config.startsAt,
      endsAt: params.config.endsAt,
      winnerOnlyContent: params.config.winnerOnlyContent,
      winnerOnlyContentPreview: params.config.winnerOnlyContentPreview,
      status: params.active ? PostAuctionStatus.ACTIVE : PostAuctionStatus.DRAFT,
      activatedAt: params.active ? new Date() : null,
    },
    select: {
      id: true,
      endsAt: true,
      status: true,
    },
  })
}

export function enqueuePostAuctionSettlement(auctionId: string, endsAt: Date) {
  const delayMs = Math.max(0, endsAt.getTime() - Date.now())
  return enqueueBackgroundJob(POST_AUCTION_SETTLE_BACKGROUND_JOB_NAME, { auctionId }, { delayMs })
}

export async function activatePostAuctionForPost(postId: string) {
  const auction = await prisma.postAuction.findUnique({
    where: { postId },
    select: {
      id: true,
      status: true,
      endsAt: true,
    },
  })

  if (!auction || auction.status !== PostAuctionStatus.DRAFT) {
    return auction
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      status: true,
    },
  })

  if (!post || post.status !== "NORMAL") {
    return auction
  }

  const updated = await prisma.postAuction.update({
    where: { id: auction.id },
    data: {
      status: PostAuctionStatus.ACTIVE,
      activatedAt: new Date(),
    },
    select: {
      id: true,
      endsAt: true,
    },
  })

  await enqueuePostAuctionSettlement(updated.id, updated.endsAt)
  return updated
}

async function resolveSellerIncome(
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

async function refundAuctionPoints(
  tx: AuctionTx,
  input: {
    userId: number
    beforeBalance: number
    amount: number
    postId: string
    auctionId: string
    pointName: string
    scopeKey: "POST_AUCTION_OUTBID_REFUND" | "POST_AUCTION_LOSE_REFUND" | "POST_AUCTION_WIN_SETTLEMENT"
    eventType: "POST_AUCTION_OUTBID_REFUND" | "POST_AUCTION_LOSE_REFUND" | "POST_AUCTION_WIN_SETTLEMENT"
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

function resolvePostAuctionSettlementBatchSize() {
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

function resolvePostAuctionFinalPrice(input: {
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

function buildPostAuctionPendingSettlementWhere(
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

function enqueuePostAuctionSettlementContinuation(auctionId: string) {
  return enqueueBackgroundJob(POST_AUCTION_SETTLE_BACKGROUND_JOB_NAME, { auctionId })
}

async function initializePostAuctionSettlement(auctionId: string, options?: { force?: boolean }) {
  return runSerializablePostAuctionTransaction(async (tx) => {
    const auction = await tx.postAuction.findUnique({
      where: { id: auctionId },
      include: {
        post: {
          select: {
            id: true,
            slug: true,
            title: true,
          },
        },
        seller: {
          select: {
            id: true,
            username: true,
            nickname: true,
          },
        },
      },
    })

    if (!auction) {
      apiError(404, "拍卖不存在")
    }

    if (auction.status === PostAuctionStatus.SETTLED || auction.status === PostAuctionStatus.CANCELLED || auction.status === PostAuctionStatus.FAILED) {
      return {
        state: "finished" as const,
        postId: auction.post.id,
        postSlug: auction.post.slug,
      }
    }

    if (!options?.force && auction.endsAt.getTime() > Date.now()) {
      return {
        state: "waiting" as const,
        postId: auction.post.id,
        postSlug: auction.post.slug,
      }
    }

    if (
      auction.status === PostAuctionStatus.SETTLING
      && auction.winnerUserId !== null
      && auction.finalPrice !== null
      && auction.winningBidAmount !== null
    ) {
      return {
        state: "processing" as const,
        postId: auction.post.id,
        postSlug: auction.post.slug,
      }
    }

    const entries = await tx.postAuctionEntry.findMany({
      where: {
        auctionId: auction.id,
      },
      orderBy: [
        { currentBidAmount: "desc" },
        { firstBidAt: "asc" },
      ],
      select: {
        userId: true,
        currentBidAmount: true,
      },
    })

    if (entries.length === 0) {
      await tx.postAuction.update({
        where: { id: auction.id },
        data: {
          status: PostAuctionStatus.FAILED,
          settledAt: new Date(),
          winnerUserId: null,
          finalPrice: null,
          winningBidAmount: null,
          leaderUserId: null,
          leaderBidAmount: null,
        },
      })

      await tx.post.update({
        where: { id: auction.post.id },
        data: {
          activityAt: new Date(),
        },
      })

      return {
        state: "failed" as const,
        postId: auction.post.id,
        postSlug: auction.post.slug,
        postTitle: auction.post.title,
        sellerId: auction.seller.id,
      }
    }

    const winnerEntry = entries[0]
    const secondEntry = entries[1] ?? null
    const finalPrice = resolvePostAuctionFinalPrice({
      mode: auction.mode,
      pricingRule: auction.pricingRule,
      startPrice: auction.startPrice,
      winningBidAmount: winnerEntry.currentBidAmount,
      secondBidAmount: secondEntry?.currentBidAmount ?? null,
    })

    await tx.postAuction.update({
      where: { id: auction.id },
      data: {
        status: PostAuctionStatus.SETTLING,
        winnerUserId: winnerEntry.userId,
        winningBidAmount: winnerEntry.currentBidAmount,
        finalPrice,
        leaderUserId: winnerEntry.userId,
        leaderBidAmount: winnerEntry.currentBidAmount,
      },
    })

    return {
      state: "processing" as const,
      postId: auction.post.id,
      postSlug: auction.post.slug,
    }
  }, { auctionId })
}

async function processPostAuctionSettlementBatch(auctionId: string, pointName: string) {
  return runSerializablePostAuctionTransaction(async (tx) => {
    const auction = await tx.postAuction.findUnique({
      where: { id: auctionId },
      select: {
        id: true,
        postId: true,
        status: true,
        winnerUserId: true,
        finalPrice: true,
      },
    })

    if (!auction) {
      apiError(404, "拍卖不存在")
    }

    if (
      auction.status !== PostAuctionStatus.SETTLING
      || auction.winnerUserId === null
      || auction.finalPrice === null
    ) {
      return {
        remainingCount: 0,
      }
    }

    const pendingWhere = buildPostAuctionPendingSettlementWhere(
      auction.id,
      auction.winnerUserId,
      auction.finalPrice,
    )
    const batchRefundedAt = new Date()
    const entries = await tx.postAuctionEntry.findMany({
      where: pendingWhere,
      orderBy: [
        { firstBidAt: "asc" },
        { userId: "asc" },
      ],
      take: resolvePostAuctionSettlementBatchSize(),
      include: {
        user: {
          select: {
            id: true,
            points: true,
          },
        },
      },
    })

    for (const entry of entries) {
      if (entry.userId === auction.winnerUserId) {
        const refundAmount = Math.max(0, entry.frozenAmount - auction.finalPrice)
        if (refundAmount > 0) {
          await refundAuctionPoints(tx, {
            userId: entry.userId,
            beforeBalance: entry.user.points,
            amount: refundAmount,
            postId: auction.postId,
            auctionId: auction.id,
            pointName,
            scopeKey: "POST_AUCTION_WIN_SETTLEMENT",
            eventType: POINT_LOG_EVENT_TYPES.POST_AUCTION_WIN_SETTLEMENT,
            reason: "[拍卖] 赢家按成交价结算，退回差额",
          })
        }

        await tx.postAuctionEntry.update({
          where: {
            auctionId_userId: {
              auctionId: auction.id,
              userId: entry.userId,
            },
          },
          data: {
            frozenAmount: auction.finalPrice,
            refundedAt: refundAmount > 0 ? batchRefundedAt : entry.refundedAt,
          },
        })
        continue
      }

      if (entry.frozenAmount > 0) {
        await refundAuctionPoints(tx, {
          userId: entry.userId,
          beforeBalance: entry.user.points,
          amount: entry.frozenAmount,
          postId: auction.postId,
          auctionId: auction.id,
          pointName,
          scopeKey: "POST_AUCTION_LOSE_REFUND",
          eventType: POINT_LOG_EVENT_TYPES.POST_AUCTION_LOSE_REFUND,
          reason: "[拍卖] 未中标，退回冻结积分",
        })
      }

      await tx.postAuctionEntry.update({
        where: {
          auctionId_userId: {
            auctionId: auction.id,
            userId: entry.userId,
          },
        },
        data: {
          status: PostAuctionEntryStatus.LOST,
          frozenAmount: 0,
          refundedAt: entry.frozenAmount > 0 ? batchRefundedAt : entry.refundedAt,
        },
      })
    }

    const remainingCount = await tx.postAuctionEntry.count({
      where: pendingWhere,
    })

    return {
      remainingCount,
    }
  }, { auctionId })
}

async function finalizePostAuctionSettlement(auctionId: string, pointName: string) {
  return runSerializablePostAuctionTransaction(async (tx) => {
    const auction = await tx.postAuction.findUnique({
      where: { id: auctionId },
      include: {
        post: {
          select: {
            id: true,
            slug: true,
            title: true,
          },
        },
        seller: {
          select: {
            id: true,
            username: true,
            nickname: true,
            points: true,
          },
        },
      },
    })

    if (!auction) {
      apiError(404, "拍卖不存在")
    }

    if (auction.status === PostAuctionStatus.SETTLED || auction.status === PostAuctionStatus.CANCELLED || auction.status === PostAuctionStatus.FAILED) {
      return {
        settled: false as const,
        postId: auction.post.id,
        postSlug: auction.post.slug,
      }
    }

    if (
      auction.status !== PostAuctionStatus.SETTLING
      || auction.winnerUserId === null
      || auction.finalPrice === null
      || auction.winningBidAmount === null
    ) {
      return {
        settled: false as const,
        postId: auction.post.id,
        postSlug: auction.post.slug,
      }
    }

    const remainingCount = await tx.postAuctionEntry.count({
      where: buildPostAuctionPendingSettlementWhere(
        auction.id,
        auction.winnerUserId,
        auction.finalPrice,
      ),
    })

    if (remainingCount > 0) {
      return {
        settled: false as const,
        postId: auction.post.id,
        postSlug: auction.post.slug,
      }
    }

    const winnerEntry = await tx.postAuctionEntry.findUnique({
      where: {
        auctionId_userId: {
          auctionId: auction.id,
          userId: auction.winnerUserId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
          },
        },
      },
    })

    if (!winnerEntry) {
      apiError(409, "拍卖赢家记录不存在")
    }

    if (winnerEntry.frozenAmount !== auction.finalPrice) {
      apiError(409, "拍卖赢家冻结积分与成交价不一致")
    }

    await resolveSellerIncome(tx, {
      sellerId: auction.seller.id,
      beforeBalance: auction.seller.points,
      amount: auction.finalPrice,
      postId: auction.post.id,
      auctionId: auction.id,
      pointName,
    })

    await tx.postAuctionEntry.update({
      where: {
        auctionId_userId: {
          auctionId: auction.id,
          userId: winnerEntry.userId,
        },
      },
      data: {
        status: PostAuctionEntryStatus.WON,
        frozenAmount: 0,
      },
    })

    await tx.postAuction.update({
      where: { id: auction.id },
      data: {
        status: PostAuctionStatus.SETTLED,
        settledAt: new Date(),
        winnerUserId: winnerEntry.userId,
        winningBidAmount: auction.winningBidAmount,
        finalPrice: auction.finalPrice,
        leaderUserId: winnerEntry.userId,
        leaderBidAmount: auction.winningBidAmount,
      },
    })

    await tx.post.update({
      where: { id: auction.post.id },
      data: {
        activityAt: new Date(),
      },
    })

    return {
      settled: true as const,
      postId: auction.post.id,
      postSlug: auction.post.slug,
      postTitle: auction.post.title,
      sellerId: auction.seller.id,
      sellerName: getUserDisplayName(auction.seller) ?? "卖家",
      pointName,
      failed: false,
      winnerId: winnerEntry.userId,
      winnerName: getUserDisplayName(winnerEntry.user),
      finalPrice: auction.finalPrice,
    }
  }, { auctionId })
}

export async function settlePostAuctionByAuctionId(auctionId: string, options?: { force?: boolean }) {
  const settings = await getSiteSettings()
  const initialized = await initializePostAuctionSettlement(auctionId, options)

  if (initialized.state === "finished" || initialized.state === "waiting") {
    return {
      settled: false as const,
      postId: initialized.postId,
      postSlug: initialized.postSlug,
    }
  }

  if (initialized.state === "failed") {
    await createSystemNotification({
      userId: initialized.sellerId,
      relatedType: "POST",
      relatedId: initialized.postId,
      title: "拍卖已结束但无人出价",
      content: `你发起的帖子《${initialized.postTitle}》已结束，本次无人出价，系统已判定为流拍。`,
    })

    return {
      settled: true as const,
      postId: initialized.postId,
      postSlug: initialized.postSlug,
      postTitle: initialized.postTitle,
      sellerId: initialized.sellerId,
      sellerName: "卖家",
      pointName: settings.pointName,
      failed: true as const,
      winnerId: null,
      winnerName: null,
      finalPrice: null,
    }
  }

  const batchResult = await processPostAuctionSettlementBatch(auctionId, settings.pointName)
  if (batchResult.remainingCount > 0) {
    await enqueuePostAuctionSettlementContinuation(auctionId)

    return {
      settled: false as const,
      postId: initialized.postId,
      postSlug: initialized.postSlug,
    }
  }

  const result = await finalizePostAuctionSettlement(auctionId, settings.pointName)

  if (result.settled && result.failed) {
    await createSystemNotification({
      userId: result.sellerId,
      relatedType: "POST",
      relatedId: result.postId,
      title: "拍卖已结束但无人出价",
      content: `你发起的帖子《${result.postTitle}》已结束，本次无人出价，系统已判定为流拍。`,
    })
  }

  if (result.settled && !result.failed && result.winnerId) {
    await Promise.all([
      createSystemNotification({
        userId: result.winnerId,
        relatedType: "POST",
        relatedId: result.postId,
        title: "你已成功拍下帖子内容",
        content: `帖子《${result.postTitle}》已结算，成交价为 ${result.finalPrice} ${result.pointName}。你现在可以查看赢家专属内容。`,
      }),
      createSystemNotification({
        userId: result.sellerId,
        relatedType: "POST",
        relatedId: result.postId,
        title: "你的拍卖已成交",
        content: `帖子《${result.postTitle}》已完成结算，赢家为 ${result.winnerName ?? "匿名用户"}，成交价为 ${result.finalPrice} ${result.pointName}。`,
      }),
    ])
  }

  return result
}

export async function settlePostAuctionByPostId(postId: string, options?: { force?: boolean }) {
  const auction = await prisma.postAuction.findUnique({
    where: { postId },
    select: {
      id: true,
    },
  })

  if (!auction) {
    return null
  }

  return settlePostAuctionByAuctionId(auction.id, options)
}

async function readAuctionForSummary(postId: string) {
  return prisma.postAuction.findUnique({
    where: { postId },
    include: {
      winner: {
        select: {
          id: true,
          username: true,
          nickname: true,
          avatarPath: true,
          vipLevel: true,
          vipExpiresAt: true,
        },
      },
    },
  })
}

export async function getPostAuctionSummary(
  postId: string,
  currentUserId?: number,
  options?: {
    isAdmin?: boolean
  },
): Promise<PostAuctionSummary | null> {
  let auction = await readAuctionForSummary(postId)
  if (!auction) {
    return null
  }

  if (
    (auction.status === PostAuctionStatus.ACTIVE || auction.status === PostAuctionStatus.SETTLING)
    && auction.endsAt.getTime() <= Date.now()
  ) {
    await settlePostAuctionByAuctionId(auction.id)
    auction = await readAuctionForSummary(postId)
    if (!auction) {
      return null
    }
  }

  const [viewerEntry, participantEntries] = await Promise.all([
    currentUserId
      ? prisma.postAuctionEntry.findUnique({
          where: {
            auctionId_userId: {
              auctionId: auction.id,
              userId: currentUserId,
            },
          },
        })
      : Promise.resolve(null),
    prisma.postAuctionEntry.findMany({
      where: {
        auctionId: auction.id,
      },
      orderBy: {
        lastBidAt: "desc",
      },
      take: 10,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            avatarPath: true,
            vipLevel: true,
            vipExpiresAt: true,
          },
        },
      },
    }),
  ])

  const now = new Date()
  const resultVisible = auction.status === PostAuctionStatus.SETTLED || auction.status === PostAuctionStatus.SETTLING
  const hasStarted = !auction.startsAt || now.getTime() >= auction.startsAt.getTime()
  const hasEnded = auction.status === PostAuctionStatus.SETTLED
    || auction.status === PostAuctionStatus.SETTLING
    || auction.status === PostAuctionStatus.CANCELLED
    || auction.status === PostAuctionStatus.FAILED
    || now.getTime() >= auction.endsAt.getTime()
  const isSeller = Boolean(currentUserId && currentUserId === auction.sellerId)
  const viewerCanViewWinnerContent = Boolean(
    options?.isAdmin
    || isSeller
    || (auction.status === PostAuctionStatus.SETTLED && currentUserId && currentUserId === auction.winnerUserId),
  )

  const participantPreviews = participantEntries.map((entry) => ({
    userId: entry.userId,
    userName: getUserDisplayName(entry.user) ?? "匿名用户",
    avatarPath: entry.user.avatarPath ?? null,
    isVip: Boolean(entry.user.vipExpiresAt && entry.user.vipExpiresAt.getTime() > Date.now()),
    vipLevel: entry.user.vipLevel ?? null,
    amount: auction.mode === PostAuctionMode.OPEN_ASCENDING ? entry.currentBidAmount : null,
    isLeader: Boolean(auction.mode === PostAuctionMode.OPEN_ASCENDING && auction.leaderUserId === entry.userId),
  }))

  return {
    id: auction.id,
    mode: auction.mode,
    modeLabel: getPostAuctionModeLabel(auction.mode),
    status: auction.status,
    statusLabel: getPostAuctionStatusLabel(auction.status),
    pricingRule: auction.pricingRule,
    pricingRuleLabel: getPostAuctionPricingRuleLabel(auction.pricingRule),
    startPrice: auction.startPrice,
    incrementStep: auction.incrementStep,
    startsAt: auction.startsAt?.toISOString() ?? null,
    endsAt: auction.endsAt.toISOString(),
    participantCount: auction.participantCount,
    bidCount: auction.bidCount,
    leaderBidAmount: auction.mode === PostAuctionMode.OPEN_ASCENDING || resultVisible
      ? auction.leaderBidAmount
      : null,
    leaderUserId: auction.mode === PostAuctionMode.OPEN_ASCENDING || resultVisible
      ? auction.leaderUserId ?? null
      : null,
    winnerUserId: resultVisible ? auction.winnerUserId ?? null : null,
    winnerUserName: resultVisible ? getUserDisplayName(auction.winner) : null,
    winnerAvatarPath: resultVisible ? auction.winner?.avatarPath ?? null : null,
    winnerIsVip: resultVisible ? Boolean(auction.winner?.vipExpiresAt && auction.winner.vipExpiresAt.getTime() > Date.now()) : false,
    winnerVipLevel: resultVisible ? auction.winner?.vipLevel ?? null : null,
    winningBidAmount: resultVisible ? auction.winningBidAmount ?? null : null,
    finalPrice: resultVisible ? auction.finalPrice ?? null : null,
    settledAt: auction.settledAt?.toISOString() ?? null,
    hasStarted,
    hasEnded,
    minNextBidAmount: auction.leaderBidAmount
      ? auction.leaderBidAmount + Math.max(1, auction.incrementStep)
      : auction.startPrice,
    viewerIsSeller: isSeller,
    viewerHasJoined: Boolean(viewerEntry),
    viewerBidAmount: viewerEntry?.currentBidAmount ?? null,
    viewerFrozenAmount: viewerEntry?.frozenAmount ?? null,
    viewerStatus: viewerEntry?.status ?? null,
    viewerIsLeader: Boolean(currentUserId && auction.leaderUserId === currentUserId),
    viewerCanBid: Boolean(
      currentUserId
      && !isSeller
      && auction.status === PostAuctionStatus.ACTIVE
      && hasStarted
      && !hasEnded
      && (auction.mode === PostAuctionMode.OPEN_ASCENDING || !viewerEntry),
    ),
    viewerCanViewWinnerContent,
    winnerOnlyContentPreview: auction.winnerOnlyContentPreview ?? null,
    winnerOnlyContent: viewerCanViewWinnerContent ? (auction.winnerOnlyContent ?? null) : null,
    participantPreviews,
  }
}

export async function placePostAuctionBid(input: {
  postId: string
  userId: number
  amount: number
}) {
  const initialAuction = await prisma.postAuction.findUnique({
    where: { postId: input.postId },
    select: {
      id: true,
      endsAt: true,
      status: true,
    },
  })

  if (!initialAuction) {
    apiError(404, "拍卖不存在")
  }

  if (initialAuction.status === PostAuctionStatus.SETTLED || initialAuction.status === PostAuctionStatus.CANCELLED || initialAuction.status === PostAuctionStatus.FAILED) {
    apiError(409, "当前拍卖已结束")
  }

  if (initialAuction.endsAt.getTime() <= Date.now()) {
    await settlePostAuctionByAuctionId(initialAuction.id)
    apiError(409, "当前拍卖已结束")
  }

  const settings = await getSiteSettings()
  const normalizedAmount = Math.max(1, Math.trunc(input.amount))

  return runSerializablePostAuctionTransaction(async (tx) => {
    const [auction, bidder] = await Promise.all([
      tx.postAuction.findUnique({
        where: { postId: input.postId },
        include: {
          post: {
            select: {
              id: true,
              slug: true,
              title: true,
              type: true,
              status: true,
            },
          },
        },
      }),
      tx.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          points: true,
        },
      }),
    ])

    if (!auction || auction.post.type !== "AUCTION") {
      apiError(404, "拍卖不存在")
    }

    if (!bidder) {
      apiError(404, "用户不存在")
    }

    if (auction.post.status !== "NORMAL") {
      apiError(409, "当前拍卖帖不可参与")
    }

    if (auction.sellerId === input.userId) {
      apiError(400, "不能参与自己发起的拍卖")
    }

    if (auction.status === PostAuctionStatus.DRAFT) {
      await tx.postAuction.update({
        where: { id: auction.id },
        data: {
          status: PostAuctionStatus.ACTIVE,
          activatedAt: new Date(),
        },
      })
      auction.status = PostAuctionStatus.ACTIVE
    }

    if (auction.status !== PostAuctionStatus.ACTIVE) {
      apiError(409, "当前拍卖不可参与")
    }

    if (auction.startsAt && auction.startsAt.getTime() > Date.now()) {
      apiError(409, "拍卖尚未开始")
    }

    if (auction.endsAt.getTime() <= Date.now()) {
      apiError(409, "当前拍卖已结束")
    }

    const existingEntry = await tx.postAuctionEntry.findUnique({
      where: {
        auctionId_userId: {
          auctionId: auction.id,
          userId: input.userId,
        },
      },
    })

    if (auction.mode === PostAuctionMode.SEALED_BID) {
      if (existingEntry) {
        apiError(409, "密封竞拍每人只能出价一次")
      }

      if (normalizedAmount < auction.startPrice) {
        apiError(400, `出价不能低于起拍价 ${auction.startPrice} ${settings.pointName}`)
      }

      const preparedBidFreeze = await prepareScopedPointDelta({
        scopeKey: "POST_AUCTION_BID_FREEZE",
        baseDelta: -normalizedAmount,
        userId: bidder.id,
      })

      await applyPointDelta({
        tx,
        userId: bidder.id,
        beforeBalance: bidder.points,
        prepared: preparedBidFreeze,
        pointName: settings.pointName,
        insufficientMessage: `${settings.pointName}不足，无法完成本次出价`,
        reason: "[拍卖] 密封竞拍冻结出价积分",
        eventType: POINT_LOG_EVENT_TYPES.POST_AUCTION_BID_FREEZE,
        eventData: {
          postId: auction.post.id,
          auctionId: auction.id,
          amount: normalizedAmount,
          mode: auction.mode,
        },
        relatedType: "POST",
        relatedId: auction.post.id,
      })

      await tx.postAuctionEntry.create({
        data: {
          auctionId: auction.id,
          userId: bidder.id,
          currentBidAmount: normalizedAmount,
          frozenAmount: normalizedAmount,
        },
      })

      await tx.postAuctionBidRecord.create({
        data: {
          auctionId: auction.id,
          userId: bidder.id,
          amount: normalizedAmount,
        },
      })

      const shouldLead = auction.leaderBidAmount === null || normalizedAmount > auction.leaderBidAmount

      await tx.postAuction.update({
        where: { id: auction.id },
        data: {
          participantCount: { increment: 1 },
          bidCount: { increment: 1 },
          ...(shouldLead
            ? {
                leaderUserId: bidder.id,
                leaderBidAmount: normalizedAmount,
              }
            : {}),
        },
      })

      return {
        postSlug: auction.post.slug,
        changedUserIds: [bidder.id],
      }
    }

    const minimumAmount = auction.leaderBidAmount
      ? auction.leaderBidAmount + Math.max(1, auction.incrementStep)
      : auction.startPrice

    if (normalizedAmount < minimumAmount) {
      apiError(400, `当前最低出价为 ${minimumAmount} ${settings.pointName}`)
    }

    if (auction.leaderUserId === input.userId) {
      const previousFrozenAmount = existingEntry?.frozenAmount ?? 0
      const additionalFreezeAmount = normalizedAmount - previousFrozenAmount

      if (additionalFreezeAmount <= 0) {
        apiError(409, "新出价必须高于你当前的领先出价")
      }

      const preparedBidFreeze = await prepareScopedPointDelta({
        scopeKey: "POST_AUCTION_BID_FREEZE",
        baseDelta: -additionalFreezeAmount,
        userId: bidder.id,
      })

      await applyPointDelta({
        tx,
        userId: bidder.id,
        beforeBalance: bidder.points,
        prepared: preparedBidFreeze,
        pointName: settings.pointName,
        insufficientMessage: `${settings.pointName}不足，无法继续加价`,
        reason: "[拍卖] 公开拍卖继续加价",
        eventType: POINT_LOG_EVENT_TYPES.POST_AUCTION_BID_FREEZE,
        eventData: {
          postId: auction.post.id,
          auctionId: auction.id,
          amount: normalizedAmount,
          delta: additionalFreezeAmount,
          mode: auction.mode,
        },
        relatedType: "POST",
        relatedId: auction.post.id,
      })

      await tx.postAuctionEntry.upsert({
        where: {
          auctionId_userId: {
            auctionId: auction.id,
            userId: bidder.id,
          },
        },
        update: {
          currentBidAmount: normalizedAmount,
          frozenAmount: normalizedAmount,
          status: PostAuctionEntryStatus.ACTIVE,
          refundedAt: null,
          lastBidAt: new Date(),
        },
        create: {
          auctionId: auction.id,
          userId: bidder.id,
          currentBidAmount: normalizedAmount,
          frozenAmount: normalizedAmount,
          status: PostAuctionEntryStatus.ACTIVE,
        },
      })
    } else {
      const preparedBidFreeze = await prepareScopedPointDelta({
        scopeKey: "POST_AUCTION_BID_FREEZE",
        baseDelta: -normalizedAmount,
        userId: bidder.id,
      })

      await applyPointDelta({
        tx,
        userId: bidder.id,
        beforeBalance: bidder.points,
        prepared: preparedBidFreeze,
        pointName: settings.pointName,
        insufficientMessage: `${settings.pointName}不足，无法完成本次出价`,
        reason: "[拍卖] 公开拍卖冻结出价积分",
        eventType: POINT_LOG_EVENT_TYPES.POST_AUCTION_BID_FREEZE,
        eventData: {
          postId: auction.post.id,
          auctionId: auction.id,
          amount: normalizedAmount,
          mode: auction.mode,
        },
        relatedType: "POST",
        relatedId: auction.post.id,
      })

      if (auction.leaderUserId) {
        const previousLeaderEntry = await tx.postAuctionEntry.findUnique({
          where: {
            auctionId_userId: {
              auctionId: auction.id,
              userId: auction.leaderUserId,
            },
          },
          include: {
            user: {
              select: {
                id: true,
                points: true,
              },
            },
          },
        })

        if (previousLeaderEntry && previousLeaderEntry.frozenAmount > 0) {
          await refundAuctionPoints(tx, {
            userId: previousLeaderEntry.userId,
            beforeBalance: previousLeaderEntry.user.points,
            amount: previousLeaderEntry.frozenAmount,
            postId: auction.post.id,
            auctionId: auction.id,
            pointName: settings.pointName,
            scopeKey: "POST_AUCTION_OUTBID_REFUND",
            eventType: POINT_LOG_EVENT_TYPES.POST_AUCTION_OUTBID_REFUND,
            reason: "[拍卖] 当前领先已被超越，退回冻结积分",
          })

          await tx.postAuctionEntry.update({
            where: {
              auctionId_userId: {
                auctionId: auction.id,
                userId: previousLeaderEntry.userId,
              },
            },
            data: {
              frozenAmount: 0,
              status: PostAuctionEntryStatus.OUTBID,
              refundedAt: new Date(),
            },
          })
        }
      }

      await tx.postAuctionEntry.upsert({
        where: {
          auctionId_userId: {
            auctionId: auction.id,
            userId: bidder.id,
          },
        },
        update: {
          currentBidAmount: normalizedAmount,
          frozenAmount: normalizedAmount,
          status: PostAuctionEntryStatus.ACTIVE,
          refundedAt: null,
          lastBidAt: new Date(),
        },
        create: {
          auctionId: auction.id,
          userId: bidder.id,
          currentBidAmount: normalizedAmount,
          frozenAmount: normalizedAmount,
          status: PostAuctionEntryStatus.ACTIVE,
        },
      })
    }

    await tx.postAuctionBidRecord.create({
      data: {
        auctionId: auction.id,
        userId: bidder.id,
        amount: normalizedAmount,
      },
    })

    await tx.postAuction.update({
      where: { id: auction.id },
      data: {
        participantCount: existingEntry ? undefined : { increment: 1 },
        bidCount: { increment: 1 },
        leaderUserId: bidder.id,
        leaderBidAmount: normalizedAmount,
      },
    })

    const changedUserIds = new Set<number>([bidder.id])
    if (auction.leaderUserId && auction.leaderUserId !== bidder.id) {
      changedUserIds.add(auction.leaderUserId)
    }

    return {
      postSlug: auction.post.slug,
      changedUserIds: Array.from(changedUserIds),
    }
  }, { postId: input.postId })
}

registerBackgroundJobHandler(POST_AUCTION_SETTLE_BACKGROUND_JOB_NAME, async (payload) => {
  await settlePostAuctionByAuctionId(payload.auctionId)
})

export async function getPostAuctionBidRecordPage(
  postId: string,
  options?: {
    page?: number
    pageSize?: number
  },
): Promise<PostAuctionBidRecordPage | null> {
  const auction = await prisma.postAuction.findUnique({
    where: { postId },
    include: {
      post: {
        select: {
          status: true,
        },
      },
    },
  })

  if (!auction || auction.mode !== PostAuctionMode.OPEN_ASCENDING || auction.post.status !== "NORMAL") {
    return null
  }

  const pageSize = Math.min(20, Math.max(1, Math.trunc(options?.pageSize ?? 10)))
  const page = Math.max(1, Math.trunc(options?.page ?? 1))
  const total = await prisma.postAuctionBidRecord.count({
    where: {
      auctionId: auction.id,
    },
  })
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount)

  const records = await prisma.postAuctionBidRecord.findMany({
    where: {
      auctionId: auction.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: (safePage - 1) * pageSize,
    take: pageSize,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          nickname: true,
        },
      },
    },
  })

  return {
    items: records.map((record) => ({
      id: record.id,
      userId: record.userId,
      userName: getUserDisplayName(record.user) ?? "匿名用户",
      amount: record.amount,
      createdAt: record.createdAt.toISOString(),
    })),
    total,
    page: safePage,
    pageSize,
    pageCount,
  }
}

export async function getPostAuctionParticipantPage(
  postId: string,
  options?: {
    page?: number
    pageSize?: number
  },
): Promise<PostAuctionParticipantPage | null> {
  const auction = await prisma.postAuction.findUnique({
    where: { postId },
    include: {
      post: {
        select: {
          status: true,
        },
      },
    },
  })

  if (!auction || auction.post.status !== "NORMAL") {
    return null
  }

  const pageSize = Math.min(20, Math.max(1, Math.trunc(options?.pageSize ?? 10)))
  const page = Math.max(1, Math.trunc(options?.page ?? 1))
  const total = await prisma.postAuctionEntry.count({
    where: {
      auctionId: auction.id,
    },
  })
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount)

  const entries = await prisma.postAuctionEntry.findMany({
    where: {
      auctionId: auction.id,
    },
    orderBy: {
      lastBidAt: "desc",
    },
    skip: (safePage - 1) * pageSize,
    take: pageSize,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          nickname: true,
        },
      },
    },
  })

  return {
    items: entries.map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      userName: getUserDisplayName(entry.user) ?? "匿名用户",
      createdAt: (auction.mode === PostAuctionMode.OPEN_ASCENDING ? entry.lastBidAt : entry.firstBidAt).toISOString(),
      amount: auction.mode === PostAuctionMode.OPEN_ASCENDING ? entry.currentBidAmount : null,
    })),
    total,
    page: safePage,
    pageSize,
    pageCount,
  }
}
