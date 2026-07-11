import { countUnreadNotifications } from "@/db/notification-read-queries"
import { deleteAllNotificationsByUserId, deleteNotificationByUserId } from "@/db/notification-queries"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, readOptionalStringField, type JsonObject } from "@/lib/api-route"
import { notificationEventBus } from "@/lib/notification-event-bus"
import { invalidateNotificationUserCache } from "@/lib/notification-redis-cache"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"

export function readNotificationDeleteRequest(body: JsonObject) {
  const notificationId = readOptionalStringField(body, "notificationId")
  const deleteAll = body.deleteAll === true

  if (deleteAll && notificationId) {
    apiError(400, "不能同时指定通知和全部删除")
  }

  if (!deleteAll && !notificationId) {
    apiError(400, "缺少通知 ID")
  }

  return { notificationId, deleteAll }
}

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const { notificationId, deleteAll } = readNotificationDeleteRequest(body)

  const result = deleteAll
    ? await deleteAllNotificationsByUserId(currentUser.id)
    : notificationId
      ? await deleteNotificationByUserId(currentUser.id, notificationId)
      : { count: 0 }

  await invalidateNotificationUserCache(currentUser.id)
  const unreadNotificationCount = await countUnreadNotifications(currentUser.id)
  revalidateUserSurfaceCache(currentUser.id)
  await notificationEventBus.publish({
    type: "notification.count",
    userId: currentUser.id,
    unreadNotificationCount,
    reason: deleteAll ? "deleted-batch" : "deleted",
    notificationId: notificationId || undefined,
    occurredAt: new Date().toISOString(),
  })

  return apiSuccess({ deletedCount: result.count }, deleteAll ? "通知已清空" : "通知已删除")
}, {
  errorMessage: "删除通知失败",
  logPrefix: "[api/notifications/delete] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
