import { prisma } from "@/db/client"
import { getSiteSettings } from "@/lib/site-settings"

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
  allowedAmounts: number[]
  dailyLimit: number
  perPostLimit: number
  usedDailyCount: number
  usedPostCount: number
  tipCount: number
  tipTotalPoints: number
  topSupporters: PostTipLeaderboardItem[]
}

function buildTipReason(postId: string, amount: number, pointName: string) {
  return `[post-tip] 打赏帖子（${amount}${pointName}） post=${postId}`
}

function getTodayRange() {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

export async function getPostTipSummary(postId: string, currentUserId?: number): Promise<PostTipSummary> {
  const settings = await getSiteSettings()
  const { start, end } = getTodayRange()

  const [{ _sum, _count }, leaderboardRows, currentUser, usedDailyCount, usedPostCount] = await Promise.all([
    prisma.postTip.aggregate({
      where: { postId },
      _sum: { amount: true },
      _count: { id: true },
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
      take: 10,
    }),
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
  ])

  const supporterIds = leaderboardRows.map((item) => item.senderId)
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
      totalAmount: item._sum.amount ?? 0,
    }]
  })

  return {
    enabled: settings.tippingEnabled,
    pointName: settings.pointName,
    currentUserPoints: currentUser?.points ?? 0,
    allowedAmounts: settings.tippingAmounts,
    dailyLimit: settings.tippingDailyLimit,
    perPostLimit: settings.tippingPerPostLimit,
    usedDailyCount,
    usedPostCount,
    tipCount: _count.id,
    tipTotalPoints: _sum.amount ?? 0,
    topSupporters,
  }
}

export async function tipPost(input: { postId: string; senderId: number; amount: number }) {
  const settings = await getSiteSettings()

  if (!settings.tippingEnabled) {
    throw new Error("当前未开启帖子打赏")
  }

  if (!settings.tippingAmounts.includes(input.amount)) {
    throw new Error(`仅支持固定打赏金额：${settings.tippingAmounts.join(" / ")}`)
  }

  const { start, end } = getTodayRange()

  return prisma.$transaction(async (tx) => {
    const [post, sender] = await Promise.all([
      tx.post.findUnique({
        where: { id: input.postId },
        select: { id: true, status: true, authorId: true, title: true },
      }),
      tx.user.findUnique({
        where: { id: input.senderId },
        select: { id: true, points: true, status: true, username: true },
      }),
    ])

    if (!post || post.status !== "NORMAL") {
      throw new Error("帖子不存在或暂不可打赏")
    }

    if (!sender) {
      throw new Error("用户不存在")
    }

    if (post.authorId === sender.id) {
      throw new Error("不能给自己的帖子打赏")
    }

    if (sender.status === "MUTED" || sender.status === "BANNED") {
      throw new Error("当前账号状态不可进行打赏")
    }

    if (sender.points < input.amount) {
      throw new Error(`${settings.pointName}不足，无法完成打赏`)
    }

    const [dailyCount, postCount] = await Promise.all([
      tx.postTip.count({
        where: {
          senderId: sender.id,
          createdAt: {
            gte: start,
            lt: end,
          },
        },
      }),
      tx.postTip.count({
        where: {
          senderId: sender.id,
          postId: post.id,
        },
      }),
    ])

    if (dailyCount >= settings.tippingDailyLimit) {
      throw new Error(`今日打赏次数已达上限（${settings.tippingDailyLimit} 次）`)
    }

    if (postCount >= settings.tippingPerPostLimit) {
      throw new Error(`该帖子打赏次数已达上限（${settings.tippingPerPostLimit} 次）`)
    }

    await tx.user.update({
      where: { id: sender.id },
      data: {
        points: {
          decrement: input.amount,
        },
      },
    })

    await tx.user.update({
      where: { id: post.authorId },
      data: {
        points: {
          increment: input.amount,
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
          increment: input.amount,
        },
      },
    })

    await tx.postTip.create({
      data: {
        postId: post.id,
        senderId: sender.id,
        receiverId: post.authorId,
        amount: input.amount,
      },
    })

    await tx.pointLog.createMany({
      data: [
        {
          userId: sender.id,
          changeType: "DECREASE",
          changeValue: input.amount,
          reason: buildTipReason(post.id, input.amount, settings.pointName),
          relatedType: "POST",
          relatedId: post.id,
        },
        {
          userId: post.authorId,
          changeType: "INCREASE",
          changeValue: input.amount,
          reason: `帖子被打赏，获得${input.amount}${settings.pointName}`,
          relatedType: "POST",
          relatedId: post.id,
        },
      ],
    })

    return {
      pointName: settings.pointName,
      amount: input.amount,
    }
  })
}

