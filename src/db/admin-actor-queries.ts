import type { Prisma } from "@/db/types"

import { prisma } from "@/db/client"

export const moderatorScopeSelect = {
  id: true,
  username: true,
  nickname: true,
  role: true,
  status: true,
  moderatedZoneScopes: {
    select: {
      zoneId: true,
      canEditSettings: true,
      zone: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
    orderBy: [
      { zone: { sortOrder: "asc" } },
      { createdAt: "asc" },
    ],
  },
  moderatedBoardScopes: {
    select: {
      boardId: true,
      canEditSettings: true,
      board: {
        select: {
          name: true,
          slug: true,
          zoneId: true,
          zone: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
    },
    orderBy: [
      { board: { sortOrder: "asc" } },
      { createdAt: "asc" },
    ],
  },
} satisfies Prisma.UserSelect

export type ModeratorScopeRecord = Prisma.UserGetPayload<{ select: typeof moderatorScopeSelect }>

export function findModeratorActorById(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: moderatorScopeSelect,
  })
}

export function findManagedUserContext(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      status: true,
    },
  })
}

export function findManagedPostContext(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      slug: true,
      authorId: true,
      status: true,
      isPinned: true,
      pinScope: true,
      isFeatured: true,
      boardId: true,
      board: {
        select: {
          id: true,
          slug: true,
          name: true,
          zoneId: true,
          status: true,
          zone: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
        },
      },
    },
  })
}

export function findManagedCommentContext(commentId: string) {
  return prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      postId: true,
      userId: true,
      parentId: true,
      status: true,
      post: {
        select: {
          id: true,
          authorId: true,
          boardId: true,
          board: {
            select: {
              id: true,
              zoneId: true,
            },
          },
        },
      },
    },
  })
}

export function findManagedBoardContext(boardId: string) {
  return prisma.board.findUnique({
    where: { id: boardId },
    select: {
      id: true,
      slug: true,
      name: true,
      zoneId: true,
      status: true,
      allowPost: true,
      zone: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    },
  })
}

export function findManagedZoneContext(zoneId: string) {
  return prisma.zone.findUnique({
    where: { id: zoneId },
    select: {
      id: true,
      slug: true,
      name: true,
    },
  })
}
