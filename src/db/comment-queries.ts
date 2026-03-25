import type { Prisma } from "@/db/types"
import { ChangeType, NotificationType } from "@/db/types"
import { prisma } from "@/db/client"


const commentViewerLikeSelect = {
  userId: true,
} as const

const commentDisplayedBadgesInclude = {
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
} satisfies Prisma.User$userBadgesArgs

const commentUserSelect = {
  username: true,
  nickname: true,
  avatarPath: true,
  status: true,
  vipLevel: true,
  vipExpiresAt: true,
  userBadges: commentDisplayedBadgesInclude,
} as const



export function findCommentAuthorByUserId(userId: number) {
  return prisma.user.findUnique({ where: { id: userId } })
}

export function findCommentParentById(parentId: string) {
  return prisma.comment.findUnique({
    where: { id: parentId },
    select: {
      id: true,
      postId: true,
      status: true,
      parentId: true,
      userId: true,
      user: {
        select: {
          username: true,
          nickname: true,
        },
      },
    },
  })
}

export function buildCommentViewerLikesInclude(viewerUserId?: number) {
  if (!viewerUserId) {
    return false as const
  }

  return {
    where: {
      userId: viewerUserId,
    },
    select: commentViewerLikeSelect,
  }
}

export function buildCommentListInclude(viewerUserId?: number) {
  return {
    user: {
      select: commentUserSelect,
    },
    likes: buildCommentViewerLikesInclude(viewerUserId),
  }
}

export function buildCommentReplyInclude(viewerUserId?: number) {
  return {
    user: {
      select: commentUserSelect,
    },
    replyToUser: {
      select: commentUserSelect,
    },
    likes: buildCommentViewerLikesInclude(viewerUserId),
  }
}

export function countRootCommentsByPostId(postId: string) {
  return prisma.comment.count({
    where: {
      postId,
      status: "NORMAL",
      parentId: null,
    },
  })
}

export function findRootCommentsByPostId(params: {
  postId: string
  sort: "oldest" | "newest"
  page: number
  pageSize: number
  viewerUserId?: number
}) {
  return prisma.comment.findMany({
    where: {
      postId: params.postId,
      status: "NORMAL",
      parentId: null,
    },
    include: buildCommentListInclude(params.viewerUserId),
    orderBy: [
      { isPinnedByAuthor: "desc" },
      { createdAt: params.sort === "newest" ? "desc" : "asc" },
    ],
    skip: (params.page - 1) * params.pageSize,
    take: params.pageSize,
  })
}

export function findRepliesByParentIds(params: {
  postId: string
  parentIds: string[]
  sort: "oldest" | "newest"
  viewerUserId?: number
}) {
  if (params.parentIds.length === 0) {
    return Promise.resolve([])
  }

  return prisma.comment.findMany({
    where: {
      postId: params.postId,
      status: "NORMAL",
      parentId: { in: params.parentIds },
    },
    include: buildCommentReplyInclude(params.viewerUserId),
    orderBy: [{ createdAt: params.sort === "newest" ? "desc" : "asc" }],
  })
}

export function countUserRepliesByPostId(postId: string, userId: number) {
  return prisma.comment.count({
    where: {
      postId,
      userId,
      status: "NORMAL",
    },
  })
}

export async function createCommentWithRelations(params: {
  postId: string
  userId: number
  content: string
  status: "PENDING" | "NORMAL"
  parentId?: string
  replyToUserId?: number
  replyPointDelta: number
  pointName: string
  senderName: string
  postAuthorId: number
  mentionUsers: Array<{ id: number }>
  normalizedParentId?: string
  normalizedReplyToUserId?: number | null
}) {
  return prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: {
        postId: params.postId,
        userId: params.userId,
        content: params.content,
        parentId: params.parentId || undefined,
        replyToUserId: params.replyToUserId ?? undefined,
        status: params.status,
      },
    })

    await tx.user.update({
      where: { id: params.userId },
      data: {
        commentCount: {
          increment: 1,
        },
        lastCommentAt: new Date(),
        ...(params.replyPointDelta < 0
          ? {
              points: {
                decrement: Math.abs(params.replyPointDelta),
              },
            }
          : params.replyPointDelta > 0
            ? {
                points: {
                  increment: params.replyPointDelta,
                },
              }
            : {}),
      },
    })

    if (params.replyPointDelta !== 0) {
      await tx.pointLog.create({
        data: {
          userId: params.userId,
          changeType: params.replyPointDelta > 0 ? ChangeType.INCREASE : ChangeType.DECREASE,
          changeValue: Math.abs(params.replyPointDelta),
          reason: params.replyPointDelta > 0 ? `在指定节点回复获得${params.pointName}` : `在指定节点回复扣除${params.pointName}`,
          relatedType: "COMMENT",
          relatedId: comment.id,
        },
      })
    }

    await tx.post.update({
      where: { id: params.postId },
      data: {
        commentCount: {
          increment: 1,
        },
        lastCommentedAt: new Date(),
      },
    })

    const notifications = [] as Array<{
      userId: number
      type: NotificationType
      senderId: number
      relatedType: "POST" | "COMMENT"
      relatedId: string
      title: string
      content: string
    }>

    if (!params.normalizedParentId && params.postAuthorId !== params.userId) {
      notifications.push({
        userId: params.postAuthorId,
        type: NotificationType.REPLY_POST,
        senderId: params.userId,
        relatedType: "POST",
        relatedId: params.postId,
        title: "你的帖子有了新回复",
        content: `${params.senderName} 回复了你的帖子：${params.content.slice(0, 80)}`,
      })
    }

    if (params.normalizedReplyToUserId && params.normalizedReplyToUserId !== params.userId) {
      notifications.push({
        userId: params.normalizedReplyToUserId,
        type: NotificationType.REPLY_COMMENT,
        senderId: params.userId,
        relatedType: "COMMENT",
        relatedId: comment.id,
        title: "你的评论有了新回复",
        content: `${params.senderName} 回复了你的评论：${params.content.slice(0, 80)}`,
      })
    }

    const notificationTargets = params.mentionUsers.filter((mentionUser) => mentionUser.id !== params.userId && mentionUser.id !== params.normalizedReplyToUserId)
    notifications.push(
      ...notificationTargets.map((mentionUser) => ({
        userId: mentionUser.id,
        type: NotificationType.MENTION,
        senderId: params.userId,
        relatedType: "COMMENT" as const,
        relatedId: comment.id,
        title: "你被提及了",
        content: `${params.senderName} 在评论中提到了你：${params.content.slice(0, 80)}`,
      })),
    )

    if (notifications.length > 0) {
      await tx.notification.createMany({
        data: notifications,
      })
    }

    return comment
  })
}
