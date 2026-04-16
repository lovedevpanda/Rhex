import "server-only"

import type { AddonManifest } from "@/addons-host/types"

export const ADDON_RUNTIME_PERMISSIONS = [
  "config:read",
  "config:write",
  "secret:read",
  "secret:write",
  "data:read",
  "data:write",
  "data:delete",
  "data:migrate",
  "slot:register",
  "surface:register",
  "page:public",
  "page:admin",
  "api:public",
  "api:admin",
  "provider:register",
  "hook:register",
  "network:external",
  "auth:integrate",
  "captcha:integrate",
  "payment:integrate",
] as const

export type AddonRuntimePermission =
  (typeof ADDON_RUNTIME_PERMISSIONS)[number]

function normalizeOptionalString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback
}

function normalizeLegacyPermission(permission: string) {
  const normalized = normalizeOptionalString(permission)
  if (!normalized) {
    return ""
  }

  if (normalized === "route:public") {
    return "page:public"
  }

  if (normalized === "route:admin") {
    return "page:admin"
  }

  if (
    normalized.startsWith("slot:")
    && normalized !== "slot:register"
  ) {
    return "slot:register"
  }

  return normalized
}

export function resolveAddonPermissionSet(permissions?: string[] | null) {
  const normalizedPermissions = new Set<string>()

  for (const permission of permissions ?? []) {
    const normalizedPermission = normalizeLegacyPermission(permission)
    if (normalizedPermission) {
      normalizedPermissions.add(normalizedPermission)
    }
  }

  return normalizedPermissions
}

export function addonHasPermission(
  permissions: string[] | Set<string> | ReadonlySet<string> | null | undefined,
  requiredPermission: string,
) {
  const normalizedRequiredPermission = normalizeLegacyPermission(requiredPermission)
  const permissionSet = Array.isArray(permissions)
    ? resolveAddonPermissionSet(permissions)
    : permissions ?? new Set<string>()

  if (!normalizedRequiredPermission) {
    return true
  }

  return permissionSet.has(normalizedRequiredPermission)
}

export function assertAddonPermission(
  manifest: Pick<AddonManifest, "id" | "permissions">,
  requiredPermission: string,
  message?: string,
) {
  if (addonHasPermission(manifest.permissions, requiredPermission)) {
    return
  }

  throw new Error(
    message
      || `addon "${manifest.id}" requires permission "${normalizeLegacyPermission(requiredPermission)}"`,
  )
}

export function resolveAddonSensitivePermissionForSlot(slot: string) {
  if (slot === "post.create.captcha") {
    return "captcha:integrate"
  }

  if (slot.startsWith("auth.")) {
    if (slot.endsWith(".captcha")) {
      return "captcha:integrate"
    }

    return "auth:integrate"
  }

  return null
}

export function resolveAddonSensitivePermissionForProviderKind(kind: string) {
  switch (normalizeOptionalString(kind).toLowerCase()) {
    case "auth":
    case "external-auth":
      return "auth:integrate"
    case "captcha":
      return "captcha:integrate"
    case "payment":
      return "payment:integrate"
    default:
      return null
  }
}
