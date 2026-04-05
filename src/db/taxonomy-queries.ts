import { prisma } from "@/db/client"
import type { Prisma } from "@/db/types"
import { pinnedPostOrderBy, postListInclude } from "@/db/queries"

export function findAllTags() {
  return prisma.tag.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      postCount: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })
}

export function findTagBySlugOrName(normalized: string) {
  return prisma.tag.findFirst({
    where: {
      OR: [
        { slug: normalized },
        { name: normalized },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      postCount: true,
    },
  })
}

export function findTagPostsBySlugOrName(normalized: string) {
  return prisma.post.findMany({
    where: {
      status: "NORMAL",
      tags: {
        some: {
          tag: {
            OR: [
              { slug: normalized },
              { name: normalized },
            ],
          },
        },
      },
    },
    include: postListInclude,
    orderBy: pinnedPostOrderBy,
  })
}

export function findTagListPage(options: { page: number; pageSize: number; sort: "hot" | "new" }) {
  const normalizedPageSize = Math.min(Math.max(1, options.pageSize), 50)
  const orderBy = options.sort === "new"
    ? [{ createdAt: "desc" as const }, { name: "asc" as const }]
    : [{ postCount: "desc" as const }, { createdAt: "desc" as const }, { name: "asc" as const }]

  return prisma.tag.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      postCount: true,
    },
    orderBy,
    skip: (options.page - 1) * normalizedPageSize,
    take: normalizedPageSize,
  })
}

export function countTags() {
  return prisma.tag.count()
}

export function findAllZonesWithBoards() {
  return prisma.zone.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      boards: {
        where: { status: "ACTIVE" },
        select: {
          slug: true,
          _count: {
            select: {
              posts: {
                where: { status: "NORMAL" },
              },
            },
          },
        },
      },
    },
  })
}

export function findZoneWithBoardsBySlug(slug: string) {
  return prisma.zone.findUnique({
    where: { slug },
    include: {
      boards: {
        where: { status: "ACTIVE" },
        select: {
          slug: true,
          _count: {
            select: {
              posts: {
                where: { status: "NORMAL" },
              },
            },
          },
        },
      },
    },
  })
}

export function findZoneBoardListBySlug(slug: string) {
  return prisma.zone.findUnique({
    where: { slug },
    include: {
      boards: {
        where: { status: "ACTIVE" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          iconPath: true,
          _count: {
            select: {
              posts: {
                where: { status: "NORMAL" },
              },
            },
          },
        },
      },
    },
  })
}

export function findZoneBoardIdsBySlug(slug: string) {
  return prisma.zone.findUnique({
    where: { slug },
    include: {
      boards: {
        where: { status: "ACTIVE" },
        select: { id: true },
      },
    },
  })
}

export function findZoneBoardIdsById(zoneId: string) {
  return prisma.zone.findUnique({
    where: { id: zoneId },
    include: {
      boards: {
        where: { status: "ACTIVE" },
        select: { id: true },
      },
    },
  })
}

function getZonePinnedOrderBy(): Prisma.PostOrderByWithRelationInput[] {
  return [
    { pinScope: "asc" },
    { createdAt: "desc" },
  ]
}

export function findGlobalPinnedPosts(pageSize?: number) {
  const normalizedPageSize = typeof pageSize === "number" ? Math.min(Math.max(1, pageSize), 50) : undefined

  return prisma.post.findMany({
    where: {
      status: "NORMAL",
      pinScope: "GLOBAL",
    },
    include: {
      board: true,
      author: true,
      redPacket: {
        select: {
          id: true,
        },
      },
    },
    orderBy: getZonePinnedOrderBy(),
    take: normalizedPageSize,
  })
}

export function findZonePinnedPosts(boardIds: string[], pageSize?: number) {
  const normalizedPageSize = typeof pageSize === "number" ? Math.min(Math.max(1, pageSize), 50) : undefined

  return prisma.post.findMany({
    where: {
      status: "NORMAL",
      pinScope: "ZONE",
      boardId: {
        in: boardIds,
      },
    },
    include: {
      board: true,
      author: true,
      redPacket: {
        select: {
          id: true,
        },
      },
    },
    orderBy: getZonePinnedOrderBy(),
    take: normalizedPageSize,
  })
}

export function findZoneNormalPosts(boardIds: string[], excludedPostIds: string[], page: number, pageSize: number) {
  const normalizedPageSize = Math.min(Math.max(1, pageSize), 50)

  return prisma.post.findMany({
    where: {
      status: "NORMAL",
      boardId: {
        in: boardIds,
      },
      id: excludedPostIds.length > 0 ? { notIn: excludedPostIds } : undefined,
    },
    include: {
      board: true,
      author: true,
      redPacket: {
        select: {
          id: true,
        },
      },
    },
    orderBy: [{ activityAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * normalizedPageSize,
    take: normalizedPageSize,
  })
}

export function countZoneNormalPosts(boardIds: string[], excludedPostIds: string[] = []) {
  return prisma.post.count({
    where: {
      status: "NORMAL",
      boardId: {
        in: boardIds,
      },
      id: excludedPostIds.length > 0 ? { notIn: excludedPostIds } : undefined,
    },
  })
}

export function findBoardPinnedPosts(boardId: string, zoneBoardIds: string[], pageSize?: number) {
  const normalizedPageSize = typeof pageSize === "number" ? Math.min(Math.max(1, pageSize), 50) : undefined

  return prisma.post.findMany({
    where: {
      status: "NORMAL",
      OR: [
        { pinScope: "GLOBAL" },
        { pinScope: "ZONE", boardId: { in: zoneBoardIds } },
        { pinScope: "BOARD", boardId },
      ],
    },
    include: {
      board: true,
      author: true,
      redPacket: {
        select: {
          id: true,
        },
      },
    },
    orderBy: getZonePinnedOrderBy(),
    take: normalizedPageSize,
  })
}

export function findBoardNormalPosts(boardId: string, excludedPostIds: string[], page: number, pageSize: number) {
  const normalizedPageSize = Math.min(Math.max(1, pageSize), 50)

  return prisma.post.findMany({
    where: {
      status: "NORMAL",
      boardId,
      id: excludedPostIds.length > 0 ? { notIn: excludedPostIds } : undefined,
    },
    include: {
      board: true,
      author: true,
      redPacket: {
        select: {
          id: true,
        },
      },
    },
    orderBy: [{ activityAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * normalizedPageSize,
    take: normalizedPageSize,
  })
}

export function countBoardNormalPosts(boardId: string, excludedPostIds: string[] = []) {
  return prisma.post.count({
    where: {
      status: "NORMAL",
      boardId,
      id: excludedPostIds.length > 0 ? { notIn: excludedPostIds } : undefined,
    },
  })
}

export function findZonePostsByBoardIds(boardIds: string[], page: number, pageSize: number) {
  return findZoneNormalPosts(boardIds, [], page, pageSize)
}
