import { countUnreadNotifications } from "@/db/notification-read-queries"
import { markAllNotificationsAsRead } from "@/db/notification-queries"
import { apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { notificationEventBus } from "@/lib/notification-event-bus"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"

export const POST = createUserRouteHandler(async ({ currentUser }) => {
  await markAllNotificationsAsRead(currentUser.id)
  const unreadNotificationCount = await countUnreadNotifications(currentUser.id)
  revalidateUserSurfaceCache(currentUser.id)
  await notificationEventBus.publish({
    type: "notification.count",
    userId: currentUser.id,
    unreadNotificationCount,
    reason: "read-all",
    occurredAt: new Date().toISOString(),
  })
  return apiSuccess(undefined, "全部通知已标记为已读")
}, {
  errorMessage: "批量标记通知失败",
  logPrefix: "[api/notifications/read-all] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
