import { prisma } from "@/db/client"
import { createUserRouteHandler } from "@/lib/api-route"
import {
  buildHeartbeatPayload,
  buildMessageEventPayload,
  formatMessageStreamCursor,
  parseMessageStreamCursor,
  type MessageStreamCursor,
} from "@/lib/message-event-bus"

const POLL_INTERVAL_MS = 3_000
const HEARTBEAT_INTERVAL_MS = 15_000

async function findNextCursor(userId: number, cursor: MessageStreamCursor | null) {
  const latest = await prisma.directMessage.findFirst({
    where: {
      conversation: {
        participants: {
          some: { userId },
        },
      },
      ...(cursor
        ? {
            OR: [
              { createdAt: { gt: new Date(cursor.createdAt) } },
              {
                createdAt: new Date(cursor.createdAt),
                id: { gt: cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      createdAt: true,
      senderId: true,
      conversationId: true,
      conversation: {
        select: {
          participants: {
            where: {
              userId: {
                not: userId,
              },
            },
            select: {
              userId: true,
            },
            take: 1,
          },
        },
      },
    },
  })

  if (!latest) {
    return null
  }

  return {
    cursor: {
      id: latest.id,
      createdAt: latest.createdAt.toISOString(),
    },
    event: {
      type: "message.created" as const,
      conversationId: latest.conversationId,
      messageId: latest.id,
      senderId: latest.senderId,
      recipientId: latest.conversation.participants[0]?.userId ?? userId,
      occurredAt: latest.createdAt.toISOString(),
    },
  }
}

export const GET = createUserRouteHandler(async ({ request, currentUser }) => {
  const cursorParam = new URL(request.url).searchParams.get("cursor")
  const initialCursor = parseMessageStreamCursor(cursorParam)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let closed = false
      let cursor = initialCursor
      let pollingPromise: Promise<void> | null = null

      const push = (payload: string) => {
        if (!closed) {
          controller.enqueue(encoder.encode(payload))
        }
      }

      const close = () => {
        if (closed) {
          return
        }

        closed = true
        clearInterval(heartbeatTimer)
        clearInterval(pollingTimer)
        void pollingPromise?.catch(() => undefined)
        controller.close()
      }

      const poll = async () => {
        const next = await findNextCursor(currentUser.id, cursor)
        if (!next || closed) {
          return
        }

        cursor = next.cursor
        push(buildMessageEventPayload(next.event))
      }

      const safePoll = () => {
        pollingPromise = poll().catch((error) => {
          console.error("[api/messages/stream] poll failed", error)
          if (!closed) {
            push(`event: error\ndata: ${JSON.stringify({ message: "消息流暂时不可用" })}\n\n`)
          }
        })
      }

      push(buildHeartbeatPayload())
      if (cursor) {
        push(`event: cursor\ndata: ${JSON.stringify({ cursor: formatMessageStreamCursor(cursor) })}\n\n`)
      }

      safePoll()

      const heartbeatTimer = setInterval(() => {
        push(buildHeartbeatPayload())
      }, HEARTBEAT_INTERVAL_MS)

      const pollingTimer = setInterval(() => {
        safePoll()
      }, POLL_INTERVAL_MS)

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
      "X-Accel-Buffering": "no",
    },
  })
}, {
  errorMessage: "消息流建立失败",
  logPrefix: "[api/messages/stream] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED", "BANNED", "INACTIVE"],
})
