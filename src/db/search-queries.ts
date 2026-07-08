import { prisma } from "@/db/client"
import { UserStatus, type Prisma } from "@/db/types"
import type { PinnedTimestampCursorPayload } from "@/lib/cursor-pagination"
import { pinnedPostOrderBy } from "@/db/queries"
import { PUBLIC_READABLE_POST_STATUSES } from "@/lib/post-types"

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
  _count: {
    select: {
      attachments: true,
    },
  },
} satisfies Prisma.PostSelect

function normalizeSearchTerms(keyword: string) {
  const terms = keyword
    .trim()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)

  return terms.length > 0 ? Array.from(new Set(terms)) : [keyword.trim()]
}

export function buildPostSearchWhere(keyword: string) {
  const terms = normalizeSearchTerms(keyword)

  return {
    status: { in: [...PUBLIC_READABLE_POST_STATUSES] },
    AND: terms.map((term) => ({
      OR: [
        { title: { contains: term, mode: "insensitive" as const } },
        { summary: { contains: term, mode: "insensitive" as const } },
        { content: { contains: term, mode: "insensitive" as const } },
      ],
    })),
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

export function buildBoardSearchWhere(keyword: string): Prisma.BoardWhereInput {
  const terms = normalizeSearchTerms(keyword)

  return {
    status: "ACTIVE",
    AND: terms.map((term) => ({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { slug: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        {
          zone: {
            is: {
              OR: [
                { name: { contains: term, mode: "insensitive" } },
                { slug: { contains: term, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    })),
  }
}

export function countSearchBoards(where: Prisma.BoardWhereInput) {
  return prisma.board.count({ where })
}

export function findSearchBoardsPage(params: {
  where: Prisma.BoardWhereInput
  page: number
  pageSize: number
}) {
  const normalizedPageSize = Math.min(Math.max(1, params.pageSize), 50)

  return prisma.board.findMany({
    where: params.where,
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      iconPath: true,
      followerCount: true,
      zone: {
        select: {
          name: true,
          slug: true,
        },
      },
      _count: {
        select: {
          posts: {
            where: {
              status: { in: [...PUBLIC_READABLE_POST_STATUSES] },
            },
          },
        },
      },
    },
    orderBy: [
      { postCount: "desc" },
      { followerCount: "desc" },
      { sortOrder: "asc" },
      { createdAt: "desc" },
    ],
    skip: (params.page - 1) * normalizedPageSize,
    take: normalizedPageSize,
  })
}

export function buildTagSearchWhere(keyword: string): Prisma.TagWhereInput {
  const terms = normalizeSearchTerms(keyword)

  return {
    AND: terms.map((term) => ({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { slug: { contains: term, mode: "insensitive" } },
      ],
    })),
  }
}

export function countSearchTags(where: Prisma.TagWhereInput) {
  return prisma.tag.count({ where })
}

export function findSearchTagsPage(params: {
  where: Prisma.TagWhereInput
  page: number
  pageSize: number
}) {
  const normalizedPageSize = Math.min(Math.max(1, params.pageSize), 50)

  return prisma.tag.findMany({
    where: params.where,
    select: {
      id: true,
      name: true,
      slug: true,
      postCount: true,
      createdAt: true,
    },
    orderBy: [
      { postCount: "desc" },
      { createdAt: "desc" },
      { name: "asc" },
    ],
    skip: (params.page - 1) * normalizedPageSize,
    take: normalizedPageSize,
  })
}

export function buildUserSearchWhere(keyword: string): Prisma.UserWhereInput {
  const terms = normalizeSearchTerms(keyword)

  return {
    status: {
      in: [UserStatus.ACTIVE, UserStatus.MUTED],
    },
    AND: terms.map((term) => ({
      OR: [
        { username: { contains: term, mode: "insensitive" } },
        { nickname: { contains: term, mode: "insensitive" } },
        { bio: { contains: term, mode: "insensitive" } },
      ],
    })),
  }
}

export function countSearchUsers(where: Prisma.UserWhereInput) {
  return prisma.user.count({ where })
}

export function findSearchUsersPage(params: {
  where: Prisma.UserWhereInput
  page: number
  pageSize: number
}) {
  const normalizedPageSize = Math.min(Math.max(1, params.pageSize), 50)

  return prisma.user.findMany({
    where: params.where,
    select: {
      id: true,
      username: true,
      nickname: true,
      avatarPath: true,
      bio: true,
      role: true,
      status: true,
      level: true,
      vipLevel: true,
      vipExpiresAt: true,
      postCount: true,
      commentCount: true,
      likeReceivedCount: true,
      _count: {
        select: {
          followedByUsers: true,
          favorites: true,
          boardFollows: true,
        },
      },
    },
    orderBy: [
      { level: "desc" },
      { postCount: "desc" },
      { id: "asc" },
    ],
    skip: (params.page - 1) * normalizedPageSize,
    take: normalizedPageSize,
  })
}

export function buildFavoriteCollectionSearchWhere(
  keyword: string,
  currentUserId?: number | null,
): Prisma.FavoriteCollectionWhereInput {
  const terms = normalizeSearchTerms(keyword)
  const visibilityWhere: Prisma.FavoriteCollectionWhereInput = currentUserId
    ? {
        OR: [
          { visibility: "PUBLIC" },
          { ownerId: currentUserId },
        ],
      }
    : { visibility: "PUBLIC" }

  return {
    AND: [
      visibilityWhere,
      ...terms.map((term) => ({
        OR: [
          { title: { contains: term, mode: "insensitive" as const } },
          { description: { contains: term, mode: "insensitive" as const } },
          { owner: { username: { contains: term, mode: "insensitive" as const } } },
          { owner: { nickname: { contains: term, mode: "insensitive" as const } } },
        ],
      })),
    ],
  }
}

export function countSearchFavoriteCollections(where: Prisma.FavoriteCollectionWhereInput) {
  return prisma.favoriteCollection.count({ where })
}

export function findSearchFavoriteCollectionsPage(params: {
  where: Prisma.FavoriteCollectionWhereInput
  page: number
  pageSize: number
}) {
  const normalizedPageSize = Math.min(Math.max(1, params.pageSize), 50)

  return prisma.favoriteCollection.findMany({
    where: params.where,
    select: {
      id: true,
      title: true,
      description: true,
      visibility: true,
      allowOtherUsersToContribute: true,
      requireContributionApproval: true,
      postCount: true,
      createdAt: true,
      updatedAt: true,
      owner: {
        select: {
          id: true,
          username: true,
          nickname: true,
          avatarPath: true,
          role: true,
          status: true,
        },
      },
    },
    orderBy: [
      { postCount: "desc" },
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
    skip: (params.page - 1) * normalizedPageSize,
    take: normalizedPageSize,
  })
}
