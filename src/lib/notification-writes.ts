import { NotificationType,  type RelatedType } from "@/db/types"
import { countUnreadNotificationsByUserIds } from "@/db/notification-read-queries"
import {
  createNotification as createNotificationEntry,
  createNotifications as createNotificationsEntry,
  type NotificationDraft,
  type NotificationWriteClient,
} from "@/db/notification-write-queries"
import {
  executeAddonActionHook,
  executeAddonAsyncWaterfallHook,
} from "@/addons-host/runtime/hooks"
import { enqueueBackgroundJob, registerBackgroundJobHandler } from "@/lib/background-jobs"
import { logError } from "@/lib/logger"
import { notificationEventBus } from "@/lib/notification-event-bus"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { enqueueUserNotificationDeliveries } from "@/lib/user-notification-delivery"

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
  void _client
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

  void enqueueUserNotificationDeliveries({
    userId: notification.userId,
    event: {
      type: "systemNotification",
      notification: {
        id: notification.id,
        title: notification.title,
        content: notification.content,
        relatedType: notification.relatedType,
        relatedId: notification.relatedId,
        createdAt: notification.createdAt.toISOString(),
        inboxPath: "/notifications",
      },
    },
  }).catch((error) => {
    logError({
      scope: "user-notification-delivery",
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
  void _draft
  void _record
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
