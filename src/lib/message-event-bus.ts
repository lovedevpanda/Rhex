import { randomUUID } from "node:crypto"

import { logError } from "@/lib/logger"
import type { InboxSnapshotStreamEvent, MessageStreamEvent } from "@/lib/message-types"
import { connectRedisClient, createRedisConnection, createRedisKey, hasRedisUrl } from "@/lib/redis"

export type { MessageStreamEvent } from "@/lib/message-types"

export interface MessageStreamCursor {
  id: string
  createdAt: string
}

type MessageEventListener = (event: MessageStreamEvent) => void

interface MessageEventSubscriber {
  userId: number
  listener: MessageEventListener
}

type GlobalMessageEventBusState = {
  __bbsMessageEventBus?: MessageEventBus
  __bbsRedisMessageEventBusRuntime?: RedisMessageEventBusRuntime
}

const globalMessageEventBus = globalThis as typeof globalThis & GlobalMessageEventBusState

function getMessageEventChannel() {
  return createRedisKey("message-events", "pubsub")
}

function getEventTargetUserIds(event: MessageStreamEvent) {
  const userIds = new Set<number>()

  if ("userId" in event && typeof event.userId === "number") {
    userIds.add(event.userId)
  }

  if ("senderId" in event && typeof event.senderId === "number") {
    userIds.add(event.senderId)
  }

  if ("recipientId" in event && typeof event.recipientId === "number") {
    userIds.add(event.recipientId)
  }

  return userIds
}

class MessageEventBus {
  private nextSubscriberId = 1

  private readonly subscribers = new Map<number, MessageEventSubscriber>()

  subscribe(userId: number, listener: MessageEventListener) {
    void ensureMessageEventBusRuntimeReady()

    const subscriberId = this.nextSubscriberId
    this.nextSubscriberId += 1
    this.subscribers.set(subscriberId, { userId, listener })

    return () => {
      this.subscribers.delete(subscriberId)
    }
  }

  async publish(event: MessageStreamEvent) {
    if (!hasRedisUrl()) {
      this.publishLocal(event)
      return
    }

    try {
      const runtime = getRedisMessageEventBusRuntime()
      await runtime.ensurePublisherReady()
      await runtime.publish(event)
    } catch (error) {
      logError({
        scope: "message-event-bus",
        action: "publish",
        metadata: {
          conversationId: "conversationId" in event ? event.conversationId : undefined,
          messageId: "messageId" in event ? event.messageId : undefined,
        },
      }, error)
      this.publishLocal(event)
    }
  }

  publishLocal(event: MessageStreamEvent) {
    const targetUserIds = getEventTargetUserIds(event)
    if (targetUserIds.size === 0) {
      return
    }

    for (const subscriber of this.subscribers.values()) {
      if (!targetUserIds.has(subscriber.userId)) {
        continue
      }

      try {
        subscriber.listener(event)
      } catch (error) {
        console.error("[message-event-bus] subscriber failed", error)
      }
    }
  }
}

class RedisMessageEventBusRuntime {
  private readonly runtimeId = randomUUID()
  private readonly publisher = createRedisConnection("message-bus:publisher")
  private readonly subscriber = createRedisConnection("message-bus:subscriber")
  private publisherReadyPromise: Promise<void> | null = null
  private subscriberReadyPromise: Promise<void> | null = null
  private subscriberStarted = false

  constructor(private readonly bus: MessageEventBus) {}

  async ensurePublisherReady() {
    this.publisherReadyPromise ??= connectRedisClient(this.publisher)
      .then(() => undefined)
      .catch((error) => {
        this.publisherReadyPromise = null
        throw error
      })

    return this.publisherReadyPromise
  }

  async ensureSubscriberReady() {
    this.subscriberReadyPromise ??= this.startSubscriber()
      .catch((error) => {
        this.subscriberReadyPromise = null
        throw error
      })

    return this.subscriberReadyPromise
  }

  async publish(event: MessageStreamEvent) {
    await this.ensurePublisherReady()
    await this.publisher.publish(getMessageEventChannel(), JSON.stringify({
      event,
      origin: this.runtimeId,
    }))
  }

  private async startSubscriber() {
    if (!this.subscriberStarted) {
      this.subscriberStarted = true
      this.subscriber.on("message", (channel, rawMessage) => {
        if (channel !== getMessageEventChannel()) {
          return
        }

        try {
          const payload = JSON.parse(rawMessage) as {
            event?: MessageStreamEvent
          }

          if (!payload?.event) {
            return
          }

          this.bus.publishLocal(payload.event)
        } catch (error) {
          logError({
            scope: "message-event-bus",
            action: "consume",
          }, error)
        }
      })
    }

    await connectRedisClient(this.subscriber)
    await this.subscriber.subscribe(getMessageEventChannel())
  }
}

export const messageEventBus = globalMessageEventBus.__bbsMessageEventBus ?? new MessageEventBus()

if (!globalMessageEventBus.__bbsMessageEventBus) {
  globalMessageEventBus.__bbsMessageEventBus = messageEventBus
}

function getRedisMessageEventBusRuntime() {
  const runtime = globalMessageEventBus.__bbsRedisMessageEventBusRuntime ?? new RedisMessageEventBusRuntime(messageEventBus)

  if (!globalMessageEventBus.__bbsRedisMessageEventBusRuntime) {
    globalMessageEventBus.__bbsRedisMessageEventBusRuntime = runtime
  }

  return runtime
}

export async function ensureMessageEventBusRuntimeReady() {
  if (!hasRedisUrl()) {
    return
  }

  await getRedisMessageEventBusRuntime().ensureSubscriberReady()
}

export function buildMessageEventPayload(event: MessageStreamEvent) {
  const cursor = getMessageStreamCursorFromEvent(event)
  const cursorId = cursor ? formatMessageStreamCursor(cursor) : undefined
  return `${cursorId ? `id: ${cursorId}\n` : ""}data: ${JSON.stringify(event)}\n\n`
}

export function buildHeartbeatPayload() {
  return `data: ${JSON.stringify({ type: "heartbeat", occurredAt: new Date().toISOString() })}\n\n`
}

export function buildInboxSnapshotPayload(snapshot: Omit<InboxSnapshotStreamEvent, "type">) {
  return `data: ${JSON.stringify({ type: "inbox.snapshot", ...snapshot })}\n\n`
}

export function buildCursorPayload(cursor: MessageStreamCursor) {
  return `event: cursor\ndata: ${JSON.stringify({ cursor: formatMessageStreamCursor(cursor) })}\n\n`
}

export function createMessageStreamCursor(id: string, createdAt: Date | string): MessageStreamCursor {
  return {
    id,
    createdAt: typeof createdAt === "string" ? new Date(createdAt).toISOString() : createdAt.toISOString(),
  }
}

export function compareMessageStreamCursor(left: MessageStreamCursor, right: MessageStreamCursor) {
  if (left.createdAt < right.createdAt) {
    return -1
  }

  if (left.createdAt > right.createdAt) {
    return 1
  }

  return left.id.localeCompare(right.id)
}

export function isMessageStreamCursorAfter(cursor: MessageStreamCursor, baseline: MessageStreamCursor | null) {
  if (!baseline) {
    return true
  }

  return compareMessageStreamCursor(cursor, baseline) > 0
}

export function getMessageStreamCursorFromEvent(event: { messageId?: string; occurredAt?: string }) {
  if (!event.messageId || !event.occurredAt) {
    return null
  }

  return createMessageStreamCursor(event.messageId, event.occurredAt)
}

export function parseMessageStreamCursor(value: string | null): MessageStreamCursor | null {
  if (!value) {
    return null
  }

  const [createdAt, id] = value.split("|")
  if (!createdAt || !id) {
    return null
  }

  const timestamp = new Date(createdAt)
  if (Number.isNaN(timestamp.getTime())) {
    return null
  }

  return {
    id,
    createdAt: timestamp.toISOString(),
  }
}

export function formatMessageStreamCursor(cursor: MessageStreamCursor) {
  return `${cursor.createdAt}|${cursor.id}`
}
