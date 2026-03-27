import { apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { updatePostFlow } from "@/lib/post-update-service"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const result = await updatePostFlow({
    body,
    currentUser: {
      id: currentUser.id,
      role: currentUser.role,
    },
  })

  logRouteWriteSuccess({
    scope: "posts-update",
    action: result.mode === "append" ? "append-post" : "update-post",
  }, {
    userId: currentUser.id,
    targetId: result.post.id,
    extra: {
      slug: result.post.slug,
      mode: result.mode,
      reviewRequired: result.shouldReview,
    },
  })

  return apiSuccess({
    id: result.post.id,
    slug: result.post.slug,
  }, result.mode === "append"
    ? (result.shouldReview ? "补充内容已提交，命中敏感词审核规则" : "已追加补充内容")
    : (result.shouldReview ? "帖子已更新，内容命中敏感词审核规则" : "帖子已更新"))
}, {
  errorMessage: "修改帖子失败",
  logPrefix: "[api/posts/update] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED", "BANNED", "INACTIVE"],
})
