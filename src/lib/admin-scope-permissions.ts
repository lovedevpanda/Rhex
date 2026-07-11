import "server-only"

import type { SessionActor } from "@/lib/auth"
import type { AdminPermissionKey } from "@/lib/admin-permission-policy"
import { canAdminWithPermissionOverrides } from "@/lib/admin-permission-overrides"
import { apiError } from "@/lib/api-route"
import {
  canManageBoard,
  isSiteAdmin,
  resolveAdminActorFromSessionUser,
  type AdminActor,
} from "@/lib/moderator-permissions"

export async function canAdminActorUsePermission(
  actor: AdminActor | null | undefined,
  permission: AdminPermissionKey,
) {
  if (!actor) {
    return false
  }

  return canAdminWithPermissionOverrides(actor, permission)
}

export async function ensureAdminActorPermission(
  actor: AdminActor | null | undefined,
  permission: AdminPermissionKey,
  message = "无权限执行该操作",
) {
  if (!await canAdminActorUsePermission(actor, permission)) {
    apiError(403, message)
  }
}

export async function canAdminActorManageBoardWithPermission(
  actor: AdminActor | null | undefined,
  permission: AdminPermissionKey,
  boardId: string,
  zoneId?: string | null,
) {
  if (!actor) {
    return false
  }

  if (!await canAdminActorUsePermission(actor, permission)) {
    return false
  }

  return isSiteAdmin(actor) || canManageBoard(actor, boardId, zoneId)
}

export async function resolveContentVisibleAdminActor(user: SessionActor | null | undefined) {
  const actor = await resolveAdminActorFromSessionUser(user ?? null)
  if (!actor || !await canAdminActorUsePermission(actor, "admin.content.manage")) {
    return null
  }

  return actor
}
