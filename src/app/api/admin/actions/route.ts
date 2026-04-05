import { apiSuccess, createAdminRouteHandler, readJsonBody, readOptionalStringField, requireStringField } from "@/lib/api-route"
import { getRequestIp } from "@/lib/admin"
import { executeAdminAction } from "@/lib/admin-action-management"

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const requestIp = getRequestIp(request)
  const body = await readJsonBody(request)
  const action = requireStringField(body, "action", "缺少必要参数")
  const targetId = requireStringField(body, "targetId", "缺少必要参数")
  const message = readOptionalStringField(body, "message")

  const result = await executeAdminAction({
    actor: adminUser,
    adminUserId: adminUser.id,
    action,
    targetId,
    message,
    requestIp,
    body,
  })

  return apiSuccess(result.data, result.message)
}, {
  errorMessage: "后台操作失败",
  logPrefix: "[api/admin/actions] unexpected error",
  unauthorizedMessage: "无权执行后台操作",
  allowModerator: true,
})
