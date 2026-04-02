import { type Prisma } from "@prisma/client"

import { prisma } from "@/db/client"
import { countPostGiftEventsBySender, createPostGiftEvent, listPostGiftStats, listPostGiftSupportAggregates, listRecentPostGiftEvents, type PostGiftRecentEventItem, type PostGiftStatItem } from "@/db/post-gift-queries"
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

interface PostSupportPostRecord {
  id: string
  status: string
  authorId: number
  title: string
}

interface PostSupportSenderRecord {
  id: number
  points: number
  status: string
  username: string
}

interface PostSupportUsageCounts {
  dailyCount: number
  postCount: number
}

type PostSupportTx = Prisma.TransactionClient

function buildTipReason(postId: string, amount: number, pointName: string, gift?: SiteTippingGiftItem | null) {
  if (gift) {
    return `[post-tip] 赠送礼物（${gift.name} / ${amount}${pointName}） post=${postId}`
  }

  return `[post-tip] 打赏帖子（${amount}${pointName}） post=${postId}`
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
    params.tx.postTip.count({
      where: {
        senderId: params.senderId,
        createdAt: {
          gte: params.start,
          lt: params.end,
        },
      },
    }),
    params.tx.postTip.count({
      where: {
        senderId: params.senderId,
        postId: params.postId,
      },
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
  post: PostSupportPostRecord | null
  sender: PostSupportSenderRecord | null
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
  dailyLimit: number
  perPostLimit: number
  gift?: SiteTippingGiftItem | null
  onPersist: (context: {
    tx: PostSupportTx
    post: PostSupportPostRecord
    sender: PostSupportSenderRecord
  }) => Promise<void>
}) {
  const { start, end } = getTodayRange()

  return prisma.$transaction(async (tx) => {
    const [postRecord, senderRecord] = await Promise.all([
      tx.post.findUnique({
        where: { id: params.postId },
        select: { id: true, status: true, authorId: true, title: true },
      }),
      tx.user.findUnique({
        where: { id: params.senderId },
        select: { id: true, points: true, status: true, username: true },
      }),
    ])

    validateSupportContext({
      post: postRecord,
      sender: senderRecord,
      senderId: params.senderId,
      amount: params.amount,
      pointName: params.pointName,
    })

    const post = postRecord as PostSupportPostRecord
    const sender = senderRecord as PostSupportSenderRecord
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

    await tx.user.update({
      where: { id: sender.id },
      data: {
        points: {
          decrement: params.amount,
        },
      },
    })

    await tx.user.update({
      where: { id: post.authorId },
      data: {
        points: {
          increment: params.amount,
        },
      },
    })

    await tx.post.update({
      where: { id: post.id },
      data: {
        tipCount: {
          increment: 1,
        },
        tipTotalPoints: {
          increment: params.amount,
        },
      },
    })

    await params.onPersist({
      tx,
      post,
      sender,
    })

    await tx.pointLog.createMany({
      data: [
        {
          userId: sender.id,
          changeType: "DECREASE",
          changeValue: params.amount,
          reason: buildTipReason(post.id, params.amount, params.pointName, params.gift),
          relatedType: "POST",
          relatedId: post.id,
        },
        {
          userId: post.authorId,
          changeType: "INCREASE",
          changeValue: params.amount,
          reason: params.gift
            ? `帖子收到礼物 ${params.gift.name}，获得${params.amount}${params.pointName}`
            : `帖子被打赏，获得${params.amount}${params.pointName}`,
          relatedType: "POST",
          relatedId: post.id,
        },
      ],
    })

    await createSystemNotification({
      client: tx,
      userId: post.authorId,
      senderId: sender.id,
      relatedType: "POST",
      relatedId: post.id,
      title: "你的帖子收到了打赏",
      content: params.gift
        ? `${sender.username} 送出了 ${params.gift.name} 给你的帖子《${post.title}》，你已收到 ${params.amount} ${params.pointName}。`
        : `${sender.username} 打赏了你的帖子《${post.title}》，你已收到 ${params.amount} ${params.pointName}。`,
    })

    return {
      pointName: params.pointName,
      amount: params.amount,
      gift: params.gift ?? null,
    }
  })
}

export async function getPostTipSummary(postId: string, currentUserId?: number): Promise<PostTipSummary> {
  const settings = await getSiteSettings()
  const { start, end } = getTodayRange()

  const [postTotals, rawLeaderboardRows, giftLeaderboardRows, currentUser, rawDailyCount, rawPostCount, giftDailyCount, giftPostCount, giftStats, recentGiftEvents] = await Promise.all([
    prisma.post.findUnique({
      where: { id: postId },
      select: {
        tipCount: true,
        tipTotalPoints: true,
      },
    }),
    prisma.postTip.groupBy({
      by: ["senderId"],
      where: { postId },
      _sum: { amount: true },
      orderBy: {
        _sum: {
          amount: "desc",
        },
      },
      take: 20,
    }),
    listPostGiftSupportAggregates(postId, 20),
    currentUserId
      ? prisma.user.findUnique({
          where: { id: currentUserId },
          select: { id: true, points: true },
        })
      : Promise.resolve(null),
    currentUserId
      ? prisma.postTip.count({
          where: {
            senderId: currentUserId,
            createdAt: {
              gte: start,
              lt: end,
            },
          },
        })
      : Promise.resolve(0),
    currentUserId
      ? prisma.postTip.count({
          where: {
            senderId: currentUserId,
            postId,
          },
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
    supporterTotals.set(row.senderId, (supporterTotals.get(row.senderId) ?? 0) + (row._sum.amount ?? 0))
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
  const supporters = supporterIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: supporterIds } },
        select: {
          id: true,
          username: true,
          nickname: true,
          avatarPath: true,
        },
      })
    : []

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
    dailyLimit: settings.tippingDailyLimit,
    perPostLimit: settings.tippingPerPostLimit,
    onPersist: async ({ tx, post }) => {
      await tx.postTip.create({
        data: {
          postId: post.id,
          senderId: input.senderId,
          receiverId: post.authorId,
          amount: input.amount,
        },
      })
    },
  })
}
