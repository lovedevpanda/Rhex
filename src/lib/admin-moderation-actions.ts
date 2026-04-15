import { BoardStatus, CommentStatus } from "@/db/types"
import {
  findBoardPostingState,
  findBoardVisibilityState,
  updateCommentModerationState,
  updateBoardPostingState,
  updateBoardVisibilityState,
} from "@/db/admin-moderation-queries"

import { apiError } from "@/lib/api-route"
import { defineAdminAction, writeAdminActionLog, type AdminActionDefinition } from "@/lib/admin-action-types"
import { revalidateHomeSidebarStatsCache } from "@/lib/home-sidebar-stats"
import { ensureCanEditBoard, ensureCanManageComment } from "@/lib/moderator-permissions"
import { createSystemNotification } from "@/lib/notification-writes"
import { expireTaxonomyCacheImmediately } from "@/lib/taxonomy-cache"


export const adminModerationActionHandlers: Record<string, AdminActionDefinition> = {
  "comment.hide": defineAdminAction({ targetType: "COMMENT", revalidatePaths: ["/", "/admin"], buildDetail: () => "管理员下线评论" }, async (context) => {
    const comment = await ensureCanManageComment(context.actor, context.targetId)
    await updateCommentModerationState(context.targetId, {
      status: CommentStatus.HIDDEN,
      reviewNote: context.message || "管理员下线评论",
      reviewedById: context.adminUserId,
      reviewedAt: new Date(),
    })
    revalidateHomeSidebarStatsCache()

    if (comment.userId !== context.adminUserId) {
      await createSystemNotification({
        userId: comment.userId,
        senderId: context.adminUserId,
        relatedType: "COMMENT",
        relatedId: comment.id,
        title: "评论已被下线",
        content: `你在《${comment.post.title}》下的评论已被管理员下线。${context.message ? ` 处理说明：${context.message}` : ""}`,
      }).catch((error) => {
        console.warn("[admin-moderation-actions] failed to notify comment hide", error)
      })
    }

    await writeAdminActionLog(context, adminModerationActionHandlers["comment.hide"].metadata)
    return {
      message: "评论已下线",
      revalidatePaths: [`/posts/${comment.post.slug}`, `/boards/${comment.post.board.slug}`, "/admin", "/notifications", "/"],
    }
  }),
  "comment.show": defineAdminAction({ targetType: "COMMENT", revalidatePaths: ["/", "/admin"], buildDetail: () => "管理员恢复评论上线" }, async (context) => {
    const comment = await ensureCanManageComment(context.actor, context.targetId)
    await updateCommentModerationState(context.targetId, {
      status: CommentStatus.NORMAL,
      reviewNote: context.message || null,
      reviewedById: context.adminUserId,
      reviewedAt: new Date(),
    })
    revalidateHomeSidebarStatsCache()

    if (comment.userId !== context.adminUserId) {
      await createSystemNotification({
        userId: comment.userId,
        senderId: context.adminUserId,
        relatedType: "COMMENT",
        relatedId: comment.id,
        title: "评论已恢复显示",
        content: `你在《${comment.post.title}》下的评论已恢复公开显示。${context.message ? ` 处理说明：${context.message}` : ""}`,
      }).catch((error) => {
        console.warn("[admin-moderation-actions] failed to notify comment show", error)
      })
    }

    await writeAdminActionLog(context, adminModerationActionHandlers["comment.show"].metadata)
    return {
      message: "评论已恢复上线",
      revalidatePaths: [`/posts/${comment.post.slug}`, `/boards/${comment.post.board.slug}`, "/admin", "/notifications", "/"],
    }
  }),
  "comment.approve": defineAdminAction({ targetType: "COMMENT", revalidatePaths: ["/", "/admin"], buildDetail: () => "管理员审核通过评论" }, async (context) => {
    const comment = await ensureCanManageComment(context.actor, context.targetId)
    await updateCommentModerationState(context.targetId, {
      status: CommentStatus.NORMAL,
      reviewNote: context.message || null,
      reviewedById: context.adminUserId,
      reviewedAt: new Date(),
    })
    revalidateHomeSidebarStatsCache()

    if (comment.userId !== context.adminUserId) {
      await createSystemNotification({
        userId: comment.userId,
        senderId: context.adminUserId,
        relatedType: "COMMENT",
        relatedId: comment.id,
        title: "评论审核已通过",
        content: `你在《${comment.post.title}》下的评论已通过审核并公开展示。${context.message ? ` 审核备注：${context.message}` : ""}`,
      }).catch((error) => {
        console.warn("[admin-moderation-actions] failed to notify comment approval", error)
      })
    }

    await writeAdminActionLog(context, adminModerationActionHandlers["comment.approve"].metadata)
    return {
      message: "评论已审核通过",
      revalidatePaths: [`/posts/${comment.post.slug}`, `/boards/${comment.post.board.slug}`, "/admin", "/notifications", "/"],
    }
  }),
  "comment.reject": defineAdminAction({ targetType: "COMMENT", revalidatePaths: ["/", "/admin"], buildDetail: () => "管理员驳回评论审核" }, async (context) => {
    const comment = await ensureCanManageComment(context.actor, context.targetId)
    await updateCommentModerationState(context.targetId, {
      status: CommentStatus.HIDDEN,
      reviewNote: context.message || "审核未通过",
      reviewedById: context.adminUserId,
      reviewedAt: new Date(),
    })
    revalidateHomeSidebarStatsCache()

    if (comment.userId !== context.adminUserId) {
      await createSystemNotification({
        userId: comment.userId,
        senderId: context.adminUserId,
        relatedType: "COMMENT",
        relatedId: comment.id,
        title: "评论审核未通过",
        content: `你在《${comment.post.title}》下的评论未通过审核。${context.message ? ` 驳回原因：${context.message}` : " 请调整内容后重新发布。"}`,
      }).catch((error) => {
        console.warn("[admin-moderation-actions] failed to notify comment rejection", error)
      })
    }

    await writeAdminActionLog(context, adminModerationActionHandlers["comment.reject"].metadata)
    return {
      message: "评论已驳回并下线",
      revalidatePaths: [`/posts/${comment.post.slug}`, `/boards/${comment.post.board.slug}`, "/admin", "/notifications", "/"],
    }
  }),
  "board.togglePosting": defineAdminAction({ targetType: "BOARD", revalidatePaths: ["/", "/admin"], buildDetail: () => "管理员切换版块发帖权限" }, async (context) => {
    await ensureCanEditBoard(context.actor, context.targetId)
    const board = await findBoardPostingState(context.targetId)
    if (!board) apiError(404, "版块不存在")
    await updateBoardPostingState(context.targetId, !board.allowPost)
    expireTaxonomyCacheImmediately()
    await writeAdminActionLog(context, adminModerationActionHandlers["board.togglePosting"].metadata)
    return { message: board.allowPost ? "已关闭发帖" : "已开放发帖" }
  }),
  "board.hide": defineAdminAction({ targetType: "BOARD", revalidatePaths: ["/", "/admin"], buildDetail: () => "管理员切换版块显示状态" }, async (context) => {
    await ensureCanEditBoard(context.actor, context.targetId)
    const board = await findBoardVisibilityState(context.targetId)
    if (!board) apiError(404, "版块不存在")
    const nextStatus = board.status === BoardStatus.HIDDEN ? BoardStatus.ACTIVE : BoardStatus.HIDDEN
    await updateBoardVisibilityState(context.targetId, nextStatus)
    expireTaxonomyCacheImmediately()
    await writeAdminActionLog(context, adminModerationActionHandlers["board.hide"].metadata)
    return { message: nextStatus === BoardStatus.HIDDEN ? "版块已隐藏" : "版块已恢复显示" }
  }),
}

