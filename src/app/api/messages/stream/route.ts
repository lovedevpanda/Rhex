import { prisma } from "@/db/client"
import { getUnreadConversationCount } from "@/db/message-read-queries"
import { countUnreadNotifications } from "@/db/notification-read-queries"
import { ConversationKind } from "@/db/types"
import { createUserRouteHandler } from "@/lib/api-route"
import { formatMonthDayTime } from "@/lib/formatters"
import {
  buildInboxSnapshotPayload,
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
import { notificationEventBus } from "@/lib/notification-event-bus"
import { getUserDisplayName } from "@/lib/user-display"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const HEARTBEAT_INTERVAL_MS = 15_000
const MESSAGE_CATCH_UP_BATCH_SIZE = 50

interface MessageStreamEventEnvelope {
  cursor: MessageStreamCursor
  event: MessageStreamEvent
}

async function getInboxSnapshot(userId: number) {
  const [unreadMessageCount, unreadNotificationCount] = await Promise.all([
    getUnreadConversationCount(userId),
    countUnreadNotifications(userId),
  ])

  return {
    unreadMessageCount,
    unreadNotificationCount,
  }
}

function mapMessageRowToEnvelope(
  userId: number,
  message: {
    id: string
    body: string
    createdAt: Date
    senderId: number
    sender: {
      username: string
      nickname: string | null
      avatarPath: string | null
    }
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
      content: message.body,
      createdAtLabel: formatMonthDayTime(message.createdAt),
      senderId: message.senderId,
      senderUsername: message.sender.username,
      senderDisplayName: getUserDisplayName(message.sender),
      senderAvatarPath: message.sender.avatarPath,
      recipientId: message.conversation.participants[0]?.userId ?? userId,
      occurredAt: cursor.createdAt,
    },
  }
}

async function findLatestCursor(userId: number): Promise<MessageStreamCursor | null> {
  const latest = await prisma.directMessage.findFirst({
    where: {
      conversation: {
        kind: ConversationKind.DIRECT,
        participants: {
          some: {
            userId,
            archivedAt: null,
          },
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
        kind: ConversationKind.DIRECT,
        participants: {
          some: {
            userId,
            archivedAt: null,
          },
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
      body: true,
      createdAt: true,
      senderId: true,
      sender: {
        select: {
          username: true,
          nickname: true,
          avatarPath: true,
        },
      },
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
  const [initialCursor, inboxSnapshot] = await Promise.all([
    requestedCursor ? Promise.resolve(requestedCursor) : findLatestCursor(currentUser.id),
    getInboxSnapshot(currentUser.id),
  ])
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let closed = false
      let cursor = initialCursor
      let unsubscribeMessageEvents: (() => void) | null = null
      let unsubscribeNotificationEvents: (() => void) | null = null
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null
      let catchUpReady = false
      const bufferedCursorEvents: MessageStreamEventEnvelope[] = []
      const bufferedLiveEvents: MessageStreamEvent[] = []

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

      const deliverLiveEvent = (event: MessageStreamEvent) => {
        push(buildMessageEventPayload(event))
      }

      const flushBufferedCursorEvents = () => {
        if (bufferedCursorEvents.length === 0) {
          return
        }

        const pendingEvents = bufferedCursorEvents
          .splice(0, bufferedCursorEvents.length)
          .sort((left, right) => compareMessageStreamCursor(left.cursor, right.cursor))

        for (const envelope of pendingEvents) {
          if (closed) {
            return
          }

          deliverEnvelope(envelope)
        }
      }

      const flushBufferedLiveEvents = () => {
        if (bufferedLiveEvents.length === 0) {
          return
        }

        const pendingEvents = bufferedLiveEvents.splice(0, bufferedLiveEvents.length)

        for (const event of pendingEvents) {
          if (closed) {
            return
          }

          deliverLiveEvent(event)
        }
      }

      const bufferOrDeliverEvent = (event: MessageStreamEvent) => {
        const nextCursor = getMessageStreamCursorFromEvent(event)

        if (!catchUpReady) {
          if (nextCursor) {
            bufferedCursorEvents.push({ cursor: nextCursor, event })
          } else {
            bufferedLiveEvents.push(event)
          }
          return
        }

        if (nextCursor) {
          deliverEnvelope({ cursor: nextCursor, event })
          return
        }

        deliverLiveEvent(event)
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
        unsubscribeMessageEvents?.()
        unsubscribeNotificationEvents?.()
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

      unsubscribeMessageEvents = messageEventBus.subscribe(currentUser.id, (event) => {
        const nextCursor = getMessageStreamCursorFromEvent(event)
        if (nextCursor && !isMessageStreamCursorAfter(nextCursor, cursor)) {
          return
        }

        bufferOrDeliverEvent(event)
      })

      unsubscribeNotificationEvents = notificationEventBus.subscribe(currentUser.id, (event) => {
        bufferOrDeliverEvent(event)
      })

      push(buildHeartbeatPayload())
      push(buildInboxSnapshotPayload({
        unreadMessageCount: inboxSnapshot.unreadMessageCount,
        unreadNotificationCount: inboxSnapshot.unreadNotificationCount,
        occurredAt: new Date().toISOString(),
      }))
      if (cursor) {
        pushCursor(cursor)
      }

      heartbeatTimer = setInterval(() => {
        push(buildHeartbeatPayload())
      }, HEARTBEAT_INTERVAL_MS)

      request.signal.addEventListener("abort", close)

      void drainCatchUp()
        .then(() => {
          flushBufferedCursorEvents()
          flushBufferedLiveEvents()
          catchUpReady = true
          flushBufferedCursorEvents()
          flushBufferedLiveEvents()
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
