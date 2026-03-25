import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { getPostTipSummary, tipPost } from "@/lib/post-tips"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const postId = String(searchParams.get("postId") ?? "").trim()

  if (!postId) {
    return NextResponse.json({ code: 400, message: "缺少帖子参数" }, { status: 400 })
  }

  const currentUser = await getCurrentUser()
  const data = await getPostTipSummary(postId, currentUser?.id)
  return NextResponse.json({ code: 0, data })
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return NextResponse.json({ code: 401, message: "请先登录后再打赏" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const postId = String(body.postId ?? "").trim()
    const amount = Number(body.amount ?? 0)

    if (!postId) {
      return NextResponse.json({ code: 400, message: "缺少帖子参数" }, { status: 400 })
    }

    const result = await tipPost({
      postId,
      senderId: currentUser.id,
      amount,
    })

    const summary = await getPostTipSummary(postId, currentUser.id)

    return NextResponse.json({
      code: 0,
      message: `已成功打赏 ${result.amount} ${result.pointName}`,
      data: summary,
    })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "打赏失败" }, { status: 400 })
  }
}
