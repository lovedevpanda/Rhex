import { getCurrentUser } from "@/lib/auth"
import { apiSuccess, createUserRouteHandler, readJsonBody, readOptionalStringField, requireNumberField, requireSearchParam, requireStringField } from "@/lib/api-route"
import { getPostTipSummary, tipPost } from "@/lib/post-tips"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

export async function GET(request: Request) {
  const postId = requireSearchParam(request, "postId", "缺少帖子参数")

  const currentUser = await getCurrentUser()
  const data = await getPostTipSummary(postId, currentUser?.id)
  return Response.json(apiSuccess(data))
}

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const postId = requireStringField(body, "postId", "缺少帖子参数")
  const amount = requireNumberField(body, "amount", "缺少打赏金额")
  const giftId = readOptionalStringField(body, "giftId") || undefined

  return withRequestWriteGuard(createRequestWriteGuardOptions("posts-tip", {
    request,
    userId: currentUser.id,
    input: {
      postId,
      amount,
      giftId,
    },
  }), async () => {
    const result = await tipPost({
      postId,
      senderId: currentUser.id,
      amount,
      giftId,
    })

    revalidateUserSurfaceCache(currentUser.id)
    revalidateUserSurfaceCache(result.recipientUserId)

    const summary = await getPostTipSummary(postId, currentUser.id)

    return apiSuccess(summary, result.gift ? `已送出 ${result.gift.name}` : `已成功打赏 ${result.amount} ${result.pointName}`)
  })
}, {
  errorMessage: "打赏失败",
  logPrefix: "[api/posts/tip] unexpected error",
  unauthorizedMessage: "请登录后参与打赏",
  allowStatuses: ["ACTIVE", "MUTED"],
})
