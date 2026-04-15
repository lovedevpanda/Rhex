import { type Prisma } from "@prisma/client"

import { countPostGiftEventsBySender, createPostGiftEvent, listPostGiftStats, listPostGiftSupportAggregates, listRecentPostGiftEvents, type PostGiftRecentEventItem, type PostGiftStatItem } from "@/db/post-gift-queries"
import {
  countPostTipEventsBySender,
  createPostTipRecord,
  findPostTipRecipient,
  findPostTipSender,
  findPostTipSummarySnapshot,
  findPostTipSupportPost,
  findPostTipSupportersByIds,
  findPostTipUserPoints,
  incrementPostTipTotals,
  listPostTipSupportAggregates,
  type PostTipSupportPostRecord,
  type PostTipSupportSenderRecord,
  runPostTipTransaction,
} from "@/db/post-tip-queries"
import { incrementBoardTreasuryPoints } from "@/db/board-treasury-queries"
import { buildPreparedPointDeltaFromFinalInteger, splitBoardTreasuryTaxFromGross } from "@/lib/board-treasury"
import { POINT_LOG_EVENT_TYPES } from "@/lib/point-log-events"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { getBusinessDayRange } from "@/lib/formatters"
import { createSystemNotification } from "@/lib/notification-writes"
import { PublicRouteError } from "@/lib/public-route-error"
import { getSiteSettings, type SiteTippingGiftItem } from "@/lib/site-settings"

export interface PostTipLeaderboardItem {
  userId: number
  username: string
  nickname: string | null
  avatarPath: string | null
  totalAmount: number
}

export interface PostTipSummary {
  enabled: boolean
  isLoggedIn: boolean
  pointName: string
  currentUserPoints: number
  gifts: SiteTippingGiftItem[]
  giftStats: PostGiftStatItem[]
  recentGiftEvents: PostGiftRecentEventItem[]
  allowedAmounts: number[]
  dailyLimit: number
  perPostLimit: number
  usedDailyCount: number
  usedPostCount: number
  tipCount: number
  tipTotalPoints: number
  topSupporters: PostTipLeaderboardItem[]
}

interface PostSupportUsageCounts {
  dailyCount: number
  postCount: number
}

type PostSupportTx = Prisma.TransactionClient

function buildTipReason(postId: string, amount: number, pointName: string, gift?: SiteTippingGiftItem | null) {
  if (gift) {
    return `赠送礼物（${gift.name} / ${amount}${pointName}）`
  }

  return `打赏帖子（${amount}${pointName}）`
}

function getTodayRange() {
  return getBusinessDayRange()
}

function postTipError(statusCode: number, message: string): never {
  throw new PublicRouteError(message, statusCode)
}

async function getSupportUsageCounts(params: {
  tx: PostSupportTx
  senderId: number
  postId: string
  start: Date
  end: Date
}): Promise<PostSupportUsageCounts> {
  const [rawDailyCount, rawPostCount, giftDailyCount, giftPostCount] = await Promise.all([
    countPostTipEventsBySender({
      client: params.tx,
      senderId: params.senderId,
      start: params.start,
      end: params.end,
    }),
    countPostTipEventsBySender({
      client: params.tx,
      senderId: params.senderId,
      postId: params.postId,
    }),
    countPostGiftEventsBySender({
      client: params.tx,
      senderId: params.senderId,
      start: params.start,
      end: params.end,
    }),
    countPostGiftEventsBySender({
      client: params.tx,
      senderId: params.senderId,
      postId: params.postId,
    }),
  ])

  return {
    dailyCount: rawDailyCount + giftDailyCount,
    postCount: rawPostCount + giftPostCount,
  }
}

function validateSupportContext(params: {
  post: PostTipSupportPostRecord | null
  sender: PostTipSupportSenderRecord | null
  senderId: number
  amount: number
  pointName: string
}) {
  const { post, sender, senderId, amount, pointName } = params

  if (!post || post.status !== "NORMAL") {
    postTipError(404, "帖子不存在或暂不可打赏")
  }

  if (!sender) {
    postTipError(404, "用户不存在")
  }

  if (post.authorId === senderId) {
    postTipError(400, "不能给自己的帖子打赏")
  }

  if (sender.status === "MUTED" || sender.status === "BANNED") {
    postTipError(403, "当前账号状态不可进行打赏")
  }

  if (sender.points < amount) {
    postTipError(400, `${pointName}不足，无法完成打赏`)
  }
}

async function createPostSupportBaseTransaction(params: {
  postId: string
  senderId: number
  amount: number
  pointName: string
  tipGiftTaxEnabled: boolean
  tipGiftTaxRateBps: number
  dailyLimit: number
  perPostLimit: number
  gift?: SiteTippingGiftItem | null
  onPersist: (context: {
    tx: PostSupportTx
    post: PostTipSupportPostRecord
    sender: PostTipSupportSenderRecord
  }) => Promise<void>
}) {
  const { start, end } = getTodayRange()
  const senderPreparedDelta = await prepareScopedPointDelta({
    scopeKey: params.gift ? "GIFT_OUTGOING" : "TIP_OUTGOING",
    baseDelta: -params.amount,
    userId: params.senderId,
  })

  return runPostTipTransaction(async (tx) => {
    const [postRecord, senderRecord] = await Promise.all([
      findPostTipSupportPost(params.postId, tx),
      findPostTipSender(params.senderId, tx),
    ])

    validateSupportContext({
      post: postRecord,
      sender: senderRecord,
      senderId: params.senderId,
      amount: Math.max(params.amount, Math.abs(senderPreparedDelta.finalDelta)),
      pointName: params.pointName,
    })

    const post = postRecord as PostTipSupportPostRecord
    const sender = senderRecord as PostTipSupportSenderRecord
    const usageCounts = await getSupportUsageCounts({
      tx,
      senderId: sender.id,
      postId: post.id,
      start,
      end,
    })

    if (usageCounts.dailyCount >= params.dailyLimit) {
      postTipError(400, `今日打赏次数已达上限（${params.dailyLimit} 次）`)
    }

    if (usageCounts.postCount >= params.perPostLimit) {
      postTipError(400, `该帖子打赏次数已达上限（${params.perPostLimit} 次）`)
    }

    const recipient = await findPostTipRecipient(post.authorId, tx)

    if (!recipient) {
      postTipError(404, "帖子作者不存在")
    }

    const recipientPreparedDelta = await prepareScopedPointDelta({
      scopeKey: params.gift ? "GIFT_INCOMING" : "TIP_INCOMING",
      baseDelta: params.amount,
      userId: post.authorId,
    })
    const taxSplit = params.tipGiftTaxEnabled
      ? splitBoardTreasuryTaxFromGross(recipientPreparedDelta.finalDelta, params.tipGiftTaxRateBps)
      : {
          gross: recipientPreparedDelta.finalDelta,
          net: recipientPreparedDelta.finalDelta,
          tax: 0,
        }
    const recipientAppliedPreparedDelta = taxSplit.tax > 0
      ? buildPreparedPointDeltaFromFinalInteger(recipientPreparedDelta, taxSplit.net)
      : recipientPreparedDelta
    const recipientBaseReason = params.gift
      ? `帖子收到礼物 ${params.gift.name}`
      : "帖子被打赏"

    await incrementPostTipTotals(tx, {
      postId: post.id,
      amount: params.amount,
    })

    await params.onPersist({
      tx,
      post,
      sender,
    })

    await applyPointDelta({
      tx,
      userId: sender.id,
      beforeBalance: sender.points,
      prepared: senderPreparedDelta,
      pointName: params.pointName,
      insufficientMessage: `${params.pointName}不足，无法完成打赏`,
      reason: buildTipReason(post.id, params.amount, params.pointName, params.gift),
      eventType: params.gift ? POINT_LOG_EVENT_TYPES.POST_GIFT_SENT : POINT_LOG_EVENT_TYPES.POST_TIP_SENT,
      eventData: {
        postId: post.id,
        boardId: post.boardId,
        senderId: sender.id,
        recipientId: post.authorId,
        configuredAmount: params.amount,
        appliedFinalDelta: senderPreparedDelta.finalDelta,
        gift: params.gift
          ? {
              id: params.gift.id,
              name: params.gift.name,
              price: params.gift.price,
            }
          : null,
      },
      relatedType: "POST",
      relatedId: post.id,
    })

    await applyPointDelta({
      tx,
      userId: post.authorId,
      beforeBalance: recipient.points,
      prepared: recipientAppliedPreparedDelta,
      pointName: params.pointName,
      reason: recipientBaseReason,
      eventType: params.gift ? POINT_LOG_EVENT_TYPES.POST_GIFT_RECEIVED : POINT_LOG_EVENT_TYPES.POST_TIP_RECEIVED,
      eventData: {
        postId: post.id,
        boardId: post.boardId,
        senderId: sender.id,
        recipientId: post.authorId,
        configuredAmount: params.amount,
        grossFinalDelta: recipientPreparedDelta.finalDelta,
        netFinalDelta: recipientAppliedPreparedDelta.finalDelta,
        taxAmount: taxSplit.tax,
        gift: params.gift
          ? {
              id: params.gift.id,
              name: params.gift.name,
              price: params.gift.price,
            }
          : null,
      },
      taxAmount: taxSplit.tax,
      effectPrepared: recipientPreparedDelta,
      relatedType: "POST",
      relatedId: post.id,
    })

    if (taxSplit.tax > 0 && post.boardId) {
      await incrementBoardTreasuryPoints(tx, post.boardId, taxSplit.tax)
    }

    await createSystemNotification({
      client: tx,
      userId: post.authorId,
      senderId: sender.id,
      relatedType: "POST",
      relatedId: post.id,
      title: "你的帖子收到了打赏",
      content: params.gift
        ? `${sender.username} 送出了 ${params.gift.name} 给你的帖子《${post.title}》，你已收到 ${Math.abs(recipientAppliedPreparedDelta.finalDelta)} ${params.pointName}。`
        : `${sender.username} 打赏了你的帖子《${post.title}》，你已收到 ${Math.abs(recipientAppliedPreparedDelta.finalDelta)} ${params.pointName}。`,
    })

    return {
      pointName: params.pointName,
      amount: params.amount,
      gift: params.gift ?? null,
      recipientUserId: post.authorId,
    }
  })
}

export async function getPostTipSummary(postId: string, currentUserId?: number): Promise<PostTipSummary> {
  const settings = await getSiteSettings()
  const { start, end } = getTodayRange()

  const [postTotals, rawLeaderboardRows, giftLeaderboardRows, currentUser, rawDailyCount, rawPostCount, giftDailyCount, giftPostCount, giftStats, recentGiftEvents] = await Promise.all([
    findPostTipSummarySnapshot(postId),
    listPostTipSupportAggregates(postId, 20),
    listPostGiftSupportAggregates(postId, 20),
    currentUserId
      ? findPostTipUserPoints(currentUserId)
      : Promise.resolve(null),
    currentUserId
      ? countPostTipEventsBySender({
          senderId: currentUserId,
          start,
          end,
        })
      : Promise.resolve(0),
    currentUserId
      ? countPostTipEventsBySender({
          senderId: currentUserId,
          postId,
        })
      : Promise.resolve(0),
    currentUserId
      ? countPostGiftEventsBySender({
          senderId: currentUserId,
          start,
          end,
        })
      : Promise.resolve(0),
    currentUserId
      ? countPostGiftEventsBySender({
          senderId: currentUserId,
          postId,
        })
      : Promise.resolve(0),
    listPostGiftStats(postId),
    listRecentPostGiftEvents(postId),
  ])

  const supporterTotals = new Map<number, number>()

  for (const row of rawLeaderboardRows) {
    supporterTotals.set(row.senderId, (supporterTotals.get(row.senderId) ?? 0) + row.totalAmount)
  }

  for (const row of giftLeaderboardRows) {
    supporterTotals.set(row.senderId, (supporterTotals.get(row.senderId) ?? 0) + row.totalAmount)
  }

  const mergedSupporterRows = Array.from(supporterTotals.entries())
    .map(([senderId, totalAmount]) => ({
      senderId,
      totalAmount,
    }))
    .sort((left, right) => right.totalAmount - left.totalAmount)
    .slice(0, 10)

  const supporterIds = mergedSupporterRows.map((item) => item.senderId)
  const supporters = await findPostTipSupportersByIds(supporterIds)

  const supporterMap = new Map(supporters.map((item) => [item.id, item]))
  const topSupporters: PostTipLeaderboardItem[] = mergedSupporterRows.flatMap((item) => {
    const supporter = supporterMap.get(item.senderId)
    if (!supporter) {
      return []
    }

    return [{
      userId: supporter.id,
      username: supporter.username,
      nickname: supporter.nickname,
      avatarPath: supporter.avatarPath,
      totalAmount: item.totalAmount,
    }]
  })

  return {
    enabled: settings.tippingEnabled,
    isLoggedIn: Boolean(currentUserId),
    pointName: settings.pointName,
    currentUserPoints: currentUser?.points ?? 0,
    gifts: settings.tippingGifts,
    giftStats,
    recentGiftEvents,
    allowedAmounts: settings.tippingAmounts,
    dailyLimit: settings.tippingDailyLimit,
    perPostLimit: settings.tippingPerPostLimit,
    usedDailyCount: rawDailyCount + giftDailyCount,
    usedPostCount: rawPostCount + giftPostCount,
    tipCount: postTotals?.tipCount ?? 0,
    tipTotalPoints: postTotals?.tipTotalPoints ?? 0,
    topSupporters,
  }
}

export async function tipPost(input: { postId: string; senderId: number; amount: number; giftId?: string | null }) {
  const settings = await getSiteSettings()
  const matchedGift = input.giftId
    ? settings.tippingGifts.find((item) => item.id === input.giftId) ?? null
    : null

  if (!settings.tippingEnabled) {
    postTipError(403, "当前未开启帖子打赏")
  }

  if (input.giftId && !matchedGift) {
    postTipError(400, "当前礼物不存在或已下架")
  }

  if (matchedGift && matchedGift.price !== input.amount) {
    postTipError(400, "礼物价格已变更，请刷新后重试")
  }

  if (!input.giftId && !settings.tippingAmounts.includes(input.amount)) {
    postTipError(400, `仅支持固定打赏金额：${settings.tippingAmounts.join(" / ")}`)
  }

  if (matchedGift) {
    return createPostSupportBaseTransaction({
      postId: input.postId,
      senderId: input.senderId,
      amount: input.amount,
      pointName: settings.pointName,
      tipGiftTaxEnabled: settings.tipGiftTaxEnabled,
      tipGiftTaxRateBps: settings.tipGiftTaxRateBps,
      dailyLimit: settings.tippingDailyLimit,
      perPostLimit: settings.tippingPerPostLimit,
      gift: matchedGift,
      onPersist: async ({ tx, post, sender }) => {
        void sender
        await createPostGiftEvent({
          tx,
          postId: post.id,
          senderId: input.senderId,
          receiverId: post.authorId,
          gift: matchedGift,
        })
      },
    })
  }

  return createPostSupportBaseTransaction({
    postId: input.postId,
    senderId: input.senderId,
    amount: input.amount,
    pointName: settings.pointName,
    tipGiftTaxEnabled: settings.tipGiftTaxEnabled,
    tipGiftTaxRateBps: settings.tipGiftTaxRateBps,
    dailyLimit: settings.tippingDailyLimit,
    perPostLimit: settings.tippingPerPostLimit,
    onPersist: async ({ tx, post }) => {
      await createPostTipRecord(tx, {
        postId: post.id,
        senderId: input.senderId,
        receiverId: post.authorId,
        amount: input.amount,
      })
    },
  })
}
