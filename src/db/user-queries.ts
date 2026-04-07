import { prisma } from "@/db/client"
import type { Prisma } from "@/db/types"
import { postListInclude } from "@/db/queries"
import type { TimestampCursorPayload } from "@/lib/cursor-pagination"

export const userProfileSelect = {
  id: true,
  username: true,
  nickname: true,
  signature: true,
  role: true,
  bio: true,
  avatarPath: true,
  gender: true,
  status: true,
  level: true,
  points: true,
  vipLevel: true,
  vipExpiresAt: true,
  inviteCount: true,
  postCount: true,
  commentCount: true,
  likeReceivedCount: true,
  _count: {
    select: {
      favorites: true,
      boardFollows: true,
      followedByUsers: true,
    },
  },
  inviter: {
    select: {
      username: true,
    },
  },
  verificationApplications: {
    where: {
      status: "APPROVED",
    },
    orderBy: [{ reviewedAt: "desc" }, { submittedAt: "desc" }] as Prisma.UserVerificationOrderByWithRelationInput[],
    take: 1,
    include: {
      type: true,
    },
  },
} satisfies Prisma.UserSelect

export function findUserProfileByUsername(username: string) {
  return prisma.user.findUnique({
    where: { username },
    select: userProfileSelect,
  })
}

export function findUserPostsByUsername(username: string) {
  return prisma.post.findMany({
    where: {
      status: "NORMAL",
      isAnonymous: false,
      author: {
        username,
      },
    },
    include: postListInclude,
    orderBy: [{ createdAt: "desc" }],
    take: 30,
  })
}

export function findUserRepliesByUsername(username: string, limit = 20) {
  return prisma.comment.findMany({
    where: {
      status: "NORMAL",
      user: {
        username,
      },
      post: {
        status: "NORMAL",
        OR: [
          { isAnonymous: false },
          {
            author: {
              username: {
                not: username,
              },
            },
          },
        ],
      },
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      likeCount: true,
      replyToUser: {
        select: {
          username: true,
        },
      },
      post: {
        select: {
          id: true,
          title: true,
          slug: true,
          board: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: Math.min(Math.max(1, limit), 50),
  })
}

export function countUserPosts(userId: number) {
  return prisma.post.count({
    where: {
      status: "NORMAL",
      authorId: userId,
    },
  })
}

export function countUserPublicPostsByUsername(username: string) {
  return prisma.post.count({
    where: {
      status: "NORMAL",
      isAnonymous: false,
      author: {
        username,
      },
    },
  })
}

function buildTimestampCursorWhere<T extends string>(
  idField: T,
  createdAtField: T,
  cursor: TimestampCursorPayload,
  direction: "after" | "before",
) {
  const createdAt = new Date(cursor.createdAt)

  return {
    OR: direction === "after"
      ? [
          { [createdAtField]: { lt: createdAt } },
          { [createdAtField]: createdAt, [idField]: { lt: cursor.id } },
        ]
      : [
          { [createdAtField]: { gt: createdAt } },
          { [createdAtField]: createdAt, [idField]: { gt: cursor.id } },
        ],
  } as Record<string, unknown>
}

export async function findUserPostsByIdCursor(params: { userId: number; pageSize: number; after?: TimestampCursorPayload | null; before?: TimestampCursorPayload | null }) {
  const normalizedPageSize = Math.min(Math.max(1, params.pageSize), 50)
  const pagingDirection = params.before ? "before" : "after"
  const cursor = params.before ?? params.after

  const rows = await prisma.post.findMany({
    where: {
      status: "NORMAL",
      authorId: params.userId,
      ...(cursor ? buildTimestampCursorWhere("id", "createdAt", cursor, pagingDirection) : {}),
    },
    include: postListInclude,
    orderBy: pagingDirection === "before" ? [{ createdAt: "asc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "desc" }],
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

export function findUserAccountSettingsById(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      emailVerifiedAt: true,
      signature: true,
    },
  })
}

export function countUserFavorites(userId: number) {
  return prisma.favorite.count({
    where: { userId },
  })
}

export async function findUserFavoritePostsByIdCursor(params: { userId: number; pageSize: number; after?: TimestampCursorPayload | null; before?: TimestampCursorPayload | null }) {
  const normalizedPageSize = Math.min(Math.max(1, params.pageSize), 50)
  const pagingDirection = params.before ? "before" : "after"
  const cursor = params.before ?? params.after

  const rows = await prisma.favorite.findMany({
    where: {
      userId: params.userId,
      ...(cursor ? buildTimestampCursorWhere("id", "createdAt", cursor, pagingDirection) : {}),
    },
    include: {
      post: {
        include: postListInclude,
      },
    },
    orderBy: pagingDirection === "before" ? [{ createdAt: "asc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "desc" }],
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

export function countUserReplies(userId: number) {
  return prisma.comment.count({
    where: {
      userId,
      status: "NORMAL",
    },
  })
}

export async function findUserRepliesByIdCursor(params: { userId: number; pageSize: number; after?: TimestampCursorPayload | null; before?: TimestampCursorPayload | null }) {
  const normalizedPageSize = Math.min(Math.max(1, params.pageSize), 50)
  const pagingDirection = params.before ? "before" : "after"
  const cursor = params.before ?? params.after

  const rows = await prisma.comment.findMany({
    where: {
      userId: params.userId,
      status: "NORMAL",
      ...(cursor ? buildTimestampCursorWhere("id", "createdAt", cursor, pagingDirection) : {}),
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      likeCount: true,
      replyToUser: {
        select: {
          username: true,
        },
      },
      post: {
        select: {
          id: true,
          title: true,
          slug: true,
          board: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: pagingDirection === "before" ? [{ createdAt: "asc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "desc" }],
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

export function countUserLikedPosts(userId: number) {
  return prisma.like.count({
    where: {
      userId,
      targetType: "POST",
      post: {
        status: "NORMAL",
      },
    },
  })
}

export async function findUserLikedPostsByIdCursor(params: { userId: number; pageSize: number; after?: TimestampCursorPayload | null; before?: TimestampCursorPayload | null }) {
  const normalizedPageSize = Math.min(Math.max(1, params.pageSize), 50)
  const pagingDirection = params.before ? "before" : "after"
  const cursor = params.before ?? params.after

  const rows = await prisma.like.findMany({
    where: {
      userId: params.userId,
      targetType: "POST",
      post: {
        status: "NORMAL",
      },
      ...(cursor ? buildTimestampCursorWhere("id", "createdAt", cursor, pagingDirection) : {}),
    },
    include: {
      post: {
        include: postListInclude,
      },
    },
    orderBy: pagingDirection === "before" ? [{ createdAt: "asc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "desc" }],
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
