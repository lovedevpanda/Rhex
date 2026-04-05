import { prisma } from "@/db/client"
import type { Prisma } from "@/db/types"
import type { PinnedTimestampCursorPayload } from "@/lib/cursor-pagination"
import { pinnedPostOrderBy } from "@/db/queries"

const searchPostListSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  content: true,
  coverPath: true,
  type: true,
  status: true,
  isPinned: true,
  pinScope: true,
  isFeatured: true,
  minViewLevel: true,
  minViewVipLevel: true,
  commentCount: true,
  likeCount: true,
  favoriteCount: true,
  viewCount: true,
  tipCount: true,
  tipTotalPoints: true,
  publishedAt: true,
  createdAt: true,
  board: {
    select: {
      name: true,
      slug: true,
      iconPath: true,
    },
  },
  author: {
    select: {
      id: true,
      username: true,
      nickname: true,
      avatarPath: true,
      status: true,
      vipLevel: true,
      vipExpiresAt: true,
    },
  },
  redPacket: {
    select: {
      id: true,
    },
  },
} satisfies Prisma.PostSelect

export function buildPostSearchWhere(keyword: string) {
  return {
    status: "NORMAL" as const,
    OR: [
      { title: { contains: keyword, mode: "insensitive" as const } },
      { summary: { contains: keyword, mode: "insensitive" as const } },
      { author: { username: { contains: keyword, mode: "insensitive" as const } } },
      { author: { nickname: { contains: keyword, mode: "insensitive" as const } } },
      { board: { name: { contains: keyword, mode: "insensitive" as const } } },
    ],
  }
}

export function countSearchPosts(where: ReturnType<typeof buildPostSearchWhere>) {
  return prisma.post.count({ where })
}

function buildSearchCursorWhere(cursor: PinnedTimestampCursorPayload, direction: "after" | "before"): Prisma.PostWhereInput {
  const createdAt = new Date(cursor.createdAt)

  if (direction === "after") {
    return {
      OR: [
        ...(cursor.isPinned ? [{ isPinned: false }] : []),
        { isPinned: cursor.isPinned, createdAt: { lt: createdAt } },
        { isPinned: cursor.isPinned, createdAt, id: { lt: cursor.id } },
      ],
    }
  }

  return {
    OR: [
      ...(!cursor.isPinned ? [{ isPinned: true }] : []),
      { isPinned: cursor.isPinned, createdAt: { gt: createdAt } },
      { isPinned: cursor.isPinned, createdAt, id: { gt: cursor.id } },
    ],
  }
}

export async function findSearchPostsCursor(params: {
  where: ReturnType<typeof buildPostSearchWhere>
  pageSize: number
  after?: PinnedTimestampCursorPayload | null
  before?: PinnedTimestampCursorPayload | null
}) {
  const normalizedPageSize = Math.min(Math.max(1, params.pageSize), 50)
  const pagingDirection = params.before ? "before" : "after"
  const cursor = params.before ?? params.after

  const rows = await prisma.post.findMany({
    where: cursor
      ? {
          AND: [
            params.where,
            buildSearchCursorWhere(cursor, pagingDirection),
          ],
        }
      : params.where,
    select: searchPostListSelect,
    orderBy: pagingDirection === "before"
      ? [{ isPinned: "asc" }, { createdAt: "asc" }, { id: "asc" }]
      : [...pinnedPostOrderBy, { id: "desc" }],
    take: normalizedPageSize + 1,
  })

  const hasExtra = rows.length > normalizedPageSize
  const slicedRows = hasExtra ? rows.slice(0, normalizedPageSize) : rows
  const items = pagingDirection === "before" ? [...slicedRows].reverse() : slicedRows

  return {
    items,
    hasPrevPage: params.before ? hasExtra : Boolean(params.after),
    hasNextPage: params.before ? true : hasExtra,
  }
}
