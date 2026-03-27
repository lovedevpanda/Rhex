import { apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { publishMessageEvent } from "@/lib/message-event-bus"
import { deleteConversationForUser } from "@/lib/messages"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const conversationId = requireStringField(body, "conversationId", "缺少会话信息")

  await deleteConversationForUser(conversationId, currentUser.id)


  publishMessageEvent([currentUser.id], {
    type: "conversation.read",
    conversationId,
    senderId: currentUser.id,
    occurredAt: new Date().toISOString(),
  })

  return apiSuccess(undefined, "会话已删除")
}, {
  errorMessage: "删除会话失败",
  logPrefix: "[api/messages/delete] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED", "BANNED", "INACTIVE"],
})
