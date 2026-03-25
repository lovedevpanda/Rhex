import { cache } from "react"

import { findAllZonesWithBoards, findZoneBoardIdsBySlug, findZoneBoardListBySlug, findZonePostsByBoardIds, findZoneWithBoardsBySlug } from "@/db/taxonomy-queries"
import { mapListPost } from "@/lib/post-map"

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

export async function getZonePosts(slug: string, page = 1, pageSize = 10): Promise<SitePostItem[]> {
  const zone = await findZoneBoardIdsBySlug(slug)

  if (!zone || zone.boards.length === 0) {
    return []
  }

  const posts = await findZonePostsByBoardIds(zone.boards.map((item: (typeof zone.boards)[number]) => item.id), page, pageSize)



  return posts.map((post) => mapListPost(post))
}
