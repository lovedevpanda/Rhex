import { revalidatePath } from "next/cache"

import { findFounderAdminId, findUserStatus, findUserUsername, invalidateUserSessions } from "@/db/admin-user-action-queries"
import { apiError, apiSuccess, createAdminRouteHandler, readJsonBody, requirePositiveIntegerField } from "@/lib/api-route"
import { writeAdminLog } from "@/lib/admin"
import {
  buildPermissionGrantSaveDetail,
  canEditTargetAdminPermissions,
  getEditableAdminPermissionKeys,
  normalizeAdminPermissionGrantDrafts,
  saveAdminPermissionGrants,
} from "@/lib/admin-permission-overrides"
import { canAdminTier } from "@/lib/admin-permission-policy"
import { getRequestIp } from "@/lib/request-ip"

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const userId = requirePositiveIntegerField(body, "userId", "缺少用户标识")
  const [targetUser, targetProfile, founderAdminId] = await Promise.all([
    findUserStatus(userId),
    findUserUsername(userId),
    findFounderAdminId(),
  ])

  if (!targetUser || !targetProfile) {
    apiError(404, "用户不存在")
  }

  const actorIsFounder = founderAdminId === adminUser.id
  const targetIsFounder = founderAdminId === userId
  if (!canEditTargetAdminPermissions({
    actor: adminUser,
    actorIsFounder,
    targetId: userId,
    targetRole: targetUser.role,
    targetIsFounder,
  })) {
    apiError(403, "无权编辑该管理员权限")
  }

  const editablePermissions = getEditableAdminPermissionKeys({
    targetRole: targetUser.role,
    targetIsFounder,
  })
  const grants = normalizeAdminPermissionGrantDrafts(body.grants, editablePermissions)
  const persistedGrants = grants.filter((grant) => grant.allowed !== canAdminTier("ADMIN", grant.permissionKey))
  await saveAdminPermissionGrants(userId, persistedGrants)
  await invalidateUserSessions(userId)
  await writeAdminLog(
    adminUser.id,
    "user.adminPermissions.update",
    "USER",
    String(userId),
    `更新 @${targetProfile.username} 的管理员动态权限：${buildPermissionGrantSaveDetail(persistedGrants)}`,
    getRequestIp(request),
  )
  revalidatePath("/admin")

  return apiSuccess(null, "管理员权限已更新")
}, {
  errorMessage: "保存管理员权限失败",
  logPrefix: "[api/admin/users/permissions] unexpected error",
  unauthorizedMessage: "无权编辑管理员权限",
  permission: "admin.users.manageAdmins",
})
