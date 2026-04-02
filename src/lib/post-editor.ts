import { prisma } from "@/db/client"
import { extractSummaryFromContent } from "@/lib/content"
import { getAllPostContentText } from "@/lib/post-content"
export { normalizeManualTags } from "@/lib/post-tags"
import { normalizeManualTags } from "@/lib/post-tags"

function normalizeTagSlug(name: string) {
  return name
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 32)
}

function buildTagOperations(tags?: string[]) {
  const normalizedTags = normalizeManualTags(tags)

  return normalizedTags.map((name) => ({
    tag: {
      connectOrCreate: {
        where: {
          slug: normalizeTagSlug(name),
        },
        create: {
          name,
          slug: normalizeTagSlug(name),
        },
      },
    },
  }))
}

export async function syncPostTaxonomy(postId: string, title: string, content: string, manualTags?: string[]) {
  await prisma.postTag.deleteMany({
    where: { postId },
  })

  const normalizedContent = getAllPostContentText(content)
  const tagOperations = buildTagOperations(manualTags)

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
