import { apiSuccess, createUserRouteHandler, readJsonBody, requireNumberField, readOptionalStringField } from "@/lib/api-route"
import { publishMessageEvent } from "@/lib/message-event-bus"
import { sendDirectMessage } from "@/lib/messages"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const recipientId = requireNumberField(body, "recipientId", "缺少接收方信息")
  const content = readOptionalStringField(body, "body")

  const data = await sendDirectMessage(currentUser.id, recipientId, content)


  publishMessageEvent([currentUser.id, recipientId], {
    type: "message.created",
    conversationId: data.conversationId,
    messageId: data.id,
    senderId: currentUser.id,
    recipientId,
    occurredAt: data.occurredAt,
  })

  return apiSuccess(data, "发送成功")
}, {
  errorMessage: "发送失败",
  logPrefix: "[api/messages/send] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED", "BANNED", "INACTIVE"],
})
