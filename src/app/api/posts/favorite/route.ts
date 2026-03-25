import { NextResponse } from "next/server"

import { togglePostFavorite } from "@/db/interaction-queries"
import { getCurrentUser } from "@/lib/auth"
import { hasDatabaseUrl } from "@/lib/db-status"
import { enrollUserInLotteryPool } from "@/lib/lottery"


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

  if (result.favored) {
    await enrollUserInLotteryPool({ postId, userId: user.id }).catch(() => null)
  }

  return NextResponse.json({
    code: 0,
    message: result.favored ? "收藏成功" : "已取消收藏",
    data: { favored: result.favored },
  })

}

