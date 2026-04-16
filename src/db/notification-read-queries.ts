import type { Prisma } from "@/db/types"

import { prisma } from "@/db/client"
import type { TimestampCursorPayload } from "@/lib/cursor-pagination"

export function countUnreadNotifications(userId: number) {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  })
}

export async function countUnreadNotificationsByUserIds(userIds: number[]) {
  const normalizedUserIds = [...new Set(userIds.filter((userId) => Number.isInteger(userId) && userId > 0))]

  if (normalizedUserIds.length === 0) {
    return new Map<number, number>()
  }

  const rows = await prisma.notification.groupBy({
    by: ["userId"],
    where: {
      userId: {
        in: normalizedUserIds,
      },
      isRead: false,
    },
    _count: {
      _all: true,
    },
  })

  const unreadCountByUserId = new Map<number, number>()

  for (const row of rows) {
    unreadCountByUserId.set(row.userId, row._count._all)
  }

  return unreadCountByUserId
}

function buildNotificationCursorWhere(userId: number, cursor: TimestampCursorPayload, direction: "after" | "before"): Prisma.NotificationWhereInput {
  const createdAt = new Date(cursor.createdAt)

  return {
    userId,
    OR: direction === "after"
      ? [
          { createdAt: { lt: createdAt } },
          { createdAt, id: { lt: cursor.id } },
        ]
      : [
          { createdAt: { gt: createdAt } },
          { createdAt, id: { gt: cursor.id } },
        ],
  }
}

export async function findNotificationsByUserIdCursor(params: {
  userId: number
  take: number
  after?: TimestampCursorPayload | null
  before?: TimestampCursorPayload | null
}) {
  const normalizedTake = Math.min(Math.max(1, params.take), 50)
  const pagingDirection = params.before ? "before" : "after"
  const cursor = params.before ?? params.after
  const rows = await prisma.notification.findMany({
    where: cursor ? buildNotificationCursorWhere(params.userId, cursor, pagingDirection) : { userId: params.userId },
    include: {
      sender: {
        select: {
          username: true,
          nickname: true,
        },
      },
    },
    orderBy: pagingDirection === "before"
      ? [{ createdAt: "asc" }, { id: "asc" }]
      : [{ createdAt: "desc" }, { id: "desc" }],
    take: normalizedTake + 1,
  })

  const hasExtra = rows.length > normalizedTake
  const slicedRows = hasExtra ? rows.slice(0, normalizedTake) : rows
  const items = pagingDirection === "before" ? [...slicedRows].reverse() : slicedRows

  return {
    items,
    hasPrevPage: params.before ? hasExtra : Boolean(params.after),
    hasNextPage: params.before ? true : hasExtra,
  }
}

export function countNotificationsByUserId(userId: number) {
  return prisma.notification.count({
    where: { userId },
  })
}

export function findPostsByIds(postIds: string[]) {
  if (postIds.length === 0) {
    return Promise.resolve([])
  }

  return prisma.post.findMany({
    where: {
      id: {
        in: [...new Set(postIds)],
      },
    },
    select: { id: true, slug: true, title: true },
  })
}

export function findCommentsWithPostByIds(commentIds: string[]) {
  if (commentIds.length === 0) {
    return Promise.resolve([])
  }

  return prisma.comment.findMany({
    where: {
      id: {
        in: [...new Set(commentIds)],
      },
    },
    select: {
      id: true,
      parentId: true,
      post: {
        select: {
          id: true,
          slug: true,
          title: true,
        },
      },
    },
  })
}

export function findUsersByIds(userIds: string[]) {
  if (userIds.length === 0) {
    return Promise.resolve([])
  }

  return prisma.user.findMany({
    where: {
      id: {
        in: [...new Set(userIds.map((userId) => Number(userId)).filter((userId) => Number.isInteger(userId) && userId > 0))],
      },
    },
    select: {
      id: true,
      username: true,
      nickname: true,
    },
  })
}
