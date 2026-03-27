import type { Prisma } from "@/db/types"


export const postListInclude = {
  board: true,
  author: {
    include: {
      userBadges: {
        where: {
          isDisplayed: true,
          badge: {
            status: true,
          },
        },
        orderBy: [{ displayOrder: "asc" }, { grantedAt: "desc" }],
        take: 3,
        include: {
          badge: true,
        },
      },
      verificationApplications: {
        where: {
          status: "APPROVED",
        },
        orderBy: [{ reviewedAt: "desc" }, { submittedAt: "desc" }],
        take: 1,
        include: {
          type: true,
        },
      },
    },
  },
} satisfies Prisma.PostInclude


export const pinnedPostOrderBy = [
  { isPinned: "desc" },
  { createdAt: "desc" },
] satisfies Prisma.PostOrderByWithRelationInput[]

export const userIdOnlySelect = {
  userId: true,
} satisfies Prisma.LikeSelect


const postDetailBaseInclude = {
  board: true,
  author: postListInclude.author,
  acceptedComment: {

    include: {
      user: true,
    },
  },
  pollOptions: {
    include: {
      votes: true,
    },
  },
  lotteryPrizes: {
    include: {
      winners: {
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
  },
  lotteryConditions: true,
  appendices: {
    orderBy: {
      sortOrder: "asc",
    },
  },
} satisfies Prisma.PostInclude

export function buildPostDetailInclude(currentUserId?: number) {
  return {
    ...postDetailBaseInclude,
    lotteryParticipants: currentUserId
      ? {
          where: {
            OR: [{ isEligible: true }, { userId: currentUserId }],
          },
        }
      : {
          where: {
            isEligible: true,
          },
        },
    likes: currentUserId
      ? {
          where: {
            userId: currentUserId,
          },
          select: userIdOnlySelect,
        }
      : false,
    favorites: currentUserId
      ? {
          where: {
            userId: currentUserId,
          },
          select: userIdOnlySelect,
        }
      : false,
  } satisfies Prisma.PostInclude
}
