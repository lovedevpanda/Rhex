import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { subscribeMessageEvents } from "@/lib/message-event-bus"

export async function GET(request: Request) {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const push = (payload: string) => {
        controller.enqueue(encoder.encode(payload))
      }

      push(`data: ${JSON.stringify({ type: "heartbeat", occurredAt: new Date().toISOString() })}\n\n`)

      const unsubscribe = subscribeMessageEvents(currentUser.id, push)

      const heartbeat = setInterval(() => {
        push(`data: ${JSON.stringify({ type: "heartbeat", occurredAt: new Date().toISOString() })}\n\n`)
      }, 15000)

      const close = () => {
        clearInterval(heartbeat)
        unsubscribe()
        controller.close()
      }

      request.signal.addEventListener("abort", close)
    },
    cancel() {
      return
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
