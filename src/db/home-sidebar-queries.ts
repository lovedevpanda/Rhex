import { prisma } from "@/db/client"

export function findHomeSidebarHotTopics(limit: number) {
  return prisma.post.findMany({
    where: {
      status: "NORMAL",
    },
    include: {
      author: {
        select: {
          username: true,
          nickname: true,
          avatarPath: true,
        },
      },
      comments: {
        where: { status: "NORMAL" },
        orderBy: { createdAt: "desc" },
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
    },
    orderBy: [{ score: "desc" }, { commentCount: "desc" }, { likeCount: "desc" }, { createdAt: "desc" }],
    take: limit,
  })
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

