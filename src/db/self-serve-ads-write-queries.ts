import { NotificationType } from "@/db/types"

import { prisma } from "@/db/client"

import type { SelfServeAdOrderStatus, SelfServeAdSlotType } from "@/lib/self-serve-ads.shared"

export function submitSelfServeAdOrderTransaction(data: {
  orderId: string
  userId: number
  appCode: string
  slotType: SelfServeAdSlotType
  slotIndex: number
  title: string | null
  linkUrl: string
  imageUrl: string | null
  textColor: string | null
  backgroundColor: string | null
  durationMonths: number
  pricePoints: number
  pointReason: string
}) {
  return prisma.$transaction(async (tx) => {
    const latestUser = await tx.user.findUnique({
      where: { id: data.userId },
      select: { id: true, points: true },
    })

    if (!latestUser) {
      throw new Error("用户不存在")
    }

    if (latestUser.points < data.pricePoints) {
      return { error: "POINTS_NOT_ENOUGH" as const }
    }

    await tx.user.update({
      where: { id: latestUser.id },
      data: { points: { decrement: data.pricePoints } },
    })

    await tx.pointLog.create({
      data: {
        userId: latestUser.id,
        changeType: "DECREASE",
        changeValue: data.pricePoints,
        reason: data.pointReason,
      },
    })

    const order = await tx.selfServeAdOrder.create({
      data: {
        id: data.orderId,
        appCode: data.appCode,
        userId: latestUser.id,
        slotType: data.slotType,
        slotIndex: data.slotIndex,
        title: data.title,
        linkUrl: data.linkUrl,
        imageUrl: data.imageUrl,
        textColor: data.textColor,
        backgroundColor: data.backgroundColor,
        durationMonths: data.durationMonths,
        pricePoints: data.pricePoints,
        status: "PENDING",
      },
    })

    return { error: null as null, order }
  })
}

export function createSystemNotification(data: {
  userId: number
  relatedId: string
  title: string
  content: string
}) {
  return prisma.notification.create({
    data: {
      userId: data.userId,
      type: NotificationType.SYSTEM,
      senderId: null,
      relatedType: "ANNOUNCEMENT",
      relatedId: data.relatedId,
      title: data.title,
      content: data.content,
    },
  })
}

export function updateSelfServeAdOrderStatus(id: string, data: {
  title?: string | null
  linkUrl?: string
  imageUrl?: string | null
  textColor?: string | null
  backgroundColor?: string | null
  durationMonths?: number
  pricePoints?: number
  status?: SelfServeAdOrderStatus
  reviewNote?: string | null
  startsAt?: Date | null
  endsAt?: Date | null
  slotIndex?: number
}) {
  return prisma.selfServeAdOrder.update({
    where: { id },
    data,
  })
}
