import { UserStatus } from "@/db/types"

import { prisma } from "@/db/client"

export function findActiveBoardsWithZoneAndPostCount() {
  return prisma.board.findMany({
    where: {
      status: "ACTIVE",
    },
    include: {
      zone: true,
      _count: {
        select: {
          posts: {
            where: {
              status: "NORMAL",
            },
          },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  })
}

export function findBoardBySlugWithZoneAndPostCount(slug: string) {
  return prisma.board.findUnique({
    where: { slug },
    include: {
      zone: true,
      _count: {
        select: {
          posts: {
            where: {
              status: "NORMAL",
            },
          },
        },
      },
    },
  })
}

export function findBoardModeratorsByBoardId(boardId: string) {
  return prisma.moderatorBoardScope.findMany({
    where: {
      boardId,
      moderator: {
        status: {
          in: [UserStatus.ACTIVE, UserStatus.MUTED],
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { moderatorId: "asc" }],
    select: {
      moderator: {
        select: {
          id: true,
          username: true,
          nickname: true,
          avatarPath: true,
          vipLevel: true,
          role: true,
        },
      },
    },
  })
}
