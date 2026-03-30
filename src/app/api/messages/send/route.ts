import { apiSuccess, createUserRouteHandler, readJsonBody, requireNumberField, readOptionalStringField } from "@/lib/api-route"
import { sendDirectMessage } from "@/lib/messages"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const recipientId = requireNumberField(body, "recipientId", "缺少接收方信息")
  const content = readOptionalStringField(body, "body")

  return withRequestWriteGuard({
    request,
    userId: currentUser.id,
    scope: "messages-send",
    cooldownMs: 1_000,
    dedupeKey: `${currentUser.id}:${recipientId}:${content}`,
  }, async () => {
    const data = await sendDirectMessage(currentUser.id, recipientId, content)

    logRouteWriteSuccess({
      scope: "messages-send",
      action: "send-direct-message",
    }, {
      userId: currentUser.id,
      targetId: String(recipientId),
      extra: {
        conversationId: data.conversationId,
        messageId: data.id,
      },
    })

    return apiSuccess(data, "发送成功")
  })
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
