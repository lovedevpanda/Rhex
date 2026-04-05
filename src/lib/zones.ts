import { cache } from "react"

import { resolvePagination } from "@/db/helpers"
import { countZoneNormalPosts, findAllZonesWithBoards, findGlobalPinnedPosts, findZoneBoardIdsBySlug, findZoneBoardListBySlug, findZoneNormalPosts, findZonePinnedPosts, findZoneWithBoardsBySlug } from "@/db/taxonomy-queries"
import { dedupeAndMapPinnedPosts, extractPinnedPostIds } from "@/lib/pinned-posts"
import { mapListPost } from "@/lib/post-map"
import { normalizePostListDisplayMode, type PostListDisplayMode } from "@/lib/post-list-display"

import type { SitePostItem } from "@/lib/posts"


export interface SiteZoneItem {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  boardSlugs: string[]
  count: number
  requirePostReview?: boolean
  minViewPoints?: number
  minViewLevel?: number
  minViewVipLevel?: number
  postListDisplayMode: PostListDisplayMode
}



const getCachedZones = cache(async (): Promise<SiteZoneItem[]> => {
  const zones = await findAllZonesWithBoards()


  return zones.map((zone) => ({
    id: zone.id,
    slug: zone.slug,
    name: zone.name,
    description: zone.description ?? `${zone.name} 分区`,
    icon: zone.icon ?? "📚",
    boardSlugs: zone.boards.map((board) => board.slug),
    count: zone.boards.reduce((total, board) => total + board._count.posts, 0),
    requirePostReview: zone.requirePostReview ?? false,
    minViewPoints: (zone as { minViewPoints?: number | null }).minViewPoints ?? 0,
    minViewLevel: (zone as { minViewLevel?: number | null }).minViewLevel ?? 0,
    minViewVipLevel: zone.minViewVipLevel ?? 0,
    postListDisplayMode: normalizePostListDisplayMode(zone.postListDisplayMode),
  }))


})

export async function getZones(): Promise<SiteZoneItem[]> {
  return getCachedZones()
}

const getCachedZoneBySlug = cache(async (slug: string) => {
  const zone = await findZoneWithBoardsBySlug(slug)

  if (!zone) {
    return null
  }

  return {
    id: zone.id,
    slug: zone.slug,
    name: zone.name,
    description: zone.description ?? `${zone.name} 分区`,
    icon: zone.icon ?? "📚",
    boardSlugs: zone.boards.map((board: (typeof zone.boards)[number]) => board.slug),
    count: zone.boards.reduce((total: number, board: (typeof zone.boards)[number]) => total + board._count.posts, 0),
    requirePostReview: zone.requirePostReview ?? false,
    minViewPoints: (zone as { minViewPoints?: number | null }).minViewPoints ?? 0,
    minViewLevel: (zone as { minViewLevel?: number | null }).minViewLevel ?? 0,
    minViewVipLevel: zone.minViewVipLevel ?? 0,
    postListDisplayMode: normalizePostListDisplayMode(zone.postListDisplayMode),
  }


})


export async function getZoneBySlug(slug: string) {
  return getCachedZoneBySlug(slug)
}


export async function getZoneBoards(slug: string) {
  const zone = await findZoneBoardListBySlug(slug)


  if (!zone) {
    return []
  }

  return zone.boards.map((board) => ({
    id: board.id,
    name: board.name,
    slug: board.slug,
    icon: board.iconPath ?? "💬",
    description: board.description ?? `${board.name} 节点讨论区`,
    count: board._count.posts,
  }))
}

export interface ZonePostPageResult {
  items: SitePostItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export async function getZonePosts(slug: string, page = 1, pageSize = 10): Promise<ZonePostPageResult> {
  const zone = await findZoneBoardIdsBySlug(slug)

  if (!zone || zone.boards.length === 0) {
    return {
      items: [],
      page: 1,
      pageSize,
      total: 0,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
    }
  }

  const boardIds = zone.boards.map((item: (typeof zone.boards)[number]) => item.id)
  const [globalPinnedPosts, zonePinnedPosts] = await Promise.all([
    findGlobalPinnedPosts(),
    findZonePinnedPosts(boardIds),
  ])
  const pinnedPosts = [...globalPinnedPosts, ...zonePinnedPosts]
  const excludedPostIds = extractPinnedPostIds(pinnedPosts)
  const total = await countZoneNormalPosts(boardIds, excludedPostIds)
  const pagination = resolvePagination({ page, pageSize }, total, [pageSize], pageSize)

  if (pagination.page === 1) {
    const { pinnedItems, pinnedPostIds } = dedupeAndMapPinnedPosts(pinnedPosts)
    const normalPosts = await findZoneNormalPosts(boardIds, pinnedPostIds, 1, pagination.pageSize)

    return {
      items: [...pinnedItems, ...normalPosts.map((post) => mapListPost(post))],
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages: pagination.totalPages,
      hasPrevPage: pagination.hasPrevPage,
      hasNextPage: pagination.hasNextPage,
    }
  }

  const normalPosts = await findZoneNormalPosts(boardIds, excludedPostIds, pagination.page, pagination.pageSize)

  return {
    items: normalPosts.map((post) => mapListPost(post)),
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: pagination.total,
    totalPages: pagination.totalPages,
    hasPrevPage: pagination.hasPrevPage,
    hasNextPage: pagination.hasNextPage,
  }
}
