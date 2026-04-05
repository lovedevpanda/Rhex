import { UserRole, UserStatus } from "@/db/types"

import type { Prisma } from "@/db/types"

import { buildAdminUserSummary, findAdminUsersPage, findModeratorScopeOptions } from "@/db/admin-user-queries"

import { normalizePageSize, normalizePositiveInteger } from "@/lib/shared/normalizers"

import type { AdminUserListResult } from "@/lib/admin-user-management"
import { apiError } from "@/lib/api-route"
import { requireSiteAdminActor } from "@/lib/moderator-permissions"
import { isVipActive } from "@/lib/vip-status"


interface GetAdminUsersOptions {
  keyword?: string
  role?: string
  status?: string
  vip?: string
  activity?: string
  sort?: string
  page?: number
  pageSize?: number
}

const userRoleValues = new Set(Object.values(UserRole))
const userStatusValues = new Set(Object.values(UserStatus))


function normalizeSort(sort?: string) {
  switch (sort) {
    case "oldest":
    case "lastLogin":
    case "mostPosts":
    case "mostComments":
    case "mostPoints":
      return sort
    default:
      return "newest"
  }
}

export async function getAdminUsers(options: GetAdminUsersOptions = {}): Promise<AdminUserListResult> {
  const actor = await requireSiteAdminActor()
  if (!actor) {
    apiError(403, "无权限访问用户管理")
  }

  const keyword = String(options.keyword ?? "").trim()
  const role = userRoleValues.has(options.role as UserRole) ? String(options.role) : "ALL"
  const status = userStatusValues.has(options.status as UserStatus) ? String(options.status) : "ALL"
  const vip = options.vip === "vip" || options.vip === "non-vip" ? options.vip : "ALL"
  const activity = options.activity === "online-7d" || options.activity === "never-login" ? options.activity : "ALL"
  const sort = normalizeSort(options.sort)
  const requestedPage = normalizePositiveInteger(options.page, 1)
  const pageSize = normalizePageSize(options.pageSize)
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const where: Prisma.UserWhereInput = {
    ...(role !== "ALL" ? { role: role as UserRole } : {}),
    ...(status !== "ALL" ? { status: status as UserStatus } : {}),
    ...(vip === "vip" ? { vipExpiresAt: { gt: now } } : {}),
    ...(vip === "non-vip" ? { OR: [{ vipExpiresAt: null }, { vipExpiresAt: { lte: now } }] } : {}),
    ...(activity === "online-7d" ? { lastLoginAt: { gte: sevenDaysAgo } } : {}),
    ...(activity === "never-login" ? { lastLoginAt: null } : {}),
    ...(keyword
      ? {
          OR: [
            { username: { contains: keyword, mode: "insensitive" } },
            { nickname: { contains: keyword, mode: "insensitive" } },
            { email: { contains: keyword, mode: "insensitive" } },
            { phone: { contains: keyword, mode: "insensitive" } },
            { bio: { contains: keyword, mode: "insensitive" } },
          ],
        }
      : {}),
  }

  const orderBy: Prisma.UserOrderByWithRelationInput[] =
    sort === "oldest"
      ? [{ createdAt: "asc" }]
      : sort === "lastLogin"
        ? [{ lastLoginAt: "desc" }, { createdAt: "desc" }]
        : sort === "mostPosts"
          ? [{ postCount: "desc" }, { createdAt: "desc" }]
          : sort === "mostComments"
            ? [{ commentCount: "desc" }, { createdAt: "desc" }]
            : sort === "mostPoints"
              ? [{ points: "desc" }, { createdAt: "desc" }]
              : [{ createdAt: "desc" }]

  const userSummary = await buildAdminUserSummary(where)


  const { total, active, muted, banned, inactive, admin, moderator } = userSummary


  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const skip = (page - 1) * pageSize

  const [users, moderatorScopeOptions] = await Promise.all([
    findAdminUsersPage(where, orderBy, skip, pageSize),
    findModeratorScopeOptions(),
  ])


  const mappedUsers = users.map((user) => ({
    id: user.id,
    username: user.username,
    displayName: user.nickname ?? user.username,
    nickname: user.nickname ?? null,
    role: user.role,
    status: user.status,
    email: user.email ?? null,
    phone: user.phone ?? null,
    points: user.points,
    level: user.level,
    vipLevel: user.vipLevel,
    vipExpiresAt: user.vipExpiresAt?.toISOString() ?? null,
    inviteCount: user.inviteCount,
    inviterName: user.inviter?.nickname ?? user.inviter?.username ?? null,
    postCount: user.postCount,
    commentCount: user.commentCount,
    checkInDays: user.levelProgress?.checkInDays ?? 0,
    favoriteCount: user._count.favorites,
    likeReceivedCount: user.likeReceivedCount,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    lastLoginIp: user.lastLoginIp ?? null,
    createdAt: user.createdAt.toISOString(),
    bio: user.bio ?? "",
    moderatedZoneScopes: user.moderatedZoneScopes.map((scope) => ({
      zoneId: scope.zoneId,
      zoneName: scope.zone.name,
      zoneSlug: scope.zone.slug,
      canEditSettings: scope.canEditSettings,
    })),
    moderatedBoardScopes: user.moderatedBoardScopes.map((scope) => ({
      boardId: scope.boardId,
      boardName: scope.board.name,
      boardSlug: scope.board.slug,
      zoneId: scope.board.zoneId ?? null,
      zoneName: scope.board.zone?.name ?? null,
      zoneSlug: scope.board.zone?.slug ?? null,
      canEditSettings: scope.canEditSettings,
    })),
  }))

  return {
    users: mappedUsers,
    moderatorScopeOptions,
    summary: {
      total,
      active,
      muted,
      banned,
      admin,
      moderator,
      inactive,
      vip: mappedUsers.filter((user) => isVipActive({ vipLevel: user.vipLevel, vipExpiresAt: user.vipExpiresAt })).length,
    },
    filters: {
      keyword,
      role,
      status,
      vip,
      activity,
      sort,
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
