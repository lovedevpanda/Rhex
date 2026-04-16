import { countUnreadNotifications } from "@/db/notification-read-queries"
import { markNotificationAsRead } from "@/db/notification-queries"
import { apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { notificationEventBus } from "@/lib/notification-event-bus"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const notificationId = requireStringField(body, "notificationId", "缺少通知 ID")

  await markNotificationAsRead(currentUser.id, notificationId)
  const unreadNotificationCount = await countUnreadNotifications(currentUser.id)
  revalidateUserSurfaceCache(currentUser.id)
  await notificationEventBus.publish({
    type: "notification.count",
    userId: currentUser.id,
    unreadNotificationCount,
    reason: "read",
    notificationId,
    occurredAt: new Date().toISOString(),
  })

  return apiSuccess(undefined, "已标记为已读")
}, {
  errorMessage: "标记通知失败",
  logPrefix: "[api/notifications/read] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
