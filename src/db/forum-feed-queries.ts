import { prisma } from "@/db/client"
import { postListInclude } from "@/db/queries"
import { buildHomeVisiblePostWhere } from "@/db/home-feed-visibility"
import { buildPostListVisibilityWhere, type PostListVisibilityViewer } from "@/db/post-list-visibility"
import type { Prisma } from "@/db/types"

export type FeedQuerySort = "latest" | "new" | "hot" | "featured" | "weekly" | "following"

type FollowFeedFilters = {
  boardIds?: string[]
  authorIds?: number[]
  tagIds?: string[]
}

const feedPostInclude = {
  board: postListInclude.board,
  author: postListInclude.author,
  redPacket: {
    select: {
      id: true,
    },
  },
  _count: {
    select: {
      attachments: true,
    },
  },
  comments: {
    where: { status: "NORMAL" },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      id: true,
      userId: true,
      useAnonymousIdentity: true,
      content: true,
      user: {
        select: { username: true, nickname: true },
      },
    },
  },
} satisfies Prisma.PostInclude

const HOT_RECENT_ORDER_BY = [
  { score: "desc" as const },
  { activityAt: "desc" as const },
  { commentCount: "desc" as const },
  { likeCount: "desc" as const },
  { createdAt: "desc" as const },
  { id: "desc" as const },
]

const HOT_HISTORY_ORDER_BY = [
  { score: "desc" as const },
  { commentCount: "desc" as const },
  { likeCount: "desc" as const },
  { createdAt: "desc" as const },
  { id: "desc" as const },
]

export function getFeedOrderBy(sort: FeedQuerySort): Prisma.PostOrderByWithRelationInput[] {
  switch (sort) {
    case "new":
      return [{ createdAt: "desc" as const }, { id: "desc" as const }]
    case "hot":
      return HOT_RECENT_ORDER_BY
    case "weekly":
      return [{ likeCount: "desc" as const }, { commentCount: "desc" as const }, { createdAt: "desc" as const }, { id: "desc" as const }]
    case "following":
    case "latest":
    default:
      return [{ activityAt: "desc" }, { createdAt: "desc" }, { id: "desc" }] as Prisma.PostOrderByWithRelationInput[]

  }
}

function normalizeHotRecentWindowHours(windowHours: number) {
  if (!Number.isFinite(windowHours)) {
    return 72
  }

  return Math.min(720, Math.max(1, Math.trunc(windowHours)))
}

function getHotRecentWindowStart(windowHours: number) {
  return new Date(Date.now() - normalizeHotRecentWindowHours(windowHours) * 60 * 60 * 1000)
}

function buildFeedWhere(
  excludedPostIds: string[] = [],
  filters?: FollowFeedFilters,
  viewer?: PostListVisibilityViewer | null,
  featuredOnly = false,
): Prisma.PostWhereInput {
  const followClauses: Prisma.PostWhereInput[] = []

  if (filters?.boardIds?.length) {
    followClauses.push({
      boardId: {
        in: filters.boardIds,
      },
    })
  }

  if (filters?.authorIds?.length) {
    followClauses.push({
      authorId: {
        in: filters.authorIds,
      },
      isAnonymous: false,
    })
  }

  if (filters?.tagIds?.length) {
    followClauses.push({
      tags: {
        some: {
          tagId: {
            in: filters.tagIds,
          },
        },
      },
    })
  }

  return {
    AND: [
      buildHomeVisiblePostWhere(),
      buildPostListVisibilityWhere(viewer),
    ],
    id: excludedPostIds.length > 0 ? { notIn: excludedPostIds } : undefined,
    isFeatured: featuredOnly ? true : undefined,
    OR: followClauses.length > 0 ? followClauses : undefined,
  }
}

function buildRecentHotWhere(
  recentWindowStart: Date,
  excludedPostIds: string[] = [],
  filters?: FollowFeedFilters,
  viewer?: PostListVisibilityViewer | null,
): Prisma.PostWhereInput {
  return {
    ...buildFeedWhere(excludedPostIds, filters, viewer),
    activityAt: {
      gte: recentWindowStart,
    },
  }
}

function buildHistoricalHotWhere(
  recentWindowStart: Date,
  excludedPostIds: string[] = [],
  filters?: FollowFeedFilters,
  viewer?: PostListVisibilityViewer | null,
): Prisma.PostWhereInput {
  return {
    ...buildFeedWhere(excludedPostIds, filters, viewer),
    activityAt: {
      lt: recentWindowStart,
    },
  }
}

async function findHybridHotFeedPosts(
  page: number,
  pageSize: number,
  hotRecentWindowHours: number,
  excludedPostIds: string[] = [],
  filters?: FollowFeedFilters,
  viewer?: PostListVisibilityViewer | null,
) {
  const normalizedPageSize = Math.min(Math.max(1, pageSize), 50)
  const skip = (page - 1) * normalizedPageSize
  const recentWindowStart = getHotRecentWindowStart(hotRecentWindowHours)
  const recentWhere = buildRecentHotWhere(recentWindowStart, excludedPostIds, filters, viewer)
  const historyWhere = buildHistoricalHotWhere(recentWindowStart, excludedPostIds, filters, viewer)

  if (page === 1) {
    const recentPosts = await prisma.post.findMany({
      where: recentWhere,
      include: feedPostInclude,
      orderBy: HOT_RECENT_ORDER_BY,
      take: normalizedPageSize,
    })

    if (recentPosts.length >= normalizedPageSize) {
      return recentPosts
    }

    const historyPosts = await prisma.post.findMany({
      where: historyWhere,
      include: feedPostInclude,
      orderBy: HOT_HISTORY_ORDER_BY,
      take: normalizedPageSize - recentPosts.length,
    })

    return [...recentPosts, ...historyPosts]
  }

  const recentCount = await prisma.post.count({
    where: recentWhere,
  })

  if (skip >= recentCount) {
    return prisma.post.findMany({
      where: historyWhere,
      include: feedPostInclude,
      orderBy: HOT_HISTORY_ORDER_BY,
      skip: skip - recentCount,
      take: normalizedPageSize,
    })
  }

  const recentPosts = await prisma.post.findMany({
    where: recentWhere,
    include: feedPostInclude,
    orderBy: HOT_RECENT_ORDER_BY,
    skip,
    take: normalizedPageSize,
  })

  if (recentPosts.length >= normalizedPageSize) {
    return recentPosts
  }

  const remaining = normalizedPageSize - recentPosts.length
  const historyPosts = await prisma.post.findMany({
    where: historyWhere,
    include: feedPostInclude,
    orderBy: HOT_HISTORY_ORDER_BY,
    take: remaining,
  })

  return [...recentPosts, ...historyPosts]
}

export function findLatestFeedPosts(page: number, pageSize: number, sort: FeedQuerySort, excludedPostIds: string[] = [], hotRecentWindowHours = 72, viewer?: PostListVisibilityViewer | null) {
  if (sort === "hot") {
    return findHybridHotFeedPosts(page, pageSize, hotRecentWindowHours, excludedPostIds, undefined, viewer)
  }

  const normalizedPageSize = Math.min(Math.max(1, pageSize), 50)

  return prisma.post.findMany({
    where: buildFeedWhere(excludedPostIds, undefined, viewer, sort === "featured"),
    include: feedPostInclude,
    orderBy: getFeedOrderBy(sort),
    skip: (page - 1) * normalizedPageSize,
    take: normalizedPageSize,
  })
}

export function countLatestFeedPosts(excludedPostIds: string[] = [], viewer?: PostListVisibilityViewer | null, featuredOnly = false) {
  return prisma.post.count({
    where: buildFeedWhere(excludedPostIds, undefined, viewer, featuredOnly),
  })
}

export function findFollowingFeedPosts(
  page: number,
  pageSize: number,
  sort: FeedQuerySort,
  filters: FollowFeedFilters,
  hotRecentWindowHours = 72,
  viewer?: PostListVisibilityViewer | null,
) {
  if (sort === "hot") {
    return findHybridHotFeedPosts(page, pageSize, hotRecentWindowHours, [], filters, viewer)
  }

  const normalizedPageSize = Math.min(Math.max(1, pageSize), 50)

  return prisma.post.findMany({
    where: buildFeedWhere([], filters, viewer),
    include: feedPostInclude,
    orderBy: getFeedOrderBy(sort),
    skip: (page - 1) * normalizedPageSize,
    take: normalizedPageSize,
  })
}

export function countFollowingFeedPosts(filters: FollowFeedFilters, viewer?: PostListVisibilityViewer | null) {
  return prisma.post.count({
    where: buildFeedWhere([], filters, viewer),
  })
}




export function findLatestTopicPosts(limit: number) {
  return prisma.post.findMany({
    where: {
      ...buildHomeVisiblePostWhere(),
      ...buildPostListVisibilityWhere(),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      author: { select: { id: true, username: true, nickname: true } },
      board: { select: { name: true } },
    },
  })
}

export function findLatestReplyComments(limit: number) {
  return prisma.comment.findMany({
    where: {
      status: "NORMAL",
      post: {
        ...buildHomeVisiblePostWhere(),
        ...buildPostListVisibilityWhere(),
      },
    },
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
