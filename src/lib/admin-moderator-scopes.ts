import { UserRole, UserStatus } from "@/db/types"

import { findModeratorScopeSetup, replaceModeratorScopes } from "@/db/admin-moderator-scope-queries"
import { apiError, type JsonObject } from "@/lib/api-route"
import type { AdminActor } from "@/lib/moderator-permissions"
import { isSiteAdmin } from "@/lib/moderator-permissions"

interface ScopeInput {
  id: string
  canEditSettings: boolean
}

function readScopeArray(value: unknown, key: "zoneId" | "boardId") {
  if (!Array.isArray(value)) {
    return [] as ScopeInput[]
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null
      }

      const record = item as Record<string, unknown>
      const id = typeof record[key] === "string" ? record[key].trim() : ""
      if (!id) {
        return null
      }

      return {
        id,
        canEditSettings: record.canEditSettings === true,
      }
    })
    .filter((item): item is ScopeInput => Boolean(item))
}

export async function updateModeratorScopes(params: {
  actor: AdminActor
  body: JsonObject
}) {
  if (!isSiteAdmin(params.actor)) {
    apiError(403, "仅管理员可配置版主管辖范围")
  }

  const rawUserId = params.body.userId
  const userId = typeof rawUserId === "number" ? rawUserId : Number(rawUserId)
  if (!Number.isInteger(userId) || userId <= 0) {
    apiError(400, "用户标识不合法")
  }

  const zoneScopes = readScopeArray(params.body.zoneScopes, "zoneId")
  const boardScopes = readScopeArray(params.body.boardScopes, "boardId")
  const zoneIds = [...new Set(zoneScopes.map((scope) => scope.id))]
  const boardIds = [...new Set(boardScopes.map((scope) => scope.id))]

  const { user, zones, boards } = await findModeratorScopeSetup(userId, zoneIds, boardIds)

  if (!user) {
    apiError(404, "用户不存在")
  }

  if (user.role !== UserRole.MODERATOR) {
    apiError(400, "只有版主角色才能配置管辖范围")
  }

  if (user.status !== UserStatus.ACTIVE) {
    apiError(400, "请先确保版主账号处于启用状态")
  }

  if (zones.length !== zoneIds.length) {
    apiError(400, "包含不存在的分区授权项")
  }

  if (boards.length !== boardIds.length) {
    apiError(400, "包含不存在的节点授权项")
  }

  await replaceModeratorScopes(userId, zoneScopes, boardScopes)

  return {
    message: `已更新 @${user.username} 的版主管辖范围`,
  }
}
