import { toggleCommentLike } from "@/db/interaction-queries"
import {  apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { syncUserReceivedLikes } from "@/lib/level-system"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const commentId = requireStringField(body, "commentId", "缺少评论参数")

  const result = await toggleCommentLike({
    userId: currentUser.id,
    commentId,
    senderName: currentUser.nickname ?? currentUser.username,
  })

  if (result.targetUserId) {
    await syncUserReceivedLikes(result.targetUserId)
  }

  return apiSuccess({ liked: result.liked }, result.liked ? "点赞成功" : "已取消点赞")
}, {
  errorMessage: "评论点赞失败",
  logPrefix: "[api/comments/like] unexpected error",
  unauthorizedMessage: "请先登录后再点赞",
  allowStatuses: ["ACTIVE", "MUTED"],
})

