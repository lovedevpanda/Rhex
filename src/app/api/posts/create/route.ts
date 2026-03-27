import { apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { evaluateUserLevelProgress } from "@/lib/level-system"
import { createPostFlow } from "@/lib/post-create-service"
import { logRouteWriteSuccess } from "@/lib/route-metadata"

export const POST = createUserRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const result = await createPostFlow(body)

  await evaluateUserLevelProgress(result.author.id)

  logRouteWriteSuccess({
    scope: "posts-create",
    action: "create-post",
  }, {
    userId: result.author.id,
    targetId: result.post.id,
    extra: {
      slug: result.post.slug,
      status: result.post.status,
      reviewRequired: result.shouldPending,
    },
  })

  return apiSuccess({
    id: result.post.id,
    slug: result.post.slug,
    status: result.post.status,
  }, result.shouldPending ? "帖子命中敏感词或审核规则，已提交审核" : "success")
}, {
  errorMessage: "创建帖子失败",
  logPrefix: "[api/posts/create] unexpected error",
  unauthorizedMessage: "请先登录后再发帖",
  allowStatuses: ["ACTIVE"],
  forbiddenMessages: {
    MUTED: "账号已被禁言，暂不可发帖",
    BANNED: "账号已被拉黑，无法发帖",
  },
})
