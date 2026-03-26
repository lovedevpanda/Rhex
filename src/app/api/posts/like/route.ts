import { NextResponse } from "next/server"

import { togglePostLike } from "@/db/interaction-queries"
import { getCurrentUser } from "@/lib/auth"
import { hasDatabaseUrl } from "@/lib/db-status"
import { syncUserReceivedLikes } from "@/lib/level-system"
import { enrollUserInLotteryPool } from "@/lib/lottery"
import { tryClaimPostRedPacket } from "@/lib/post-red-packets"


export async function POST(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ code: 401, message: "请先登录后再点赞" }, { status: 401 })
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ code: 503, message: "当前未配置数据库，暂不可点赞" }, { status: 503 })
  }

  const body = await request.json()
  const postId = String(body.postId ?? "")

  if (!postId) {
    return NextResponse.json({ code: 400, message: "缺少帖子参数" }, { status: 400 })
  }

  const result = await togglePostLike({
    userId: user.id,
    postId,
    senderName: user.nickname ?? user.username,
  })

  let redPacketClaim: Awaited<ReturnType<typeof tryClaimPostRedPacket>> | null = null

  if (result.liked && result.targetUserId) {
    const settled = await Promise.all([
      syncUserReceivedLikes(result.targetUserId),
      enrollUserInLotteryPool({ postId, userId: user.id }).catch(() => null),
      tryClaimPostRedPacket({ postId, userId: user.id, triggerType: "LIKE" }).catch(() => null),
    ])
    redPacketClaim = settled[2] ?? null
  } else if (result.targetUserId) {
    await syncUserReceivedLikes(result.targetUserId)
  }

  return NextResponse.json({
    code: 0,
    message: result.liked ? (redPacketClaim?.claimed ? `点赞成功，并领取了 ${redPacketClaim.amount} ${redPacketClaim.pointName} 红包` : "点赞成功") : "已取消点赞",
    data: { liked: result.liked },
  })

}


