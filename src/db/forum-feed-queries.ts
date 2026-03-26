import { prisma } from "@/db/client"
import type { Prisma } from "@/db/types"

export type FeedQuerySort = "latest" | "new" | "hot" | "weekly"

export function getFeedOrderBy(sort: FeedQuerySort): Prisma.PostOrderByWithRelationInput[] {
  switch (sort) {
    case "new":
      return [{ pinScope: "desc" as const }, { createdAt: "desc" as const }]
    case "hot":
      return [{ pinScope: "desc" as const }, { score: "desc" as const }, { commentCount: "desc" as const }, { createdAt: "desc" as const }]
    case "weekly":
      return [{ pinScope: "desc" as const }, { likeCount: "desc" as const }, { commentCount: "desc" as const }, { createdAt: "desc" as const }]
    case "latest":
    default:
      return [{ pinScope: "desc" as const }, { lastCommentedAt: "desc" as const }, { createdAt: "desc" as const }]
  }
}

function buildFeedWhere(): Prisma.PostWhereInput {
  return {
    status: "NORMAL",
  }
}

export function findLatestFeedPosts(page: number, pageSize: number, sort: FeedQuerySort) {
  return prisma.post.findMany({
    where: buildFeedWhere(),
    include: {
      board: {
        select: { name: true, slug: true, iconPath: true },
      },

      author: true,
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
    },
    orderBy: getFeedOrderBy(sort),
    skip: (page - 1) * pageSize,
    take: pageSize,
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
