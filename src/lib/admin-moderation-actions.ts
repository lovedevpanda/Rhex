import { BoardStatus } from "@/db/types"
import {
  findBoardPostingState,
  findBoardVisibilityState,
  hideCommentById,
  showCommentById,
  updateBoardPostingState,
  updateBoardVisibilityState,
} from "@/db/admin-moderation-queries"

import { apiError } from "@/lib/api-route"
import { defineAdminAction, writeAdminActionLog, type AdminActionDefinition } from "@/lib/admin-action-types"
import { ensureCanEditBoard, ensureCanManageComment } from "@/lib/moderator-permissions"


export const adminModerationActionHandlers: Record<string, AdminActionDefinition> = {
  "comment.hide": defineAdminAction({ targetType: "COMMENT", revalidatePaths: ["/", "/admin"], buildDetail: () => "管理员下线评论" }, async (context) => {
    await ensureCanManageComment(context.actor, context.targetId)
    await hideCommentById(context.targetId)
    await writeAdminActionLog(context, adminModerationActionHandlers["comment.hide"].metadata)
    return { message: "评论已下线" }
  }),
  "comment.show": defineAdminAction({ targetType: "COMMENT", revalidatePaths: ["/", "/admin"], buildDetail: () => "管理员恢复评论上线" }, async (context) => {
    await ensureCanManageComment(context.actor, context.targetId)
    await showCommentById(context.targetId)
    await writeAdminActionLog(context, adminModerationActionHandlers["comment.show"].metadata)
    return { message: "评论已恢复上线" }
  }),
  "board.togglePosting": defineAdminAction({ targetType: "BOARD", revalidatePaths: ["/", "/admin"], buildDetail: () => "管理员切换版块发帖权限" }, async (context) => {
    await ensureCanEditBoard(context.actor, context.targetId)
    const board = await findBoardPostingState(context.targetId)
    if (!board) apiError(404, "版块不存在")
    await updateBoardPostingState(context.targetId, !board.allowPost)
    await writeAdminActionLog(context, adminModerationActionHandlers["board.togglePosting"].metadata)
    return { message: board.allowPost ? "已关闭发帖" : "已开放发帖" }
  }),
  "board.hide": defineAdminAction({ targetType: "BOARD", revalidatePaths: ["/", "/admin"], buildDetail: () => "管理员切换版块显示状态" }, async (context) => {
    await ensureCanEditBoard(context.actor, context.targetId)
    const board = await findBoardVisibilityState(context.targetId)
    if (!board) apiError(404, "版块不存在")
    const nextStatus = board.status === BoardStatus.HIDDEN ? BoardStatus.ACTIVE : BoardStatus.HIDDEN
    await updateBoardVisibilityState(context.targetId, nextStatus)
    await writeAdminActionLog(context, adminModerationActionHandlers["board.hide"].metadata)
    return { message: nextStatus === BoardStatus.HIDDEN ? "版块已隐藏" : "版块已恢复显示" }
  }),
}

