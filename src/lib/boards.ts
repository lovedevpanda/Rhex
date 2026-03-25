import { cache } from "react"

import { findBoardFollow } from "@/db/board-queries"
import { resolvePagination } from "@/db/helpers"
import { resolveBoardSettings } from "@/lib/board-settings"
import { prisma } from "@/db/client"
import { mapListPost } from "@/lib/post-map"



export interface SiteBoardItem {
  id: string
  zoneId?: string | null
  name: string

  slug: string
  icon: string
  description: string
  count: number
  allowedPostTypes?: string[]
  requirePostReview?: boolean
  minViewPoints?: number
  minViewLevel?: number
  minPostPoints?: number
  minPostLevel?: number
  minReplyPoints?: number
  minReplyLevel?: number
  minViewVipLevel?: number

  minPostVipLevel?: number
  minReplyVipLevel?: number
}


const getCachedBoards = cache(async (): Promise<SiteBoardItem[]> => {
  const boards = await prisma.board.findMany({
    where: {
      status: "ACTIVE",
    },
    include: {
      zone: true,
      _count: {
        select: {
          posts: {
            where: {
              status: "NORMAL",
            },
          },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  })

  return boards.map((board) => {
    const settings = resolveBoardSettings(board.zone, board)

    return {
      id: board.id,
      zoneId: board.zoneId,
      name: board.name,
      slug: board.slug,
      icon: board.iconPath ?? "💬",
      description: board.description ?? `${board.name} 节点讨论区`,
      count: board._count.posts,
      allowedPostTypes: settings.allowedPostTypes,
      requirePostReview: settings.requirePostReview,
      minViewPoints: settings.minViewPoints,
      minViewLevel: settings.minViewLevel,
      minPostPoints: settings.minPostPoints,
      minPostLevel: settings.minPostLevel,
      minReplyPoints: settings.minReplyPoints,
      minReplyLevel: settings.minReplyLevel,
      minViewVipLevel: settings.minViewVipLevel,

      minPostVipLevel: settings.minPostVipLevel,
      minReplyVipLevel: settings.minReplyVipLevel,
    }
  })
})

export async function getBoards(): Promise<SiteBoardItem[]> {
  return getCachedBoards()
}

export async function getFeaturedBoards(limit: number): Promise<SiteBoardItem[]> {
  const boards = await getCachedBoards()
  return boards.slice(0, Math.max(0, limit))
}

const getCachedBoardBySlug = cache(async (slug: string): Promise<SiteBoardItem | null> => {
  const board = await prisma.board.findUnique({
    where: { slug },
    include: {
      zone: true,
      _count: {
        select: {
          posts: {
            where: {
              status: "NORMAL",
            },
          },
        },
      },
    },
  })

  if (!board) {
    return null
  }

  const settings = resolveBoardSettings(board.zone, board)

  return {
    id: board.id,
    zoneId: board.zoneId,
    name: board.name,
    slug: board.slug,
    icon: board.iconPath ?? "💬",
    description: board.description ?? `${board.name} 节点讨论区`,
    count: board._count.posts,
    allowedPostTypes: settings.allowedPostTypes,
    minViewPoints: settings.minViewPoints,
    minViewLevel: settings.minViewLevel,
    minPostPoints: settings.minPostPoints,
    minPostLevel: settings.minPostLevel,
    minReplyPoints: settings.minReplyPoints,
    minReplyLevel: settings.minReplyLevel,
    minViewVipLevel: settings.minViewVipLevel,

    minPostVipLevel: settings.minPostVipLevel,
    minReplyVipLevel: settings.minReplyVipLevel,
    requirePostReview: settings.requirePostReview,
  }
})

export async function getBoardBySlug(slug: string): Promise<SiteBoardItem | null> {
  return getCachedBoardBySlug(slug)
}

export async function getBoardPosts(slug: string, page = 1, pageSize = 30) {
  const board = await getBoardBySlug(slug)

  if (!board) {
    return []
  }

  const pagination = resolvePagination({ page, pageSize }, Number.MAX_SAFE_INTEGER, [10, 20, 30, 50, 100], 30)
  const posts = await prisma.post.findMany({
    where: {
      status: "NORMAL",
      board: {
        slug,
      },
    },
    include: {
      board: true,
      author: true,
    },
    orderBy: [{ pinScope: "desc" }, { createdAt: "desc" }],
    skip: pagination.skip,
    take: pagination.pageSize,
  })

  return posts.map((post) => mapListPost(post))
}

export async function isUserFollowingBoard(userId: number, boardId: string) {
  const follow = await findBoardFollow(userId, boardId)

  return Boolean(follow)
}


