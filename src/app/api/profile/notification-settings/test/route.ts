import { apiError, apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { sendUserNotificationWebhookTest } from "@/lib/user-notification-delivery"
import { validateNotificationSettingsPayload } from "@/lib/validators"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const validated = validateNotificationSettingsPayload(body, {
    requireUrlWhenEnabled: false,
    requireUrl: true,
  })

  if (!validated.success || !validated.data) {
    apiError(400, validated.message ?? "参数错误")
  }

  const payload = validated.data
  const webhookUrl = payload.notificationPreferences.webhook.url

  return withRequestWriteGuard(createRequestWriteGuardOptions("profile-notification-webhook-test", {
    request,
    userId: currentUser.id,
    input: {
      notificationWebhookUrl: webhookUrl,
    },
  }), async () => {
    try {
      await sendUserNotificationWebhookTest({
        userId: currentUser.id,
        webhookUrl,
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
        webhookEnabled: payload.notificationPreferences.webhook.enabled,
      },
    })

    return apiSuccess(undefined, "测试通知已发送，请检查你的 Webhook 接收端")
  })
}, {
  errorMessage: "Webhook 测试失败",
  logPrefix: "[api/profile/notification-settings/test] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
