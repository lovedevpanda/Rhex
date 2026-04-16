import { apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { deleteConversationForUser, getUnreadMessageConversationCount } from "@/lib/messages"
import { messageEventBus } from "@/lib/message-event-bus"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const conversationId = requireStringField(body, "conversationId", "缺少会话信息")

  return withRequestWriteGuard(createRequestWriteGuardOptions("messages-delete", {
    request,
    userId: currentUser.id,
    input: {
      conversationId,
    },
  }), async () => {
    await deleteConversationForUser(conversationId, currentUser.id)
    const unreadMessageCount = await getUnreadMessageConversationCount(currentUser.id)

    revalidateUserSurfaceCache(currentUser.id)
    await messageEventBus.publish({
      type: "conversation.deleted",
      conversationId,
      userId: currentUser.id,
      unreadMessageCount,
      occurredAt: new Date().toISOString(),
    })

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
  allowStatuses: ["ACTIVE", "MUTED"],
})
