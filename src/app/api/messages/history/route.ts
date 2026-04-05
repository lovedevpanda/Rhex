import { apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { getConversationHistory } from "@/lib/messages"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const conversationId = requireStringField(body, "conversationId", "缺少历史消息参数")
  const beforeMessageId = requireStringField(body, "beforeMessageId", "缺少历史消息参数")

  const data = await getConversationHistory(currentUser.id, conversationId, beforeMessageId)

  return apiSuccess(data, "加载成功")
}, {
  errorMessage: "加载历史消息失败",
  logPrefix: "[api/messages/history] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
