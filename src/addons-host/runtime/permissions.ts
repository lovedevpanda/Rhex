import "server-only"

import type { AddonManifest } from "@/addons-host/types"

/**
 * These permissions gate capabilities exposed by Rhex's addon API. They are
 * deliberately not described as a sandbox: an addon server entry is imported
 * and executed in the host Node.js process.
 */
export const ADDON_RUNTIME_PERMISSIONS = [
  "config:read",
  "config:write",
  "secret:read",
  "secret:write",
  "background-job:register",
  "background-job:enqueue",
  "background-job:delete",
  "database:sql",
  "database:orm",
  "data:read",
  "data:write",
  "data:delete",
  "data:migrate",
  "file:write",
  "slot:register",
  "surface:register",
  "page:public",
  "page:admin",
  "api:public",
  "api:admin",
  "provider:register",
  "hook:register",
  "post:create",
  "post:query",
  "post:like",
  "comment:create",
  "comment:query",
  "comment:like",
  "message:send",
  "notification:create",
  "email:send",
  "sms:send",
  "follow:user",
  "points:adjust",
  "badge:query",
  "badge:grant",
  "post:tip",
  "network:external",
  "auth:integrate",
  "captcha:integrate",
  "payment:integrate",
  "sms:integrate",
] as const

export type AddonRuntimePermission =
  (typeof ADDON_RUNTIME_PERMISSIONS)[number]

const ADDON_RUNTIME_PERMISSION_SET = new Set<string>(ADDON_RUNTIME_PERMISSIONS)

/**
 * Server operators must set this exact value before Rhex imports any addon
 * server module. It is intentionally verbose so enabling addons cannot happen
 * by accident through a generic boolean switch.
 */
export const ADDON_TRUSTED_CODE_ACKNOWLEDGEMENT_ENV =
  "RHEX_ADDON_TRUSTED_CODE_ACKNOWLEDGED"
export const ADDON_TRUSTED_CODE_ACKNOWLEDGEMENT =
  "I_UNDERSTAND_ADDONS_RUN_WITH_FULL_SERVER_PRIVILEGES"

export const ADDON_TRUST_BOUNDARY_MESSAGE =
  "插件服务端代码与 Rhex 运行在同一 Node.js 进程中。permissions 仅约束 Rhex 提供的插件 API，不提供文件系统、进程、数据库或网络隔离；只允许安装并执行完全可信的代码。"

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

function formatManifestPermission(permission: string) {
  const normalized = normalizeLegacyPermission(permission)
  if (/^(sandbox|isolation|isolated|jail|process):/i.test(normalized)) {
    return `权限声明 "${permission}" 无效：Rhex 插件运行时不提供安全沙箱或进程隔离，不能在 manifest 中声明此类限制。`
  }

  return `权限声明 "${permission}" 不受 Rhex 支持。permissions 只能声明 Rhex 插件 API 能力，不能作为宿主机权限或隔离策略。`
}

/**
 * Returns declaration errors rather than throwing so callers can present a
 * safe install/load error without taking down the whole addon registry.
 */
export function getAddonManifestPermissionDeclarationErrors(
  permissions?: string[] | null,
) {
  const errors: string[] = []
  const seen = new Set<string>()

  for (const permission of permissions ?? []) {
    const normalized = normalizeLegacyPermission(permission)
    if (!normalized || ADDON_RUNTIME_PERMISSION_SET.has(normalized)) {
      continue
    }

    const key = permission.trim()
    if (!seen.has(key)) {
      seen.add(key)
      errors.push(formatManifestPermission(permission))
    }
  }

  return errors
}

export function assertAddonManifestPermissionDeclarations(
  manifest: Pick<AddonManifest, "id" | "permissions">,
) {
  const errors = getAddonManifestPermissionDeclarationErrors(manifest.permissions)
  if (errors.length > 0) {
    throw new Error(`插件 "${manifest.id}" 的 permissions 无法执行：${errors.join("；")}`)
  }
}

export function getAddonTrustedCodeExecutionStatus() {
  const acknowledged =
    process.env[ADDON_TRUSTED_CODE_ACKNOWLEDGEMENT_ENV]
    === ADDON_TRUSTED_CODE_ACKNOWLEDGEMENT

  return {
    acknowledged,
    environmentVariable: ADDON_TRUSTED_CODE_ACKNOWLEDGEMENT_ENV,
    requiredValue: ADDON_TRUSTED_CODE_ACKNOWLEDGEMENT,
    message: acknowledged
      ? ADDON_TRUST_BOUNDARY_MESSAGE
      : `${ADDON_TRUST_BOUNDARY_MESSAGE} 要执行插件，请由服务部署负责人显式设置 ${ADDON_TRUSTED_CODE_ACKNOWLEDGEMENT_ENV}=${ADDON_TRUSTED_CODE_ACKNOWLEDGEMENT}。`,
  }
}

export function assertAddonTrustedCodeExecutionAcknowledged(
  addonId?: string,
) {
  const status = getAddonTrustedCodeExecutionStatus()
  if (status.acknowledged) {
    return status
  }

  throw new Error(
    `${addonId ? `插件 "${addonId}" 未执行：` : "插件未执行："}${status.message}`,
  )
}

export function resolveAddonPermissionSet(permissions?: string[] | null) {
  const normalizedPermissions = new Set<string>()

  for (const permission of permissions ?? []) {
    const normalizedPermission = normalizeLegacyPermission(permission)
    if (
      normalizedPermission
      && ADDON_RUNTIME_PERMISSION_SET.has(normalizedPermission)
    ) {
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
    case "sms":
      return "sms:integrate"
    default:
      return null
  }
}
