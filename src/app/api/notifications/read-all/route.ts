import { markAllNotificationsAsRead } from "@/db/notification-queries"
import { apiSuccess, createUserRouteHandler } from "@/lib/api-route"

export const POST = createUserRouteHandler(async ({ currentUser }) => {
  await markAllNotificationsAsRead(currentUser.id)
  return apiSuccess(undefined, "全部通知已标记为已读")
}, {
  errorMessage: "批量标记通知失败",
  logPrefix: "[api/notifications/read-all] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED", "BANNED", "INACTIVE"],
})
