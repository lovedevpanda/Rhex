import { apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { updateCommentFlow } from "@/lib/comment-update-service"
import { logRequestSucceeded } from "@/lib/request-log"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const result = await updateCommentFlow({
    body,
    currentUser: {
      id: currentUser.id,
      role: currentUser.role,
      username: currentUser.username,
      nickname: currentUser.nickname,
    },
  })

  const targetId = typeof body?.commentId === "string" ? body.commentId : ""
  logRequestSucceeded({
    scope: "comments-update",
    action: "update-comment",
    userId: currentUser.id,
    targetId,
  }, {
    reviewRequired: result.contentSafety.shouldReview,
  })

  return apiSuccess({
    id: result.updated.id,
  }, result.contentSafety.shouldReview ? "评论编辑内容命中敏感词规则，已进入审核" : "评论已更新")
}, {
  errorMessage: "评论编辑失败",
  logPrefix: "[api/comments/update] unexpected error",
  unauthorizedMessage: "请先登录后再编辑评论",
  allowStatuses: ["ACTIVE"],
  forbiddenMessages: {
    MUTED: "账号已被禁言，暂不可编辑评论",
    BANNED: "账号已被拉黑，无法编辑评论",
  },
})
