import { prisma } from "@/db/client"
import { type NotificationType, type Prisma, type RelatedType } from "@/db/types"

export type NotificationWriteClient = Prisma.TransactionClient | typeof prisma

export interface NotificationDraft {
  userId: number
  type: NotificationType
  senderId?: number | null
  relatedType: RelatedType
  relatedId: string
  title: string
  content: string
}

function resolveNotificationClient(client?: NotificationWriteClient) {
  return client ?? prisma
}

function normalizeNotificationDraft(draft: NotificationDraft) {
  return {
    ...draft,
    senderId: draft.senderId ?? null,
  }
}

export function createNotification(params: NotificationDraft & { client?: NotificationWriteClient }) {
  const { client, ...draft } = params

  return resolveNotificationClient(client).notification.create({
    data: normalizeNotificationDraft(draft),
  })
}

export function createNotifications(params: {
  notifications: NotificationDraft[]
  client?: NotificationWriteClient
}) {
  if (params.notifications.length === 0) {
    return Promise.resolve({ count: 0 })
  }

  return resolveNotificationClient(params.client).notification.createMany({
    data: params.notifications.map(normalizeNotificationDraft),
  })
}

export function findUserNotificationDeliveryRecipient(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      nickname: true,
      email: true,
      emailVerifiedAt: true,
      signature: true,
    },
  })
}
