import { prisma } from "@/db/client"

const RSS_POST_LIMIT = 30

export function findRssPosts(limit = RSS_POST_LIMIT) {
  return prisma.post.findMany({
    where: {
      status: "NORMAL",
    },
    orderBy: [
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
    take: limit,
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      content: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      board: {
        select: {
          name: true,
          slug: true,
        },
      },
      author: {
        select: {
          username: true,
          nickname: true,
        },
      },
    },
  })
}

export { RSS_POST_LIMIT }
