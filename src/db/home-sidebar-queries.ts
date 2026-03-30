import { CommentStatus, Prisma } from "@/db/types"

import { prisma } from "@/db/client"

const POST_INCLUDE = {
  author: {
    select: {
      username: true,
      nickname: true,
      avatarPath: true,
    },
  },
  comments: {
    where: { status: CommentStatus.NORMAL },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: {
      user: {
        select: {
          username: true,
          nickname: true,
        },
      },
    },
  },
} satisfies Prisma.PostInclude

const POST_ORDER_BY = [
  { score: "desc" as const },
  { commentCount: "desc" as const },
  { likeCount: "desc" as const },
  { createdAt: "desc" as const },
]

export async function findHomeSidebarHotTopics(limit: number) {
  // 今日零点（本地时间）
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // 优先取今日发布/有活动的热门帖子
  const todayPosts = await prisma.post.findMany({
    where: {
      status: "NORMAL",
      createdAt: { gte: todayStart },
    },
    include: POST_INCLUDE,
    orderBy: POST_ORDER_BY,
    take: limit,
  })

  if (todayPosts.length >= limit) {
    return todayPosts
  }

  // 今日帖子不足，用历史热门补充
  const todayIds = todayPosts.map((p) => p.id)
  const remaining = limit - todayPosts.length

  const historyPosts = await prisma.post.findMany({
    where: {
      status: "NORMAL",
      ...(todayIds.length > 0 ? { id: { notIn: todayIds } } : {}),
    },
    include: POST_INCLUDE,
    orderBy: POST_ORDER_BY,
    take: remaining,
  })

  return [...todayPosts, ...historyPosts]
}

export function findSidebarCurrentUser(username: string) {
  return prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      postCount: true,
      points: true,
      likeReceivedCount: true,
    },
  })
}

export function countSidebarUserBoardFollows(userId: number) {
  return prisma.boardFollow.count({ where: { userId } })
}

export function countSidebarUserFavorites(userId: number) {
  return prisma.favorite.count({ where: { userId } })
}

const checkInDelegate = prisma as typeof prisma & {
  userCheckInLog?: {
    findUnique: (args: {
      where: {
        userId_checkedInOn: {
          userId: number
          checkedInOn: string
        }
      }
    }) => Promise<unknown>
  }
}

export function findSidebarUserCheckInRecord(userId: number, checkedInOn: string) {
  return checkInDelegate.userCheckInLog?.findUnique({
    where: {
      userId_checkedInOn: {
        userId,
        checkedInOn,
      },
    },
  }) ?? Promise.resolve(null)
}
