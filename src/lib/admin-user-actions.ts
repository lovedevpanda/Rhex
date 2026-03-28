import bcrypt from "bcryptjs"

import { UserRole, UserStatus } from "@/db/types"
import {
  findUserUsername,
  findUserVipState,
  updateUserPasswordHash,
  updateUserPoints,
  updateUserRole,
  updateUserStatus,
  updateUserVip,
} from "@/db/admin-user-action-queries"

import { apiError } from "@/lib/api-route"
import {

  defineAdminAction,
  normalizePositiveUserId,
  readAdminActionNumber,
  writeAdminActionLog,
  type AdminActionDefinition,
} from "@/lib/admin-action-types"
import { parseBusinessDateTime } from "@/lib/formatters"


export const adminUserActionHandlers: Record<string, AdminActionDefinition> = {
  "user.mute": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员禁言用户" }, async (context) => {
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    await updateUserStatus(userId, UserStatus.MUTED)

    await writeAdminActionLog(context, adminUserActionHandlers["user.mute"].metadata)
    return { message: "用户已禁言" }
  }),
  "user.activate": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员恢复用户状态" }, async (context) => {
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    await updateUserStatus(userId, UserStatus.ACTIVE)

    await writeAdminActionLog(context, adminUserActionHandlers["user.activate"].metadata)
    return { message: "用户状态已恢复" }
  }),
  "user.ban": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员拉黑用户" }, async (context) => {
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    await updateUserStatus(userId, UserStatus.BANNED)

    await writeAdminActionLog(context, adminUserActionHandlers["user.ban"].metadata)
    return { message: "用户已拉黑" }
  }),
  "user.promoteModerator": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员提升为版主" }, async (context) => {
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    await updateUserRole(userId, UserRole.MODERATOR, UserStatus.ACTIVE)

    await writeAdminActionLog(context, adminUserActionHandlers["user.promoteModerator"].metadata)
    return { message: "用户已设为版主" }
  }),
  "user.setAdmin": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员提升为管理员" }, async (context) => {
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    await updateUserRole(userId, UserRole.ADMIN, UserStatus.ACTIVE)

    await writeAdminActionLog(context, adminUserActionHandlers["user.setAdmin"].metadata)
    return { message: "用户已设为管理员" }
  }),
  "user.demoteToUser": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员降级为普通用户" }, async (context) => {
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    await updateUserRole(userId, UserRole.USER)

    await writeAdminActionLog(context, adminUserActionHandlers["user.demoteToUser"].metadata)
    return { message: "用户角色已降级为普通用户" }
  }),
  "user.points.adjust": defineAdminAction({ targetType: "USER", buildDetail: (context) => `管理员将用户积分调整为 ${Math.max(0, readAdminActionNumber(context.body, "points") ?? 0)}` }, async (context) => {
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    const points = Math.max(0, readAdminActionNumber(context.body, "points") ?? 0)
    await updateUserPoints(userId, points)

    await writeAdminActionLog(context, adminUserActionHandlers["user.points.adjust"].metadata)
    return { message: "用户积分已更新" }
  }),
  "user.password.update": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员重置用户密码" }, async (context) => {
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    const newPassword = String(context.body.newPassword ?? "")
    if (!newPassword) apiError(400, "新密码不能为空")
    if (newPassword.length < 6 || newPassword.length > 64) apiError(400, "新密码长度需为 6-64 位")
    const user = await findUserUsername(userId)
    if (!user) apiError(404, "用户不存在")
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await updateUserPasswordHash(userId, passwordHash)

    await writeAdminActionLog(context, adminUserActionHandlers["user.password.update"].metadata)
    return { message: `用户 @${user.username} 的密码已更新` }
  }),
  "user.profile.note": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员添加用户备注" }, async (context) => {
    await writeAdminActionLog(context, adminUserActionHandlers["user.profile.note"].metadata)
    return { message: "备注已记录" }
  }),
  "user.vip": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员切换用户 VIP 状态" }, async (context) => {
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    const user = await findUserVipState(userId)
    if (!user) apiError(404, "用户不存在")
    const isVipActive = Boolean(user.vipExpiresAt && new Date(user.vipExpiresAt).getTime() > Date.now())
    await updateUserVip(userId, isVipActive ? 0 : Math.max(1, user.vipLevel || 1), isVipActive ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))

    await writeAdminActionLog(context, adminUserActionHandlers["user.vip"].metadata)
    return { message: isVipActive ? "已取消 VIP" : "已设为 VIP1（月卡 30 天）" }
  }),
  "user.vip.configure": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员配置用户 VIP 等级与到期时间" }, async (context) => {
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    const vipLevel = Math.max(1, readAdminActionNumber(context.body, "vipLevel") ?? 1)
    const vipExpiresAt = context.body.vipExpiresAt ? parseBusinessDateTime(String(context.body.vipExpiresAt)) : null

    if (vipExpiresAt && Number.isNaN(vipExpiresAt.getTime())) apiError(400, "VIP 到期时间不合法")
    await updateUserVip(userId, vipLevel, vipExpiresAt)

    await writeAdminActionLog(context, adminUserActionHandlers["user.vip.configure"].metadata)
    return { message: "VIP 设置已更新" }
  }),
}
