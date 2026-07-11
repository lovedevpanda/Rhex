import { GodCommentSource, type Prisma } from "@/db/types"

import { prisma } from "@/db/client"
import { lockGodCommentPost } from "@/db/post-god-comment-queries"
import { apiError } from "@/lib/api-route"
import { DEFAULT_GOD_COMMENT_AUTO_LIKE_THRESHOLD } from "@/lib/god-comment-settings"
import { getAdminManagementTier } from "@/lib/admin-permission-policy"
import type { AdminActor } from "@/lib/moderator-permissions"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"

export interface GodCommentPromotionResult {
  changed: boolean
  commentId: string
  postId: string
  userId: number
  likeCount: number
  isGodComment: boolean
  affectedUserIds?: number[]
}

type GodCommentActionComment = {
  id: string
  postId: string
  userId: number
  parentId: string | null
  status: "NORMAL" | "HIDDEN" | "PENDING"
  likeCount: number
  isGodComment: boolean
}

function normalizeLikeThreshold(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_GOD_COMMENT_AUTO_LIKE_THRESHOLD
  }

  return Math.max(1, Math.floor(value))
}

async function findGodCommentActionComment(tx: Prisma.TransactionClient, commentId: string) {
  return tx.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      postId: true,
      userId: true,
      parentId: true,
      status: true,
      likeCount: true,
      isGodComment: true,
    },
  })
}

async function lockAndFindGodCommentActionComment(tx: Prisma.TransactionClient, commentId: string): Promise<GodCommentActionComment> {
  const initial = await findGodCommentActionComment(tx, commentId)
  if (!initial || initial.status !== "NORMAL") {
    throw new Error("评论不存在或不可操作")
  }

  if (initial.parentId) {
    throw new Error("回复评论不能设为神评")
  }

  const lockedPost = await lockGodCommentPost(tx, initial.postId)
  if (!lockedPost) {
    throw new Error("关联帖子不存在")
  }

  const comment = await findGodCommentActionComment(tx, commentId)
  if (!comment || comment.status !== "NORMAL") {
    throw new Error("评论状态已变化，操作失败")
  }

  if (comment.parentId) {
    throw new Error("回复评论不能设为神评")
  }

  return comment
}

async function clearExistingGodCommentForPost(
  tx: Prisma.TransactionClient,
  input: {
    postId: string
    keepCommentId?: string
  },
): Promise<number[]> {
  const existing = await tx.comment.findMany({
    where: {
      postId: input.postId,
      parentId: null,
      isGodComment: true,
      ...(input.keepCommentId ? { NOT: { id: input.keepCommentId } } : {}),
    },
    select: {
      id: true,
      userId: true,
    },
  })

  if (existing.length === 0) {
    return []
  }

  await tx.comment.updateMany({
    where: {
      id: {
        in: existing.map((comment) => comment.id),
      },
      isGodComment: true,
    },
    data: {
      isGodComment: false,
      godCommentSource: null,
      godCommentedById: null,
      godCommentedAt: null,
    },
  })

  const countsByUserId = new Map<number, number>()
  for (const comment of existing) {
    countsByUserId.set(comment.userId, (countsByUserId.get(comment.userId) ?? 0) + 1)
  }

  for (const [userId, count] of countsByUserId.entries()) {
    await tx.$executeRaw`
      UPDATE "User"
      SET "godCommentCount" = GREATEST(0, "godCommentCount" - ${count})
      WHERE "id" = ${userId}
    `
  }

  return [...countsByUserId.keys()]
}

export async function promoteGodComment(input: {
  commentId: string
  source: GodCommentSource
  markerUserId?: number | null
}) {
  return prisma.$transaction(async (tx): Promise<GodCommentPromotionResult> => {
    const comment = await lockAndFindGodCommentActionComment(tx, input.commentId)

    if (comment.isGodComment) {
      return {
        changed: false,
        commentId: comment.id,
        postId: comment.postId,
        userId: comment.userId,
        likeCount: comment.likeCount,
        isGodComment: true,
      }
    }

    const demotedUserIds: number[] = []

    if (input.source === GodCommentSource.ADMIN) {
      const clearedUserIds = await clearExistingGodCommentForPost(tx, {
        postId: comment.postId,
        keepCommentId: comment.id,
      })
      demotedUserIds.push(...clearedUserIds)
    } else {
      const existing = await tx.comment.findFirst({
        where: {
          postId: comment.postId,
          parentId: null,
          isGodComment: true,
        },
        select: {
          id: true,
        },
      })

      if (existing) {
        return {
          changed: false,
          commentId: comment.id,
          postId: comment.postId,
          userId: comment.userId,
          likeCount: comment.likeCount,
          isGodComment: false,
        }
      }
    }

    const marked = await tx.comment.updateMany({
      where: {
        id: comment.id,
        parentId: null,
        status: "NORMAL",
        isGodComment: false,
      },
      data: {
        isGodComment: true,
        godCommentSource: input.source,
        godCommentedById: input.markerUserId ?? null,
        godCommentedAt: new Date(),
      },
    })

    if (marked.count !== 1) {
      throw new Error("评论状态已变化，神评设置失败")
    }

    await tx.user.update({
      where: { id: comment.userId },
      data: {
        godCommentCount: {
          increment: 1,
        },
      },
    })

    return {
      changed: true,
      commentId: comment.id,
      postId: comment.postId,
      userId: comment.userId,
      likeCount: comment.likeCount,
      isGodComment: true,
      affectedUserIds: demotedUserIds,
    }
  }).then((result) => {
    if (result.changed) {
      for (const userId of new Set([result.userId, ...(result.affectedUserIds ?? [])])) {
        revalidateUserSurfaceCache(userId)
      }
    }

    return result
  })
}

export async function demoteGodComment(input: {
  commentId: string
}) {
  return prisma.$transaction(async (tx): Promise<GodCommentPromotionResult> => {
    const comment = await lockAndFindGodCommentActionComment(tx, input.commentId)

    if (!comment.isGodComment) {
      return {
        changed: false,
        commentId: comment.id,
        postId: comment.postId,
        userId: comment.userId,
        likeCount: comment.likeCount,
        isGodComment: false,
      }
    }

    const unmarked = await tx.comment.updateMany({
      where: {
        id: comment.id,
        isGodComment: true,
      },
      data: {
        isGodComment: false,
        godCommentSource: null,
        godCommentedById: null,
        godCommentedAt: null,
      },
    })

    if (unmarked.count !== 1) {
      throw new Error("评论状态已变化，取消神评失败")
    }

    await tx.$executeRaw`
      UPDATE "User"
      SET "godCommentCount" = GREATEST(0, "godCommentCount" - 1)
      WHERE "id" = ${comment.userId}
    `

    return {
      changed: true,
      commentId: comment.id,
      postId: comment.postId,
      userId: comment.userId,
      likeCount: comment.likeCount,
      isGodComment: false,
    }
  }).then((result) => {
    if (result.changed) {
      revalidateUserSurfaceCache(result.userId)
    }

    return result
  })
}

export async function maybePromoteGodCommentByLikes(input: {
  commentId: string
  threshold?: number
}) {
  const threshold = normalizeLikeThreshold(input.threshold)
  const comment = await prisma.comment.findUnique({
    where: { id: input.commentId },
    select: {
      id: true,
      parentId: true,
      status: true,
      likeCount: true,
      isGodComment: true,
    },
  })

  if (!comment || comment.status !== "NORMAL" || comment.parentId || comment.isGodComment || comment.likeCount < threshold) {
    return null
  }

  return promoteGodComment({
    commentId: comment.id,
    source: GodCommentSource.AUTO_LIKE,
  })
}

export async function toggleGodCommentByAdmin(input: {
  commentId: string
  adminUserId: number
  actor: AdminActor
  action: "mark" | "unmark"
}) {
  const { ensureAdminActorPermission } = await import("@/lib/admin-scope-permissions")

  await ensureAdminActorPermission(
    input.actor,
    "admin.comments.manage",
    "没有管理评论的权限",
  )
  if (getAdminManagementTier(input.actor) === "REVIEWER") {
    apiError(403, "审核员不能管理神评")
  }

  return input.action === "mark"
    ? promoteGodComment({
        commentId: input.commentId,
        source: GodCommentSource.ADMIN,
        markerUserId: input.adminUserId,
      })
    : demoteGodComment({
        commentId: input.commentId,
      })
}
