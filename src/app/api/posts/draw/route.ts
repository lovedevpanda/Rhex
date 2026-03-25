import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { hasDatabaseUrl } from "@/lib/db-status"
import { drawLotteryWinners } from "@/lib/lottery"
import { prisma } from "@/db/client"

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ code: 503, message: "当前未配置数据库，暂不可开奖" }, { status: 503 })
  }

  const body = await request.json()
  const postId = String(body.postId ?? "").trim()
  if (!postId) {
    return NextResponse.json({ code: 400, message: "缺少帖子参数" }, { status: 400 })
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      type: true,
    },
  })

  if (!post || post.type !== "LOTTERY") {
    return NextResponse.json({ code: 404, message: "抽奖帖不存在" }, { status: 404 })
  }

  const isAdmin = currentUser.role === "ADMIN" || currentUser.role === "MODERATOR"
  if (!isAdmin && post.authorId !== currentUser.id) {
    return NextResponse.json({ code: 403, message: "仅楼主或管理员可开奖" }, { status: 403 })
  }

  try {
    const result = await drawLotteryWinners(postId, { actorId: currentUser.id })
    return NextResponse.json({
      code: 0,
      message: "开奖成功",
      data: result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "开奖失败"
    return NextResponse.json({ code: 400, message }, { status: 400 })
  }
}
