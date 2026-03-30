import type { Prisma } from "@prisma/client"

import { prisma } from "@/db/client"
import { buildPostDetailInclude, pinnedPostOrderBy, postListInclude } from "@/db/queries"

const postSeoSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  content: true,
} satisfies Prisma.PostSelect

function extractPostRouteIdentifier(slug: string) {
  const trimmed = slug.trim()

  if (!trimmed) {
    return null
  }

  return trimmed.match(/-([a-z0-9]+)$/i)?.[1] ?? trimmed.match(/^[a-z0-9]+$/i)?.[0] ?? null
}

function buildPostRouteFallbackFilter(slug: string): Prisma.PostWhereInput | null {
  const identifier = extractPostRouteIdentifier(slug)

  if (!identifier) {
    return null
  }

  return {
    OR: [
      {
        id: identifier,
      },
      {
        slug: {
          endsWith: `-${identifier}`,
        },
      },
    ],
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

  const fallbackWhere = buildPostRouteFallbackFilter(slug)

  if (!fallbackWhere) {
    return null
  }

  return prisma.post.findFirst({
    where: fallbackWhere,
    include,
  })
}

export async function findHomepagePosts(page: number, pageSize: number) {
  const normalizedPageSize = Math.min(Math.max(1, pageSize), 50)

  return prisma.post.findMany({
    where: {
      status: "NORMAL",
    },
    include: postListInclude,
    orderBy: pinnedPostOrderBy,
    skip: (page - 1) * normalizedPageSize,
    take: normalizedPageSize,
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
      redPacket: true,
      tags: {
        include: {
          tag: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  })
}

export async function increasePostViewCount(postId: string) {
  return prisma.post.update({
    where: { id: postId },
    data: {
      viewCount: {
        increment: 1,
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

  const fallbackWhere = buildPostRouteFallbackFilter(slug)

  if (!fallbackWhere) {
    return null
  }

  return prisma.post.findFirst({
    where: fallbackWhere,
    select: postSeoSelect,
  })
}
