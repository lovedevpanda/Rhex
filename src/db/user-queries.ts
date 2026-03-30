import { prisma } from "@/db/client"
import type { Prisma } from "@/db/types"
import { postListInclude } from "@/db/queries"

export const userProfileSelect = {
  id: true,
  username: true,
  nickname: true,
  bio: true,
  avatarPath: true,
  gender: true,
  status: true,
  level: true,
  points: true,
  vipLevel: true,
  vipExpiresAt: true,
  inviteCount: true,
  postCount: true,
  commentCount: true,
  likeReceivedCount: true,
  _count: {
    select: {
      favorites: true,
      boardFollows: true,
    },
  },
  inviter: {
    select: {
      username: true,
    },
  },
  verificationApplications: {
    where: {
      status: "APPROVED",
    },
    orderBy: [{ reviewedAt: "desc" }, { submittedAt: "desc" }] as Prisma.UserVerificationOrderByWithRelationInput[],
    take: 1,
    include: {
      type: true,
    },
  },
} satisfies Prisma.UserSelect

export function findUserProfileByUsername(username: string) {
  return prisma.user.findUnique({
    where: { username },
    select: userProfileSelect,
  })
}

export function findUserPostsByUsername(username: string) {
  return prisma.post.findMany({
    where: {
      status: "NORMAL",
      author: {
        username,
      },
    },
    include: postListInclude,
    orderBy: [{ createdAt: "desc" }],
    take: 30,
  })
}

export function countUserPosts(userId: number) {
  return prisma.post.count({
    where: {
      status: "NORMAL",
      authorId: userId,
    },
  })
}

export function findUserPostsById(userId: number, options: { page: number; pageSize: number }) {
  const normalizedPageSize = Math.min(Math.max(1, options.pageSize), 50)

  return prisma.post.findMany({
    where: {
      status: "NORMAL",
      authorId: userId,
    },
    include: postListInclude,
    orderBy: [{ createdAt: "desc" }],
    skip: (options.page - 1) * normalizedPageSize,
    take: normalizedPageSize,
  })
}

export function findUserAccountSettingsById(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      emailVerifiedAt: true,
    },
  })
}

export function countUserFavorites(userId: number) {
  return prisma.favorite.count({
    where: { userId },
  })
}

export function findUserFavoritePostsById(userId: number, options: { page: number; pageSize: number }) {
  const normalizedPageSize = Math.min(Math.max(1, options.pageSize), 50)

  return prisma.favorite.findMany({
    where: { userId },
    include: {
      post: {
        include: postListInclude,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: (options.page - 1) * normalizedPageSize,
    take: normalizedPageSize,
  })
}

export function countUserReplies(userId: number) {
  return prisma.comment.count({
    where: {
      userId,
      status: "NORMAL",
    },
  })
}

export function findUserRepliesById(userId: number, options: { page: number; pageSize: number }) {
  const normalizedPageSize = Math.min(Math.max(1, options.pageSize), 50)

  return prisma.comment.findMany({
    where: {
      userId,
      status: "NORMAL",
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      likeCount: true,
      replyToUser: {
        select: {
          username: true,
        },
      },
      post: {
        select: {
          id: true,
          title: true,
          slug: true,
          board: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    skip: (options.page - 1) * normalizedPageSize,
    take: normalizedPageSize,
  })
}

export function countUserLikedPosts(userId: number) {
  return prisma.like.count({
    where: {
      userId,
      targetType: "POST",
      post: {
        status: "NORMAL",
      },
    },
  })
}

export function findUserLikedPostsById(userId: number, options: { page: number; pageSize: number }) {
  const normalizedPageSize = Math.min(Math.max(1, options.pageSize), 50)

  return prisma.like.findMany({
    where: {
      userId,
      targetType: "POST",
      post: {
        status: "NORMAL",
      },
    },
    include: {
      post: {
        include: postListInclude,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: (options.page - 1) * normalizedPageSize,
    take: normalizedPageSize,
  })
}

export function countUserBoardFollows(userId: number) {
  return prisma.boardFollow.count({
    where: { userId },
  })
}

export function findUserBoardFollowsById(userId: number, options: { page: number; pageSize: number }) {
  const normalizedPageSize = Math.min(Math.max(1, options.pageSize), 50)

  return prisma.boardFollow.findMany({
    where: { userId },
    include: {
      board: {
        include: {
          zone: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: (options.page - 1) * normalizedPageSize,
    take: normalizedPageSize,
  })
}
