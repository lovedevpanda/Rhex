import { NotificationType,  type RelatedType } from "@/db/types"
import { countUnreadNotificationsByUserIds } from "@/db/notification-read-queries"
import {
  createNotification as createNotificationEntry,
  createNotifications as createNotificationsEntry,
  findNotificationWebhookRecipientSignature,
  type NotificationDraft,
  type NotificationWriteClient,
} from "@/db/notification-write-queries"
import {
  executeAddonActionHook,
  executeAddonAsyncWaterfallHook,
} from "@/addons-host/runtime/hooks"
import { enqueueBackgroundJob, registerBackgroundJobHandler } from "@/lib/background-jobs"
import { logError, logInfo } from "@/lib/logger"
import { notificationEventBus } from "@/lib/notification-event-bus"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { resolveUserProfileSettings } from "@/lib/user-profile-settings"

interface SystemNotificationWebhookPayload {
  event: "system.notification.created"
  notification: {
    id: string
    type: "SYSTEM"
    title: string
    content: string
    relatedType: RelatedType
    relatedId: string
    createdAt: string
    inboxPath: string
  }
  recipient: {
    userId: number
  }
}

const DEFAULT_SYSTEM_NOTIFICATION_WEBHOOK_TIMEOUT_MS = 5_000
const DEFAULT_SYSTEM_NOTIFICATION_WEBHOOK_MAX_ATTEMPTS = 4
const DEFAULT_SYSTEM_NOTIFICATION_WEBHOOK_RETRY_BASE_MS = 15_000
const DEFAULT_SYSTEM_NOTIFICATION_WEBHOOK_RETRY_MAX_MS = 5 * 60 * 1_000

function parseIntegerConfig(rawValue: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(rawValue ?? ""), 10)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, parsed))
}

function getSystemNotificationWebhookTimeoutMs() {
  return parseIntegerConfig(
    process.env.SYSTEM_NOTIFICATION_WEBHOOK_TIMEOUT_MS,
    DEFAULT_SYSTEM_NOTIFICATION_WEBHOOK_TIMEOUT_MS,
    1_000,
    60_000,
  )
}

function getSystemNotificationWebhookMaxAttempts() {
  return parseIntegerConfig(
    process.env.SYSTEM_NOTIFICATION_WEBHOOK_MAX_ATTEMPTS,
    DEFAULT_SYSTEM_NOTIFICATION_WEBHOOK_MAX_ATTEMPTS,
    1,
    10,
  )
}

function getSystemNotificationWebhookRetryBaseMs() {
  return parseIntegerConfig(
    process.env.SYSTEM_NOTIFICATION_WEBHOOK_RETRY_BASE_MS,
    DEFAULT_SYSTEM_NOTIFICATION_WEBHOOK_RETRY_BASE_MS,
    1_000,
    60 * 60 * 1_000,
  )
}

function getSystemNotificationWebhookRetryMaxMs() {
  return parseIntegerConfig(
    process.env.SYSTEM_NOTIFICATION_WEBHOOK_RETRY_MAX_MS,
    DEFAULT_SYSTEM_NOTIFICATION_WEBHOOK_RETRY_MAX_MS,
    5_000,
    24 * 60 * 60 * 1_000,
  )
}

function resolveSystemNotificationWebhookRetryDelayMs(attempt: number) {
  const baseDelayMs = getSystemNotificationWebhookRetryBaseMs()
  const retryDelayMs = baseDelayMs * Math.max(1, 2 ** Math.max(0, attempt - 1))
  return Math.min(getSystemNotificationWebhookRetryMaxMs(), retryDelayMs)
}

function buildSystemNotificationWebhookPayload(input: {
  id: string
  userId: number
  title: string
  content: string
  relatedType: RelatedType
  relatedId: string
  createdAt: Date
}): SystemNotificationWebhookPayload {
  return {
    event: "system.notification.created",
    notification: {
      id: input.id,
      type: "SYSTEM",
      title: input.title,
      content: input.content,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      createdAt: input.createdAt.toISOString(),
      inboxPath: "/notifications",
    },
    recipient: {
      userId: input.userId,
    },
  }
}

async function postSystemNotificationWebhook(webhookUrl: string, payload: SystemNotificationWebhookPayload) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), getSystemNotificationWebhookTimeoutMs())

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Webhook responded with ${response.status}`)
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function deliverSystemNotificationWebhook(input: {
  id: string
  userId: number
  title: string
  content: string
  relatedType: RelatedType
  relatedId: string
  createdAt: Date
}) {
  const recipient = await findNotificationWebhookRecipientSignature(input.userId)

  if (!recipient) {
    return false
  }

  const profileSettings = resolveUserProfileSettings(recipient.signature)
  const webhookUrl = profileSettings.notificationWebhookUrl.trim()

  if (!profileSettings.externalNotificationEnabled || !webhookUrl) {
    return false
  }

  await postSystemNotificationWebhook(webhookUrl, buildSystemNotificationWebhookPayload(input))

  return true
}

function enqueueSystemNotificationWebhookDelivery(params: {
  id: string
  userId: number
  title: string
  content: string
  relatedType: RelatedType
  relatedId: string
  createdAt: Date
  attempt?: number
  delayMs?: number
}) {
  return enqueueBackgroundJob("notification.dispatch-system-webhook", {
    id: params.id,
    userId: params.userId,
    title: params.title,
    content: params.content,
    relatedType: params.relatedType,
    relatedId: params.relatedId,
    createdAt: params.createdAt.toISOString(),
    attempt: Math.max(1, params.attempt ?? 1),
  }, {
    delayMs: Math.max(0, params.delayMs ?? 0),
  })
}

export async function sendSystemNotificationWebhookTest(params: {
  userId: number
  webhookUrl: string
}) {
    await postSystemNotificationWebhook(params.webhookUrl, buildSystemNotificationWebhookPayload({
      id: `test-${Date.now()}`,
    userId: params.userId,
    title: "系统通知 Webhook 测试",
    content: "这是一条测试通知，说明你的站外通知 Webhook 已经可以正常接收系统消息。",
    relatedType: "ANNOUNCEMENT",
    relatedId: "webhook-test",
    createdAt: new Date(),
  }))
}

export type { NotificationDraft, NotificationWriteClient }

async function publishNotificationCountEvents(userIds: number[], reason: "created" | "created-batch" | "read" | "read-all", notificationIdByUserId?: Map<number, string>) {
  const unreadCountByUserId = await countUnreadNotificationsByUserIds(userIds)

  await Promise.allSettled(
    [...new Set(userIds)].map((userId) => notificationEventBus.publish({
      type: "notification.count",
      userId,
      unreadNotificationCount: unreadCountByUserId.get(userId) ?? 0,
      reason,
      notificationId: notificationIdByUserId?.get(userId),
      occurredAt: new Date().toISOString(),
    })),
  )
}

export async function createNotification(params: NotificationDraft & { client?: NotificationWriteClient }) {
  const { client: _client, ...draft } = params
  await fireNotificationCreateBefore(draft)
  const notification = await createNotificationEntry(params)
  revalidateUserSurfaceCache(notification.userId)
  if (!params.client) {
    await publishNotificationCountEvents([notification.userId], "created", new Map([[notification.userId, notification.id]]))
  }
  await fireNotificationCreateAfter(draft, notification)
  return notification
}

export async function createNotifications(params: {
  notifications: NotificationDraft[]
  client?: NotificationWriteClient
}) {
  const expandedNotifications = await expandNotificationTargets(params.notifications)
  for (const draft of expandedNotifications) {
    await fireNotificationCreateBefore(draft)
  }
  const result = await createNotificationsEntry({
    notifications: expandedNotifications,
    client: params.client,
  })
  for (const draft of expandedNotifications) {
    await fireNotificationCreateAfter(draft, null)
  }

  const userIds = [...new Set(expandedNotifications.map((item) => item.userId))]
  for (const userId of userIds) {
    revalidateUserSurfaceCache(userId)
  }

  if (!params.client) {
    await publishNotificationCountEvents(userIds, "created-batch")
  }

  return result
}

registerBackgroundJobHandler("notification.create", async (payload) => {
  await createNotification(payload)
})

registerBackgroundJobHandler("notification.create-many", async (payload) => {
  await createNotifications({
    notifications: payload.notifications,
  })
})

registerBackgroundJobHandler("notification.dispatch-system-webhook", async (payload) => {
  try {
    const delivered = await deliverSystemNotificationWebhook({
      id: payload.id,
      userId: payload.userId,
      title: payload.title,
      content: payload.content,
      relatedType: payload.relatedType,
      relatedId: payload.relatedId,
      createdAt: new Date(payload.createdAt),
    })

    if (delivered) {
      logInfo({
        scope: "notification-webhook",
        action: "deliver",
        userId: payload.userId,
        targetId: payload.id,
        metadata: {
          attempt: payload.attempt,
        },
      })
    }
  } catch (error) {
    const maxAttempts = getSystemNotificationWebhookMaxAttempts()
    const nextAttempt = payload.attempt + 1

    logError({
      scope: "notification-webhook",
      action: "deliver",
      userId: payload.userId,
      targetId: payload.id,
      metadata: {
        attempt: payload.attempt,
        maxAttempts,
      },
    }, error)

    if (nextAttempt > maxAttempts) {
      return
    }

    await enqueueSystemNotificationWebhookDelivery({
      id: payload.id,
      userId: payload.userId,
      title: payload.title,
      content: payload.content,
      relatedType: payload.relatedType,
      relatedId: payload.relatedId,
      createdAt: new Date(payload.createdAt),
      attempt: nextAttempt,
      delayMs: resolveSystemNotificationWebhookRetryDelayMs(payload.attempt),
    })
  }
})

export function enqueueNotification(params: NotificationDraft) {
  return enqueueBackgroundJob("notification.create", params)
}

export function enqueueNotifications(notifications: NotificationDraft[]) {
  return enqueueBackgroundJob("notification.create-many", {
    notifications,
  })
}

export async function createSystemNotification(params: {
  userId: number
  relatedId: string
  title: string
  content: string
  relatedType?: RelatedType
  senderId?: number | null
  client?: NotificationWriteClient
}) {
  const notification = await createNotification({
    client: params.client,
    userId: params.userId,
    type: NotificationType.SYSTEM,
    senderId: params.senderId ?? null,
    relatedType: params.relatedType ?? "ANNOUNCEMENT",
    relatedId: params.relatedId,
    title: params.title,
    content: params.content,
  })

  void enqueueSystemNotificationWebhookDelivery({
    id: notification.id,
    userId: notification.userId,
    title: notification.title,
    content: notification.content,
    relatedType: notification.relatedType,
    relatedId: notification.relatedId,
    createdAt: notification.createdAt,
  }).catch((error) => {
    logError({
      scope: "notification-webhook",
      action: "enqueue",
      userId: notification.userId,
      targetId: notification.id,
    }, error)
  })

  return notification
}

export function createReportResultNotification(params: {
  userId: number
  senderId: number
  relatedType: RelatedType
  relatedId: string
  title: string
  content: string
  client?: NotificationWriteClient
}) {
  return createNotification({
    client: params.client,
    userId: params.userId,
    type: NotificationType.REPORT_RESULT,
    senderId: params.senderId,
    relatedType: params.relatedType,
    relatedId: params.relatedId,
    title: params.title,
    content: params.content,
  })
}
async function fireNotificationCreateBefore(draft: NotificationDraft) {
  try {
    await executeAddonActionHook("notification.create.before", {
      recipientId: String(draft.userId),
      type: String(draft.type),
      payload: {
        senderId: draft.senderId ?? null,
        relatedType: draft.relatedType,
        relatedId: draft.relatedId,
        title: draft.title,
        content: draft.content,
      },
    })
  } catch (error) {
    logError({ scope: "addons", action: "notification.create.before" }, error)
  }
}

async function fireNotificationCreateAfter(
  _draft: NotificationDraft,
  _record: { id: string; createdAt: Date } | null,
) {
  try {
    await executeAddonActionHook("notification.create.after", {})
  } catch (error) {
    logError({ scope: "addons", action: "notification.create.after" }, error)
  }
}

async function expandNotificationTargets(drafts: NotificationDraft[]): Promise<NotificationDraft[]> {
  const expanded: NotificationDraft[] = []
  for (const draft of drafts) {
    expanded.push(draft)
    let targets: Array<{ userId: string; channel: string }> = []
    try {
      const result = await executeAddonAsyncWaterfallHook(
        "notification.dispatch.targets",
        [{ userId: String(draft.userId), channel: "inapp" }],
      )
      targets = result.value
    } catch (error) {
      logError({ scope: "addons", action: "notification.dispatch.targets" }, error)
      continue
    }
    const seen = new Set<number>([draft.userId])
    for (const target of targets) {
      if (target.channel !== "inapp") continue
      const uid = Number(target.userId)
      if (!Number.isFinite(uid) || seen.has(uid)) continue
      seen.add(uid)
      expanded.push({ ...draft, userId: uid })
    }
  }
  return expanded
}