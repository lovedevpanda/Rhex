import { prisma } from "@/db/client"

export function findActiveSensitiveWords() {
  return prisma.sensitiveWord.findMany({
    where: { status: true },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      word: true,
      matchType: true,
      actionType: true,
      status: true,
    },
  })
}
