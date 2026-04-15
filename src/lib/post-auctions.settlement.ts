import { prisma } from "@/db/client"
import {
  PostAuctionEntryStatus,
  PostAuctionStatus,
} from "@/db/types"
import { apiError } from "@/lib/api-route"
import { registerBackgroundJobHandler } from "@/lib/background-jobs"
import { getSiteSettings } from "@/lib/site-settings"
import { logError, logInfo } from "@/lib/logger"
import {
  buildPostAuctionPendingSettlementWhere,
  enqueuePostAuctionSettlementContinuation,
  getUserDisplayName,
  notifyPostAuctionFailed,
  notifyPostAuctionSettled,
  POST_AUCTION_SETTLE_BACKGROUND_JOB_NAME,
  refundAuctionPoints,
  resolvePostAuctionFinalPrice,
  resolvePostAuctionSettlementBatchSize,
  resolvePostAuctionSettlementRecoveryBatchSize,
  resolvePostAuctionSettlementRecoveryIntervalMs,
  resolveSellerIncome,
  runSerializablePostAuctionTransaction,
  sleepWithAbort,
} from "@/lib/post-auctions.core"

async function initializePostAuctionSettlement(
  auctionId: string,
  options?: { force?: boolean },
) {
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

    if (
      auction.status === PostAuctionStatus.SETTLED
      || auction.status === PostAuctionStatus.CANCELLED
      || auction.status === PostAuctionStatus.FAILED
    ) {
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
      orderBy: [{ currentBidAmount: "desc" }, { firstBidAt: "asc" }],
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

async function processPostAuctionSettlementBatch(
  auctionId: string,
  pointName: string,
) {
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
      orderBy: [{ firstBidAt: "asc" }, { userId: "asc" }],
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
            eventType: "POST_AUCTION_WIN_SETTLEMENT",
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
          eventType: "POST_AUCTION_LOSE_REFUND",
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

    if (
      auction.status === PostAuctionStatus.SETTLED
      || auction.status === PostAuctionStatus.CANCELLED
      || auction.status === PostAuctionStatus.FAILED
    ) {
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

export async function settlePostAuctionByAuctionId(
  auctionId: string,
  options?: { force?: boolean },
) {
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
    await notifyPostAuctionFailed({
      sellerId: initialized.sellerId,
      postId: initialized.postId,
      postTitle: initialized.postTitle,
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

  const batchResult = await processPostAuctionSettlementBatch(
    auctionId,
    settings.pointName,
  )
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
    await notifyPostAuctionFailed({
      sellerId: result.sellerId,
      postId: result.postId,
      postTitle: result.postTitle,
    })
  }

  if (result.settled && !result.failed && result.winnerId) {
    await notifyPostAuctionSettled({
      winnerId: result.winnerId,
      sellerId: result.sellerId,
      postId: result.postId,
      postTitle: result.postTitle,
      winnerName: result.winnerName ?? null,
      finalPrice: result.finalPrice,
      pointName: result.pointName,
    })
  }

  return result
}

export async function settlePostAuctionByPostId(
  postId: string,
  options?: { force?: boolean },
) {
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

async function findOverduePostAuctionIds(limit: number) {
  const rows = await prisma.postAuction.findMany({
    where: {
      status: {
        in: [PostAuctionStatus.ACTIVE, PostAuctionStatus.SETTLING],
      },
      endsAt: {
        lte: new Date(),
      },
    },
    orderBy: [{ endsAt: "asc" }, { id: "asc" }],
    take: limit,
    select: {
      id: true,
    },
  })

  return rows.map((row) => row.id)
}

export async function runPostAuctionSettlementRecoveryCycle(options?: {
  signal?: AbortSignal
}) {
  const batchSize = resolvePostAuctionSettlementRecoveryBatchSize()
  let scannedCount = 0
  let attemptedCount = 0
  let settledCount = 0
  let failedCount = 0

  while (!options?.signal?.aborted) {
    const overdueAuctionIds = await findOverduePostAuctionIds(batchSize)
    if (overdueAuctionIds.length === 0) {
      break
    }

    scannedCount += overdueAuctionIds.length

    for (const auctionId of overdueAuctionIds) {
      if (options?.signal?.aborted) {
        break
      }

      attemptedCount += 1

      try {
        const result = await settlePostAuctionByAuctionId(auctionId)
        if (result?.settled) {
          settledCount += 1
        }
      } catch (error) {
        failedCount += 1
        logError({
          scope: "post-auction",
          action: "recovery-cycle",
          targetId: auctionId,
        }, error)
      }
    }

    if (overdueAuctionIds.length < batchSize) {
      break
    }
  }

  return {
    scannedCount,
    attemptedCount,
    settledCount,
    failedCount,
  }
}

export async function startPostAuctionSettlementRecoveryLoop(options?: {
  signal?: AbortSignal
}) {
  const intervalMs = resolvePostAuctionSettlementRecoveryIntervalMs()

  while (!options?.signal?.aborted) {
    try {
      const cycle = await runPostAuctionSettlementRecoveryCycle(options)

      if (cycle.scannedCount > 0) {
        logInfo({
          scope: "post-auction",
          action: "recovery-loop",
          metadata: cycle,
        })
      }
    } catch (error) {
      logError({
        scope: "post-auction",
        action: "recovery-loop",
      }, error)
    }

    await sleepWithAbort(intervalMs, options?.signal)
  }
}

registerBackgroundJobHandler(
  POST_AUCTION_SETTLE_BACKGROUND_JOB_NAME,
  async (payload) => {
    await settlePostAuctionByAuctionId(payload.auctionId)
  },
)
