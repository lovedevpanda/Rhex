import { prisma } from "@/db/client"

export async function findPostSidebarData(postId: string, authorUsername: string) {
  const [author, postTags, relatedPosts] = await Promise.all([
    prisma.user.findUnique({
      where: { username: authorUsername },
      select: {
        bio: true,
      },
    }),


    prisma.postTag.findMany({
      where: { postId },
      include: { tag: true },
      take: 8,
    }),
    prisma.post.findMany({
      where: {
        id: { not: postId },
        status: "NORMAL",
        OR: [
          {
            author: {
              username: authorUsername,
            },
          },
        ],
      },
      select: {
        id: true,
        slug: true,
        title: true,
      },
      take: 5,
      orderBy: [{ createdAt: "desc" }],
    }),
  ])

  return { author, postTags, relatedPosts }
}
