import bcrypt from "bcryptjs"

import { UserRole, UserStatus } from "@/db/types"

import { apiError } from "@/lib/api-route"
import { prisma } from "@/db/client"
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
    await prisma.user.update({ where: { id: userId }, data: { status: UserStatus.MUTED } })
    await writeAdminActionLog(context, adminUserActionHandlers["user.mute"].metadata)
    return { message: "用户已禁言" }
  }),
  "user.activate": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员恢复用户状态" }, async (context) => {
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    await prisma.user.update({ where: { id: userId }, data: { status: UserStatus.ACTIVE } })
    await writeAdminActionLog(context, adminUserActionHandlers["user.activate"].metadata)
    return { message: "用户状态已恢复" }
  }),
  "user.ban": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员拉黑用户" }, async (context) => {
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    await prisma.user.update({ where: { id: userId }, data: { status: UserStatus.BANNED } })
    await writeAdminActionLog(context, adminUserActionHandlers["user.ban"].metadata)
    return { message: "用户已拉黑" }
  }),
  "user.promoteModerator": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员提升为版主" }, async (context) => {
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    await prisma.user.update({ where: { id: userId }, data: { role: UserRole.MODERATOR, status: UserStatus.ACTIVE } })
    await writeAdminActionLog(context, adminUserActionHandlers["user.promoteModerator"].metadata)
    return { message: "用户已设为版主" }
  }),
  "user.setAdmin": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员提升为管理员" }, async (context) => {
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    await prisma.user.update({ where: { id: userId }, data: { role: UserRole.ADMIN, status: UserStatus.ACTIVE } })
    await writeAdminActionLog(context, adminUserActionHandlers["user.setAdmin"].metadata)
    return { message: "用户已设为管理员" }
  }),
  "user.demoteToUser": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员降级为普通用户" }, async (context) => {
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    await prisma.user.update({ where: { id: userId }, data: { role: UserRole.USER } })
    await writeAdminActionLog(context, adminUserActionHandlers["user.demoteToUser"].metadata)
    return { message: "用户角色已降级为普通用户" }
  }),
  "user.points.adjust": defineAdminAction({ targetType: "USER", buildDetail: (context) => `管理员将用户积分调整为 ${Math.max(0, readAdminActionNumber(context.body, "points") ?? 0)}` }, async (context) => {
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    const points = Math.max(0, readAdminActionNumber(context.body, "points") ?? 0)
    await prisma.user.update({ where: { id: userId }, data: { points } })
    await writeAdminActionLog(context, adminUserActionHandlers["user.points.adjust"].metadata)
    return { message: "用户积分已更新" }
  }),
  "user.password.update": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员重置用户密码" }, async (context) => {
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    const newPassword = String(context.body.newPassword ?? "")
    if (!newPassword) apiError(400, "新密码不能为空")
    if (newPassword.length < 6 || newPassword.length > 64) apiError(400, "新密码长度需为 6-64 位")
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } })
    if (!user) apiError(404, "用户不存在")
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } })
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
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { vipLevel: true, vipExpiresAt: true } })
    if (!user) apiError(404, "用户不存在")
    const isVipActive = Boolean(user.vipExpiresAt && new Date(user.vipExpiresAt).getTime() > Date.now())
    await prisma.user.update({ where: { id: userId }, data: { vipLevel: isVipActive ? 0 : Math.max(1, user.vipLevel || 1), vipExpiresAt: isVipActive ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } })
    await writeAdminActionLog(context, adminUserActionHandlers["user.vip"].metadata)
    return { message: isVipActive ? "已取消 VIP" : "已设为 VIP1（月卡 30 天）" }
  }),
  "user.vip.configure": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员配置用户 VIP 等级与到期时间" }, async (context) => {
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    const vipLevel = Math.max(1, readAdminActionNumber(context.body, "vipLevel") ?? 1)
    const vipExpiresAt = context.body.vipExpiresAt ? parseBusinessDateTime(String(context.body.vipExpiresAt)) : null

    if (vipExpiresAt && Number.isNaN(vipExpiresAt.getTime())) apiError(400, "VIP 到期时间不合法")
    await prisma.user.update({ where: { id: userId }, data: { vipLevel, vipExpiresAt } })
    await writeAdminActionLog(context, adminUserActionHandlers["user.vip.configure"].metadata)
    return { message: "VIP 设置已更新" }
  }),
}
