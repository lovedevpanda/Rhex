import { prisma } from "@/db/client"
import { createUserRouteHandler } from "@/lib/api-route"
import {
  buildCursorPayload,
  buildHeartbeatPayload,
  buildMessageEventPayload,
  compareMessageStreamCursor,
  createMessageStreamCursor,
  getMessageStreamCursorFromEvent,
  isMessageStreamCursorAfter,
  messageEventBus,
  parseMessageStreamCursor,
  type MessageStreamEvent,
  type MessageStreamCursor,
} from "@/lib/message-event-bus"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const HEARTBEAT_INTERVAL_MS = 15_000
const MESSAGE_CATCH_UP_BATCH_SIZE = 50

interface MessageStreamEventEnvelope {
  cursor: MessageStreamCursor
  event: MessageStreamEvent
}

function mapMessageRowToEnvelope(
  userId: number,
  message: {
    id: string
    createdAt: Date
    senderId: number
    conversationId: string
    conversation: {
      participants: Array<{
        userId: number
      }>
    }
  },
): MessageStreamEventEnvelope {
  const cursor = createMessageStreamCursor(message.id, message.createdAt)

  return {
    cursor,
    event: {
      type: "message.created",
      conversationId: message.conversationId,
      messageId: message.id,
      senderId: message.senderId,
      recipientId: message.conversation.participants[0]?.userId ?? userId,
      occurredAt: cursor.createdAt,
    },
  }
}

async function findLatestCursor(userId: number): Promise<MessageStreamCursor | null> {
  const latest = await prisma.directMessage.findFirst({
    where: {
      conversation: {
        participants: {
          some: { userId },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      createdAt: true,
    },
  })

  if (!latest) {
    return null
  }

  return createMessageStreamCursor(latest.id, latest.createdAt)
}

async function findMessageEventsAfterCursor(userId: number, cursor: MessageStreamCursor | null) {
  const messages = await prisma.directMessage.findMany({
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
    take: MESSAGE_CATCH_UP_BATCH_SIZE,
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

  return messages.map((message) => mapMessageRowToEnvelope(userId, message))
}

export const GET = createUserRouteHandler(async ({ request, currentUser }) => {
  const requestUrl = new URL(request.url)
  const cursorParam = requestUrl.searchParams.get("cursor")
  const lastEventId = request.headers.get("last-event-id")
  const requestedCursor = parseMessageStreamCursor(cursorParam) ?? parseMessageStreamCursor(lastEventId)
  const initialCursor = requestedCursor ?? await findLatestCursor(currentUser.id)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let closed = false
      let cursor = initialCursor
      let unsubscribe: (() => void) | null = null
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null
      let catchUpReady = false
      const bufferedEvents: MessageStreamEventEnvelope[] = []

      const push = (payload: string) => {
        if (!closed) {
          controller.enqueue(encoder.encode(payload))
        }
      }

      const pushCursor = (nextCursor: MessageStreamCursor) => {
        push(buildCursorPayload(nextCursor))
      }

      const deliverEnvelope = (envelope: MessageStreamEventEnvelope) => {
        if (!isMessageStreamCursorAfter(envelope.cursor, cursor)) {
          return
        }

        cursor = envelope.cursor
        push(buildMessageEventPayload(envelope.event))
        pushCursor(cursor)
      }

      const flushBufferedEvents = () => {
        if (bufferedEvents.length === 0) {
          return
        }

        const pendingEvents = bufferedEvents
          .splice(0, bufferedEvents.length)
          .sort((left, right) => compareMessageStreamCursor(left.cursor, right.cursor))

        for (const envelope of pendingEvents) {
          if (closed) {
            return
          }

          deliverEnvelope(envelope)
        }
      }

      const close = () => {
        if (closed) {
          return
        }

        closed = true
        request.signal.removeEventListener("abort", close)
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer)
        }
        unsubscribe?.()
        controller.close()
      }

      const handleStreamFailure = (error: unknown) => {
        console.error("[api/messages/stream] stream failed", error)

        if (!closed) {
          push(`event: error\ndata: ${JSON.stringify({ message: "消息流暂时不可用" })}\n\n`)
        }

        close()
      }

      const drainCatchUp = async () => {
        let hasMore = true

        while (!closed && hasMore) {
          const events = await findMessageEventsAfterCursor(currentUser.id, cursor)

          if (events.length === 0) {
            hasMore = false
            continue
          }

          for (const envelope of events) {
            if (closed) {
              return
            }

            deliverEnvelope(envelope)
          }

          hasMore = events.length === MESSAGE_CATCH_UP_BATCH_SIZE
        }
      }

      unsubscribe = messageEventBus.subscribe(currentUser.id, (event) => {
        const nextCursor = getMessageStreamCursorFromEvent(event)
        if (!nextCursor || !isMessageStreamCursorAfter(nextCursor, cursor)) {
          return
        }

        const envelope = {
          cursor: nextCursor,
          event,
        }

        if (!catchUpReady) {
          bufferedEvents.push(envelope)
          return
        }

        deliverEnvelope(envelope)
      })

      push(buildHeartbeatPayload())
      if (cursor) {
        pushCursor(cursor)
      }

      heartbeatTimer = setInterval(() => {
        push(buildHeartbeatPayload())
      }, HEARTBEAT_INTERVAL_MS)

      request.signal.addEventListener("abort", close)

      void drainCatchUp()
        .then(() => {
          flushBufferedEvents()
          catchUpReady = true
          flushBufferedEvents()
        })
        .catch(handleStreamFailure)
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
  allowStatuses: ["ACTIVE", "MUTED"],
})
