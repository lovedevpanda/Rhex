import { apiSuccess, createUserRouteHandler, readJsonBody, requireNumberField, readOptionalStringField } from "@/lib/api-route"
import { executeDirectMessageSend } from "@/lib/message-send-execution"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const recipientId = requireNumberField(body, "recipientId", "缺少接收方信息")
  const content = readOptionalStringField(body, "body")
  const data = await executeDirectMessageSend({
    recipientId,
    body: content,
  }, {
    request,
    sender: {
      id: currentUser.id,
      username: currentUser.username,
      nickname: currentUser.nickname,
      avatarPath: currentUser.avatarPath,
      status: currentUser.status,
    },
    log: {
      scope: "messages-send",
      action: "send-direct-message",
    },
  })

  return apiSuccess(data, data.contentAdjusted ? "发送成功，部分内容已自动替换" : "发送成功")
}, {
  errorMessage: "发送失败",
  logPrefix: "[api/messages/send] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
  forbiddenMessages: {
    BANNED: "账号已被拉黑，无法发送私信",
    INACTIVE: "账号未激活，无法发送私信",
  },
})
