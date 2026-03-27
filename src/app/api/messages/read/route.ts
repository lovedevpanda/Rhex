import { apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { publishMessageEvent } from "@/lib/message-event-bus"
import { markConversationAsRead } from "@/lib/messages"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const conversationId = requireStringField(body, "conversationId", "缺少会话信息")

  await markConversationAsRead(conversationId, currentUser.id)


  publishMessageEvent([currentUser.id], {
    type: "conversation.read",
    conversationId,
    senderId: currentUser.id,
    occurredAt: new Date().toISOString(),
  })

  return apiSuccess(undefined, "已读状态已更新")
}, {
  errorMessage: "更新会话已读失败",
  logPrefix: "[api/messages/read] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED", "BANNED", "INACTIVE"],
})
