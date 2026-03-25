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

export function findPostSlugById(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    select: { slug: true },
  })
}

export function findCommentPostSlugById(commentId: string) {
  return prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      post: {
        select: {
          slug: true,
        },
      },
    },
  })
}
