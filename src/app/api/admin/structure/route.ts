import { apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"

import { getRequestIp, writeAdminLog } from "@/lib/admin"
import { createStructureItem, deleteStructureItem, updateStructureItem } from "@/lib/admin-structure-service"

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const result = await createStructureItem({
    body,
    adminId: adminUser.id,
    actor: adminUser,
  })

  await writeAdminLog(adminUser.id, result.action, result.targetType, result.targetId, result.detail, getRequestIp(request))
  return apiSuccess(result.data, result.message)
}, {
  errorMessage: "创建结构失败",
  logPrefix: "[api/admin/structure:POST] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
  allowModerator: true,
})

export const PUT = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const result = await updateStructureItem({
    body,
    adminId: adminUser.id,
    actor: adminUser,
  })

  await writeAdminLog(adminUser.id, result.action, result.targetType, result.targetId, result.detail, getRequestIp(request))
  return apiSuccess(undefined, result.message)
}, {
  errorMessage: "更新结构失败",
  logPrefix: "[api/admin/structure:PUT] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
  allowModerator: true,
})

export const DELETE = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const result = await deleteStructureItem({
    body,
    adminId: adminUser.id,
    requestIp: getRequestIp(request),
    actor: adminUser,
  })

  await writeAdminLog(adminUser.id, result.action, result.targetType, result.targetId, result.detail, getRequestIp(request))
  return apiSuccess(undefined, result.message)
}, {
  errorMessage: "删除结构失败",
  logPrefix: "[api/admin/structure:DELETE] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
  allowModerator: true,
})
