import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { publishMessageEvent } from "@/lib/message-event-bus"
import { sendDirectMessage } from "@/lib/messages"

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  const body = await request.json()
  const recipientId = Number(body.recipientId)
  const content = String(body.body ?? "")

  if (!Number.isFinite(recipientId)) {
    return NextResponse.json({ code: 400, message: "缺少接收方信息" }, { status: 400 })
  }

  try {
    const data = await sendDirectMessage(currentUser.id, recipientId, content)

    publishMessageEvent([currentUser.id, recipientId], {
      type: "message.created",
      conversationId: data.conversationId,
      messageId: data.id,
      senderId: currentUser.id,
      recipientId,
      occurredAt: data.occurredAt,
    })

    return NextResponse.json({ code: 0, message: "发送成功", data })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "发送失败" }, { status: 400 })
  }
}
