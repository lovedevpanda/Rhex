import { type Prisma, type PrismaClient } from "@prisma/client"

import { prisma } from "@/db/client"
import { userIdentityWithAvatarSelect } from "@/db/user-selects"

type PostTipQueryClient = Prisma.TransactionClient | PrismaClient

function resolveClient(client?: PostTipQueryClient) {
  return client ?? prisma
}

export interface PostTipSupportPostRecord {
  id: string
  status: string
  authorId: number
  title: string
  boardId: string | null
}

export interface PostTipSupportSenderRecord {
  id: number
  points: number
  status: string
  username: string
}

export interface PostTipSupportRecipientRecord {
  id: number
  points: number
}

export interface PostTipSupportAggregateRow {
  senderId: number
  totalAmount: number
}

export interface PostTipSupporterProfile {
  id: number
  username: string
  nickname: string | null
  avatarPath: string | null
}

export function countPostTipEventsBySender(params: {
  senderId: number
  postId?: string
  start?: Date
  end?: Date
  client?: PostTipQueryClient
}) {
  return resolveClient(params.client).postTip.count({
    where: {
      senderId: params.senderId,
      ...(params.postId ? { postId: params.postId } : {}),
      ...(params.start || params.end
        ? {
            createdAt: {
              ...(params.start ? { gte: params.start } : {}),
              ...(params.end ? { lt: params.end } : {}),
            },
          }
        : {}),
    },
  })
}

export function createPostTipRecord(
  client: Prisma.TransactionClient,
  params: {
    postId: string
    senderId: number
    receiverId: number
    amount: number
  },
) {
  return client.postTip.create({
    data: {
      postId: params.postId,
      senderId: params.senderId,
      receiverId: params.receiverId,
      amount: params.amount,
    },
  })
}

export function findPostTipRecipient(userId: number, client: Prisma.TransactionClient) {
  return client.user.findUnique({
    where: { id: userId },
    select: { id: true, points: true },
  })
}

export function findPostTipSender(senderId: number, client: Prisma.TransactionClient) {
  return client.user.findUnique({
    where: { id: senderId },
    select: {
      id: true,
      points: true,
      status: true,
      username: true,
    },
  })
}

export function findPostTipSummarySnapshot(postId: string, client?: PostTipQueryClient) {
  return resolveClient(client).post.findUnique({
    where: { id: postId },
    select: {
      tipCount: true,
      tipTotalPoints: true,
    },
  })
}

export function findPostTipSupportPost(postId: string, client: Prisma.TransactionClient) {
  return client.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      status: true,
      authorId: true,
      title: true,
      boardId: true,
    },
  })
}

export async function findPostTipSupportersByIds(
  userIds: number[],
  client?: PostTipQueryClient,
): Promise<PostTipSupporterProfile[]> {
  if (userIds.length === 0) {
    return []
  }

  return resolveClient(client).user.findMany({
    where: { id: { in: userIds } },
    select: userIdentityWithAvatarSelect,
  })
}

export function findPostTipUserPoints(userId: number, client?: PostTipQueryClient) {
  return resolveClient(client).user.findUnique({
    where: { id: userId },
    select: { id: true, points: true },
  })
}

export function incrementPostTipTotals(
  client: Prisma.TransactionClient,
  params: {
    postId: string
    amount: number
  },
) {
  return client.post.update({
    where: { id: params.postId },
    data: {
      tipCount: {
        increment: 1,
      },
      tipTotalPoints: {
        increment: params.amount,
      },
    },
  })
}

export async function listPostTipSupportAggregates(
  postId: string,
  limit = 20,
  client?: PostTipQueryClient,
): Promise<PostTipSupportAggregateRow[]> {
  const rows = await resolveClient(client).postTip.groupBy({
    by: ["senderId"],
    where: { postId },
    _sum: { amount: true },
    orderBy: {
      _sum: {
        amount: "desc",
      },
    },
    take: Math.max(1, limit),
  })

  return rows.map((row) => ({
    senderId: row.senderId,
    totalAmount: row._sum.amount ?? 0,
  }))
}

export function runPostTipTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(callback)
}
