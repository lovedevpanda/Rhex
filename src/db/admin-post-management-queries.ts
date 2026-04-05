import { PostStatus } from "@/db/types"

import type { Prisma } from "@/db/types"

import { prisma } from "@/db/client"

export async function countAdminPostSummary(where: Prisma.PostWhereInput) {
  const [total, pending, normal, offline, pinned, featured, announcement] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.count({ where: { ...where, status: PostStatus.PENDING } }),
    prisma.post.count({ where: { ...where, status: PostStatus.NORMAL } }),
    prisma.post.count({ where: { ...where, status: PostStatus.OFFLINE } }),
    prisma.post.count({ where: { ...where, isPinned: true } }),
    prisma.post.count({ where: { ...where, isFeatured: true } }),
    prisma.post.count({ where: { ...where, isAnnouncement: true } }),
  ])

  return {
    total,
    pending,
    normal,
    offline,
    pinned,
    featured,
    announcement,
  }
}

export function findAdminPostBoardOptions(where?: Prisma.BoardWhereInput) {
  return prisma.board.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: { slug: true, name: true, zone: { select: { name: true } } },
    take: 200,
  })
}

export function findAdminPostsPage(where: Prisma.PostWhereInput, orderBy: Prisma.PostOrderByWithRelationInput[], skip: number, take: number) {
  return prisma.post.findMany({
    where,
    orderBy,
    skip,
    take,
    include: {
      board: { select: { name: true, slug: true, zone: { select: { name: true } } } },
      author: { select: { id: true, username: true, nickname: true, status: true } },
    },
  })
}
