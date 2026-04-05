import { prisma } from "@/db/client"

import type { Prisma } from "@/db/types"

export function findPostUpdateContext(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      slug: true,
      authorId: true,
      content: true,
      createdAt: true,
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
