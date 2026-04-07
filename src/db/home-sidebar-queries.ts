import { CommentStatus, PostStatus, Prisma } from "@/db/types"

import { prisma } from "@/db/client"
import { getBusinessDayRange } from "@/lib/formatters"

export async function findHomeSidebarStats() {
  const [postCount, replyCount, userCount] = await Promise.all([
    prisma.post.count({
      where: {
        status: {
          notIn: [PostStatus.PENDING, PostStatus.DELETED],
        },
      },
    }),
    prisma.comment.count({
      where: {
        status: {
          notIn: [CommentStatus.PENDING, CommentStatus.DELETED],
        },
      },
    }),
    prisma.user.count(),
  ])

  return {
    postCount,
    replyCount,
    userCount,
  }
}

const POST_INCLUDE = {
  author: {
    select: {
      id: true,
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
  { activityAt: "desc" as const },
  { commentCount: "desc" as const },
  { likeCount: "desc" as const },
  { createdAt: "desc" as const },
]

export async function findHomeSidebarHotTopics(limit: number) {
  const { start: todayStart } = getBusinessDayRange()

  // 优先取上海业务日内有活动的热门帖子，老帖当天被顶起也会进入今日热帖。
  const todayPosts = await prisma.post.findMany({
    where: {
      status: "NORMAL",
      activityAt: { gte: todayStart },
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
      _count: {
        select: {
          followedByUsers: true,
        },
      },
      levelProgress: {
        select: {
          checkInDays: true,
          currentCheckInStreak: true,
          maxCheckInStreak: true,
          lastCheckInDate: true,
        },
      },
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
