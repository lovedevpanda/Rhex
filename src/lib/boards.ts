import { cache } from "react"

import { findFollowRecord } from "@/db/follow-queries"
import { resolvePagination } from "@/db/helpers"
import { countBoardNormalPosts, findBoardNormalPosts, findBoardPinnedPosts, findZoneBoardIdsById } from "@/db/taxonomy-queries"
import { normalizeBoardSidebarConfig, type BoardSidebarLinkItem } from "@/lib/board-sidebar-config"
import { resolveBoardSettings } from "@/lib/board-settings"
import { getAnonymousMaskDisplayIdentity } from "@/lib/post-anonymous"
import { resolvePostListLoadMode, type PostListLoadMode } from "@/lib/post-list-load-mode"
import { resolvePostListDisplayMode, type PostListDisplayMode } from "@/lib/post-list-display"
import { dedupeAndMapPinnedPosts, extractPinnedPostIds } from "@/lib/pinned-posts"
import { mapListPost } from "@/lib/post-map"
import { findActiveBoardsWithZoneAndPostCount, findBoardBySlugWithZoneAndPostCount, findBoardModeratorsByBoardId } from "@/db/board-read-queries"
import type { SitePostItem } from "@/lib/posts"
import { getUserDisplayName } from "@/lib/user-display"



export interface SiteBoardItem {
  id: string
  zoneId?: string | null
  name: string

  slug: string
  icon: string
  description: string
  sidebarLinks: BoardSidebarLinkItem[]
  rulesMarkdown: string | null
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
  postListDisplayMode: PostListDisplayMode
  postListLoadMode: PostListLoadMode
}


const getCachedBoards = cache(async (): Promise<SiteBoardItem[]> => {
  const boards = await findActiveBoardsWithZoneAndPostCount()


  return boards.map((board) => {
    const settings = resolveBoardSettings(board.zone, board)
    const sidebarConfig = normalizeBoardSidebarConfig(board.configJson)

    return {
      id: board.id,
      zoneId: board.zoneId,
      name: board.name,
      slug: board.slug,
      icon: board.iconPath ?? "💬",
      description: board.description ?? `${board.name} 节点讨论区`,
      sidebarLinks: sidebarConfig.links,
      rulesMarkdown: sidebarConfig.rulesMarkdown,
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
      postListDisplayMode: resolvePostListDisplayMode(board.zone?.postListDisplayMode, board.postListDisplayMode),
      postListLoadMode: resolvePostListLoadMode(board.zone?.postListLoadMode, board.postListLoadMode),
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
  const board = await findBoardBySlugWithZoneAndPostCount(slug)

  if (!board) {
    return null
  }

  const settings = resolveBoardSettings(board.zone, board)
  const sidebarConfig = normalizeBoardSidebarConfig(board.configJson)

  return {
    id: board.id,
    zoneId: board.zoneId,
    name: board.name,
    slug: board.slug,
    icon: board.iconPath ?? "💬",
    description: board.description ?? `${board.name} 节点讨论区`,
    sidebarLinks: sidebarConfig.links,
    rulesMarkdown: sidebarConfig.rulesMarkdown,
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
    postListDisplayMode: resolvePostListDisplayMode(board.zone?.postListDisplayMode, board.postListDisplayMode),
    postListLoadMode: resolvePostListLoadMode(board.zone?.postListLoadMode, board.postListLoadMode),
  }
})

export async function getBoardBySlug(slug: string): Promise<SiteBoardItem | null> {
  return getCachedBoardBySlug(slug)
}

export interface BoardModeratorItem {
  id: number
  username: string
  displayName: string
  avatarPath: string | null
  vipLevel: number
  role: "USER" | "MODERATOR" | "ADMIN"
}

const getCachedBoardModerators = cache(async (boardId: string): Promise<BoardModeratorItem[]> => {
  const scopes = await findBoardModeratorsByBoardId(boardId)

  return scopes.map((scope) => ({
    id: scope.moderator.id,
    username: scope.moderator.username,
    displayName: getUserDisplayName(scope.moderator),
    avatarPath: scope.moderator.avatarPath ?? null,
    vipLevel: scope.moderator.vipLevel ?? 0,
    role: scope.moderator.role,
  }))
})

export async function getBoardModerators(boardId: string): Promise<BoardModeratorItem[]> {
  return getCachedBoardModerators(boardId)
}

export interface BoardPostPageResult {
  items: SitePostItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export async function getBoardPosts(slug: string, page = 1, pageSize = 30): Promise<BoardPostPageResult> {
  const board = await getBoardBySlug(slug)

  if (!board) {
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
  const zone = board.zoneId ? await findZoneBoardIdsById(board.zoneId) : null
  const zoneBoardIds = zone?.boards.map((item: (typeof zone.boards)[number]) => item.id) ?? [board.id]
  const pinnedPosts = await findBoardPinnedPosts(board.id, zoneBoardIds)
  const excludedPostIds = extractPinnedPostIds(pinnedPosts)
  const total = await countBoardNormalPosts(board.id, excludedPostIds)
  const pagination = resolvePagination({ page, pageSize }, total, [pageSize], pageSize)

  if (pagination.page === 1) {
    const { pinnedItems, pinnedPostIds } = dedupeAndMapPinnedPosts(pinnedPosts, (post) => mapListPost(post, anonymousMaskIdentity))
    const normalPosts = await findBoardNormalPosts(board.id, pinnedPostIds, 1, pagination.pageSize)

    return {
      items: [...pinnedItems, ...normalPosts.map((post) => mapListPost(post, anonymousMaskIdentity))],
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages: pagination.totalPages,
      hasPrevPage: pagination.hasPrevPage,
      hasNextPage: pagination.hasNextPage,
    }
  }

  const normalPosts = await findBoardNormalPosts(board.id, excludedPostIds, pagination.page, pagination.pageSize)

  return {
    items: normalPosts.map((post) => mapListPost(post, anonymousMaskIdentity)),
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: pagination.total,
    totalPages: pagination.totalPages,
    hasPrevPage: pagination.hasPrevPage,
    hasNextPage: pagination.hasNextPage,
  }
}

export async function isUserFollowingBoard(userId: number, boardId: string) {
  const follow = await findFollowRecord({
    userId,
    targetType: "board",
    targetId: boardId,
  })

  return Boolean(follow)
}


