import { unstable_cache } from "next/cache"

import { resolvePagination } from "@/db/helpers"
import { countZoneNormalPosts, findAllZonesWithBoards, findGlobalPinnedPosts, findZoneBoardIdsBySlug, findZoneBoardListBySlug, findZoneNormalPosts, findZonePinnedPosts, findZoneWithBoardsBySlug } from "@/db/taxonomy-queries"
import { dedupeAndMapPinnedPosts, extractPinnedPostIds } from "@/lib/pinned-posts"
import type { TaxonomyPostSort } from "@/lib/forum-taxonomy-sort"
import { getAnonymousMaskDisplayIdentity } from "@/lib/post-anonymous"
import { mapListPost } from "@/lib/post-map"
import { applyHookedUserPresentationToSitePosts } from "@/lib/user-presentation-server"
import { normalizePostListLoadMode, type PostListLoadMode } from "@/lib/post-list-load-mode"
import { normalizePostListDisplayMode, type PostListDisplayMode } from "@/lib/post-list-display"
import { TAXONOMY_CACHE_TAGS, TAXONOMY_CONTENT_CACHE_TAG } from "@/lib/taxonomy-cache"

import type { SitePostItem } from "@/lib/posts"


export interface SiteZoneItem {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  hiddenFromSidebar: boolean
  boardSlugs: string[]
  count: number
  requirePostReview?: boolean
  requireCommentReview?: boolean
  minViewPoints?: number
  minViewLevel?: number
  minViewVipLevel?: number
  postListDisplayMode: PostListDisplayMode
  postListLoadMode: PostListLoadMode
}

type ZoneListRecord = Awaited<ReturnType<typeof findAllZonesWithBoards>>[number]
type ZoneBySlugRecord = NonNullable<Awaited<ReturnType<typeof findZoneWithBoardsBySlug>>>
type ZoneBoardListRecord = NonNullable<Awaited<ReturnType<typeof findZoneBoardListBySlug>>>
type SiteZoneRecord = ZoneListRecord | ZoneBySlugRecord

function mapSiteZone(zone: SiteZoneRecord): SiteZoneItem {
  return {
    id: zone.id,
    slug: zone.slug,
    name: zone.name,
    description: zone.description ?? `${zone.name} 分区`,
    icon: zone.icon ?? "📚",
    hiddenFromSidebar: zone.hiddenFromSidebar ?? false,
    boardSlugs: zone.boards.map((board) => board.slug),
    count: zone.boards.reduce((total, board) => total + board._count.posts, 0),
    requirePostReview: zone.requirePostReview ?? false,
    requireCommentReview: zone.requireCommentReview ?? false,
    minViewPoints: (zone as { minViewPoints?: number | null }).minViewPoints ?? 0,
    minViewLevel: (zone as { minViewLevel?: number | null }).minViewLevel ?? 0,
    minViewVipLevel: zone.minViewVipLevel ?? 0,
    postListDisplayMode: normalizePostListDisplayMode(zone.postListDisplayMode),
    postListLoadMode: normalizePostListLoadMode(zone.postListLoadMode),
  }
}

const getPersistentZones = unstable_cache(
  async (): Promise<SiteZoneItem[]> => {
    const zones = await findAllZonesWithBoards()
    return zones.map((zone) => mapSiteZone(zone))
  },
  ["zones:list"],
  { tags: [...TAXONOMY_CACHE_TAGS] },
)

const getPersistentZoneBySlug = unstable_cache(
  async (slug: string): Promise<SiteZoneItem | null> => {
    const zone = await findZoneWithBoardsBySlug(slug)

    if (!zone) {
      return null
    }

    return mapSiteZone(zone)
  },
  ["zones:by-slug"],
  { tags: [...TAXONOMY_CACHE_TAGS] },
)

const getPersistentZoneBoards = unstable_cache(
  async (slug: string) => {
    const zone = await findZoneBoardListBySlug(slug)

    if (!zone) {
      return []
    }

    return zone.boards.map((board: ZoneBoardListRecord["boards"][number]) => ({
      id: board.id,
      name: board.name,
      slug: board.slug,
      icon: board.iconPath ?? "💬",
      description: board.description ?? `${board.name} 节点讨论区`,
      count: board._count.posts,
    }))
  },
  ["zones:board-list"],
  { tags: [...TAXONOMY_CACHE_TAGS] },
)

export async function getZones(): Promise<SiteZoneItem[]> {
  return getPersistentZones()
}

export async function getZoneBySlug(slug: string) {
  return getPersistentZoneBySlug(slug)
}


export async function getZoneBoards(slug: string) {
  return getPersistentZoneBoards(slug)
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

const TAXONOMY_POST_PAGE_CACHE_REVALIDATE_SECONDS = 30
const TAXONOMY_POST_PAGE_CACHE_MAX_PAGE = 3

function shouldCacheTaxonomyPostPage(page: number) {
  return page >= 1 && page <= TAXONOMY_POST_PAGE_CACHE_MAX_PAGE
}

async function readZonePosts(
  slug: string,
  page = 1,
  pageSize = 10,
  sort: TaxonomyPostSort = "latest",
): Promise<ZonePostPageResult> {
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

  const anonymousMaskIdentity = await getAnonymousMaskDisplayIdentity()
  const boardIds = zone.boards.map((item: (typeof zone.boards)[number]) => item.id)
  const [globalPinnedPosts, zonePinnedPosts] = await Promise.all([
    findGlobalPinnedPosts(),
    findZonePinnedPosts(boardIds),
  ])
  const pinnedPosts = [...globalPinnedPosts, ...zonePinnedPosts].filter((post) => sort !== "featured" || post.isFeatured)
  const excludedPostIds = extractPinnedPostIds(pinnedPosts)
  const total = await countZoneNormalPosts(boardIds, excludedPostIds, sort)
  const pagination = resolvePagination({ page, pageSize }, total, [pageSize], pageSize)

  if (pagination.page === 1) {
    const { pinnedItems, pinnedPostIds } = dedupeAndMapPinnedPosts(pinnedPosts, (post) => mapListPost(post, anonymousMaskIdentity))
    const normalPosts = await findZoneNormalPosts(boardIds, pinnedPostIds, 1, pagination.pageSize, sort)
    const items = await applyHookedUserPresentationToSitePosts([
      ...pinnedItems,
      ...normalPosts.map((post) => mapListPost(post, anonymousMaskIdentity)),
    ])

    return {
      items,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages: pagination.totalPages,
      hasPrevPage: pagination.hasPrevPage,
      hasNextPage: pagination.hasNextPage,
    }
  }

  const normalPosts = await findZoneNormalPosts(boardIds, excludedPostIds, pagination.page, pagination.pageSize, sort)
  const items = await applyHookedUserPresentationToSitePosts(
    normalPosts.map((post) => mapListPost(post, anonymousMaskIdentity)),
  )

  return {
    items,
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: pagination.total,
    totalPages: pagination.totalPages,
    hasPrevPage: pagination.hasPrevPage,
    hasNextPage: pagination.hasNextPage,
  }
}

const getPersistentZonePosts = unstable_cache(
  async (slug: string, page: number, pageSize: number, sort: TaxonomyPostSort) => readZonePosts(slug, page, pageSize, sort),
  ["zones:posts"],
  {
    tags: [TAXONOMY_CONTENT_CACHE_TAG],
    revalidate: TAXONOMY_POST_PAGE_CACHE_REVALIDATE_SECONDS,
  },
)

export async function getZonePosts(
  slug: string,
  page = 1,
  pageSize = 10,
  sort: TaxonomyPostSort = "latest",
): Promise<ZonePostPageResult> {
  if (shouldCacheTaxonomyPostPage(page)) {
    return getPersistentZonePosts(slug, page, pageSize, sort)
  }

  return readZonePosts(slug, page, pageSize, sort)
}
