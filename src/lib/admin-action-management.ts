import { apiError } from "@/lib/api-route"
import { adminModerationActionHandlers } from "@/lib/admin-moderation-actions"
import { adminPostActionHandlers } from "@/lib/admin-post-actions"
import { adminReportActionHandlers } from "@/lib/admin-report-actions"
import { type AdminActionContext, revalidateAdminMutationPaths, type AdminActionDefinition } from "@/lib/admin-action-types"
import { adminUserActionHandlers } from "@/lib/admin-user-actions"
import { canAdminWithPermissionOverrides } from "@/lib/admin-permission-overrides"
import type { AdminPermissionKey } from "@/lib/admin-permission-policy"

const adminActionHandlers: Record<string, AdminActionDefinition> = {
  ...adminUserActionHandlers,
  ...adminPostActionHandlers,
  ...adminModerationActionHandlers,
  ...adminReportActionHandlers,
}

const adminActionPermissions: Record<string, AdminPermissionKey> = {
  "user.mute": "admin.users.manage",
  "user.activate": "admin.users.manage",
  "user.ban": "admin.users.manage",
  "user.promoteModerator": "admin.users.manage",
  "user.setAdmin": "admin.users.manageAdmins",
  "user.demoteToUser": "admin.users.manageAdmins",
  "user.points.adjust": "admin.users.manage",
  "user.password.update": "admin.users.manage",
  "user.profile.note": "admin.users.manage",
  "user.avatar.update": "admin.users.manage",
  "user.profile.update": "admin.users.manage",
  "user.vip": "admin.users.manage",
  "user.vip.configure": "admin.users.manage",
  "user.badge.grant": "admin.users.grantBadges",
  "user.notification.send": "admin.users.manage",
  "post.feature": "admin.content.manage",
  "post.pin": "admin.content.manage",
  "post.hide": "admin.content.manage",
  "post.delete": "admin.content.manage",
  "post.show": "admin.content.manage",
  "post.lock": "admin.content.manage",
  "post.unlock": "admin.content.manage",
  "post.moveBoard": "admin.content.manage",
  "post.approve": "admin.content.manage",
  "post.reject": "admin.content.manage",
  "comment.hide": "admin.comments.manage",
  "comment.delete": "admin.comments.manage",
  "comment.show": "admin.comments.manage",
  "comment.approve": "admin.comments.manage",
  "comment.reject": "admin.comments.manage",
  "comment.markGod": "admin.comments.manage",
  "comment.unmarkGod": "admin.comments.manage",
  "board.togglePosting": "admin.structure.edit",
  "board.hide": "admin.structure.edit",
  "report.process": "admin.operations.manage",
  "report.resolve": "admin.operations.manage",
  "report.reject": "admin.operations.manage",
}

export async function executeAdminAction(context: AdminActionContext) {
  const definition = adminActionHandlers[context.action]
  if (!definition) {
    apiError(400, "暂不支持该操作")
  }

  const requiredPermission = adminActionPermissions[context.action]
  if (requiredPermission && !await canAdminWithPermissionOverrides(context.actor, requiredPermission)) {
    apiError(403, "无权执行该操作")
  }

  if (context.action.startsWith("user.")) {
    const targetUserId = Number(context.targetId)
    if (Number.isInteger(targetUserId) && targetUserId === context.actor.id) {
      apiError(403, "\u4e0d\u80fd\u901a\u8fc7\u540e\u53f0\u63a7\u5236\u9762\u4fee\u6539\u5f53\u524d\u767b\u5f55\u7ba1\u7406\u5458")
    }
  }

  const result = await definition.execute(context)
  const revalidatePaths = result.revalidatePaths ?? definition.metadata.revalidatePaths
  if (revalidatePaths?.length) {
    revalidateAdminMutationPaths(revalidatePaths)
  }
  return result
}
