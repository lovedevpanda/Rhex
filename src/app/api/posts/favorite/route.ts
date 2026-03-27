import { togglePostFavorite } from "@/db/interaction-queries"
import {  apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { enrollUserInLotteryPool } from "@/lib/lottery"
import { tryClaimPostRedPacket } from "@/lib/post-red-packets"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const postId = requireStringField(body, "postId", "缺少帖子参数")

  const result = await togglePostFavorite({
    userId: currentUser.id,
    postId,
  })

  let redPacketClaim: Awaited<ReturnType<typeof tryClaimPostRedPacket>> | null = null

  if (result.favored) {
    const settled = await Promise.all([
      enrollUserInLotteryPool({ postId, userId: currentUser.id }).catch(() => null),
      tryClaimPostRedPacket({ postId, userId: currentUser.id, triggerType: "FAVORITE" }).catch(() => null),
    ])
    redPacketClaim = settled[1] ?? null
  }

  return apiSuccess({ favored: result.favored }, result.favored ? (redPacketClaim?.claimed ? `收藏成功，并领取了 ${redPacketClaim.amount} ${redPacketClaim.pointName} 红包` : "收藏成功") : "已取消收藏")
}, {
  errorMessage: "帖子收藏失败",
  logPrefix: "[api/posts/favorite] unexpected error",
  unauthorizedMessage: "请先登录后再收藏",
  allowStatuses: ["ACTIVE", "MUTED", "BANNED", "INACTIVE"],
})

