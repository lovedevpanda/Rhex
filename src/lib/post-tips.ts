import { type Prisma } from "@prisma/client"

import { countPostGiftEventsBySender, createPostGiftEvent, listCommentGiftStats, listCommentGiftSupportAggregates, listPostGiftStats, listPostGiftSupportAggregates, listRecentCommentGiftEvents, listRecentPostGiftEvents, type PostGiftRecentEventItem, type PostGiftStatItem } from "@/db/post-gift-queries"
import {
  countPostTipEventsBySender,
  createPostTipRecord,
  findCommentTipSupportComment,
  findCommentTipSummarySnapshot,
  findPostTipRecipient,
  findPostTipSender,
  findPostTipSummarySnapshot,
  findPostTipSupportPost,
  findPostTipSupportersByIds,
  findPostTipUserPoints,
  incrementCommentTipTotals,
  incrementPostTipTotals,
  lockPostTipSender,
  listCommentTipSupportAggregates,
  listPostTipSupportAggregates,
  type CommentTipSupportCommentRecord,
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
import { executeAddonAsyncWaterfallHook } from "@/addons-host/runtime/hooks"

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

interface SupportUsageCounts {
  dailyCount: number
  targetCount: number
}

type PostSupportTx = Prisma.TransactionClient
type TipTargetType = "post" | "comment"

interface TipTargetContext {
  type: TipTargetType
  post: PostTipSupportPostRecord
  comment?: CommentTipSupportCommentRecord
  recipientId: number
  label: string
  relatedType: "POST" | "COMMENT"
  relatedId: string
}

function buildTipReason(target: TipTargetContext, amount: number, pointName: string, gift?: SiteTippingGiftItem | null) {
  if (gift) {
    return `赠送礼物（${gift.name} / ${amount}${pointName}）`
  }

  return `打赏${target.type === "comment" ? "评论" : "帖子"}（${amount}${pointName}）`
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
  commentId?: string | null
  start: Date
  end: Date
}): Promise<SupportUsageCounts> {
  const isCommentTarget = params.commentId !== undefined
  const [rawDailyCount, rawTargetCount, giftDailyCount, giftTargetCount] = await Promise.all([
    countPostTipEventsBySender({
      client: params.tx,
      senderId: params.senderId,
      start: params.start,
      end: params.end,
    }),
    countPostTipEventsBySender({
      client: params.tx,
      senderId: params.senderId,
      ...(isCommentTarget ? { commentId: params.commentId } : { postId: params.postId, commentId: null }),
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
      ...(isCommentTarget ? { commentId: params.commentId } : { postId: params.postId, commentId: null }),
    }),
  ])

  return {
    dailyCount: rawDailyCount + giftDailyCount,
    targetCount: rawTargetCount + giftTargetCount,
  }
}

function validateSupportContext(params: {
  target: TipTargetContext | null
  sender: PostTipSupportSenderRecord | null
  senderId: number
  amount: number
  pointName: string
}) {
  const { target, sender, senderId, amount, pointName } = params

  if (!target || target.post.status !== "NORMAL") {
    postTipError(404, "内容不存在或暂不可打赏")
  }

  if (!sender) {
    postTipError(404, "用户不存在")
  }

  if (target.comment && target.comment.status !== "NORMAL") {
    postTipError(404, "评论不存在或暂不可打赏")
  }

  if (target.recipientId === senderId) {
    postTipError(400, `不能给自己的${target.type === "comment" ? "评论" : "帖子"}打赏`)
  }

  if (sender.status === "MUTED" || sender.status === "BANNED") {
    postTipError(403, "当前账号状态不可进行打赏")
  }

  void amount
  void pointName
}

async function createPostSupportBaseTransaction(params: {
  postId: string
  commentId?: string
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
    target: TipTargetContext
  }) => Promise<void>
}) {
  const { start, end } = getTodayRange()
  const senderPreparedDelta = await prepareScopedPointDelta({
    scopeKey: params.gift ? "GIFT_OUTGOING" : "TIP_OUTGOING",
    baseDelta: -params.amount,
    userId: params.senderId,
  })

  return runPostTipTransaction(async (tx) => {
    // Daily and per-target limits are derived from event counts. Lock the sender
    // before reading them so concurrent requests cannot both consume the last slot.
    await lockPostTipSender(tx, params.senderId)

    const [targetRecord, senderRecord] = await Promise.all([
      params.commentId ? findCommentTipSupportComment(params.commentId, tx) : findPostTipSupportPost(params.postId, tx),
      findPostTipSender(params.senderId, tx),
    ])

    const target: TipTargetContext | null = params.commentId
      ? targetRecord
        ? {
            type: "comment",
            post: (targetRecord as CommentTipSupportCommentRecord).post,
            comment: targetRecord as CommentTipSupportCommentRecord,
            recipientId: (targetRecord as CommentTipSupportCommentRecord).userId,
            label: "评论",
            relatedType: "COMMENT",
            relatedId: (targetRecord as CommentTipSupportCommentRecord).id,
          }
        : null
      : targetRecord
        ? {
            type: "post",
            post: targetRecord as PostTipSupportPostRecord,
            recipientId: (targetRecord as PostTipSupportPostRecord).authorId,
            label: "帖子",
            relatedType: "POST",
            relatedId: (targetRecord as PostTipSupportPostRecord).id,
          }
        : null

    if (params.commentId && target && target.post.id !== params.postId) {
      // The route carries both IDs; never let a public comment ID silently select
      // a target from a different post and invalidate/categorize the wrong resource.
      postTipError(404, "评论不属于指定帖子")
    }

    validateSupportContext({
      target,
      sender: senderRecord,
      senderId: params.senderId,
      amount: Math.max(params.amount, Math.abs(senderPreparedDelta.finalDelta)),
      pointName: params.pointName,
    })

    const activeTarget = target as TipTargetContext
    const post = activeTarget.post
    const sender = senderRecord as PostTipSupportSenderRecord
    const usageCounts = await getSupportUsageCounts({
      tx,
      senderId: sender.id,
      postId: post.id,
      commentId: params.commentId,
      start,
      end,
    })

    if (usageCounts.dailyCount >= params.dailyLimit) {
      postTipError(400, `今日打赏次数已达上限（${params.dailyLimit} 次）`)
    }

    if (usageCounts.targetCount >= params.perPostLimit) {
      postTipError(400, `该${activeTarget.label}打赏次数已达上限（${params.perPostLimit} 次）`)
    }

    const recipient = await findPostTipRecipient(activeTarget.recipientId, tx)

    if (!recipient) {
      postTipError(404, "收款用户不存在")
    }

    const recipientPreparedDelta = await prepareScopedPointDelta({
      scopeKey: params.gift ? "GIFT_INCOMING" : "TIP_INCOMING",
      baseDelta: params.amount,
      userId: activeTarget.recipientId,
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
      : `${activeTarget.label}被打赏`

    if (activeTarget.type === "comment") {
      await incrementCommentTipTotals(tx, {
        commentId: activeTarget.relatedId,
        amount: params.amount,
      })
    } else {
      await incrementPostTipTotals(tx, {
        postId: post.id,
        amount: params.amount,
      })
    }

    await params.onPersist({
      tx,
      post,
      sender,
      target: activeTarget,
    })

    await applyPointDelta({
      tx,
      userId: sender.id,
      beforeBalance: sender.points,
      prepared: senderPreparedDelta,
      pointName: params.pointName,
      insufficientMessage: `${params.pointName}不足，无法完成打赏`,
      reason: buildTipReason(activeTarget, params.amount, params.pointName, params.gift),
      eventType: params.gift ? POINT_LOG_EVENT_TYPES.POST_GIFT_SENT : POINT_LOG_EVENT_TYPES.POST_TIP_SENT,
      eventData: {
        postId: post.id,
        boardId: post.boardId,
        senderId: sender.id,
        commentId: activeTarget.comment?.id ?? null,
        recipientId: activeTarget.recipientId,
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
      relatedType: activeTarget.relatedType,
      relatedId: activeTarget.relatedId,
    })

    await applyPointDelta({
      tx,
      userId: activeTarget.recipientId,
      beforeBalance: recipient.points,
      prepared: recipientAppliedPreparedDelta,
      pointName: params.pointName,
      reason: recipientBaseReason,
      eventType: params.gift ? POINT_LOG_EVENT_TYPES.POST_GIFT_RECEIVED : POINT_LOG_EVENT_TYPES.POST_TIP_RECEIVED,
      eventData: {
        postId: post.id,
        boardId: post.boardId,
        senderId: sender.id,
        commentId: activeTarget.comment?.id ?? null,
        recipientId: activeTarget.recipientId,
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
      relatedType: activeTarget.relatedType,
      relatedId: activeTarget.relatedId,
    })

    if (taxSplit.tax > 0 && post.boardId) {
      await incrementBoardTreasuryPoints(tx, post.boardId, taxSplit.tax)
    }

    await createSystemNotification({
      client: tx,
      userId: activeTarget.recipientId,
      senderId: sender.id,
      relatedType: activeTarget.relatedType,
      relatedId: activeTarget.relatedId,
      title: `你的${activeTarget.label}收到了打赏`,
      content: params.gift
        ? `${sender.username} 送出了 ${params.gift.name} 给你的帖子《${post.title}》，你已收到 ${Math.abs(recipientAppliedPreparedDelta.finalDelta)} ${params.pointName}。`
        : activeTarget.type === "comment"
          ? `${sender.username} 打赏了你在《${post.title}》下的评论，你已收到 ${Math.abs(recipientAppliedPreparedDelta.finalDelta)} ${params.pointName}。`
          : `${sender.username} 打赏了你的帖子《${post.title}》，你已收到 ${Math.abs(recipientAppliedPreparedDelta.finalDelta)} ${params.pointName}。`,
    })

    return {
      pointName: params.pointName,
      amount: params.amount,
      gift: params.gift ?? null,
      recipientUserId: activeTarget.recipientId,
    }
  })
}

async function applyPostTipSummaryHook(
  summary: PostTipSummary,
  payload: {
    targetType: "post" | "comment"
    postId?: string
    commentId?: string
    currentUserId?: number
  },
) {
  const { value } = await executeAddonAsyncWaterfallHook("post.tip.summary", summary, {
    payload,
  })

  return {
    ...summary,
    ...value,
    enabled: Boolean(value.enabled),
    isLoggedIn: Boolean(value.isLoggedIn),
    pointName: typeof value.pointName === "string" && value.pointName.trim()
      ? value.pointName.trim()
      : summary.pointName,
    currentUserPoints: Number.isSafeInteger(value.currentUserPoints)
      ? Math.max(0, value.currentUserPoints)
      : summary.currentUserPoints,
    gifts: Array.isArray(value.gifts) ? value.gifts as SiteTippingGiftItem[] : summary.gifts,
    giftStats: Array.isArray(value.giftStats) ? value.giftStats as PostGiftStatItem[] : summary.giftStats,
    recentGiftEvents: Array.isArray(value.recentGiftEvents) ? value.recentGiftEvents as PostGiftRecentEventItem[] : summary.recentGiftEvents,
    allowedAmounts: Array.isArray(value.allowedAmounts) ? value.allowedAmounts : summary.allowedAmounts,
    dailyLimit: Number.isSafeInteger(value.dailyLimit) ? Math.max(0, value.dailyLimit) : summary.dailyLimit,
    perPostLimit: Number.isSafeInteger(value.perPostLimit) ? Math.max(0, value.perPostLimit) : summary.perPostLimit,
    usedDailyCount: Number.isSafeInteger(value.usedDailyCount) ? Math.max(0, value.usedDailyCount) : summary.usedDailyCount,
    usedPostCount: Number.isSafeInteger(value.usedPostCount) ? Math.max(0, value.usedPostCount) : summary.usedPostCount,
    tipCount: Number.isSafeInteger(value.tipCount) ? Math.max(0, value.tipCount) : summary.tipCount,
    tipTotalPoints: Number.isSafeInteger(value.tipTotalPoints) ? Math.max(0, value.tipTotalPoints) : summary.tipTotalPoints,
    topSupporters: Array.isArray(value.topSupporters) ? value.topSupporters as PostTipLeaderboardItem[] : summary.topSupporters,
  } satisfies PostTipSummary
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
          commentId: null,
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
          commentId: null,
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

  const summary: PostTipSummary = {
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

  return applyPostTipSummaryHook(summary, {
    targetType: "post",
    postId,
    currentUserId,
  })
}

export async function getCommentTipSummary(commentId: string, currentUserId?: number): Promise<PostTipSummary> {
  const settings = await getSiteSettings()
  const { start, end } = getTodayRange()

  const [commentTotals, rawLeaderboardRows, giftLeaderboardRows, currentUser, rawDailyCount, rawCommentCount, giftDailyCount, giftCommentCount, giftStats, recentGiftEvents] = await Promise.all([
    findCommentTipSummarySnapshot(commentId),
    listCommentTipSupportAggregates(commentId, 20),
    listCommentGiftSupportAggregates(commentId, 20),
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
          commentId,
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
          commentId,
        })
      : Promise.resolve(0),
    listCommentGiftStats(commentId),
    listRecentCommentGiftEvents(commentId),
  ])

  const supporterTotals = new Map<number, number>()

  for (const row of rawLeaderboardRows) {
    supporterTotals.set(row.senderId, (supporterTotals.get(row.senderId) ?? 0) + row.totalAmount)
  }

  for (const row of giftLeaderboardRows) {
    supporterTotals.set(row.senderId, (supporterTotals.get(row.senderId) ?? 0) + row.totalAmount)
  }

  const leaderboardRows = Array.from(supporterTotals.entries())
    .map(([senderId, totalAmount]) => ({ senderId, totalAmount }))
    .sort((left, right) => right.totalAmount - left.totalAmount)
    .slice(0, 20)
  const supporterIds = leaderboardRows.map((item) => item.senderId)
  const supporters = await findPostTipSupportersByIds(supporterIds)
  const supporterMap = new Map(supporters.map((item) => [item.id, item]))
  const topSupporters: PostTipLeaderboardItem[] = leaderboardRows.flatMap((item) => {
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

  const summary: PostTipSummary = {
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
    usedPostCount: rawCommentCount + giftCommentCount,
    tipCount: commentTotals?.tipCount ?? 0,
    tipTotalPoints: commentTotals?.tipTotalPoints ?? 0,
    topSupporters,
  }

  return applyPostTipSummaryHook(summary, {
    targetType: "comment",
    commentId,
    currentUserId,
  })
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

export async function tipComment(input: { postId: string; commentId: string; senderId: number; amount: number; giftId?: string | null }) {
  const settings = await getSiteSettings()
  const matchedGift = input.giftId
    ? settings.tippingGifts.find((item) => item.id === input.giftId) ?? null
    : null

  if (!settings.tippingEnabled) {
    postTipError(403, "当前未开启评论打赏")
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

  return createPostSupportBaseTransaction({
    postId: input.postId,
    commentId: input.commentId,
    senderId: input.senderId,
    amount: input.amount,
    pointName: settings.pointName,
    tipGiftTaxEnabled: settings.tipGiftTaxEnabled,
    tipGiftTaxRateBps: settings.tipGiftTaxRateBps,
    dailyLimit: settings.tippingDailyLimit,
    perPostLimit: settings.tippingPerPostLimit,
    gift: matchedGift,
    onPersist: async ({ tx, post, target }) => {
      if (matchedGift) {
        await createPostGiftEvent({
          tx,
          postId: post.id,
          commentId: target.comment?.id ?? input.commentId,
          senderId: input.senderId,
          receiverId: target.recipientId,
          gift: matchedGift,
        })
        return
      }

      await createPostTipRecord(tx, {
        postId: post.id,
        commentId: target.comment?.id ?? input.commentId,
        senderId: input.senderId,
        receiverId: target.recipientId,
        amount: input.amount,
      })
    },
  })
}
