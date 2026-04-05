import type { Prisma } from "@/db/types"
import { CommentStatus, NotificationType } from "@/db/types"
import { prisma } from "@/db/client"
import { applyPointDelta, type PreparedPointDelta } from "@/lib/point-center"
import { createNotifications } from "@/lib/notification-writes"


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
  role: true,
  status: true,
  vipLevel: true,
  vipExpiresAt: true,
  userBadges: commentDisplayedBadgesInclude,
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

export function findEditableCommentById(commentId: string) {
  return prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      postId: true,
      userId: true,
      status: true,
      content: true,
      createdAt: true,
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

function buildVisibleCommentStatuses(includeHidden = false) {
  return includeHidden ? [CommentStatus.NORMAL, CommentStatus.HIDDEN] : [CommentStatus.NORMAL]
}

function buildCommentBlockVisibilityWhere(viewerUserId?: number): Prisma.CommentWhereInput {
  if (!viewerUserId) {
    return {}
  }

  return {
    user: {
      blocksInitiated: {
        none: {
          blockedId: viewerUserId,
        },
      },
      blocksReceived: {
        none: {
          blockerId: viewerUserId,
        },
      },
    },
  }
}

export function countRootCommentsByPostId(postId: string, viewerUserId?: number, includeHidden = false) {
  return prisma.comment.count({
    where: {
      postId,
      status: {
        in: buildVisibleCommentStatuses(includeHidden),
      },
      parentId: null,
      ...buildCommentBlockVisibilityWhere(viewerUserId),
    },
  })
}

export async function findRootCommentPageById(params: {
  postId: string
  rootCommentId: string
  pageSize: number
  sort: "oldest" | "newest"
}) {
  const normalizedPageSize = Math.min(Math.max(1, params.pageSize), 50)

  const rootComment = await prisma.comment.findFirst({
    where: {
      id: params.rootCommentId,
      postId: params.postId,
      status: CommentStatus.NORMAL,
      parentId: null,
    },
    select: {
      id: true,
      createdAt: true,
      isPinnedByAuthor: true,
    },
  })

  if (!rootComment) {
    return 1
  }

  const precedingCount = await prisma.comment.count({
    where: {
      postId: params.postId,
      status: CommentStatus.NORMAL,
      parentId: null,
      OR: rootComment.isPinnedByAuthor
        ? [
            { isPinnedByAuthor: true, createdAt: { lt: rootComment.createdAt } },
            { isPinnedByAuthor: true, createdAt: rootComment.createdAt, id: { lt: rootComment.id } },
          ]
        : [
            { isPinnedByAuthor: true },
            { isPinnedByAuthor: false, createdAt: { lt: rootComment.createdAt } },
            { isPinnedByAuthor: false, createdAt: rootComment.createdAt, id: { lt: rootComment.id } },
          ],
    },
  })

  const totalRootComments = await countRootCommentsByPostId(params.postId)
  const oldestPage = Math.max(1, Math.ceil((precedingCount + 1) / normalizedPageSize))

  if (params.sort === "oldest") {
    return oldestPage
  }

  const newestIndex = totalRootComments - precedingCount
  return Math.max(1, Math.ceil(newestIndex / normalizedPageSize))
}

export function findRootCommentsByPostId(params: {

  postId: string
  sort: "oldest" | "newest"
  page: number
  pageSize: number
  viewerUserId?: number
  includeHidden?: boolean
}) {
  const normalizedPageSize = Math.min(Math.max(1, params.pageSize), 50)

  return prisma.comment.findMany({
    where: {
      postId: params.postId,
      status: {
        in: buildVisibleCommentStatuses(params.includeHidden),
      },
      parentId: null,
      ...buildCommentBlockVisibilityWhere(params.viewerUserId),
    },
    include: buildCommentListInclude(params.viewerUserId),
    orderBy: [
      { isPinnedByAuthor: "desc" },
      { createdAt: params.sort === "newest" ? "desc" : "asc" },
    ],
    skip: (params.page - 1) * normalizedPageSize,
    take: normalizedPageSize,
  })
}

export function findRepliesByParentIds(params: {
  postId: string
  parentIds: string[]
  sort: "oldest" | "newest"
  viewerUserId?: number
  includeHidden?: boolean
}) {
  if (params.parentIds.length === 0) {
    return Promise.resolve([])
  }

  return prisma.comment.findMany({
    where: {
      postId: params.postId,
      status: {
        in: buildVisibleCommentStatuses(params.includeHidden),
      },
      parentId: { in: params.parentIds },
      ...buildCommentBlockVisibilityWhere(params.viewerUserId),
    },
    include: buildCommentReplyInclude(params.viewerUserId),
    orderBy: [{ createdAt: params.sort === "newest" ? "desc" : "asc" }],
  })
}

export function findCommentRewardClaimsByCommentIds(postId: string, commentIds: string[]) {
  if (commentIds.length === 0) {
    return Promise.resolve([])
  }

  return prisma.postRedPacketClaim.findMany({
    where: {
      postId,
      triggerType: "REPLY",
      triggerCommentId: {
        in: commentIds,
      },
    },
    select: {
      triggerCommentId: true,
      amount: true,
      redPacket: {
        select: {
          packetCount: true,
        },
      },
    },
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

export function updateCommentContentById(commentId: string, data: { content: string; reviewNote: string | null }) {
  return prisma.comment.update({
    where: { id: commentId },
    data: {
      content: data.content,
    },
    select: {
      id: true,
      postId: true,
      parentId: true,
      replyToUserId: true,
    },
  })
}

export function createCommentMentionNotifications(params: {
  commentId: string
  senderId: number
  senderName: string
  content: string
  mentionUserIds: number[]
  excludeUserIds?: number[]
}) {
  const excludeUserIds = new Set([params.senderId, ...(params.excludeUserIds ?? [])])
  const notificationTargets = [...new Set(params.mentionUserIds)].filter((userId) => !excludeUserIds.has(userId))

  if (notificationTargets.length === 0) {
    return Promise.resolve({ count: 0 })
  }

  return createNotifications({
    notifications: notificationTargets.map((userId) => ({
      userId,
      type: NotificationType.MENTION,
      senderId: params.senderId,
      relatedType: "COMMENT" as const,
      relatedId: params.commentId,
      title: "你被提及了",
      content: `${params.senderName} 在评论中提到了你：${params.content.slice(0, 80)}`,
    })),
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
  replyPointDeltaPrepared: PreparedPointDelta
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

    const updatedUser = await tx.user.update({
      where: { id: params.userId },
      data: {
        commentCount: {
          increment: 1,
        },
        lastCommentAt: new Date(),
      },
      select: {
        points: true,
      },
    })

    if (params.replyPointDeltaPrepared.finalDelta !== 0) {
      await applyPointDelta({
        tx,
        userId: params.userId,
        beforeBalance: updatedUser.points,
        prepared: params.replyPointDeltaPrepared,
        pointName: params.pointName,
        reason: "在指定节点回复",
        relatedType: "COMMENT",
        relatedId: comment.id,
      })
    }

    const commentedAt = new Date()

    await tx.post.update({
      where: { id: params.postId },
      data: {
        commentCount: {
          increment: 1,
        },
        lastCommentedAt: commentedAt,
        activityAt: commentedAt,
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
      await createNotifications({
        client: tx,
        notifications,
      })
    }

    return comment
  })
}
