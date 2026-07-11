import { CommentStatus, type Prisma } from "@/db/types"

import { prisma } from "@/db/client"

type CommentOfflineQueryClient = Prisma.TransactionClient | typeof prisma

function resolveClient(client?: CommentOfflineQueryClient) {
  return client ?? prisma
}

export function findCommentOfflineTarget(commentId: string, client?: CommentOfflineQueryClient) {
  return resolveClient(client).comment.findUnique({
    where: { id: commentId },
    include: {
      post: {
        include: {
          board: {
            include: {
              zone: true,
            },
          },
        },
      },
    },
  })
}

export async function updateCommentOfflineTarget(
  client: CommentOfflineQueryClient,
  params: {
    commentId: string
    actorId: number
    reviewNote: string
  },
) {
  const updated = await client.comment.updateMany({
    where: {
      id: params.commentId,
      status: CommentStatus.NORMAL,
    },
    data: {
      status: CommentStatus.HIDDEN,
      reviewNote: params.reviewNote,
      reviewedById: params.actorId,
      reviewedAt: new Date(),
    },
  })

  if (updated.count !== 1) {
    return null
  }

  return findCommentOfflineTarget(params.commentId, client)
}

export function runCommentOfflineTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(callback)
}
