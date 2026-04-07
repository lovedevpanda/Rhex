import { Prisma, type PrismaClient } from "@prisma/client"

import { prisma } from "@/db/client"

type PostUnlockQueryClient = Prisma.TransactionClient | PrismaClient

interface PostBlockPurchaseIdRow {
  id: string
}

interface PostBlockPurchaseBlockRow {
  blockId: string
}

function resolveClient(client?: PostUnlockQueryClient) {
  return client ?? prisma
}

export function findPostUnlockUserPoints(userId: number, client: PostUnlockQueryClient) {
  return client.user.findUnique({
    where: { id: userId },
    select: { id: true, points: true },
  })
}

export async function findPurchasedPostBlockPurchase(
  params: {
    userId: number
    postId: string
    blockId: string
  },
  client?: PostUnlockQueryClient,
) {
  const rows = await resolveClient(client).$queryRaw<PostBlockPurchaseIdRow[]>(Prisma.sql`
    SELECT "id"
    FROM "PostBlockPurchase"
    WHERE "buyerId" = ${params.userId}
      AND "postId" = ${params.postId}
      AND "blockId" = ${params.blockId}
    LIMIT 1
  `)

  return rows[0] ?? null
}

export async function createPostBlockPurchase(
  params: {
    id: string
    postId: string
    blockId: string
    buyerId: number
    sellerId: number
    price: number
  },
  client: PostUnlockQueryClient,
) {
  const rows = await resolveClient(client).$queryRaw<PostBlockPurchaseIdRow[]>(Prisma.sql`
    INSERT INTO "PostBlockPurchase" ("id", "postId", "blockId", "buyerId", "sellerId", "price", "createdAt")
    VALUES (${params.id}, ${params.postId}, ${params.blockId}, ${params.buyerId}, ${params.sellerId}, ${params.price}, NOW())
    ON CONFLICT ("postId", "blockId", "buyerId") DO NOTHING
    RETURNING "id"
  `)

  return rows[0] ?? null
}

export async function listPurchasedPostBlockPurchases(postId: string, userId: number, client?: PostUnlockQueryClient) {
  return resolveClient(client).$queryRaw<PostBlockPurchaseBlockRow[]>(Prisma.sql`
    SELECT "blockId"
    FROM "PostBlockPurchase"
    WHERE "postId" = ${postId}
      AND "buyerId" = ${userId}
  `)
}

export async function listPurchasedPostBlockPurchaseBuyersByPost(postId: string, client?: PostUnlockQueryClient) {
  return resolveClient(client).$queryRaw<Array<{ blockId: string; buyerId: number }>>(Prisma.sql`
    SELECT "blockId", "buyerId"
    FROM "PostBlockPurchase"
    WHERE "postId" = ${postId}
  `)
}

export function runPostUnlockTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(callback)
}
