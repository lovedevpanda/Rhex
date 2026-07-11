import { UserRole, UserStatus } from "@/db/types"
import {
  deleteModeratorTargetScope,
  findModeratorScopeSetup,
  findModeratorTargetContext,
  findModeratorUserByUsername,
  upsertModeratorTargetScope,
} from "@/db/admin-moderator-scope-queries"
import { invalidateUserSessions } from "@/db/admin-user-action-queries"
import { apiError, readOptionalStringField, type JsonObject } from "@/lib/api-route"
import { canAdminWithPermissionOverrides } from "@/lib/admin-permission-overrides"
import type { AdminActor } from "@/lib/moderator-permissions"
import { canManageBoard, canManageZone, isSiteAdmin } from "@/lib/moderator-permissions"
import { getUserDisplayName } from "@/lib/user-display"

function readTargetType(value: unknown) {
  return value === "zone" || value === "board" ? value : null
}

function readOptionalBoolean(value: unknown, field: string, defaultValue: boolean) {
  if (value === undefined) {
    return defaultValue
  }

  if (typeof value !== "boolean") {
    apiError(400, `${field} \u683c\u5f0f\u4e0d\u6b63\u786e`)
  }

  return value
}

function ensureCanManageModeratorTarget(actor: AdminActor, target: {
  targetType: "zone" | "board"
  targetId: string
  zoneId?: string | null
}) {
  if (isSiteAdmin(actor)) {
    return
  }

  if (target.targetType === "zone") {
    if (!canManageZone(actor, target.targetId)) {
      apiError(403, "无权配置该分区版主")
    }
    return
  }

  if (!canManageBoard(actor, target.targetId, target.zoneId)) {
    apiError(403, "无权配置该节点版主")
  }
}

async function ensureCanAssignModerators(actor: AdminActor) {
  if (!await canAdminWithPermissionOverrides(actor, "admin.structure.assignModerators")) {
    apiError(403, "无权配置版主")
  }
}

export async function upsertStructureModerator(params: {
  actor: AdminActor
  body: JsonObject
}) {
  await ensureCanAssignModerators(params.actor)

  const rawBody = params.body as Record<string, unknown>
  const targetType = readTargetType(rawBody.targetType)
  const targetId = readOptionalStringField(rawBody, "targetId")
  const username = readOptionalStringField(rawBody, "username")

  if (!targetType || !targetId || !username) {
    apiError(400, "缺少版主、分区或节点参数")
  }

  const [target, moderator] = await Promise.all([
    findModeratorTargetContext({ targetType, targetId }),
    findModeratorUserByUsername(username),
  ])

  if (!target) {
    apiError(404, targetType === "zone" ? "分区不存在" : "节点不存在")
  }

  ensureCanManageModeratorTarget(params.actor, {
    targetType,
    targetId,
    zoneId: target.zoneId,
  })

  if (!moderator) {
    apiError(404, "版主用户不存在")
  }

  if (moderator.id === params.actor.id) {
    apiError(403, "\u4e0d\u80fd\u901a\u8fc7\u540e\u53f0\u63a7\u5236\u9762\u4fee\u6539\u5f53\u524d\u767b\u5f55\u7ba1\u7406\u5458\u7684\u7248\u4e3b\u6743\u9650")
  }

  if (moderator.role === UserRole.ADMIN) {
    apiError(400, "\u7ba1\u7406\u5458\u8d26\u53f7\u65e0\u9700\u914d\u7f6e\u7248\u4e3b\u7ba1\u8f96\u8303\u56f4")
  }

  if (moderator.status !== UserStatus.ACTIVE) {
    apiError(400, "只能添加启用状态的用户为版主")
  }

  const promoteToModerator = moderator.role === UserRole.USER
  const effectiveRole = promoteToModerator ? UserRole.MODERATOR : moderator.role

  const canEditSettings = readOptionalBoolean(rawBody.canEditSettings, "canEditSettings", false)
  const canWithdrawTreasury = readOptionalBoolean(rawBody.canWithdrawTreasury, "canWithdrawTreasury", true)

  await upsertModeratorTargetScope({
    moderatorId: moderator.id,
    targetType,
    targetId,
    canEditSettings,
    canWithdrawTreasury,
    promoteToModerator,
  })

  await invalidateUserSessions(moderator.id)

  return {
    message: promoteToModerator
      ? `已将 @${moderator.username} 设为版主，并更新${targetType === "zone" ? "分区" : "节点"}授权`
      : `已更新 @${moderator.username} 的${targetType === "zone" ? "分区" : "节点"}版主设置`,
    data: {
      moderator: {
        id: moderator.id,
        username: moderator.username,
        displayName: getUserDisplayName(moderator),
        role: effectiveRole,
        status: moderator.status,
        canEditSettings,
        canWithdrawTreasury,
        source: targetType,
      },
    },
    action: "moderator.scope.upsert",
    targetType: targetType === "zone" ? "ZONE" : "BOARD",
    targetId,
    detail: promoteToModerator
      ? `将 @${moderator.username} 设为版主并更新 ${target.name} 授权`
      : `更新 ${target.name} 的版主 @${moderator.username}`,
  }
}

export async function removeStructureModerator(params: {
  actor: AdminActor
  body: JsonObject
}) {
  await ensureCanAssignModerators(params.actor)

  const rawBody = params.body as Record<string, unknown>
  const targetType = readTargetType(rawBody.targetType)
  const targetId = readOptionalStringField(rawBody, "targetId")
  const moderatorId = typeof rawBody.moderatorId === "number"
    ? rawBody.moderatorId
    : typeof rawBody.moderatorId === "string" && /^\d+$/.test(rawBody.moderatorId.trim())
      ? Number(rawBody.moderatorId.trim())
      : NaN

  if (!targetType || !targetId || !Number.isSafeInteger(moderatorId) || moderatorId <= 0) {
    apiError(400, "缺少版主、分区或节点参数")
  }

  if (moderatorId === params.actor.id) {
    apiError(403, "\u4e0d\u80fd\u901a\u8fc7\u540e\u53f0\u63a7\u5236\u9762\u4fee\u6539\u5f53\u524d\u767b\u5f55\u7ba1\u7406\u5458\u7684\u7248\u4e3b\u6743\u9650")
  }

  const [target, moderatorResult] = await Promise.all([
    findModeratorTargetContext({ targetType, targetId }),
    findModeratorScopeSetup(moderatorId, [], []),
  ])
  if (!target) {
    apiError(404, targetType === "zone" ? "\u5206\u533a\u4e0d\u5b58\u5728" : "\u8282\u70b9\u4e0d\u5b58\u5728")
  }

  const moderator = moderatorResult.user
  if (!moderator) {
    apiError(404, "\u7248\u4e3b\u7528\u6237\u4e0d\u5b58\u5728")
  }

  if (moderator.role === UserRole.ADMIN) {
    apiError(400, "\u7ba1\u7406\u5458\u8d26\u53f7\u65e0\u9700\u914d\u7f6e\u7248\u4e3b\u7ba1\u8f96\u8303\u56f4")
  }

  if (moderator.role !== UserRole.MODERATOR) {
    apiError(400, "\u53ea\u6709\u7248\u4e3b\u89d2\u8272\u624d\u80fd\u914d\u7f6e\u7ba1\u8f96\u8303\u56f4")
  }

  ensureCanManageModeratorTarget(params.actor, {
    targetType,
    targetId,
    zoneId: target.zoneId,
  })

  await deleteModeratorTargetScope({
    moderatorId,
    targetType,
    targetId,
  })

  await invalidateUserSessions(moderatorId)

  return {
    message: "版主已移除",
    data: { moderatorId },
    action: "moderator.scope.delete",
    targetType: targetType === "zone" ? "ZONE" : "BOARD",
    targetId,
    detail: `移除 ${target.name} 的版主 #${moderatorId}`,
  }
}
