import { prisma } from "@/db/client"

export function findActiveBoardsWithZoneAndPostCount() {
  return prisma.board.findMany({
    where: {
      status: "ACTIVE",
    },
    include: {
      zone: true,
      _count: {
        select: {
          posts: {
            where: {
              status: "NORMAL",
            },
          },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  })
}

export function findBoardBySlugWithZoneAndPostCount(slug: string) {
  return prisma.board.findUnique({
    where: { slug },
    include: {
      zone: true,
      _count: {
        select: {
          posts: {
            where: {
              status: "NORMAL",
            },
          },
        },
      },
    },
  })
}
