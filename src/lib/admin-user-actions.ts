import bcrypt from "bcryptjs"

import { BadgeGrantSource, Prisma, UserRole, UserStatus } from "@/db/types"
import {
  demoteUserToUser,
  findUserUsername,
  findUserStatus,
  findUserVipState,
  promoteUserToAdmin,
  updateUserBasicProfile,
  updateUserPasswordHash,
  updateUserPoints,
  updateUserRole,
  updateUserStatus,
  updateUserVip,
} from "@/db/admin-user-action-queries"
import { createGrantedUserBadge, findBadgeSummaryById, findGrantedUserBadge, runBadgeTransaction } from "@/db/badge-queries"
import { createSystemNotification } from "@/lib/notification-writes"

import { apiError } from "@/lib/api-route"
import {

  type AdminActionContext,
  defineAdminAction,
  normalizePositiveUserId,
  readAdminActionNumber,
  requireAdminActionString,
  readAdminActionString,
  writeAdminActionLog,
  type AdminActionDefinition,
} from "@/lib/admin-action-types"
import { enforceSensitiveText } from "@/lib/content-safety"
import { parseBusinessDateTime } from "@/lib/formatters"
import { ensureCanModerateUser, isScopedModerator, isSiteAdmin } from "@/lib/moderator-permissions"
import { mergeUserProfileSettings } from "@/lib/user-profile-settings"
import { validateProfilePayload } from "@/lib/validators"
import { normalizeConfigurableVipLevel } from "@/lib/vip-status"

function buildProfileUpdateDetail(context: AdminActionContext) {
  const changedFields: string[] = []

  if (readAdminActionString(context.body, "nickname")) changedFields.push("昵称")
  if (readAdminActionString(context.body, "email")) changedFields.push("邮箱")
  if (readAdminActionString(context.body, "phone")) changedFields.push("手机号")
  if (readAdminActionString(context.body, "bio")) changedFields.push("简介")
  if (readAdminActionString(context.body, "introduction")) changedFields.push("介绍")

  return changedFields.length > 0
    ? `管理员更新用户资料（${changedFields.join("、")}）`
    : "管理员更新用户资料"
}


export const adminUserActionHandlers: Record<string, AdminActionDefinition> = {
  "user.mute": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员禁言用户" }, async (context) => {
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    await ensureCanModerateUser(context.actor, {
      targetUserId: userId,
      postId: readAdminActionString(context.body, "postId") || undefined,
      commentId: readAdminActionString(context.body, "commentId") || undefined,
    })
    await updateUserStatus(userId, UserStatus.MUTED)

    await writeAdminActionLog(context, adminUserActionHandlers["user.mute"].metadata)
    return { message: "用户已禁言" }
  }),
  "user.activate": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员恢复用户状态" }, async (context) => {
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    const user = await findUserStatus(userId)
    if (!user) apiError(404, "用户不存在")
    if (isScopedModerator(context.actor) && user.status !== UserStatus.MUTED) {
      apiError(403, "版主只能解除禁言状态")
    }
    await ensureCanModerateUser(context.actor, {
      targetUserId: userId,
      postId: readAdminActionString(context.body, "postId") || undefined,
      commentId: readAdminActionString(context.body, "commentId") || undefined,
    })
    await updateUserStatus(userId, UserStatus.ACTIVE)

    await writeAdminActionLog(context, adminUserActionHandlers["user.activate"].metadata)
    return { message: "用户状态已恢复" }
  }),
  "user.ban": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员拉黑用户" }, async (context) => {
    if (!isSiteAdmin(context.actor)) apiError(403, "仅管理员可封禁用户")
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    await updateUserStatus(userId, UserStatus.BANNED)

    await writeAdminActionLog(context, adminUserActionHandlers["user.ban"].metadata)
    return { message: "用户已拉黑" }
  }),
  "user.promoteModerator": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员提升为版主" }, async (context) => {
    if (!isSiteAdmin(context.actor)) apiError(403, "仅管理员可设置版主")
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    await updateUserRole(userId, UserRole.MODERATOR, UserStatus.ACTIVE)

    await writeAdminActionLog(context, adminUserActionHandlers["user.promoteModerator"].metadata)
    return { message: "用户已设为版主" }
  }),
  "user.setAdmin": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员提升为管理员" }, async (context) => {
    if (!isSiteAdmin(context.actor)) apiError(403, "仅管理员可设置管理员")
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    await promoteUserToAdmin(userId)

    await writeAdminActionLog(context, adminUserActionHandlers["user.setAdmin"].metadata)
    return { message: "用户已设为管理员" }
  }),
  "user.demoteToUser": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员降级为普通用户" }, async (context) => {
    if (!isSiteAdmin(context.actor)) apiError(403, "仅管理员可调整角色")
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    await demoteUserToUser(userId)

    await writeAdminActionLog(context, adminUserActionHandlers["user.demoteToUser"].metadata)
    return { message: "用户角色已降级为普通用户" }
  }),
  "user.points.adjust": defineAdminAction({ targetType: "USER", buildDetail: (context) => `管理员将用户积分调整为 ${Math.max(0, readAdminActionNumber(context.body, "points") ?? 0)}` }, async (context) => {
    if (!isSiteAdmin(context.actor)) apiError(403, "仅管理员可调整积分")
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    const points = Math.max(0, readAdminActionNumber(context.body, "points") ?? 0)
    await updateUserPoints(userId, points)

    await writeAdminActionLog(context, adminUserActionHandlers["user.points.adjust"].metadata)
    return { message: "用户积分已更新" }
  }),
  "user.password.update": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员重置用户密码" }, async (context) => {
    if (!isSiteAdmin(context.actor)) apiError(403, "仅管理员可重置密码")
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
    if (!isSiteAdmin(context.actor)) apiError(403, "仅管理员可记录用户备注")
    await writeAdminActionLog(context, adminUserActionHandlers["user.profile.note"].metadata)
    return { message: "备注已记录" }
  }),
  "user.profile.update": defineAdminAction({ targetType: "USER", buildDetail: buildProfileUpdateDetail }, async (context) => {
    if (!isSiteAdmin(context.actor)) apiError(403, "仅管理员可修改基础资料")
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")

    const currentUser = await findUserUsername(userId)
    if (!currentUser) apiError(404, "用户不存在")

    const validated = validateProfilePayload({
      nickname: readAdminActionString(context.body, "nickname"),
      bio: readAdminActionString(context.body, "bio"),
      introduction: readAdminActionString(context.body, "introduction"),
      email: readAdminActionString(context.body, "email"),
      gender: readAdminActionString(context.body, "gender"),
    })
    if (!validated.success || !validated.data) {
      apiError(400, validated.message ?? "资料参数不正确")
    }

    const phone = readAdminActionString(context.body, "phone")
    if (phone && !/^1\d{10}$/.test(phone)) {
      apiError(400, "手机号格式不正确")
    }

    const nicknameSafety = await enforceSensitiveText({ scene: "profile.nickname", text: validated.data.nickname })
    const bioSafety = await enforceSensitiveText({ scene: "profile.bio", text: validated.data.bio })
    const introductionSafety = await enforceSensitiveText({ scene: "profile.introduction", text: validated.data.introduction })

    try {
      await updateUserBasicProfile({
        userId,
        nickname: nicknameSafety.sanitizedText,
        email: validated.data.email || null,
        phone: phone || null,
        bio: bioSafety.sanitizedText || null,
        gender: validated.data.gender || "unknown",
        signature: mergeUserProfileSettings(currentUser.signature, {
          introduction: introductionSafety.sanitizedText,
        }),
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const targets = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : []
        if (targets.includes("email")) apiError(409, "邮箱已被使用")
        if (targets.includes("phone")) apiError(409, "手机号已被使用")
        if (targets.includes("nickname")) apiError(409, "昵称已被使用")
        apiError(409, "资料存在重复字段，请检查后重试")
      }

      throw error
    }

    await writeAdminActionLog(context, adminUserActionHandlers["user.profile.update"].metadata)
    return { message: `用户 @${currentUser.username} 的基础资料已更新` }
  }),
  "user.vip": defineAdminAction({ targetType: "USER", buildDetail: () => "管理员切换用户 VIP 状态" }, async (context) => {
    if (!isSiteAdmin(context.actor)) apiError(403, "仅管理员可调整 VIP")
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
    if (!isSiteAdmin(context.actor)) apiError(403, "仅管理员可配置 VIP")
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    const vipLevel = normalizeConfigurableVipLevel(readAdminActionNumber(context.body, "vipLevel"), 1)
    const vipExpiresAt = context.body.vipExpiresAt ? parseBusinessDateTime(String(context.body.vipExpiresAt)) : null

    if (vipExpiresAt && Number.isNaN(vipExpiresAt.getTime())) apiError(400, "VIP 到期时间不合法")
    await updateUserVip(userId, vipLevel, vipExpiresAt)

    await writeAdminActionLog(context, adminUserActionHandlers["user.vip.configure"].metadata)
    return { message: "VIP 设置已更新" }
  }),
  "user.badge.grant": defineAdminAction({ targetType: "USER", buildDetail: (context) => {
    const badgeName = readAdminActionString(context.body, "badgeName")
    return badgeName ? `管理员手动颁发勋章：${badgeName}` : "管理员手动颁发勋章"
  } }, async (context) => {
    if (!isSiteAdmin(context.actor)) apiError(403, "仅管理员可手动颁发勋章")
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    const badgeId = requireAdminActionString(context.body, "badgeId", "请选择要颁发的勋章")
    const badge = await findBadgeSummaryById(badgeId)
    if (!badge) apiError(404, "勋章不存在")

    const user = await findUserUsername(userId)
    if (!user) apiError(404, "用户不存在")

    const existing = await findGrantedUserBadge(userId, badgeId)
    if (existing) apiError(409, "该用户已经拥有这枚勋章")

    await runBadgeTransaction(async (tx) => {
      await createGrantedUserBadge({
        userId,
        badgeId,
        grantSource: BadgeGrantSource.ADMIN_GRANT,
        grantSnapshot: JSON.stringify({
          grantedByAdminUserId: context.adminUserId,
          grantedAt: new Date().toISOString(),
          note: context.message || null,
        }),
        client: tx,
      })

      await createSystemNotification({
        client: tx,
        userId,
        senderId: context.adminUserId,
        relatedType: "USER",
        relatedId: String(userId),
        title: `获得新勋章：${badge.name}`,
        content: `管理员已为你手动颁发勋章“${badge.name}”。你可以前往勋章中心查看并决定是否佩戴展示。`,
      })
    })

    await writeAdminActionLog(context, adminUserActionHandlers["user.badge.grant"].metadata)
    return { message: `已向 @${user.username} 颁发勋章：${badge.name}` }
  }),
  "user.notification.send": defineAdminAction({ targetType: "USER", buildDetail: (context) => {
    const title = readAdminActionString(context.body, "title")
    return title ? `管理员向用户发送通知：${title}` : "管理员向用户发送通知"
  } }, async (context) => {
    if (!isSiteAdmin(context.actor)) apiError(403, "仅管理员可手动发送通知")
    const userId = normalizePositiveUserId(context.targetId)
    if (!userId) apiError(400, "用户标识不合法")
    const title = requireAdminActionString(context.body, "title", "请填写通知标题")
    const content = requireAdminActionString(context.body, "content", "请填写通知内容")
    const user = await findUserUsername(userId)
    if (!user) apiError(404, "用户不存在")

    await createSystemNotification({
      userId,
      senderId: context.adminUserId,
      relatedType: "USER",
      relatedId: String(userId),
      title,
      content,
    })

    await writeAdminActionLog(context, adminUserActionHandlers["user.notification.send"].metadata)
    return { message: `通知已发送给 @${user.username}` }
  }),
}
