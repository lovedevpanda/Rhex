import { prisma } from "@/db/client"

export function countUnreadNotifications(userId: number) {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  })
}

export function findNotificationsByUserId(userId: number, skip: number, take: number) {
  return prisma.notification.findMany({
    where: { userId },
    include: {
      sender: {
        select: {
          username: true,
          nickname: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take,
  })
}

export function countNotificationsByUserId(userId: number) {
  return prisma.notification.count({
    where: { userId },
  })
}

export function findPostsByIds(postIds: string[]) {
  if (postIds.length === 0) {
    return Promise.resolve([])
  }

  return prisma.post.findMany({
    where: {
      id: {
        in: [...new Set(postIds)],
      },
    },
    select: { id: true, slug: true, title: true },
  })
}

export function findCommentsWithPostByIds(commentIds: string[]) {
  if (commentIds.length === 0) {
    return Promise.resolve([])
  }

  return prisma.comment.findMany({
    where: {
      id: {
        in: [...new Set(commentIds)],
      },
    },
    select: {
      id: true,
      post: {
        select: {
          id: true,
          slug: true,
          title: true,
        },
      },
    },
  })
}

export function findUsersByIds(userIds: string[]) {
  if (userIds.length === 0) {
    return Promise.resolve([])
  }

  return prisma.user.findMany({
    where: {
      id: {
        in: [...new Set(userIds.map((userId) => Number(userId)).filter((userId) => Number.isInteger(userId) && userId > 0))],
      },
    },
    select: {
      id: true,
      username: true,
      nickname: true,
    },
  })
}
