import { getCurrentUser } from "@/lib/auth"
import { apiSuccess, createUserRouteHandler, readJsonBody, requireNumberField, requireSearchParam, requireStringField } from "@/lib/api-route"
import { getPostTipSummary, tipPost } from "@/lib/post-tips"

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

  const result = await tipPost({
    postId,
    senderId: currentUser.id,
    amount,
  })

  const summary = await getPostTipSummary(postId, currentUser.id)

  return apiSuccess(summary, `已成功打赏 ${result.amount} ${result.pointName}`)
}, {
  errorMessage: "打赏失败",
  logPrefix: "[api/posts/tip] unexpected error",
  unauthorizedMessage: "请先登录后再打赏",
  allowStatuses: ["ACTIVE", "MUTED", "BANNED", "INACTIVE"],
})
