import { revalidatePath } from "next/cache"

import { prisma } from "@/db/client"
import { Prisma, UserRole, UserStatus } from "@/db/types"
import { apiError } from "@/lib/api-route"
import { findFounderAdminId } from "@/db/admin-user-action-queries"
import { getBlockedAdminRoleChangeMessage } from "@/lib/admin-user-permission-policy"
import { canManageTargetUser } from "@/lib/admin-permission-policy"
import { canAdminWithPermissionOverrides } from "@/lib/admin-permission-overrides"
import { parseBrowserLocalDateTime } from "@/lib/browser-local-datetime"
import { formatBrowserLocalDateTimeInput } from "@/lib/browser-local-datetime"
import { parseBusinessDateTime } from "@/lib/formatters"
import { writeAdminLog } from "@/lib/admin"
import type { AdminActor } from "@/lib/moderator-permissions"
import { getDefaultUserStatusReason } from "@/lib/user-status-reason"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"

export type AdminUserBulkAction =
  | "setRole"
  | "activate"
  | "mute"
  | "ban"
  | "delete"

export interface AdminUserBulkActionInput {
  action: string
  userIds: unknown
  role?: unknown
  message?: unknown
  statusExpiresAt?: unknown
  statusExpiresAtTimezoneOffsetMinutes?: unknown
  requestIp?: string | null
}

export interface AdminUserBulkActionResult {
  action: AdminUserBulkAction
  requestedCount: number
  affectedCount: number
  skippedCount: number
  failedCount: number
  skippedReasons: Array<{
    reason: string
    count: number
  }>
}

type BulkUserRecord = {
  id: number
  username: string
  nickname: string | null
  role: UserRole
  status: UserStatus
  postCount: number
  commentCount: number
}

interface BulkStatusExpiration {
  expiresAt: Date
  displayText: string
}

const MAX_BULK_USERS = 100
const adminUserBulkActions = new Set<AdminUserBulkAction>(["setRole", "activate", "mute", "ban", "delete"])
const roleValues = new Set<UserRole>(Object.values(UserRole))

function normalizeBulkAction(value: unknown): AdminUserBulkAction {
  if (typeof value !== "string" || !adminUserBulkActions.has(value as AdminUserBulkAction)) {
    apiError(400, "\u6682\u4e0d\u652f\u6301\u8be5\u6279\u91cf\u64cd\u4f5c")
  }

  return value as AdminUserBulkAction
}

function normalizeUserIds(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    apiError(400, "\u8bf7\u9009\u62e9\u8981\u64cd\u4f5c\u7684\u7528\u6237")
  }

  if (value.length > MAX_BULK_USERS) {
    apiError(400, `\u5355\u6b21\u6700\u591a\u6279\u91cf\u64cd\u4f5c ${MAX_BULK_USERS} \u4e2a\u7528\u6237`)
  }

  const ids = value.map((item) => {
    const id = typeof item === "number"
      ? item
      : typeof item === "string" && /^\d+$/.test(item.trim())
        ? Number(item.trim())
        : NaN

    if (!Number.isSafeInteger(id) || id <= 0) {
      apiError(400, "\u7528\u6237\u6807\u8bc6\u4e0d\u5408\u6cd5")
    }

    return id
  })

  const uniqueIds = [...new Set(ids)]
  if (uniqueIds.length !== ids.length) {
    apiError(400, "\u7528\u6237\u6807\u8bc6\u4e0d\u80fd\u91cd\u590d")
  }

  return uniqueIds
}

function readOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function readStatusExpiration(input: AdminUserBulkActionInput): BulkStatusExpiration | null {
  const rawValue = readOptionalString(input.statusExpiresAt)
  if (!rawValue) {
    return null
  }

  const timezoneOffsetMinutes = Number(input.statusExpiresAtTimezoneOffsetMinutes)
  const parsedBrowserTime = Number.isFinite(timezoneOffsetMinutes)
    ? parseBrowserLocalDateTime(rawValue, timezoneOffsetMinutes)
    : null
  const expiresAt = parsedBrowserTime?.date ?? parseBusinessDateTime(rawValue)

  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    apiError(400, "自动解除时间不合法")
  }

  if (expiresAt.getTime() <= Date.now()) {
    apiError(400, "自动解除时间必须晚于当前时间")
  }

  return {
    expiresAt,
    displayText: parsedBrowserTime?.displayText || formatBrowserLocalDateTimeInput(rawValue) || rawValue,
  }
}

function pushSkipped(skippedReasons: Map<string, number>, reason: string) {
  skippedReasons.set(reason, (skippedReasons.get(reason) ?? 0) + 1)
}

function toSkippedReasonList(skippedReasons: Map<string, number>) {
  return Array.from(skippedReasons.entries()).map(([reason, count]) => ({ reason, count }))
}

function buildStatusUpdateData(status: UserStatus, expiration: BulkStatusExpiration | null, reason: string): Prisma.UserUpdateManyMutationInput {
  const shouldStoreReason = status === UserStatus.MUTED || status === UserStatus.BANNED

  return {
    status,
    statusExpiresAt: shouldStoreReason ? expiration?.expiresAt ?? null : null,
    statusReason: shouldStoreReason ? reason.trim() || null : null,
    sessionInvalidBefore: new Date(),
  }
}

function getRoleLabel(role: UserRole) {
  if (role === UserRole.ADMIN) return "管理员"
  if (role === UserRole.MODERATOR) return "版主"
  return "普通用户"
}

function getActionLabel(action: AdminUserBulkAction, role?: UserRole) {
  if (action === "setRole") return role ? `批量调整用户组为${getRoleLabel(role)}` : "批量调整用户组"
  if (action === "activate") return "批量恢复用户状态"
  if (action === "mute") return "批量禁言用户"
  if (action === "ban") return "批量封禁用户"
  return "批量删除用户"
}

function revalidateBulkUserSurfaces(users: BulkUserRecord[]) {
  for (const user of users) {
    revalidateUserSurfaceCache(user.id)
  }

  revalidatePath("/admin")
  revalidatePath("/users/[username]", "page")
}

async function countDeletionBlockers(userId: number) {
  const [
    authoredPosts,
    replyReferences,
    notificationSenderReferences,
    handledReports,
    createdAnnouncements,
    createdCustomPages,
  ] = await Promise.all([
    prisma.post.count({ where: { authorId: userId } }),
    prisma.comment.count({ where: { replyToUserId: userId } }),
    prisma.notification.count({ where: { senderId: userId } }),
    prisma.report.count({ where: { handledBy: userId } }),
    prisma.announcement.count({ where: { createdBy: userId } }),
    prisma.customPage.count({ where: { createdBy: userId } }),
  ])

  return authoredPosts
    + replyReferences
    + notificationSenderReferences
    + handledReports
    + createdAnnouncements
    + createdCustomPages
}

async function runRoleBulkAction(actor: AdminActor, users: BulkUserRecord[], role: UserRole, skippedReasons: Map<string, number>) {
  const targetUsers: BulkUserRecord[] = []
  const founderAdminId = await findFounderAdminId()
  const actorIsFounder = founderAdminId === actor.id
  const actorCanManageAdmins = await canAdminWithPermissionOverrides(actor, "admin.users.manageAdmins", { isFounder: actorIsFounder })
  const actorCanManageFounder = await canAdminWithPermissionOverrides(actor, "admin.users.manageFounder", { isFounder: actorIsFounder })
  const touchesAdminRole = role === UserRole.ADMIN || users.some((user) => user.role === UserRole.ADMIN)
  if (touchesAdminRole && !actorCanManageAdmins) {
    apiError(403, "无权批量调整管理员账号")
  }

  for (const user of users) {
    const blockedMessage = getBlockedAdminRoleChangeMessage({
      actorId: actor.id,
      targetId: user.id,
      targetRole: user.role,
      nextRole: role,
      actorIsFounder,
      actorCanManageAdmins,
      actorCanManageFounder,
      targetIsFounder: founderAdminId === user.id,
    })

    if (blockedMessage) {
      pushSkipped(skippedReasons, blockedMessage === "不能降级管理员账号" ? "不能批量降级管理员账号" : blockedMessage === "不能提升管理员账号" ? "不能批量提升管理员账号" : blockedMessage)
      continue
    }

    targetUsers.push(user)
  }

  if (targetUsers.length === 0) {
    return []
  }

  await prisma.$transaction(async (tx) => {
    for (const user of targetUsers) {
      if (role === UserRole.ADMIN) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            role,
            status: UserStatus.ACTIVE,
            statusExpiresAt: null,
            statusReason: null,
            sessionInvalidBefore: new Date(),
          },
        })
        await tx.moderatorZoneScope.deleteMany({ where: { moderatorId: user.id } })
        await tx.moderatorBoardScope.deleteMany({ where: { moderatorId: user.id } })
        continue
      }

      if (role === UserRole.MODERATOR) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            role,
            status: UserStatus.ACTIVE,
            statusExpiresAt: null,
            statusReason: null,
            sessionInvalidBefore: new Date(),
          },
        })
        await tx.adminPermissionGrant.deleteMany({ where: { userId: user.id } })
        continue
      }

      await tx.user.update({
        where: { id: user.id },
        data: { role, sessionInvalidBefore: new Date() },
      })
      await tx.adminPermissionGrant.deleteMany({ where: { userId: user.id } })
      await tx.moderatorZoneScope.deleteMany({ where: { moderatorId: user.id } })
      await tx.moderatorBoardScope.deleteMany({ where: { moderatorId: user.id } })
    }
  })

  return targetUsers
}

async function runStatusBulkAction(
  actor: AdminActor,
  users: BulkUserRecord[],
  status: UserStatus,
  expiration: BulkStatusExpiration | null,
  reason: string,
  skippedReasons: Map<string, number>,
) {
  const targetUsers: BulkUserRecord[] = []
  const founderAdminId = await findFounderAdminId()
  const actorIsFounder = founderAdminId === actor.id
  const actorCanManageAdmins = await canAdminWithPermissionOverrides(actor, "admin.users.manageAdmins", { isFounder: actorIsFounder })
  const actorCanManageFounder = await canAdminWithPermissionOverrides(actor, "admin.users.manageFounder", { isFounder: actorIsFounder })

  for (const user of users) {
    if (user.id === actor.id && (status === UserStatus.BANNED || status === UserStatus.MUTED || status === UserStatus.INACTIVE)) {
      pushSkipped(skippedReasons, "不能限制当前登录管理员")
      continue
    }

    if (!canManageTargetUser({
      actor,
      actorIsFounder,
      actorCanManageAdmins,
      actorCanManageFounder,
      targetId: user.id,
      targetRole: user.role,
      targetIsFounder: founderAdminId === user.id,
    })) {
      pushSkipped(skippedReasons, "无权批量管理管理员账号")
      continue
    }

    targetUsers.push(user)
  }

  if (targetUsers.length === 0) {
    return []
  }

  await prisma.user.updateMany({
    where: { id: { in: targetUsers.map((user) => user.id) } },
    data: buildStatusUpdateData(status, expiration, reason),
  })

  return targetUsers
}

async function runDeleteBulkAction(actor: AdminActor, users: BulkUserRecord[], skippedReasons: Map<string, number>) {
  const affectedUsers: BulkUserRecord[] = []
  let failedCount = 0
  const founderAdminId = await findFounderAdminId()
  const actorIsFounder = founderAdminId === actor.id
  const actorCanManageAdmins = await canAdminWithPermissionOverrides(actor, "admin.users.manageAdmins", { isFounder: actorIsFounder })
  const actorCanManageFounder = await canAdminWithPermissionOverrides(actor, "admin.users.manageFounder", { isFounder: actorIsFounder })

  for (const user of users) {
    if (user.id === actor.id) {
      pushSkipped(skippedReasons, "不能删除当前登录管理员")
      continue
    }

    if (!canManageTargetUser({
      actor,
      actorIsFounder,
      actorCanManageAdmins,
      actorCanManageFounder,
      targetId: user.id,
      targetRole: user.role,
      targetIsFounder: founderAdminId === user.id,
    }) || user.role !== UserRole.USER) {
      pushSkipped(skippedReasons, "不能批量删除管理员或版主账号")
      continue
    }

    if (user.postCount > 0 || user.commentCount > 0) {
      pushSkipped(skippedReasons, "用户已有发帖或评论，未执行物理删除")
      continue
    }

    const blockerCount = await countDeletionBlockers(user.id)
    if (blockerCount > 0) {
      pushSkipped(skippedReasons, "用户仍有关联内容，未执行物理删除")
      continue
    }

    try {
      await prisma.user.delete({ where: { id: user.id } })
      affectedUsers.push(user)
    } catch (error) {
      failedCount += 1
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        pushSkipped(skippedReasons, "用户仍有关联内容，删除被数据库拒绝")
      } else {
        console.error("[admin-user-bulk-actions] failed to delete user", user.id, error)
      }
    }
  }

  return { affectedUsers, failedCount }
}

export async function runAdminUserBulkAction(actor: AdminActor, input: AdminUserBulkActionInput): Promise<AdminUserBulkActionResult> {
  const action = normalizeBulkAction(typeof input.action === "string" ? input.action.trim() : input.action)
  const userIds = normalizeUserIds(input.userIds)
  const message = readOptionalString(input.message)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      username: true,
      nickname: true,
      role: true,
      status: true,
      postCount: true,
      commentCount: true,
    },
  })
  const skippedReasons = new Map<string, number>()
  const missingCount = userIds.length - users.length
  if (missingCount > 0) {
    skippedReasons.set("用户不存在或已被删除", missingCount)
  }

  let affectedUsers: BulkUserRecord[] = []
  let failedCount = 0
  let role: UserRole | undefined

  if (action === "setRole") {
    const rawRole = String(input.role ?? "").trim()
    if (!roleValues.has(rawRole as UserRole)) {
      apiError(400, "请选择有效的用户组")
    }

    role = rawRole as UserRole
    affectedUsers = await runRoleBulkAction(actor, users, role, skippedReasons)
  } else if (action === "activate") {
    affectedUsers = await runStatusBulkAction(
      actor,
      users,
      UserStatus.ACTIVE,
      null,
      "",
      skippedReasons,
    )
  } else if (action === "mute" || action === "ban") {
    const status = action === "mute" ? UserStatus.MUTED : UserStatus.BANNED
    const expiration = readStatusExpiration(input)
    const reason = message || getDefaultUserStatusReason(status)
    affectedUsers = await runStatusBulkAction(actor, users, status, expiration, reason, skippedReasons)
  } else {
    const result = await runDeleteBulkAction(actor, users, skippedReasons)
    affectedUsers = result.affectedUsers
    failedCount = result.failedCount
  }

  revalidateBulkUserSurfaces(affectedUsers)

  const actionLabel = getActionLabel(action, role)
  const detailParts = [
    `${actionLabel}：请求 ${userIds.length} 人，成功 ${affectedUsers.length} 人`,
    skippedReasons.size > 0 ? `跳过 ${Array.from(skippedReasons.values()).reduce((sum, count) => sum + count, 0)} 人` : null,
    failedCount > 0 ? `失败 ${failedCount} 人` : null,
    message ? `原因：${message}` : null,
  ].filter(Boolean)

  await writeAdminLog(
    actor.id,
    `user.bulk.${action}`,
    "USER",
    "bulk",
    detailParts.join("；"),
    input.requestIp,
  )

  const skippedCount = Array.from(skippedReasons.values()).reduce((sum, count) => sum + count, 0)

  return {
    action,
    requestedCount: userIds.length,
    affectedCount: affectedUsers.length,
    skippedCount,
    failedCount,
    skippedReasons: toSkippedReasonList(skippedReasons),
  }
}
