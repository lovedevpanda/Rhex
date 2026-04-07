import { AnnouncementStatus, BoardStatus, PostStatus, ReportStatus, UserRole, UserStatus } from "@/db/types"

import { getCurrentUser } from "@/lib/auth"
import type { AdminPostListResult } from "@/lib/admin-post-management"
export { getRequestIp } from "@/lib/request-ip"

import { getAdminDashboardRawData, getAdminStructureRawData } from "@/db/admin-dashboard-queries"
import { createAdminLogEntry } from "@/db/admin-log-queries"
import { countAdminPostSummary, findAdminPostBoardOptions, findAdminPostsPage } from "@/db/admin-post-management-queries"
import {
  buildAdminPostFilters,
  buildAdminPostOrderBy,
  buildAdminPostWhere,
  mapAdminPostBoardOption,
  mapAdminPostListItem,
  normalizeAdminPostQuery,
  type AdminPostQuery,
} from "@/lib/admin-post-list"
import { mapAdminDashboardData, mapAdminStructureData, type AdminDashboardData, type AdminStructureData } from "@/lib/admin-dashboard"
import {
  buildManagedBoardWhereInput,
  buildManagedZoneWhereInput,
  requireAdminActor,
  requireSiteAdminActor,
  isSiteAdmin,
  type AdminActor,
} from "@/lib/moderator-permissions"
import { apiError } from "./api-route"
import { getAdminBoardApplicationPageData } from "@/lib/board-applications"

export async function requireAdminUser() {
  const currentUser = await getCurrentUser()

  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
    return null
  }

  return {
    ...currentUser,
    role: "ADMIN",
    moderatedZoneScopes: [],
    moderatedBoardScopes: [],
  } satisfies AdminActor
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const currentUser = await requireSiteAdminActor()

  if (!currentUser) {
    apiError(403, "无权限访问后台数据")
  }

  const data = await getAdminDashboardRawData()

  return mapAdminDashboardData(data)
}

export async function getAdminStructureData(): Promise<AdminStructureData> {
  const currentUser = await requireAdminActor()

  if (!currentUser) {
    apiError(403, "无权限访问后台版块数据")
  }

  const [data, boardApplications] = await Promise.all([
    getAdminStructureRawData({
      zoneWhere: buildManagedZoneWhereInput(currentUser),
      boardWhere: buildManagedBoardWhereInput(currentUser),
    }),
    isSiteAdmin(currentUser)
      ? getAdminBoardApplicationPageData()
      : Promise.resolve({ pendingCount: 0, items: [] }),
  ])

  return {
    ...mapAdminStructureData(data, currentUser),
    boardApplications: boardApplications.items,
    canReviewBoardApplications: isSiteAdmin(currentUser),
  }
}

export async function getAdminPosts(query: AdminPostQuery = {}): Promise<AdminPostListResult> {
  const currentUser = await requireAdminActor()

  if (!currentUser) {
    apiError(403, "无权限访问帖子管理")
  }

  const normalizedQuery = normalizeAdminPostQuery(query)
  const where = buildAdminPostWhere(currentUser, normalizedQuery)
  const orderBy = buildAdminPostOrderBy(normalizedQuery.sort)

  const [summary, boardOptions] = await Promise.all([
    countAdminPostSummary(where),
    findAdminPostBoardOptions(buildManagedBoardWhereInput(currentUser)),
  ])
  const { total, pending, normal, offline, pinned, featured: featuredCount, announcement: announcementCount } = summary

  const totalPages = Math.max(1, Math.ceil(total / normalizedQuery.pageSize))
  const page = Math.min(normalizedQuery.page, totalPages)
  const skip = (page - 1) * normalizedQuery.pageSize

  const posts = await findAdminPostsPage(where, orderBy, skip, normalizedQuery.pageSize)

  return {
    posts: posts.map(mapAdminPostListItem),
    boardOptions: boardOptions.map(mapAdminPostBoardOption),
    filters: buildAdminPostFilters(normalizedQuery),
    actorRole: currentUser.role,
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
      pageSize: normalizedQuery.pageSize,
      total,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    },
  }
}

export async function writeAdminLog(adminId: number, action: string, targetType: string, targetId: string, detail?: string, ip?: string | null) {
  await createAdminLogEntry({
    adminId,
    action,
    targetType,
    targetId,
    detail,
    ip,
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

