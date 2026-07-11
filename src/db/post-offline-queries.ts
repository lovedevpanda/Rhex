import { type PrismaClient } from "@prisma/client"

import { Prisma } from "@/db/types"

import { prisma } from "@/db/client"

type PostOfflineQueryClient = Prisma.TransactionClient | PrismaClient

function resolveClient(client?: PostOfflineQueryClient) {
  return client ?? prisma
}

// Serialize state validation, the point debit, and the transition for one post.
// Without this row lock, concurrent retries can both observe NORMAL and charge twice.
export async function lockPostOfflineTarget(tx: Prisma.TransactionClient, postId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "Post"
    WHERE "id" = ${postId}
    FOR UPDATE
  `)

  return rows.length > 0
}

export function findPostOfflineTarget(postId: string, client?: PostOfflineQueryClient) {
  return resolveClient(client).post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      status: true,
      title: true,
      slug: true,
      board: {
        select: {
          slug: true,
          zone: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
  })
}

export function findPostOfflineUser(userId: number, client: Prisma.TransactionClient) {
  return client.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      points: true,
      vipLevel: true,
      vipExpiresAt: true,
    },
  })
}

export function updatePostOfflineTarget(
  client: Prisma.TransactionClient,
  params: {
    postId: string
    reviewNote: string | null
  },
) {
  return client.post.update({
    where: { id: params.postId },
    data: {
      status: "OFFLINE",
      reviewNote: params.reviewNote,
    },
    select: {
      id: true,
      authorId: true,
      slug: true,
      title: true,
      status: true,
      reviewNote: true,
      board: {
        select: {
          slug: true,
          zone: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
  })
}

export function runPostOfflineTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(callback)
}
