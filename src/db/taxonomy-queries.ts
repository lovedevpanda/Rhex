import { prisma } from "@/db/client"
import type { Prisma } from "@/db/types"
import { pinnedPostOrderBy, postListInclude } from "@/db/queries"

export function findAllTags() {
  return prisma.tag.findMany({
    include: {
      _count: {
        select: {
          posts: true,
        },
      },
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
    include: {
      _count: {
        select: {
          posts: true,
        },
      },
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
  const orderBy = options.sort === "new"
    ? [{ createdAt: "desc" as const }, { name: "asc" as const }]
    : [{ posts: { _count: "desc" as const } }, { createdAt: "desc" as const }, { name: "asc" as const }]

  return prisma.tag.findMany({
    include: {
      _count: {
        select: {
          posts: true,
        },
      },
    },
    orderBy,
    skip: (options.page - 1) * options.pageSize,
    take: options.pageSize,
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
  return prisma.post.findMany({
    where: {
      status: "NORMAL",
      pinScope: "GLOBAL",
    },
    include: {
      board: true,
      author: true,
    },
    orderBy: getZonePinnedOrderBy(),
    take: pageSize,
  })
}

export function findZonePinnedPosts(boardIds: string[], pageSize?: number) {
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
    },
    orderBy: getZonePinnedOrderBy(),
    take: pageSize,
  })
}

export function findZoneNormalPosts(boardIds: string[], excludedPostIds: string[], page: number, pageSize: number) {
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
    },
    orderBy: [{ createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  })
}

export function findBoardPinnedPosts(boardId: string, zoneBoardIds: string[], pageSize?: number) {
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
    },
    orderBy: getZonePinnedOrderBy(),
    take: pageSize,
  })
}

export function findBoardNormalPosts(boardId: string, excludedPostIds: string[], page: number, pageSize: number) {
  return prisma.post.findMany({
    where: {
      status: "NORMAL",
      boardId,
      id: excludedPostIds.length > 0 ? { notIn: excludedPostIds } : undefined,
    },
    include: {
      board: true,
      author: true,
    },
    orderBy: [{ createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  })
}

export function findZonePostsByBoardIds(boardIds: string[], page: number, pageSize: number) {
  return findZoneNormalPosts(boardIds, [], page, pageSize)
}
