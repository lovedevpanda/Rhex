import { togglePostLike } from "@/db/interaction-queries"
import { apiError, apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { syncUserReceivedLikes } from "@/lib/level-system"
import { enrollUserInLotteryPool } from "@/lib/lottery"
import { tryClaimPostRedPacket } from "@/lib/post-red-packets"

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

  let redPacketClaim: Awaited<ReturnType<typeof tryClaimPostRedPacket>> | null = null

  if (result.liked && result.targetUserId) {
    const settled = await Promise.all([
      syncUserReceivedLikes(result.targetUserId),
      enrollUserInLotteryPool({ postId, userId: currentUser.id }).catch(() => null),
      tryClaimPostRedPacket({ postId, userId: currentUser.id, triggerType: "LIKE" }).catch(() => null),
    ])
    redPacketClaim = settled[2] ?? null
  } else if (result.targetUserId) {
    await syncUserReceivedLikes(result.targetUserId)
  }

  return apiSuccess({ liked: result.liked }, result.liked ? (redPacketClaim?.claimed ? `点赞成功，并领取了 ${redPacketClaim.amount} ${redPacketClaim.pointName} 红包` : "点赞成功") : "已取消点赞")
}, {
  errorMessage: "帖子点赞失败",
  logPrefix: "[api/posts/like] unexpected error",
  unauthorizedMessage: "请先登录后再点赞",
  allowStatuses: ["ACTIVE", "MUTED", "BANNED", "INACTIVE"],
})


