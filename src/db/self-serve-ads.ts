import { prisma } from "@/db/client"

import type { SelfServeAdOrderStatus, SelfServeAdSlotType } from "@/lib/self-serve-ads.shared"


export interface SelfServeAdOrderRecord {
  id: string
  appCode: string
  userId: number
  slotType: SelfServeAdSlotType
  slotIndex: number
  title: string | null
  linkUrl: string
  imageUrl: string | null
  textColor: string | null
  backgroundColor: string | null
  durationMonths: number
  pricePoints: number
  status: SelfServeAdOrderStatus
  reviewNote: string | null
  startsAt: Date | null
  endsAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function mapRow(row: Record<string, unknown>): SelfServeAdOrderRecord {
  return {
    id: String(row.id),
    appCode: String(row.appCode),

    userId: Number(row.userId),
    slotType: String(row.slotType) as SelfServeAdSlotType,
    slotIndex: Number(row.slotIndex),
    title: row.title == null ? null : String(row.title),
    linkUrl: String(row.linkUrl),
    imageUrl: row.imageUrl == null ? null : String(row.imageUrl),
    textColor: row.textColor == null ? null : String(row.textColor),
    backgroundColor: row.backgroundColor == null ? null : String(row.backgroundColor),
    durationMonths: Number(row.durationMonths),
    pricePoints: Number(row.pricePoints),
    status: String(row.status) as SelfServeAdOrderStatus,
    reviewNote: row.reviewNote == null ? null : String(row.reviewNote),
    startsAt: row.startsAt instanceof Date ? row.startsAt : row.startsAt ? new Date(String(row.startsAt)) : null,
    endsAt: row.endsAt instanceof Date ? row.endsAt : row.endsAt ? new Date(String(row.endsAt)) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(String(row.createdAt)),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(String(row.updatedAt)),
  }
}

export async function findSelfServeApprovedAds(appCode: string) {
  const now = new Date()
  const rows = await prisma.selfServeAdOrder.findMany({
    where: {
      appCode,
      status: "APPROVED",
      AND: [
        {
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        },
        {
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
      ],
    },
    orderBy: [
      { slotType: "asc" },
      { slotIndex: "asc" },
      { updatedAt: "desc" },
    ],
  })
  return rows.map(mapRow)
}

export async function findSelfServeOrdersForAdmin(appCode: string) {
  const rows = await prisma.selfServeAdOrder.findMany({
    where: { appCode },
    orderBy: [
      { status: "asc" },
      { createdAt: "desc" },
    ],
  })

  return rows.sort((left, right) => {
    if (left.status === "PENDING" && right.status !== "PENDING") {
      return -1
    }

    if (left.status !== "PENDING" && right.status === "PENDING") {
      return 1
    }

    return right.createdAt.getTime() - left.createdAt.getTime()
  }).map(mapRow)
}

export async function findSelfServeOrderById(id: string) {
  const row = await prisma.selfServeAdOrder.findUnique({
    where: { id },
  })

  return row ? mapRow(row) : null
}

export async function countPendingSelfServeOrders(appCode: string) {
  return prisma.selfServeAdOrder.count({
    where: {
      appCode,
      status: "PENDING",
    },
  })
}

export async function createSelfServeOrder(data: {
  id: string
  appCode: string
  userId: number
  slotType: SelfServeAdSlotType
  slotIndex: number
  title?: string | null
  linkUrl: string
  imageUrl?: string | null
  textColor?: string | null
  backgroundColor?: string | null
  durationMonths: number
  pricePoints: number
  status: SelfServeAdOrderStatus
  reviewNote?: string | null
}) {
  await prisma.selfServeAdOrder.create({
    data: {
      id: data.id,
      appCode: data.appCode,
      userId: data.userId,
      slotType: data.slotType,
      slotIndex: data.slotIndex,
      title: data.title ?? null,
      linkUrl: data.linkUrl,
      imageUrl: data.imageUrl ?? null,
      textColor: data.textColor ?? null,
      backgroundColor: data.backgroundColor ?? null,
      durationMonths: data.durationMonths,
      pricePoints: data.pricePoints,
      status: data.status,
      reviewNote: data.reviewNote ?? null,
    },
  })

  return findSelfServeOrderById(data.id)
}

export async function updateSelfServeOrder(id: string, data: {
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
  const existing = await findSelfServeOrderById(id)
  if (!existing) {
    return null
  }

  await prisma.selfServeAdOrder.update({
    where: { id },
    data: {
      title: data.title ?? existing.title,
      linkUrl: data.linkUrl ?? existing.linkUrl,
      imageUrl: data.imageUrl ?? existing.imageUrl,
      textColor: data.textColor ?? existing.textColor,
      backgroundColor: data.backgroundColor ?? existing.backgroundColor,
      durationMonths: data.durationMonths ?? existing.durationMonths,
      pricePoints: data.pricePoints ?? existing.pricePoints,
      status: data.status ?? existing.status,
      reviewNote: data.reviewNote ?? existing.reviewNote,
      startsAt: data.startsAt ?? existing.startsAt,
      endsAt: data.endsAt ?? existing.endsAt,
      slotIndex: data.slotIndex ?? existing.slotIndex,
    },
  })

  return findSelfServeOrderById(id)
}

