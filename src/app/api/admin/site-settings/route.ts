import { apiError, apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { getOrCreateSiteSettings, updateSiteSettingsBySection } from "@/lib/admin-site-settings-service"
import { revalidateAdminMutationPaths } from "@/lib/admin-action-types"
import { resolveAdminPermissionState } from "@/lib/admin-permission-overrides"
import { canAdminTierWithEffectivePermissions } from "@/lib/admin-navigation"
import type { AdminPermissionKey } from "@/lib/admin-permission-policy"
import type { AdminActor } from "@/lib/moderator-permissions"

const SITE_SETTINGS_ACCESS_PERMISSIONS = [
  "admin.siteSettings.manage",
  "admin.operations.manage",
] satisfies AdminPermissionKey[]

async function resolveSiteSettingsPermissionContext(adminUser: AdminActor, message: string) {
  const permissionState = await resolveAdminPermissionState(adminUser)
  const effectivePermissionSet = new Set(permissionState.effectivePermissions)
  const canAccessSettings = SITE_SETTINGS_ACCESS_PERMISSIONS.some((permission) =>
    canAdminTierWithEffectivePermissions(permissionState.tier, permission, effectivePermissionSet)
  )

  if (!canAccessSettings) {
    apiError(403, message)
  }

  return {
    permissionState,
    effectivePermissionSet,
  }
}

/**
 * 剥离敏感字段后再返回。
 *
 * `getOrCreateSiteSettings()` 返回的是整行 SiteSetting，其中 `sensitiveStateJson`
 * 是**明文**存储的全部密钥：OAuth client secret、Turnstile secret、S3/OSS 密钥、
 * 短信 AccessKey、支付网关密钥、插件密钥，以及各 AI 供应商的 API Key。
 *
 * 这个路由的权限闸门是 admin.operations.manage（每个 ADMIN 都有），而写入侧需要
 * admin.siteSettings.manage —— 读侧比写侧宽松，等于给任何管理员开了密钥后门。
 * 全仓库没有客户端消费这个 GET，所以直接剔除敏感字段即可。
 */
function stripSensitiveSiteSettings<T extends Record<string, unknown>>(settings: T): Omit<T, "sensitiveStateJson"> {
  const rest = { ...settings }
  delete (rest as Record<string, unknown>).sensitiveStateJson
  return rest
}

export const GET = createAdminRouteHandler(async ({ adminUser }) => {
  await resolveSiteSettingsPermissionContext(adminUser, "无权访问站点设置")
  const settings = await getOrCreateSiteSettings()
  return apiSuccess(stripSensitiveSiteSettings(settings as unknown as Record<string, unknown>))
}, {
  errorMessage: "读取站点设置失败",
  logPrefix: "[api/admin/site-settings:GET] unexpected error",
  unauthorizedMessage: "无权访问",
})

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const { permissionState, effectivePermissionSet } = await resolveSiteSettingsPermissionContext(adminUser, "无权操作")
  const result = await updateSiteSettingsBySection(body, {
    adminTier: permissionState.tier,
    effectivePermissions: effectivePermissionSet,
  })

  if (result.revalidatePaths?.length) {
    revalidateAdminMutationPaths(result.revalidatePaths)
  }

  // 见 stripSensitiveSiteSettings：POST 返回的也是整行记录，同样不能带密钥
  return apiSuccess(
    result.settings === undefined
      ? undefined
      : stripSensitiveSiteSettings(result.settings as Record<string, unknown>),
    result.message,
  )
}, {
  errorMessage: "保存站点设置失败",
  logPrefix: "[api/admin/site-settings:POST] unexpected error",
  unauthorizedMessage: "无权操作",
})
