import { prisma } from "@/db/client"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { mergeUserProfileSettings, resolveUserProfileSettings } from "@/lib/user-profile-settings"
import { validateNotificationSettingsPayload } from "@/lib/validators"

type NotificationSettingsResponse = {
  externalNotificationEnabled: boolean
  notificationWebhookUrl: string
}

export const POST = createUserRouteHandler<NotificationSettingsResponse>(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const validated = validateNotificationSettingsPayload(body)
  const requestUrl = new URL(request.url)

  if (!validated.success || !validated.data) {
    apiError(400, validated.message ?? "参数错误")
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: {
      id: true,
      signature: true,
    },
  })

  if (!dbUser) {
    apiError(404, "用户不存在")
  }

  const nextSignature = mergeUserProfileSettings(dbUser.signature, validated.data)

  await executeAddonActionHook("user.notification-settings.update.before", {
    userId: currentUser.id,
    username: currentUser.username,
    externalNotificationEnabled: validated.data.externalNotificationEnabled,
    notificationWebhookUrl: validated.data.notificationWebhookUrl,
  }, {
    request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
    throwOnError: true,
  })

  const updated = await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      signature: nextSignature,
    },
    select: {
      signature: true,
    },
  })

  const profileSettings = resolveUserProfileSettings(updated.signature)

  await executeAddonActionHook("user.notification-settings.update.after", {
    userId: currentUser.id,
    username: currentUser.username,
    externalNotificationEnabled: profileSettings.externalNotificationEnabled,
    notificationWebhookUrl: profileSettings.notificationWebhookUrl,
  }, {
    request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
  })

  logRouteWriteSuccess({
    scope: "profile-notification-settings",
    action: "update-notification-settings",
  }, {
    userId: currentUser.id,
    targetId: String(currentUser.id),
    extra: {
      externalNotificationEnabled: profileSettings.externalNotificationEnabled,
      hasNotificationWebhookUrl: Boolean(profileSettings.notificationWebhookUrl),
    },
  })

  return apiSuccess({
    externalNotificationEnabled: profileSettings.externalNotificationEnabled,
    notificationWebhookUrl: profileSettings.notificationWebhookUrl,
  }, "通知设置已更新")
}, {
  errorMessage: "保存通知设置失败",
  logPrefix: "[api/profile/notification-settings] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
