import { type Prisma, type PrismaClient } from "@prisma/client"

import { prisma } from "@/db/client"

type PostOfflineQueryClient = Prisma.TransactionClient | PrismaClient

function resolveClient(client?: PostOfflineQueryClient) {
  return client ?? prisma
}

export function findPostOfflineTarget(postId: string, client?: PostOfflineQueryClient) {
  return resolveClient(client).post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      status: true,
      title: true,
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
      slug: true,
      title: true,
      status: true,
      reviewNote: true,
    },
  })
}

export function runPostOfflineTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(callback)
}
