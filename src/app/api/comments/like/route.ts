import { NextResponse } from "next/server"

import { toggleCommentLike } from "@/db/interaction-queries"
import { getCurrentUser } from "@/lib/auth"
import { hasDatabaseUrl } from "@/lib/db-status"
import { syncUserReceivedLikes } from "@/lib/level-system"


export async function POST(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ code: 401, message: "请先登录后再点赞" }, { status: 401 })
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ code: 503, message: "当前未配置数据库，暂不可点赞" }, { status: 503 })
  }

  const body = await request.json()
  const commentId = String(body.commentId ?? "")

  if (!commentId) {
    return NextResponse.json({ code: 400, message: "缺少评论参数" }, { status: 400 })
  }

  const result = await toggleCommentLike({
    userId: user.id,
    commentId,
    senderName: user.nickname ?? user.username,
  })

  if (result.targetUserId) {
    await syncUserReceivedLikes(result.targetUserId)
  }

  return NextResponse.json({
    code: 0,
    message: result.liked ? "点赞成功" : "已取消点赞",
    data: { liked: result.liked },
  })

}

