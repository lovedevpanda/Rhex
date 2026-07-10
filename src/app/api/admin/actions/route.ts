import { apiError, apiSuccess, createAdminRouteHandler, readJsonBody, readOptionalStringField, requireStringField } from "@/lib/api-route"
import { getRequestIp } from "@/lib/admin"
import { executeAdminAction } from "@/lib/admin-action-management"

const MAX_ADMIN_ACTION_LENGTH = 128
const MAX_ADMIN_TARGET_ID_LENGTH = 191
const MAX_ADMIN_MESSAGE_LENGTH = 10_000

function ensureMaxLength(value: string, maxLength: number, message: string) {
  if (value.length > maxLength) {
    apiError(400, message)
  }
}

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const requestIp = getRequestIp(request)
  const body = await readJsonBody(request)
  const action = requireStringField(body, "action", "缺少必要参数")
  const targetId = requireStringField(body, "targetId", "缺少必要参数")
  const message = readOptionalStringField(body, "message")

  ensureMaxLength(action, MAX_ADMIN_ACTION_LENGTH, "\u64cd\u4f5c\u7c7b\u578b\u8fc7\u957f")
  ensureMaxLength(targetId, MAX_ADMIN_TARGET_ID_LENGTH, "\u76ee\u6807\u6807\u8bc6\u8fc7\u957f")
  ensureMaxLength(message, MAX_ADMIN_MESSAGE_LENGTH, "\u64cd\u4f5c\u8bf4\u660e\u8fc7\u957f")

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
