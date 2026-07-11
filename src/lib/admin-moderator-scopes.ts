import { UserRole, UserStatus } from "@/db/types"

import { findModeratorScopeSetup, replaceModeratorScopes } from "@/db/admin-moderator-scope-queries"
import { invalidateUserSessions } from "@/db/admin-user-action-queries"
import { apiError, type JsonObject } from "@/lib/api-route"
import { canAdminWithPermissionOverrides } from "@/lib/admin-permission-overrides"
import type { AdminActor } from "@/lib/moderator-permissions"
import { canManageBoard, canManageZone, isSiteAdmin } from "@/lib/moderator-permissions"

interface ScopeInput {
  id: string
  canEditSettings: boolean
  canWithdrawTreasury: boolean
}

const MAX_SCOPE_ASSIGNMENTS = 100

function readScopeArray(value: unknown, key: "zoneId" | "boardId") {
  if (value === undefined) {
    return [] as ScopeInput[]
  }

  if (!Array.isArray(value) || value.length > MAX_SCOPE_ASSIGNMENTS) {
    apiError(400, `\u5355\u6b21\u6700\u591a\u914d\u7f6e ${MAX_SCOPE_ASSIGNMENTS} \u9879\u7248\u4e3b\u7ba1\u8f96\u8303\u56f4`)
  }

  const scopes = value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      apiError(400, "\u7248\u4e3b\u7ba1\u8f96\u8303\u56f4\u683c\u5f0f\u4e0d\u6b63\u786e")
    }

    const record = item as Record<string, unknown>
    const id = typeof record[key] === "string" ? record[key].trim() : ""
    if (!id || id.length > 191) {
      apiError(400, "\u7248\u4e3b\u7ba1\u8f96\u8303\u56f4\u6807\u8bc6\u4e0d\u5408\u6cd5")
    }

    if (record.canEditSettings !== undefined && typeof record.canEditSettings !== "boolean") {
      apiError(400, "\u7248\u4e3b\u7ba1\u8f96\u8bbe\u7f6e\u683c\u5f0f\u4e0d\u6b63\u786e")
    }

    if (record.canWithdrawTreasury !== undefined && typeof record.canWithdrawTreasury !== "boolean") {
      apiError(400, "\u7248\u4e3b\u91d1\u5e93\u6743\u9650\u683c\u5f0f\u4e0d\u6b63\u786e")
    }

    return {
      id,
      canEditSettings: record.canEditSettings === true,
      canWithdrawTreasury: record.canWithdrawTreasury !== false,
    }
  })

  if (new Set(scopes.map((scope) => scope.id)).size !== scopes.length) {
    apiError(400, "\u7248\u4e3b\u7ba1\u8f96\u8303\u56f4\u4e0d\u80fd\u91cd\u590d")
  }

  return scopes
}

function readPositiveUserId(value: unknown) {
  const userId = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : NaN

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    apiError(400, "\u7528\u6237\u6807\u8bc6\u4e0d\u5408\u6cd5")
  }

  return userId
}

export async function updateModeratorScopes(params: {
  actor: AdminActor
  body: JsonObject
}) {
  if (!await canAdminWithPermissionOverrides(params.actor, "admin.structure.assignModerators")) {
    apiError(403, "无权配置版主管辖范围")
  }

  const userId = readPositiveUserId(params.body.userId)
  if (userId === params.actor.id) {
    apiError(403, "\u4e0d\u80fd\u901a\u8fc7\u540e\u53f0\u63a7\u5236\u9762\u4fee\u6539\u5f53\u524d\u767b\u5f55\u7ba1\u7406\u5458\u7684\u7248\u4e3b\u6743\u9650")
  }

  const zoneScopes = readScopeArray(params.body.zoneScopes, "zoneId")
  const boardScopes = readScopeArray(params.body.boardScopes, "boardId")
  const zoneIds = zoneScopes.map((scope) => scope.id)
  const boardIds = boardScopes.map((scope) => scope.id)

  const { user, zones, boards } = await findModeratorScopeSetup(userId, zoneIds, boardIds)

  if (!user) {
    apiError(404, "\u7528\u6237\u4e0d\u5b58\u5728")
  }

  if (user.role !== UserRole.MODERATOR) {
    apiError(400, "\u53ea\u6709\u7248\u4e3b\u89d2\u8272\u624d\u80fd\u914d\u7f6e\u7ba1\u8f96\u8303\u56f4")
  }

  if (user.status !== UserStatus.ACTIVE) {
    apiError(400, "\u8bf7\u5148\u786e\u4fdd\u7248\u4e3b\u8d26\u53f7\u5904\u4e8e\u542f\u7528\u72b6\u6001")
  }

  if (zones.length !== zoneIds.length) {
    apiError(400, "\u5305\u542b\u4e0d\u5b58\u5728\u7684\u5206\u533a\u6388\u6743\u9879")
  }

  if (boards.length !== boardIds.length) {
    apiError(400, "\u5305\u542b\u4e0d\u5b58\u5728\u7684\u8282\u70b9\u6388\u6743\u9879")
  }

  if (!isSiteAdmin(params.actor)) {
    const unauthorizedZone = zones.find((zone) => !canManageZone(params.actor, zone.id))
    if (unauthorizedZone) {
      apiError(403, "\u65e0\u6743\u914d\u7f6e\u8be5\u5206\u533a\u6388\u6743")
    }

    const unauthorizedBoard = boards.find((board) => !canManageBoard(params.actor, board.id, board.zoneId))
    if (unauthorizedBoard) {
      apiError(403, "\u65e0\u6743\u914d\u7f6e\u8be5\u8282\u70b9\u6388\u6743")
    }
  }

  await replaceModeratorScopes(userId, zoneScopes, boardScopes)
  await invalidateUserSessions(userId)

  return {
    message: `\u5df2\u66f4\u65b0 @${user.username} \u7684\u7248\u4e3b\u7ba1\u8f96\u8303\u56f4`,
    action: "moderator.scopes.replace",
    targetType: "USER",
    targetId: String(userId),
    detail: `\u66f4\u65b0 @${user.username} \u7684\u7248\u4e3b\u7ba1\u8f96\u8303\u56f4\uff08\u5206\u533a ${zoneScopes.length} \u9879\uff0c\u8282\u70b9 ${boardScopes.length} \u9879\uff09`,
  }
}
