import { randomUUID } from "node:crypto"

import { logError } from "@/lib/logger"
import type { InboxStreamEvent, NotificationCountStreamEvent } from "@/lib/message-types"
import { connectRedisClient, createRedisConnection, createRedisKey, hasRedisUrl } from "@/lib/redis"

type NotificationEventListener = (event: NotificationCountStreamEvent) => void

interface NotificationEventSubscriber {
  userId: number
  listener: NotificationEventListener
}

type GlobalNotificationEventBusState = {
  __bbsNotificationEventBus?: NotificationEventBus
  __bbsRedisNotificationEventBusRuntime?: RedisNotificationEventBusRuntime
}

const globalNotificationEventBus = globalThis as typeof globalThis & GlobalNotificationEventBusState

function getNotificationEventChannel() {
  return createRedisKey("notification-events", "pubsub")
}

function isNotificationCountEvent(event: InboxStreamEvent): event is NotificationCountStreamEvent {
  return event.type === "notification.count"
}

class NotificationEventBus {
  private nextSubscriberId = 1

  private readonly subscribers = new Map<number, NotificationEventSubscriber>()

  subscribe(userId: number, listener: NotificationEventListener) {
    void ensureNotificationEventBusRuntimeReady()

    const subscriberId = this.nextSubscriberId
    this.nextSubscriberId += 1
    this.subscribers.set(subscriberId, { userId, listener })

    return () => {
      this.subscribers.delete(subscriberId)
    }
  }

  async publish(event: NotificationCountStreamEvent) {
    if (!hasRedisUrl()) {
      this.publishLocal(event)
      return
    }

    try {
      const runtime = getRedisNotificationEventBusRuntime()
      await runtime.ensurePublisherReady()
      await runtime.publish(event)
    } catch (error) {
      logError({
        scope: "notification-event-bus",
        action: "publish",
        metadata: {
          userId: event.userId,
          notificationId: event.notificationId ?? null,
          reason: event.reason,
        },
      }, error)
      this.publishLocal(event)
    }
  }

  publishLocal(event: NotificationCountStreamEvent) {
    for (const subscriber of this.subscribers.values()) {
      if (subscriber.userId !== event.userId) {
        continue
      }

      try {
        subscriber.listener(event)
      } catch (error) {
        console.error("[notification-event-bus] subscriber failed", error)
      }
    }
  }
}

class RedisNotificationEventBusRuntime {
  private readonly runtimeId = randomUUID()
  private readonly publisher = createRedisConnection("notification-bus:publisher")
  private readonly subscriber = createRedisConnection("notification-bus:subscriber")
  private publisherReadyPromise: Promise<void> | null = null
  private subscriberReadyPromise: Promise<void> | null = null
  private subscriberStarted = false

  constructor(private readonly bus: NotificationEventBus) {}

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

  async publish(event: NotificationCountStreamEvent) {
    await this.ensurePublisherReady()
    await this.publisher.publish(getNotificationEventChannel(), JSON.stringify({
      event,
      origin: this.runtimeId,
    }))
  }

  private async startSubscriber() {
    if (!this.subscriberStarted) {
      this.subscriberStarted = true
      this.subscriber.on("message", (channel, rawMessage) => {
        if (channel !== getNotificationEventChannel()) {
          return
        }

        try {
          const payload = JSON.parse(rawMessage) as {
            event?: InboxStreamEvent
          }

          if (!payload?.event || !isNotificationCountEvent(payload.event)) {
            return
          }

          this.bus.publishLocal(payload.event)
        } catch (error) {
          logError({
            scope: "notification-event-bus",
            action: "consume",
          }, error)
        }
      })
    }

    await connectRedisClient(this.subscriber)
    await this.subscriber.subscribe(getNotificationEventChannel())
  }
}

export const notificationEventBus = globalNotificationEventBus.__bbsNotificationEventBus ?? new NotificationEventBus()

if (!globalNotificationEventBus.__bbsNotificationEventBus) {
  globalNotificationEventBus.__bbsNotificationEventBus = notificationEventBus
}

function getRedisNotificationEventBusRuntime() {
  const runtime = globalNotificationEventBus.__bbsRedisNotificationEventBusRuntime ?? new RedisNotificationEventBusRuntime(notificationEventBus)

  if (!globalNotificationEventBus.__bbsRedisNotificationEventBusRuntime) {
    globalNotificationEventBus.__bbsRedisNotificationEventBusRuntime = runtime
  }

  return runtime
}

export async function ensureNotificationEventBusRuntimeReady() {
  if (!hasRedisUrl()) {
    return
  }

  await getRedisNotificationEventBusRuntime().ensureSubscriberReady()
}
