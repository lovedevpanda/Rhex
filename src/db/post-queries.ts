import type { Prisma } from "@prisma/client"

import { prisma } from "@/db/client"
import { buildPostDetailInclude } from "@/db/queries"


const postSeoSelect = {
  slug: true,
  title: true,
  summary: true,
  content: true,
} satisfies Prisma.PostSelect

function extractSlugNumericSuffix(slug: string) {
  return slug.match(/-(\d+)$/)?.[1] ?? null
}

function buildSlugSuffixFilter(slug: string): Prisma.PostWhereInput | null {
  const suffix = extractSlugNumericSuffix(slug)

  if (!suffix) {
    return null
  }

  return {
    slug: {
      endsWith: `-${suffix}`,
    },
  }
}

export async function findPostDetailBySlug(slug: string, currentUserId?: number) {
  const include = buildPostDetailInclude(currentUserId)

  const post = await prisma.post.findUnique({
    where: { slug },
    include,
  })

  if (post) {
    return post
  }

  const fallbackWhere = buildSlugSuffixFilter(slug)

  if (!fallbackWhere) {
    return null
  }

  return prisma.post.findFirst({
    where: fallbackWhere,
    include,
  })
}

export async function findEditablePostBySlug(slug: string) {
  return prisma.post.findUnique({
    where: { slug },
    include: {
      board: true,
      pollOptions: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  })
}

export async function findPostSeoBySlug(slug: string) {
  const post = await prisma.post.findUnique({
    where: { slug },
    select: postSeoSelect,
  })

  if (post) {
    return post
  }

  const fallbackWhere = buildSlugSuffixFilter(slug)

  if (!fallbackWhere) {
    return null
  }

  return prisma.post.findFirst({
    where: fallbackWhere,
    select: postSeoSelect,
  })
}
