import { prisma } from "@/db/client"
import type { Prisma } from "@/db/types"

export type FeedQuerySort = "latest" | "new" | "hot" | "weekly"

const feedPostInclude = {
  board: {
    select: { name: true, slug: true, iconPath: true },
  },
  author: true,
  redPacket: {
    select: {
      id: true,
    },
  },
  comments: {
    where: { status: "NORMAL" },
    orderBy: { createdAt: "desc" },
    take: 1,
    include: {
      user: {
        select: { username: true, nickname: true },
      },
    },
  },
} satisfies Prisma.PostInclude

export function getFeedOrderBy(sort: FeedQuerySort): Prisma.PostOrderByWithRelationInput[] {
  switch (sort) {
    case "new":
      return [{ createdAt: "desc" as const }, { id: "desc" as const }]
    case "hot":
      return [{ score: "desc" as const }, { commentCount: "desc" as const }, { likeCount: "desc" as const }, { createdAt: "desc" as const }, { id: "desc" as const }]
    case "weekly":
      return [{ likeCount: "desc" as const }, { commentCount: "desc" as const }, { createdAt: "desc" as const }, { id: "desc" as const }]
    case "latest":
    default:
      return [{ activityAt: "desc" }, { createdAt: "desc" }, { id: "desc" }] as Prisma.PostOrderByWithRelationInput[]

  }
}


function buildFeedWhere(excludedPostIds: string[] = []): Prisma.PostWhereInput {
  return {
    status: "NORMAL",
    id: excludedPostIds.length > 0 ? { notIn: excludedPostIds } : undefined,
  }
}

export function findLatestFeedPosts(page: number, pageSize: number, sort: FeedQuerySort, excludedPostIds: string[] = []) {
  const normalizedPageSize = Math.min(Math.max(1, pageSize), 50)

  return prisma.post.findMany({
    where: buildFeedWhere(excludedPostIds),
    include: feedPostInclude,
    orderBy: getFeedOrderBy(sort),
    skip: (page - 1) * normalizedPageSize,
    take: normalizedPageSize,
  })
}




export function findLatestTopicPosts(limit: number) {
  return prisma.post.findMany({
    where: { status: "NORMAL" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      author: { select: { username: true, nickname: true } },
      board: { select: { name: true } },
    },
  })
}

export function findLatestReplyComments(limit: number) {
  return prisma.comment.findMany({
    where: { status: "NORMAL", post: { status: "NORMAL" } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      content: true,
      createdAt: true,
      user: { select: { username: true, nickname: true } },
      post: { select: { slug: true, title: true } },
    },
  })
}
