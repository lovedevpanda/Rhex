import { prisma } from "@/db/client"

import type { Prisma } from "@/db/types"

export function runPostCreateTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(callback)
}

export function createPostRecord(
  tx: Prisma.TransactionClient,
  data: Prisma.PostUncheckedCreateInput,
) {
  return tx.post.create({
    data: {
      ...data,
      activityAt: new Date(),
    },
  })
}

export function updateAuthorAfterPostCreated(
  tx: Prisma.TransactionClient,
  authorId: number,
  lastPostAt: Date,
) {
  return tx.user.update({
    where: { id: authorId },
    data: {
      postCount: { increment: 1 },
      lastPostAt,
    },
  })
}

export function incrementBoardPostCount(
  tx: Prisma.TransactionClient,
  boardId: string,
) {
  return tx.board.update({
    where: { id: boardId },
    data: {
      postCount: { increment: 1 },
    },
  })
}

export function updatePostContentAndSummary(
  tx: Prisma.TransactionClient,
  postId: string,
  content: string,
  summary: string,
) {
  return tx.post.update({
    where: { id: postId },
    data: {
      content,
      summary,
    },
  })
}
