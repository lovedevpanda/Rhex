import { NextResponse } from "next/server"

import { togglePostFavorite } from "@/db/interaction-queries"
import { getCurrentUser } from "@/lib/auth"
import { hasDatabaseUrl } from "@/lib/db-status"
import { enrollUserInLotteryPool } from "@/lib/lottery"
import { tryClaimPostRedPacket } from "@/lib/post-red-packets"



export async function POST(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ code: 401, message: "请先登录后再收藏" }, { status: 401 })
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ code: 503, message: "当前未配置数据库，暂不可收藏" }, { status: 503 })
  }

  const body = await request.json()
  const postId = String(body.postId ?? "")

  if (!postId) {
    return NextResponse.json({ code: 400, message: "缺少帖子参数" }, { status: 400 })
  }

  const result = await togglePostFavorite({
    userId: user.id,
    postId,
  })

  let redPacketClaim: Awaited<ReturnType<typeof tryClaimPostRedPacket>> | null = null

  if (result.favored) {
    const settled = await Promise.all([
      enrollUserInLotteryPool({ postId, userId: user.id }).catch(() => null),
      tryClaimPostRedPacket({ postId, userId: user.id, triggerType: "FAVORITE" }).catch(() => null),
    ])
    redPacketClaim = settled[1] ?? null
  }

  return NextResponse.json({

    code: 0,
    message: result.favored ? (redPacketClaim?.claimed ? `收藏成功，并领取了 ${redPacketClaim.amount} ${redPacketClaim.pointName} 红包` : "收藏成功") : "已取消收藏",

    data: { favored: result.favored },
  })

}

