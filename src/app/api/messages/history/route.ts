import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { getConversationHistory } from "@/lib/messages"

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  const body = await request.json()
  const conversationId = String(body.conversationId ?? "")
  const beforeMessageId = String(body.beforeMessageId ?? "")

  if (!conversationId || !beforeMessageId) {
    return NextResponse.json({ code: 400, message: "缺少历史消息参数" }, { status: 400 })
  }

  try {
    const data = await getConversationHistory(currentUser.id, conversationId, beforeMessageId)
    return NextResponse.json({ code: 0, message: "加载成功", data })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "加载历史消息失败" }, { status: 400 })
  }
}
