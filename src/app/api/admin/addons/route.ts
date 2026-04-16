import { apiError, apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { getAddonsAdminData, runAddonManagementAction } from "@/addons-host/management"
import type { AddonManagementAction } from "@/addons-host/admin-types"

export const dynamic = "force-dynamic"

export const GET = createAdminRouteHandler(async () => {
  return apiSuccess(await getAddonsAdminData())
}, {
  errorMessage: "插件宿主数据加载失败",
  logPrefix: "[api/admin/addons:GET] unexpected error",
  unauthorizedMessage: "无权访问插件宿主",
})

export const POST = createAdminRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const rawAction = typeof body.action === "string" ? body.action.trim() : "sync"
  const action = ["sync", "clear-cache", "enable", "disable", "remove"].includes(rawAction)
    ? rawAction as AddonManagementAction
    : null
  const addonId = typeof body.addonId === "string" ? body.addonId.trim() : ""

  if (!action) {
    apiError(400, "未知插件操作")
  }

  const result = await runAddonManagementAction(action, addonId)
  return apiSuccess(result.data, result.message)
}, {
  errorMessage: "插件宿主操作失败",
  logPrefix: "[api/admin/addons:POST] unexpected error",
  unauthorizedMessage: "无权操作插件宿主",
})
