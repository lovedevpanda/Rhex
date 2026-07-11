import { prisma } from "@/db/client"

import { Prisma } from "@/db/types"

export function findPostUpdateContext(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      slug: true,
      authorId: true,
      boardId: true,
      isAnonymous: true,
      type: true,
      content: true,
      createdAt: true,
      lastAppendedAt: true,
      board: {
        include: {
          zone: true,
        },
      },
      appendices: {
        select: {
          sortOrder: true,
        },
        orderBy: {
          sortOrder: "desc",
        },
        take: 1,
      },
    },
  })
}

// The append interval and sort order are derived from mutable post state.
// Locking the post row keeps concurrent append requests from observing the same state.
export async function lockPostAppendTarget(tx: Prisma.TransactionClient, postId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "Post"
    WHERE "id" = ${postId}
    FOR UPDATE
  `)

  return rows.length > 0
}

export function findPostAppendState(tx: Prisma.TransactionClient, postId: string) {
  return tx.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      lastAppendedAt: true,
      appendices: {
        select: {
          sortOrder: true,
        },
        orderBy: {
          sortOrder: "desc",
        },
        take: 1,
      },
    },
  })
}

export function runPostUpdateTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(callback)
}
