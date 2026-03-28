import { AnnouncementStatus, BoardStatus, PostStatus, ReportStatus, UserRole, UserStatus } from "@/db/types"


import type { Prisma } from "@/db/types"

import { getCurrentUser } from "@/lib/auth"
import { resolveBoardSettings } from "@/lib/board-settings"
import type { AdminPostListResult } from "@/lib/admin-post-management"
import { serializeDateTime } from "@/lib/formatters"

import { getPostStatusLabel, getPostTypeLabel, isLocalPostType, type LocalPostType } from "@/lib/post-types"
import { prisma } from "@/db/client"
import { getAdminDashboardRawData } from "@/db/admin-dashboard-queries"
import { normalizePageSize, normalizePositiveInteger } from "@/lib/shared/normalizers"




interface AdminPostQuery {
  keyword?: string
  type?: string
  status?: string
  boardSlug?: string
  sort?: string
  pin?: string
  featured?: string
  review?: string
  page?: number
  pageSize?: number
}



function normalizePostSort(sort?: string) {
  switch (sort) {
    case "oldest":
    case "recentReply":
    case "mostComments":
    case "mostLikes":
    case "mostViews":
    case "highestScore":
      return sort
    default:
      return "newest"
  }
}

export async function requireAdminUser() {
  const currentUser = await getCurrentUser()

  if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.MODERATOR)) {
    return null
  }

  return currentUser
}

interface AdminDashboardData {
  overview: {
    userCount: number
    postCount: number
    commentCount: number
    reportCount: number
    pendingReportCount: number
    announcementCount: number
    pendingPostCount: number
    pendingCommentCount: number
    pendingVerificationCount: number
    pendingFriendLinkCount: number
    pendingAdOrderCount: number
    activeUserCount7d: number

    newUserCount7d: number
    newPostCount7d: number
    newCommentCount7d: number
    totalViewCount: number
    totalLikeCount: number
    totalFavoriteCount: number
    totalFollowerCount: number
    vipOrderCount30d: number
    todayCheckInUserCount: number
  }
  trends: Array<{
    date: string
    userCount: number
    postCount: number
    commentCount: number
    reportCount: number
  }>



  recentUsers: Array<{
    id: number
    username: string
    displayName: string
    role: UserRole
    status: UserStatus
    createdAt: string
    postCount: number
    commentCount: number
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
  recentReports: Array<{
    id: string
    targetType: string
    targetId: string
    reasonType: string
    reasonDetail: string | null
    status: ReportStatus
    createdAt: string
    reporterName: string
  }>
  zones: Array<{
    id: string
    name: string
    slug: string
    description: string
    icon: string
    sortOrder: number
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
  }>
  boardStatus: Array<{
    id: string
    name: string
    slug: string
    description: string
    status: BoardStatus
    postCount: number
    followerCount: number
    todayPostCount: number
    allowPost: boolean
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
  }>
  recentAnnouncements: Array<{
    id: string
    title: string
    status: AnnouncementStatus
    isPinned: boolean
    createdAt: string
    publishedAt: string | null
    creatorName: string
  }>
  sensitiveWords: Array<{
    id: string
    word: string
    matchType: string
    actionType: string
    status: boolean
    createdAt: string
  }>
  vipOrders: Array<{
    id: string
    username: string
    displayName: string
    orderType: string
    amount: number | null
    pointsCost: number | null
    days: number
    vipLevel: number
    expiresAt: string | null
    createdAt: string
    remark: string | null
  }>
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const currentUser = await requireAdminUser()

  if (!currentUser) {
    throw new Error("无权限访问后台数据")
  }

  const data = await getAdminDashboardRawData()

  return {
    overview: data.overview,
    trends: data.trends.map((item) => ({
      date: serializeDateTime(item.date) ?? item.date.toISOString(),
      userCount: item.userCount,
      postCount: item.postCount,
      commentCount: item.commentCount,
      reportCount: item.reportCount,
    })),
    recentUsers: data.recentUsers.map((user) => ({

      id: user.id,
      username: user.username,
      displayName: user.nickname ?? user.username,
      role: user.role,
      status: user.status,
      createdAt: serializeDateTime(user.createdAt) ?? user.createdAt.toISOString(),

      postCount: user.postCount,
      commentCount: user.commentCount,
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

    recentReports: data.recentReports.map((report) => ({

      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reasonType: report.reasonType,
      reasonDetail: report.reasonDetail,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
      reporterName: report.reporter.nickname ?? report.reporter.username,
    })),
    zones: data.zones.map((zone) => {

      const settings = resolveBoardSettings(zone, null)
      const relatedBoards = data.boards.filter((board) => board.zoneId === zone.id)


      return {
        id: zone.id,
        name: zone.name,
        slug: zone.slug,
        description: zone.description ?? "",
        icon: zone.icon ?? "📚",
        sortOrder: zone.sortOrder,
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
      }
    }),
    boardStatus: data.boards.map((board) => ({

      id: board.id,
      name: board.name,
      slug: board.slug,
      description: board.description ?? "",
      status: board.status,
      postCount: board.postCount,
      followerCount: board.followerCount,
      todayPostCount: data.todayBoardPostStats.find((item) => item.boardId === board.id)?._count.boardId ?? 0,

      allowPost: board.allowPost,
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
    })),
    recentAnnouncements: data.recentAnnouncements.map((announcement) => ({

      id: announcement.id,
      title: announcement.title,
      status: announcement.status,
      isPinned: announcement.isPinned,
      createdAt: announcement.createdAt.toISOString(),
      publishedAt: announcement.publishedAt?.toISOString() ?? null,
      creatorName: announcement.creator.nickname ?? announcement.creator.username,
    })),
    sensitiveWords: data.sensitiveWords.map((word) => ({

      id: word.id,
      word: word.word,
      matchType: word.matchType,
      actionType: word.actionType,
      status: word.status,
      createdAt: serializeDateTime(word.createdAt) ?? word.createdAt.toISOString(),
    })),

    vipOrders: data.vipOrders.map((item) => ({

      id: item.id,
      username: item.user.username,
      displayName: item.user.nickname ?? item.user.username,
      orderType: item.orderType,
      amount: item.amount ?? null,
      pointsCost: item.pointsCost ?? null,
      days: item.days,
      vipLevel: item.vipLevel,
      expiresAt: serializeDateTime(item.expiresAt),
      createdAt: serializeDateTime(item.createdAt) ?? item.createdAt.toISOString(),

      remark: item.remark ?? null,
    })),
  }
}

export async function getAdminPosts(query: AdminPostQuery = {}): Promise<AdminPostListResult> {
  const keyword = query.keyword?.trim() ?? ""
  const pageSize = normalizePageSize(query.pageSize)
  const requestedPage = normalizePositiveInteger(query.page, 1)
  const sort = normalizePostSort(query.sort)
  const pin = query.pin === "pinned" || query.pin === "not-pinned" ? query.pin : "ALL"
  const featured = query.featured === "featured" || query.featured === "not-featured" ? query.featured : "ALL"
  const review = query.review === "reviewed" || query.review === "unreviewed" ? query.review : "ALL"

  const where: Prisma.PostWhereInput = {
    ...(isLocalPostType(query.type) ? { type: query.type as LocalPostType } : {}),

    ...(query.status && query.status !== "ALL" ? { status: query.status as PostStatus } : {}),
    ...(query.boardSlug ? { board: { slug: query.boardSlug } } : {}),
    ...(pin === "pinned" ? { isPinned: true } : {}),
    ...(pin === "not-pinned" ? { isPinned: false } : {}),
    ...(featured === "featured" ? { isFeatured: true } : {}),
    ...(featured === "not-featured" ? { isFeatured: false } : {}),
    ...(review === "reviewed" ? { NOT: { reviewNote: null } } : {}),
    ...(review === "unreviewed" ? { reviewNote: null } : {}),
    ...(keyword
      ? {
          OR: [
            { title: { contains: keyword, mode: "insensitive" } },
            { summary: { contains: keyword, mode: "insensitive" } },
            { author: { username: { contains: keyword, mode: "insensitive" } } },
            { author: { nickname: { contains: keyword, mode: "insensitive" } } },
          ],
        }
      : {}),
  }

  const orderBy: Prisma.PostOrderByWithRelationInput[] =
    sort === "oldest"
      ? [{ createdAt: "asc" }]
      : sort === "recentReply"
        ? [{ lastCommentedAt: "desc" }, { createdAt: "desc" }]
        : sort === "mostComments"
          ? [{ commentCount: "desc" }, { createdAt: "desc" }]
          : sort === "mostLikes"
            ? [{ likeCount: "desc" }, { createdAt: "desc" }]
            : sort === "mostViews"
              ? [{ viewCount: "desc" }, { createdAt: "desc" }]
              : sort === "highestScore"
                ? [{ score: "desc" }, { createdAt: "desc" }]
                : [{ status: "asc" }, { createdAt: "desc" }]

  const [total, pending, normal, offline, pinned, featuredCount, announcementCount, boardOptions] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.count({ where: { ...where, status: PostStatus.PENDING } }),
    prisma.post.count({ where: { ...where, status: PostStatus.NORMAL } }),
    prisma.post.count({ where: { ...where, status: PostStatus.OFFLINE } }),
    prisma.post.count({ where: { ...where, isPinned: true } }),
    prisma.post.count({ where: { ...where, isFeatured: true } }),
    prisma.post.count({ where: { ...where, isAnnouncement: true } }),
    prisma.board.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: { slug: true, name: true, zone: { select: { name: true } } },
      take: 200,
    }),

  ])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const skip = (page - 1) * pageSize

  const posts = await prisma.post.findMany({
    where,
    orderBy,
    skip,
    take: pageSize,
    include: {
      board: { select: { name: true, slug: true, zone: { select: { name: true } } } },
      author: { select: { id: true, username: true, nickname: true, status: true } },
    },
  })

  return {
    posts: posts.map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      summary: post.summary ?? null,
      boardName: post.board.name,
      boardSlug: post.board.slug,
      zoneName: post.board.zone?.name ?? null,
      authorId: post.author.id,
      authorName: post.author.nickname ?? post.author.username,
      authorUsername: post.author.username,
      authorStatus: post.author.status,
      createdAt: post.createdAt.toISOString(),
      publishedAt: post.publishedAt?.toISOString() ?? null,
      updatedAt: post.updatedAt.toISOString(),
      commentCount: post.commentCount,
      likeCount: post.likeCount,
      favoriteCount: post.favoriteCount,
      viewCount: post.viewCount,
      score: post.score,
      tipCount: post.tipCount,
      tipTotalPoints: post.tipTotalPoints,


      type: post.type,
      typeLabel: getPostTypeLabel(post.type),
      status: post.status,
      statusLabel: getPostStatusLabel(post.status),
      reviewNote: post.reviewNote ?? null,
      isPinned: post.isPinned,
      pinScope: post.pinScope === "NONE" ? null : post.pinScope,
      isFeatured: post.isFeatured,
      isAnnouncement: post.isAnnouncement,
    })),
    boardOptions: boardOptions.map((board) => ({
      slug: board.slug,
      name: board.name,
      zoneName: board.zone?.name ?? null,
    })),

    filters: {
      type: query.type && query.type !== "" ? query.type : "ALL",
      status: query.status && query.status !== "" ? query.status : "ALL",
      board: query.boardSlug ?? "",
      keyword,
      sort,
      pin,
      featured,
      review,
    },
    summary: {
      total,
      pending,
      normal,
      offline,
      pinned,
      featured: featuredCount,
      announcement: announcementCount,
    },
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    },
  }
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",").map((item) => item.trim()).find(Boolean)
    if (firstIp) {
      return firstIp
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) {
    return realIp
  }

  const cfIp = request.headers.get("cf-connecting-ip")?.trim()
  if (cfIp) {
    return cfIp
  }

  return null
}

export async function writeAdminLog(adminId: number, action: string, targetType: string, targetId: string, detail?: string, ip?: string | null) {
  await prisma.adminLog.create({
    data: {
      adminId,
      action,
      targetType,
      targetId,
      detail,
      ip: ip?.trim() || null,
    },
  })
}


export const adminEnums = {
  UserRole,
  UserStatus,
  BoardStatus,
  PostStatus,
  ReportStatus,
  AnnouncementStatus,
}

