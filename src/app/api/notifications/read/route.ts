import { markNotificationAsRead } from "@/db/notification-queries"
import { apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const notificationId = requireStringField(body, "notificationId", "缺少通知 ID")

  await markNotificationAsRead(currentUser.id, notificationId)

  return apiSuccess(undefined, "已标记为已读")
}, {
  errorMessage: "标记通知失败",
  logPrefix: "[api/notifications/read] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED", "BANNED", "INACTIVE"],
})
