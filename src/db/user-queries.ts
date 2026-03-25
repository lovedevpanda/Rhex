import { prisma } from "@/db/client"
import { postListInclude } from "@/db/queries"

export const userProfileSelect = {
  id: true,
  username: true,
  nickname: true,
  bio: true,
  avatarPath: true,
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
} as const

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

export function findUserFavoritesById(userId: number, options: { page: number; pageSize: number }) {
  return prisma.favorite.findMany({
    where: { userId },
    include: {
      post: {
        include: {
          board: true,
          author: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: (options.page - 1) * options.pageSize,
    take: options.pageSize,
  })
}

export function countUserBoardFollows(userId: number) {
  return prisma.boardFollow.count({
    where: { userId },
  })
}

export function findUserBoardFollowsById(userId: number, options: { page: number; pageSize: number }) {
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
    skip: (options.page - 1) * options.pageSize,
    take: options.pageSize,
  })
}


