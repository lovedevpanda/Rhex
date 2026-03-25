import { prisma } from "@/db/client"
import { extractSummaryFromContent } from "@/lib/content"
import { getAllPostContentText } from "@/lib/post-content"
import { extractAutoTags, slugifyTagName } from "@/lib/post-taxonomy"

function buildTagOperations(title: string, content: string) {
  const normalizedContent = getAllPostContentText(content)
  const autoTags = extractAutoTags(title, normalizedContent)

  return autoTags.map((name) => ({
    tag: {
      connectOrCreate: {
        where: {
          slug: slugifyTagName(name),
        },
        create: {
          name,
          slug: slugifyTagName(name),
        },
      },
    },
  }))
}

export async function syncPostTaxonomy(postId: string, title: string, content: string) {
  await prisma.postTag.deleteMany({
    where: { postId },
  })

  const normalizedContent = getAllPostContentText(content)
  const tagOperations = buildTagOperations(title, content)

  await prisma.post.update({
    where: { id: postId },
    data: {
      summary: extractSummaryFromContent(normalizedContent) || title,
      tags: tagOperations.length > 0
        ? {
            create: tagOperations,
          }
        : undefined,
    },
  })
}

