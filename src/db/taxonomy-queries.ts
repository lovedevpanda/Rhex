import { prisma } from "@/db/client"
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

export function findZonePostsByBoardIds(boardIds: string[], page: number, pageSize: number) {
  return prisma.post.findMany({
    where: {
      status: "NORMAL",
      boardId: {
        in: boardIds,
      },
    },
    include: {
      board: true,
      author: true,
    },
    orderBy: [{ pinScope: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  })
}
