import type { Prisma } from "@/db/types"

import { prisma } from "@/db/client"
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

function buildNormalizedTags(tags?: string[]) {
  return normalizeManualTags(tags).map((name) => ({
    name,
    slug: normalizeTagSlug(name),
  }))
}

async function syncTagPostCounts(tx: Prisma.TransactionClient, tagIds: string[]) {
  const uniqueTagIds = [...new Set(tagIds.filter(Boolean))]

  if (uniqueTagIds.length === 0) {
    return
  }

  const counts = await Promise.all(
    uniqueTagIds.map((tagId) => tx.postTag.count({
      where: { tagId },
    })),
  )

  await Promise.all(
    uniqueTagIds.map((tagId, index) => tx.tag.update({
      where: { id: tagId },
      data: {
        postCount: counts[index] ?? 0,
      },
    })),
  )
}

export async function replacePostTaxonomy(postId: string, summary: string, manualTags?: string[]) {
  await prisma.$transaction(async (tx) => {
    const existingRelations = await tx.postTag.findMany({
      where: { postId },
      select: { tagId: true },
    })

    const normalizedTags = buildNormalizedTags(manualTags)
    const syncedTags = await Promise.all(
      normalizedTags.map(({ name, slug }) => tx.tag.upsert({
        where: { slug },
        update: {
          name,
        },
        create: {
          name,
          slug,
        },
      })),
    )

    await tx.postTag.deleteMany({
      where: { postId },
    })

    if (syncedTags.length > 0) {
      await tx.postTag.createMany({
        data: syncedTags.map((tag) => ({
          postId,
          tagId: tag.id,
        })),
        skipDuplicates: true,
      })
    }

    await tx.post.update({
      where: { id: postId },
      data: {
        summary,
      },
    })

    await syncTagPostCounts(tx, [
      ...existingRelations.map((relation) => relation.tagId),
      ...syncedTags.map((tag) => tag.id),
    ])
  })
}
