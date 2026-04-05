import { type Prisma, type PrismaClient } from "@prisma/client"

import { prisma } from "@/db/client"

type PostUnlockQueryClient = Prisma.TransactionClient | PrismaClient

function resolveClient(client?: PostUnlockQueryClient) {
  return client ?? prisma
}

export function findPostUnlockUserPoints(userId: number, client: PostUnlockQueryClient) {
  return client.user.findUnique({
    where: { id: userId },
    select: { id: true, points: true },
  })
}

export function findPurchasedPostBlockLog(
  params: {
    userId: number
    postId: string
    reasonPrefix: string
  },
  client?: PostUnlockQueryClient,
) {
  return resolveClient(client).pointLog.findFirst({
    where: {
      userId: params.userId,
      relatedType: "POST",
      relatedId: params.postId,
      reason: {
        startsWith: params.reasonPrefix,
      },
    },
    select: { id: true },
  })
}

export function listPurchasedPostBlockLogReasons(postId: string, userId: number, client?: PostUnlockQueryClient) {
  return resolveClient(client).pointLog.findMany({
    where: {
      userId,
      relatedType: "POST",
      relatedId: postId,
      reason: {
        startsWith: "[purchase:block]",
      },
    },
    select: {
      reason: true,
    },
  })
}

export function runPostUnlockTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(callback)
}
