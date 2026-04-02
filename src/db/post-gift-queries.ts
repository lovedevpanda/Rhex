import { Prisma, type PrismaClient } from "@prisma/client"

import { prisma } from "@/db/client"
import type { SiteTippingGiftItem } from "@/lib/tipping-gifts"

type PostGiftQueryClient = Prisma.TransactionClient | PrismaClient

interface GiftDefinitionDelegate {
  deleteMany(args?: { where?: { id?: { notIn?: string[] } } }): Promise<unknown>
  upsert(args: {
    where: { id: string }
    create: {
      id: string
      name: string
      icon: string
      price: number
      sortOrder: number
      isEnabled: boolean
    }
    update: {
      name: string
      icon: string
      price: number
      sortOrder: number
      isEnabled: boolean
    }
  }): Promise<unknown>
}

interface PostGiftEventDelegate {
  create(args: {
    data: {
      id: string
      postId: string
      senderId: number
      receiverId: number
      giftId: string
      giftNameSnapshot: string
      giftIconSnapshot: string
      unitPrice: number
      quantity: number
      totalPoints: number
    }
  }): Promise<unknown>
}

interface PostGiftStatsDelegate {
  upsert(args: {
    where: {
      postId_giftId: {
        postId: string
        giftId: string
      }
    }
    create: {
      id: string
      postId: string
      receiverId: number
      giftId: string
      giftNameSnapshot: string
      giftIconSnapshot: string
      unitPrice: number
      totalCount: number
      totalPoints: number
      lastSentAt: Date
    }
    update: {
      giftNameSnapshot: string
      giftIconSnapshot: string
      unitPrice: number
      totalCount: { increment: number }
      totalPoints: { increment: number }
      lastSentAt: Date
    }
  }): Promise<unknown>
}

type GiftDefinitionWriteClient = PostGiftQueryClient & {
  giftDefinition: GiftDefinitionDelegate
}

type PostGiftWriteTransactionClient = Prisma.TransactionClient & {
  postGiftEvent: PostGiftEventDelegate
  postGiftStats: PostGiftStatsDelegate
}

function resolveClient(client?: PostGiftQueryClient) {
  return client ?? prisma
}

function resolveGiftDefinitionClient(client?: PostGiftQueryClient) {
  return resolveClient(client) as GiftDefinitionWriteClient
}

function parseNumberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "bigint") {
    return Number(value)
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return 0
}

function parseDateValue(value: unknown) {
  if (value instanceof Date) {
    return value
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return new Date(0)
}

interface GiftDefinitionRow {
  id: string
  name: string
  icon: string
  price: number | string | bigint
  sortOrder: number | string | bigint
  isEnabled: boolean
}

export interface PostGiftSupportAggregateRow {
  senderId: number
  totalAmount: number
}

export interface PostGiftStatItem {
  giftId: string
  giftName: string
  giftIcon: string
  unitPrice: number
  totalCount: number
  totalPoints: number
  lastSentAt: string
}

export interface PostGiftRecentEventItem {
  id: string
  giftId: string
  senderId: number
  senderName: string
  senderAvatarPath: string | null
  createdAt: string
}

export async function listActiveGiftDefinitions(client?: PostGiftQueryClient): Promise<SiteTippingGiftItem[]> {
  const rows = await resolveClient(client).$queryRaw<GiftDefinitionRow[]>(Prisma.sql`
    SELECT
      "id",
      "name",
      "icon",
      "price",
      "sortOrder",
      "isEnabled"
    FROM "GiftDefinition"
    WHERE "isEnabled" = TRUE
    ORDER BY "sortOrder" ASC, "createdAt" ASC
  `)

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    price: parseNumberValue(row.price),
  }))
}

export async function syncGiftDefinitions(input: SiteTippingGiftItem[], client?: PostGiftQueryClient) {
  const db = resolveGiftDefinitionClient(client)

  if (input.length === 0) {
    await db.giftDefinition.deleteMany()
    return
  }

  const normalizedRows = input.map((item, index) => ({
    ...item,
    sortOrder: index,
  }))

  await db.giftDefinition.deleteMany({
    where: {
      id: {
        notIn: normalizedRows.map((item) => item.id),
      },
    },
  })

  await Promise.all(normalizedRows.map((item) => db.giftDefinition.upsert({
    where: { id: item.id },
    create: {
      id: item.id,
      name: item.name,
      icon: item.icon,
      price: item.price,
      sortOrder: item.sortOrder,
      isEnabled: true,
    },
    update: {
      name: item.name,
      icon: item.icon,
      price: item.price,
      sortOrder: item.sortOrder,
      isEnabled: true,
    },
  })))
}

export async function countPostGiftEventsBySender(params: {
  senderId: number
  postId?: string
  start?: Date
  end?: Date
  client?: PostGiftQueryClient
}) {
  const rows = await resolveClient(params.client).$queryRaw<Array<{ count: number | string | bigint }>>(Prisma.sql`
    SELECT COUNT(*)::int AS "count"
    FROM "PostGiftEvent"
    WHERE "senderId" = ${params.senderId}
      ${params.postId ? Prisma.sql`AND "postId" = ${params.postId}` : Prisma.empty}
      ${params.start ? Prisma.sql`AND "createdAt" >= ${params.start}` : Prisma.empty}
      ${params.end ? Prisma.sql`AND "createdAt" < ${params.end}` : Prisma.empty}
  `)

  return parseNumberValue(rows[0]?.count)
}

export async function listPostGiftSupportAggregates(postId: string, limit = 10, client?: PostGiftQueryClient): Promise<PostGiftSupportAggregateRow[]> {
  const rows = await resolveClient(client).$queryRaw<Array<{
    senderId: number | string | bigint
    totalAmount: number | string | bigint
  }>>(Prisma.sql`
    SELECT
      "senderId",
      SUM("totalPoints")::int AS "totalAmount"
    FROM "PostGiftEvent"
    WHERE "postId" = ${postId}
    GROUP BY "senderId"
    ORDER BY SUM("totalPoints") DESC, MAX("createdAt") DESC
    LIMIT ${Math.max(1, limit)}
  `)

  return rows.map((row) => ({
    senderId: parseNumberValue(row.senderId),
    totalAmount: parseNumberValue(row.totalAmount),
  }))
}

export async function listPostGiftStats(postId: string, client?: PostGiftQueryClient): Promise<PostGiftStatItem[]> {
  const rows = await resolveClient(client).$queryRaw<Array<{
    giftId: string
    giftNameSnapshot: string
    giftIconSnapshot: string
    unitPrice: number | string | bigint
    totalCount: number | string | bigint
    totalPoints: number | string | bigint
    lastSentAt: Date | string
  }>>(Prisma.sql`
    SELECT
      "giftId",
      "giftNameSnapshot",
      "giftIconSnapshot",
      "unitPrice",
      "totalCount",
      "totalPoints",
      "lastSentAt"
    FROM "PostGiftStats"
    WHERE "postId" = ${postId}
    ORDER BY "totalCount" DESC, "lastSentAt" DESC
  `)

  return rows.map((row) => ({
    giftId: row.giftId,
    giftName: row.giftNameSnapshot,
    giftIcon: row.giftIconSnapshot,
    unitPrice: parseNumberValue(row.unitPrice),
    totalCount: parseNumberValue(row.totalCount),
    totalPoints: parseNumberValue(row.totalPoints),
    lastSentAt: parseDateValue(row.lastSentAt).toISOString(),
  }))
}

export async function listRecentPostGiftEvents(postId: string, limit = 12, client?: PostGiftQueryClient): Promise<PostGiftRecentEventItem[]> {
  const rows = await resolveClient(client).$queryRaw<Array<{
    id: string
    giftId: string
    senderId: number | string | bigint
    senderName: string
    senderAvatarPath: string | null
    createdAt: Date | string
  }>>(Prisma.sql`
    SELECT
      event."id",
      event."giftId",
      event."senderId",
      COALESCE(NULLIF("user"."nickname", ''), "user"."username") AS "senderName",
      "user"."avatarPath" AS "senderAvatarPath",
      event."createdAt"
    FROM "PostGiftEvent" AS event
    INNER JOIN "User" AS "user"
      ON "user"."id" = event."senderId"
    WHERE event."postId" = ${postId}
    ORDER BY event."createdAt" DESC
    LIMIT ${Math.max(1, limit)}
  `)

  return rows.map((row) => ({
    id: row.id,
    giftId: row.giftId,
    senderId: parseNumberValue(row.senderId),
    senderName: row.senderName,
    senderAvatarPath: row.senderAvatarPath,
    createdAt: parseDateValue(row.createdAt).toISOString(),
  }))
}

export async function createPostGiftEvent(params: {
  tx: Prisma.TransactionClient
  postId: string
  senderId: number
  receiverId: number
  gift: SiteTippingGiftItem
  quantity?: number
}) {
  const tx = params.tx as PostGiftWriteTransactionClient
  const quantity = Math.max(1, params.quantity ?? 1)
  const totalPoints = params.gift.price * quantity
  const now = new Date()

  await tx.postGiftEvent.create({
    data: {
      id: crypto.randomUUID(),
      postId: params.postId,
      senderId: params.senderId,
      receiverId: params.receiverId,
      giftId: params.gift.id,
      giftNameSnapshot: params.gift.name,
      giftIconSnapshot: params.gift.icon,
      unitPrice: params.gift.price,
      quantity,
      totalPoints,
    },
  })

  await tx.postGiftStats.upsert({
    where: {
      postId_giftId: {
        postId: params.postId,
        giftId: params.gift.id,
      },
    },
    create: {
      id: crypto.randomUUID(),
      postId: params.postId,
      receiverId: params.receiverId,
      giftId: params.gift.id,
      giftNameSnapshot: params.gift.name,
      giftIconSnapshot: params.gift.icon,
      unitPrice: params.gift.price,
      totalCount: quantity,
      totalPoints,
      lastSentAt: now,
    },
    update: {
      giftNameSnapshot: params.gift.name,
      giftIconSnapshot: params.gift.icon,
      unitPrice: params.gift.price,
      totalCount: {
        increment: quantity,
      },
      totalPoints: {
        increment: totalPoints,
      },
      lastSentAt: now,
    },
  })

  return {
    quantity,
    totalPoints,
  }
}
