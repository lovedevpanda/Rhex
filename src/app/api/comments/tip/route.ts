import { getCurrentUser } from "@/lib/auth"
import { apiSuccess, createUserRouteHandler, readJsonBody, readOptionalStringField, requireNumberField, requireSearchParam, requireStringField } from "@/lib/api-route"
import { revalidateContentListCaches } from "@/lib/content-list-cache"
import { getCommentTipSummary, tipComment } from "@/lib/post-tips"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

export async function GET(request: Request) {
  const commentId = requireSearchParam(request, "commentId", "缺少评论参数")

  const currentUser = await getCurrentUser()
  const data = await getCommentTipSummary(commentId, currentUser?.id)
  return Response.json(apiSuccess(data))
}

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const postId = requireStringField(body, "postId", "缺少帖子参数")
  const commentId = requireStringField(body, "commentId", "缺少评论参数")
  const amount = requireNumberField(body, "amount", "缺少打赏金额")
  const giftId = readOptionalStringField(body, "giftId") || undefined

  return withRequestWriteGuard(createRequestWriteGuardOptions("comments-tip", {
    request,
    userId: currentUser.id,
    input: {
      postId,
      commentId,
      amount,
      giftId,
    },
  }), async () => {
    const result = await tipComment({
      postId,
      commentId,
      senderId: currentUser.id,
      amount,
      giftId,
    })

    revalidateContentListCaches()
    revalidateUserSurfaceCache(currentUser.id)
    revalidateUserSurfaceCache(result.recipientUserId)

    const summary = await getCommentTipSummary(commentId, currentUser.id)

    return apiSuccess(summary, result.gift ? `已送出 ${result.gift.name}` : `已成功打赏 ${result.amount} ${result.pointName}`)
  })
}, {
  errorMessage: "评论打赏失败",
  logPrefix: "[api/comments/tip] unexpected error",
  unauthorizedMessage: "请登录后参与打赏",
  allowStatuses: ["ACTIVE", "MUTED"],
})
