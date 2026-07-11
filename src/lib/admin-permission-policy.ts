import type { UserRole } from "@/db/types"
import type { AdminActor } from "@/lib/moderator-permissions"

export type AdminManagementTier =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "SUPER_MODERATOR"
  | "MODERATOR"
  | "REVIEWER"
  | "USER"

export type AdminPermissionKey =
  | "admin.overview.view"
  | "admin.content.manage"
  | "admin.comments.manage"
  | "admin.structure.view"
  | "admin.structure.create"
  | "admin.structure.edit"
  | "admin.structure.delete"
  | "admin.structure.assignModerators"
  | "admin.users.manage"
  | "admin.users.manageAdmins"
  | "admin.users.manageFounder"
  | "admin.users.grantBadges"
  | "admin.users.grantVerifications"
  | "admin.siteSettings.manage"
  | "admin.forumCore.manage"
  | "admin.apps.manage"
  | "admin.addons.manage"
  | "admin.theme.manage"
  | "admin.logs.view"
  | "admin.operations.manage"

export interface AdminPermissionContext {
  isFounder?: boolean
  grants?: Iterable<AdminPermissionGrantInput>
}

export interface AdminPermissionGrantInput {
  permissionKey: AdminPermissionKey
  allowed: boolean
}

export interface TargetUserPermissionContext {
  actor: AdminActor
  actorIsFounder?: boolean
  actorCanManageAdmins?: boolean
  actorCanManageFounder?: boolean
  actorTier?: AdminManagementTier
  targetId: number
  targetRole: UserRole
  targetIsFounder?: boolean
}

const ADMIN_PERMISSIONS = new Set<AdminPermissionKey>([
  "admin.overview.view",
  "admin.content.manage",
  "admin.comments.manage",
  "admin.structure.view",
  "admin.structure.create",
  "admin.structure.edit",
  "admin.structure.assignModerators",
  "admin.users.manage",
  "admin.users.grantBadges",
  "admin.users.grantVerifications",
  "admin.logs.view",
  "admin.operations.manage",
])

const SUPER_MODERATOR_PERMISSIONS = new Set<AdminPermissionKey>([
  "admin.content.manage",
  "admin.comments.manage",
  "admin.structure.view",
  "admin.structure.edit",
  "admin.structure.assignModerators",
])

const MODERATOR_PERMISSIONS = new Set<AdminPermissionKey>([
  "admin.content.manage",
  "admin.comments.manage",
  "admin.structure.view",
])

const REVIEWER_PERMISSIONS = new Set<AdminPermissionKey>([
  "admin.content.manage",
  "admin.comments.manage",
])

export function getAdminManagementTier(
  actor: AdminActor | null | undefined,
  context: AdminPermissionContext = {},
): AdminManagementTier {
  if (!actor) {
    return "USER"
  }

  if (actor.role === "ADMIN") {
    return context.isFounder ? "SUPER_ADMIN" : "ADMIN"
  }

  if (actor.role !== "MODERATOR") {
    return "USER"
  }

  if (actor.moderatedZoneScopes.length > 0) {
    return "SUPER_MODERATOR"
  }

  if (actor.moderatedBoardScopes.length > 0) {
    const canOnlyReview = actor.moderatedBoardScopes.every(
      (scope) => !scope.canEditSettings && !scope.canWithdrawTreasury,
    )
    return canOnlyReview ? "REVIEWER" : "MODERATOR"
  }

  return "USER"
}

export function canAdmin(
  actor: AdminActor | null | undefined,
  permission: AdminPermissionKey,
  context: AdminPermissionContext = {},
) {
  const tier = getAdminManagementTier(actor, context)
  return canAdminTierWithGrants(tier, permission, context.grants)
}

export function canAdminTier(tier: AdminManagementTier, permission: AdminPermissionKey) {
  return canAdminTierWithGrants(tier, permission)
}

export function canAdminTierWithGrants(
  tier: AdminManagementTier,
  permission: AdminPermissionKey,
  grants?: Iterable<AdminPermissionGrantInput>,
) {
  if (tier === "SUPER_ADMIN") {
    return true
  }

  const granted = getPermissionGrantOverride(grants, permission)
  if (typeof granted === "boolean") {
    return granted
  }

  if (tier === "ADMIN") {
    return ADMIN_PERMISSIONS.has(permission)
  }

  if (tier === "SUPER_MODERATOR") {
    return SUPER_MODERATOR_PERMISSIONS.has(permission)
  }

  if (tier === "MODERATOR") {
    return MODERATOR_PERMISSIONS.has(permission)
  }

  if (tier === "REVIEWER") {
    return REVIEWER_PERMISSIONS.has(permission)
  }

  return false
}

export function getDefaultAdminPermissionKeys(tier: AdminManagementTier) {
  if (tier === "SUPER_ADMIN") {
    return null
  }

  if (tier === "ADMIN") {
    return [...ADMIN_PERMISSIONS]
  }

  if (tier === "SUPER_MODERATOR") {
    return [...SUPER_MODERATOR_PERMISSIONS]
  }

  if (tier === "MODERATOR") {
    return [...MODERATOR_PERMISSIONS]
  }

  if (tier === "REVIEWER") {
    return [...REVIEWER_PERMISSIONS]
  }

  return []
}

export function getEffectiveAdminPermissionKeys(
  tier: AdminManagementTier,
  allPermissions: readonly AdminPermissionKey[],
  grants?: Iterable<AdminPermissionGrantInput>,
) {
  if (tier === "SUPER_ADMIN") {
    return [...allPermissions]
  }

  return allPermissions.filter((permission) => canAdminTierWithGrants(tier, permission, grants))
}

function getPermissionGrantOverride(
  grants: Iterable<AdminPermissionGrantInput> | undefined,
  permission: AdminPermissionKey,
) {
  if (!grants) {
    return null
  }

  for (const grant of grants) {
    if (grant.permissionKey === permission) {
      return grant.allowed
    }
  }

  return null
}

export function canManageTargetUser(input: TargetUserPermissionContext) {
  // Administrative user-management endpoints must not be used as a backdoor for
  // changing the current operator. Self-service profile/password flows are kept
  // separate so control-plane writes always have a distinct actor and target.
  if (input.actor.id === input.targetId) {
    return false
  }

  if (input.targetIsFounder) {
    return Boolean(input.actorIsFounder || input.actorCanManageFounder)
  }

  if (input.targetRole === "ADMIN") {
    return Boolean(input.actorIsFounder || input.actorCanManageAdmins)
  }

  if (input.actor.role === "ADMIN") {
    return true
  }

  return input.targetRole === "USER"
}

export function canChangeTargetRole(input: TargetUserPermissionContext & {
  nextRole: UserRole
}) {
  if (input.actor.id === input.targetId) {
    return false
  }

  if (input.targetIsFounder) {
    return Boolean(input.actorIsFounder || input.actorCanManageFounder)
  }

  if (input.targetRole === "ADMIN" || input.nextRole === "ADMIN") {
    return Boolean(input.actorIsFounder || input.actorCanManageAdmins)
  }

  return canManageTargetUser(input)
}

export function getAdminTierLabel(tier: AdminManagementTier) {
  switch (tier) {
    case "SUPER_ADMIN":
      return "超级管理员"
    case "ADMIN":
      return "管理员"
    case "SUPER_MODERATOR":
      return "超级版主"
    case "MODERATOR":
      return "版主"
    case "REVIEWER":
      return "审核员"
    default:
      return "普通用户"
  }
}
