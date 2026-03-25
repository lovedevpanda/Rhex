import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { publishMessageEvent } from "@/lib/message-event-bus"
import { deleteConversationForUser } from "@/lib/messages"

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  const body = await request.json()
  const conversationId = String(body.conversationId ?? "")

  if (!conversationId) {
    return NextResponse.json({ code: 400, message: "缺少会话信息" }, { status: 400 })
  }

  try {
    await deleteConversationForUser(conversationId, currentUser.id)

    publishMessageEvent([currentUser.id], {
      type: "conversation.read",
      conversationId,
      senderId: currentUser.id,
      occurredAt: new Date().toISOString(),
    })

    return NextResponse.json({ code: 0, message: "会话已删除" })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "删除会话失败" }, { status: 400 })
  }
}
