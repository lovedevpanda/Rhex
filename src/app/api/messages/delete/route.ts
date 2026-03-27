import { apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { deleteConversationForUser } from "@/lib/messages"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const conversationId = requireStringField(body, "conversationId", "缺少会话信息")

  return withRequestWriteGuard({
    request,
    userId: currentUser.id,
    scope: "messages-delete",
    cooldownMs: 1_000,
    dedupeKey: `${currentUser.id}:${conversationId}`,
  }, async () => {
    await deleteConversationForUser(conversationId, currentUser.id)

    logRouteWriteSuccess({
      scope: "messages-delete",
      action: "delete-conversation",
    }, {
      userId: currentUser.id,
      targetId: conversationId,
    })

    return apiSuccess(undefined, "会话已删除")
  })
}, {
  errorMessage: "删除会话失败",
  logPrefix: "[api/messages/delete] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED", "BANNED", "INACTIVE"],
})
