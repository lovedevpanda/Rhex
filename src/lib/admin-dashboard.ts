import { BoardStatus, CommentStatus, PostStatus, UserRole } from "@/db/types"

import { getAdminDashboardRawData, getAdminStructureRawData } from "@/db/admin-dashboard-queries"
import { normalizeBoardSidebarConfig, type BoardSidebarLinkItem } from "@/lib/board-sidebar-config"
import { resolveBoardSettings } from "@/lib/board-settings"
import { serializeDateTime } from "@/lib/formatters"
import {
  canEditBoardSettings,
  canEditZoneSettings,
  type AdminActor,
} from "@/lib/moderator-permissions"
import { getPostStatusLabel, getPostTypeLabel } from "@/lib/post-types"

export interface AdminDashboardData {
  overview: {
    userCount: number
    postCount: number
    commentCount: number
    boardCount: number
    zoneCount: number
    reportCount: number
    pendingReportCount: number
    processingReportCount: number
    resolvedReportCount: number
    pendingPostCount: number
    offlinePostCount: number
    pendingBoardApplicationCount: number
    pendingVerificationCount: number
    pendingFriendLinkCount: number
    pendingAdOrderCount: number
    activeUserCount7d: number
    mutedUserCount: number
    bannedUserCount: number
    newUserCount7d: number
    newPostCount7d: number
    newCommentCount7d: number
    todayPostCount: number
    todayCommentCount: number
    todayReportCount: number
    totalViewCount: number
    totalLikeCount: number
    totalFavoriteCount: number
    totalFollowerCount: number
    todayCheckInUserCount: number
  }
  trends: Array<{
    date: string
    userCount: number
    postCount: number
    commentCount: number
    reportCount: number
  }>
  recentPosts: Array<{
    id: string
    title: string
    slug: string
    type: string
    typeLabel: string
    status: PostStatus
    statusLabel: string
    reviewNote: string | null
    boardName: string
    authorName: string
    createdAt: string
    commentCount: number
    likeCount: number
    isPinned: boolean
    isFeatured: boolean
  }>
  recentComments: Array<{
    id: string
    content: string
    status: CommentStatus
    createdAt: string
    authorName: string
    postTitle: string
    postSlug: string
  }>
}

export interface AdminStructureData {
  zones: Array<{
    id: string
    name: string
    slug: string
    description: string
    icon: string
    sortOrder: number
    hiddenFromSidebar: boolean
    boardCount: number
    postCount: number
    followerCount: number
    postPointDelta: number
    replyPointDelta: number
    postIntervalSeconds: number
    replyIntervalSeconds: number
    allowedPostTypes: string
    minViewPoints: number
    minViewLevel: number
    minPostPoints: number
    minPostLevel: number
    minReplyPoints: number
    minReplyLevel: number
    minViewVipLevel: number
    minPostVipLevel: number
    minReplyVipLevel: number
    requirePostReview: boolean
    postListDisplayMode: string | null
    postListLoadMode: string | null
    canEditSettings: boolean
  }>
  boardStatus: Array<{
    id: string
    name: string
    slug: string
    description: string
    sidebarLinks: BoardSidebarLinkItem[]
    rulesMarkdown: string | null
    moderatorsCanWithdrawTreasury: boolean
    status: BoardStatus
    postCount: number
    followerCount: number
    todayPostCount: number
    allowPost: boolean
    treasuryPoints: number
    zoneId: string | null
    zoneName: string | null
    icon: string
    sortOrder: number
    postPointDelta: number | null
    replyPointDelta: number | null
    postIntervalSeconds: number | null
    replyIntervalSeconds: number | null
    allowedPostTypes: string | null
    minViewPoints: number | null
    minViewLevel: number | null
    minPostPoints: number | null
    minPostLevel: number | null
    minReplyPoints: number | null
    minReplyLevel: number | null
    minViewVipLevel: number | null
    minPostVipLevel: number | null
    minReplyVipLevel: number | null
    requirePostReview: boolean | null
    postListDisplayMode: string | null
    postListLoadMode: string | null
    canEditSettings: boolean
  }>
  permissions: {
    canCreateZone: boolean
    canCreateBoard: boolean
    canDeleteZone: boolean
    canDeleteBoard: boolean
  }
  boardApplications: Array<{
    id: string
    applicantId: number
    zoneId: string
    boardId: string | null
    name: string
    slug: string
    description: string
    icon: string
    reason: string
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
    reviewNote: string
    reviewedAt: string | null
    createdAt: string
    applicant: {
      id: number
      username: string
      displayName: string
      role: "USER" | "MODERATOR" | "ADMIN"
      status: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
    }
    reviewer: {
      id: number
      displayName: string
    } | null
    zone: {
      id: string
      name: string
      slug: string
    }
    board: {
      id: string
      name: string
      slug: string
      treasuryPoints: number
    } | null
  }>
  canReviewBoardApplications: boolean
}

type AdminDashboardRawData = Awaited<ReturnType<typeof getAdminDashboardRawData>>
type AdminStructureRawData = Awaited<ReturnType<typeof getAdminStructureRawData>>

export function mapAdminDashboardData(data: AdminDashboardRawData): AdminDashboardData {
  return {
    overview: data.overview,
    trends: data.trends.map((item) => ({
      date: serializeDateTime(item.date) ?? item.date.toISOString(),
      userCount: item.userCount,
      postCount: item.postCount,
      commentCount: item.commentCount,
      reportCount: item.reportCount,
    })),
    recentPosts: data.recentPosts.map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      type: post.type,
      typeLabel: getPostTypeLabel(post.type),
      status: post.status,
      statusLabel: getPostStatusLabel(post.status),
      reviewNote: post.reviewNote ?? null,
      boardName: post.board.name,
      authorName: post.author.nickname ?? post.author.username,
      createdAt: serializeDateTime(post.createdAt) ?? post.createdAt.toISOString(),
      commentCount: post.commentCount,
      likeCount: post.likeCount,
      isPinned: post.isPinned,
      isFeatured: post.isFeatured,
    })),
    recentComments: data.recentComments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      status: comment.status,
      createdAt: serializeDateTime(comment.createdAt) ?? comment.createdAt.toISOString(),
      authorName: comment.user.nickname ?? comment.user.username,
      postTitle: comment.post.title,
      postSlug: comment.post.slug,
    })),
  }
}

export function mapAdminStructureData(data: AdminStructureRawData, actor: AdminActor): AdminStructureData {
  const boardsByZoneId = new Map<string, Array<(typeof data.boards)[number]>>()
  for (const board of data.boards) {
    if (!board.zoneId) {
      continue
    }

    const current = boardsByZoneId.get(board.zoneId) ?? []
    current.push(board)
    boardsByZoneId.set(board.zoneId, current)
  }

  const todayBoardPostCountMap = new Map(
    data.todayBoardPostStats.map((item) => [item.boardId, item._count.boardId]),
  )

  return {
    zones: data.zones.map((zone) => {
      const settings = resolveBoardSettings(zone, null)
      const relatedBoards = boardsByZoneId.get(zone.id) ?? []

      return {
        id: zone.id,
        name: zone.name,
        slug: zone.slug,
        description: zone.description ?? "",
        icon: zone.icon ?? "📚",
        sortOrder: zone.sortOrder,
        hiddenFromSidebar: zone.hiddenFromSidebar,
        boardCount: zone._count.boards,
        postCount: relatedBoards.reduce((total, board) => total + board.postCount, 0),
        followerCount: relatedBoards.reduce((total, board) => total + board.followerCount, 0),
        postPointDelta: settings.postPointDelta,
        replyPointDelta: settings.replyPointDelta,
        postIntervalSeconds: settings.postIntervalSeconds,
        replyIntervalSeconds: settings.replyIntervalSeconds,
        allowedPostTypes: settings.allowedPostTypes.join(","),
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
        postListDisplayMode: zone.postListDisplayMode ?? null,
        postListLoadMode: zone.postListLoadMode ?? null,
        canEditSettings: canEditZoneSettings(actor, zone.id),
      }
    }),
    boardStatus: data.boards.map((board) => {
      const sidebarConfig = normalizeBoardSidebarConfig(board.configJson)

      return {
        id: board.id,
        name: board.name,
        slug: board.slug,
        description: board.description ?? "",
        sidebarLinks: sidebarConfig.links,
        rulesMarkdown: sidebarConfig.rulesMarkdown,
        moderatorsCanWithdrawTreasury: sidebarConfig.moderatorsCanWithdrawTreasury,
        status: board.status,
        postCount: board.postCount,
        followerCount: board.followerCount,
        todayPostCount: todayBoardPostCountMap.get(board.id) ?? 0,
        allowPost: board.allowPost,
        treasuryPoints: board.treasuryPoints,
        zoneId: board.zoneId ?? null,
        zoneName: board.zone?.name ?? null,
        icon: board.iconPath ?? "💬",
        sortOrder: board.sortOrder,
        postPointDelta: board.postPointDelta ?? null,
        replyPointDelta: board.replyPointDelta ?? null,
        postIntervalSeconds: board.postIntervalSeconds ?? null,
        replyIntervalSeconds: board.replyIntervalSeconds ?? null,
        allowedPostTypes: board.allowedPostTypes ?? null,
        minViewPoints: board.minViewPoints ?? null,
        minViewLevel: board.minViewLevel ?? null,
        minPostPoints: board.minPostPoints ?? null,
        minPostLevel: board.minPostLevel ?? null,
        minReplyPoints: board.minReplyPoints ?? null,
        minReplyLevel: board.minReplyLevel ?? null,
        minViewVipLevel: board.minViewVipLevel ?? null,
        minPostVipLevel: board.minPostVipLevel ?? null,
        minReplyVipLevel: board.minReplyVipLevel ?? null,
        requirePostReview: board.requirePostReview ?? null,
        postListDisplayMode: board.postListDisplayMode ?? null,
        postListLoadMode: board.postListLoadMode ?? null,
        canEditSettings: canEditBoardSettings(actor, board.id, board.zoneId),
      }
    }),
    permissions: {
      canCreateZone: actor.role === UserRole.ADMIN,
      canCreateBoard: actor.role === UserRole.ADMIN,
      canDeleteZone: actor.role === UserRole.ADMIN,
      canDeleteBoard: actor.role === UserRole.ADMIN,
    },
    boardApplications: [],
    canReviewBoardApplications: false,
  }
}
