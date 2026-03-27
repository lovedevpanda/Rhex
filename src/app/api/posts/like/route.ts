import { togglePostLike } from "@/db/interaction-queries"
import { apiError, apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { handlePostLikeSideEffects } from "@/lib/interaction-side-effects"
import { logRequestSucceeded } from "@/lib/request-log"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await request.json()
  const postId = String(body.postId ?? "")

  if (!postId) {
    apiError(400, "缺少帖子参数")
  }

  const result = await togglePostLike({
    userId: currentUser.id,
    postId,
    senderName: currentUser.nickname ?? currentUser.username,
  })

  const { redPacketClaim } = await handlePostLikeSideEffects({
    liked: result.liked,
    postId,
    userId: currentUser.id,
    targetUserId: result.targetUserId,
  })

  logRequestSucceeded({
    scope: "posts-like",
    action: "toggle-post-like",
    userId: currentUser.id,
    targetId: postId,
  }, {
    liked: result.liked,
  })

  return apiSuccess({ liked: result.liked }, result.liked ? (redPacketClaim?.claimed ? `点赞成功，并领取了 ${redPacketClaim.amount} ${redPacketClaim.pointName} 红包` : "点赞成功") : "已取消点赞")
}, {
  errorMessage: "帖子点赞失败",
  logPrefix: "[api/posts/like] unexpected error",
  unauthorizedMessage: "请先登录后再点赞",
  allowStatuses: ["ACTIVE", "MUTED", "BANNED", "INACTIVE"],
})


