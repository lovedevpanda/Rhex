import { apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { markConversationAsRead } from "@/lib/messages"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const conversationId = requireStringField(body, "conversationId", "缺少会话信息")

  return withRequestWriteGuard({
    request,
    userId: currentUser.id,
    scope: "messages-read",
    cooldownMs: 500,
    dedupeKey: `${currentUser.id}:${conversationId}`,
    dedupeWindowMs: 1_000,
  }, async () => {
    await markConversationAsRead(conversationId, currentUser.id)

    logRouteWriteSuccess({
      scope: "messages-read",
      action: "mark-conversation-read",
    }, {
      userId: currentUser.id,
      targetId: conversationId,
    })

    return apiSuccess(undefined, "已读状态已更新")
  })
}, {
  errorMessage: "更新会话已读失败",
  logPrefix: "[api/messages/read] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED", "BANNED", "INACTIVE"],
})
