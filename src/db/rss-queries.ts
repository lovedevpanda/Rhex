import type { Prisma } from "@/db/types"

import { prisma } from "@/db/client"

const RSS_POST_LIMIT = 30

const rssPostSelect = {
  id: true,
  slug: true,
  title: true,
  isAnonymous: true,
  summary: true,
  content: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  board: {
    select: {
      id: true,
      name: true,
      slug: true,
      zone: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  },
  author: {
    select: {
      id: true,
      username: true,
      nickname: true,
    },
  },
} satisfies Prisma.PostSelect

function getRssPostOrderBy(): Prisma.PostOrderByWithRelationInput[] {
  return [
    { publishedAt: "desc" },
    { createdAt: "desc" },
    { id: "desc" },
  ]
}

export function findRssPosts(limit = RSS_POST_LIMIT) {
  return prisma.post.findMany({
    where: {
      status: "NORMAL",
    },
    orderBy: getRssPostOrderBy(),
    take: limit,
    select: rssPostSelect,
  })
}

export function findBoardRssPosts(boardSlug: string, limit = RSS_POST_LIMIT) {
  return prisma.post.findMany({
    where: {
      status: "NORMAL",
      board: {
        slug: boardSlug,
        status: "ACTIVE",
      },
    },
    orderBy: getRssPostOrderBy(),
    take: limit,
    select: rssPostSelect,
  })
}

export function findZoneRssPosts(zoneSlug: string, limit = RSS_POST_LIMIT) {
  return prisma.post.findMany({
    where: {
      status: "NORMAL",
      board: {
        status: "ACTIVE",
        zone: {
          slug: zoneSlug,
        },
      },
    },
    orderBy: getRssPostOrderBy(),
    take: limit,
    select: rssPostSelect,
  })
}

export function findUserRssPosts(username: string, limit = RSS_POST_LIMIT) {
  return prisma.post.findMany({
    where: {
      status: "NORMAL",
      isAnonymous: false,
      author: {
        username,
      },
    },
    orderBy: getRssPostOrderBy(),
    take: limit,
    select: rssPostSelect,
  })
}

export function findTagRssPosts(tagSlug: string, limit = RSS_POST_LIMIT) {
  return prisma.post.findMany({
    where: {
      status: "NORMAL",
      tags: {
        some: {
          tag: {
            slug: tagSlug,
          },
        },
      },
    },
    orderBy: getRssPostOrderBy(),
    take: limit,
    select: rssPostSelect,
  })
}

export { RSS_POST_LIMIT }
export type RssPostRecord = Prisma.PostGetPayload<{ select: typeof rssPostSelect }>

