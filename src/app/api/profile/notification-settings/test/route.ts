import { apiError, apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { sendSystemNotificationWebhookTest } from "@/lib/notification-writes"
import { validateNotificationSettingsPayload } from "@/lib/validators"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const validated = validateNotificationSettingsPayload(body, {
    requireUrlWhenEnabled: false,
    requireUrl: true,
  })

  if (!validated.success || !validated.data) {
    apiError(400, validated.message ?? "参数错误")
  }

  try {
    await sendSystemNotificationWebhookTest({
      userId: currentUser.id,
      webhookUrl: validated.data.notificationWebhookUrl,
    })
  } catch (error) {
    apiError(502, error instanceof Error ? `Webhook 测试失败：${error.message}` : "Webhook 测试失败")
  }

  logRouteWriteSuccess({
    scope: "profile-notification-settings",
    action: "test-notification-webhook",
  }, {
    userId: currentUser.id,
    targetId: String(currentUser.id),
    extra: {
      hasNotificationWebhookUrl: true,
      externalNotificationEnabled: validated.data.externalNotificationEnabled,
    },
  })

  return apiSuccess(undefined, "测试通知已发送，请检查你的 Webhook 接收端")
}, {
  errorMessage: "Webhook 测试失败",
  logPrefix: "[api/profile/notification-settings/test] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
