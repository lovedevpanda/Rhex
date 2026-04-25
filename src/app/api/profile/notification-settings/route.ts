import { prisma } from "@/db/client"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import type { UserNotificationPreferences } from "@/lib/user-notification-preferences"
import { mergeUserProfileSettings, resolveUserProfileSettings } from "@/lib/user-profile-settings"
import { validateNotificationSettingsPayload } from "@/lib/validators"

type NotificationSettingsResponse = {
  notificationPreferences: UserNotificationPreferences
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
  const nextNotificationPreferences = validated.data.notificationPreferences

  await executeAddonActionHook("user.notification-settings.update.before", {
    userId: currentUser.id,
    username: currentUser.username,
    notificationPreferences: nextNotificationPreferences,
    emailNotificationEnabled: nextNotificationPreferences.email.enabled,
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
    notificationPreferences: profileSettings.notificationPreferences,
    emailNotificationEnabled: profileSettings.notificationPreferences.email.enabled,
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
      webhookEnabled: profileSettings.notificationPreferences.webhook.enabled,
      emailEnabled: profileSettings.notificationPreferences.email.enabled,
      hasNotificationWebhookUrl: Boolean(profileSettings.notificationPreferences.webhook.url),
    },
  })

  return apiSuccess({
    notificationPreferences: profileSettings.notificationPreferences,
  }, "通知设置已更新")
}, {
  errorMessage: "保存通知设置失败",
  logPrefix: "[api/profile/notification-settings] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
