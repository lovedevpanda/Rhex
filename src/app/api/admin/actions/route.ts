import bcrypt from "bcryptjs"
import { BoardStatus, CommentStatus, PostStatus, ReportStatus, UserRole, UserStatus } from "@/db/types"
import { NextResponse } from "next/server"

import { getRequestIp, requireAdminUser, writeAdminLog } from "@/lib/admin"
import { prisma } from "@/db/client"

import { notifyReportResult } from "@/lib/reports"

function normalizePositiveUserId(value: string) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

export async function POST(request: Request) {

  const admin = await requireAdminUser()

  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权执行后台操作" }, { status: 403 })
  }

  const requestIp = getRequestIp(request)
  const body = await request.json()
  const action = String(body.action ?? "")
  const targetId = String(body.targetId ?? "")
  const message = String(body.message ?? "")

  if (!action || !targetId) {
    return NextResponse.json({ code: 400, message: "缺少必要参数" }, { status: 400 })
  }

  const normalizedUserTargetId = normalizePositiveUserId(targetId)

  switch (action) {
    case "user.mute": {
      if (!normalizedUserTargetId) {
        return NextResponse.json({ code: 400, message: "用户标识不合法" }, { status: 400 })
      }
      await prisma.user.update({ where: { id: normalizedUserTargetId }, data: { status: UserStatus.MUTED } })
      await writeAdminLog(admin.id, action, "USER", targetId, message || "管理员禁言用户", requestIp)
      return NextResponse.json({ code: 0, message: "用户已禁言" })
    }
    case "user.activate": {
      if (!normalizedUserTargetId) {
        return NextResponse.json({ code: 400, message: "用户标识不合法" }, { status: 400 })
      }
      await prisma.user.update({ where: { id: normalizedUserTargetId }, data: { status: UserStatus.ACTIVE } })
      await writeAdminLog(admin.id, action, "USER", targetId, message || "管理员恢复用户状态", requestIp)
      return NextResponse.json({ code: 0, message: "用户状态已恢复" })
    }
    case "user.ban": {
      if (!normalizedUserTargetId) {
        return NextResponse.json({ code: 400, message: "用户标识不合法" }, { status: 400 })
      }
      await prisma.user.update({ where: { id: normalizedUserTargetId }, data: { status: UserStatus.BANNED } })
      await writeAdminLog(admin.id, action, "USER", targetId, message || "管理员拉黑用户", requestIp)
      return NextResponse.json({ code: 0, message: "用户已拉黑" })
    }
    case "user.promoteModerator": {
      if (!normalizedUserTargetId) {
        return NextResponse.json({ code: 400, message: "用户标识不合法" }, { status: 400 })
      }
      await prisma.user.update({ where: { id: normalizedUserTargetId }, data: { role: UserRole.MODERATOR, status: UserStatus.ACTIVE } })
      await writeAdminLog(admin.id, action, "USER", targetId, message || "管理员提升为版主", requestIp)
      return NextResponse.json({ code: 0, message: "用户已设为版主" })
    }
    case "user.setAdmin": {
      if (!normalizedUserTargetId) {
        return NextResponse.json({ code: 400, message: "用户标识不合法" }, { status: 400 })
      }
      await prisma.user.update({ where: { id: normalizedUserTargetId }, data: { role: UserRole.ADMIN, status: UserStatus.ACTIVE } })
      await writeAdminLog(admin.id, action, "USER", targetId, message || "管理员提升为管理员", requestIp)
      return NextResponse.json({ code: 0, message: "用户已设为管理员" })
    }
    case "user.demoteToUser": {
      if (!normalizedUserTargetId) {
        return NextResponse.json({ code: 400, message: "用户标识不合法" }, { status: 400 })
      }
      await prisma.user.update({ where: { id: normalizedUserTargetId }, data: { role: UserRole.USER } })
      await writeAdminLog(admin.id, action, "USER", targetId, message || "管理员降级为普通用户", requestIp)
      return NextResponse.json({ code: 0, message: "用户角色已降级为普通用户" })
    }
    case "user.points.adjust": {
      if (!normalizedUserTargetId) {
        return NextResponse.json({ code: 400, message: "用户标识不合法" }, { status: 400 })
      }
      const points = Math.max(0, Number(body.points ?? 0) || 0)
      await prisma.user.update({ where: { id: normalizedUserTargetId }, data: { points } })
      await writeAdminLog(admin.id, action, "USER", targetId, message || `管理员将用户积分调整为 ${points}`, requestIp)
      return NextResponse.json({ code: 0, message: "用户积分已更新" })
    }
    case "user.password.update": {
      if (!normalizedUserTargetId) {
        return NextResponse.json({ code: 400, message: "用户标识不合法" }, { status: 400 })
      }
      const newPassword = String(body.newPassword ?? "")
      if (!newPassword) {
        return NextResponse.json({ code: 400, message: "新密码不能为空" }, { status: 400 })
      }
      if (newPassword.length < 6 || newPassword.length > 64) {
        return NextResponse.json({ code: 400, message: "新密码长度需为 6-64 位" }, { status: 400 })
      }
      const user = await prisma.user.findUnique({ where: { id: normalizedUserTargetId }, select: { id: true, username: true } })
      if (!user) {
        return NextResponse.json({ code: 404, message: "用户不存在" }, { status: 404 })
      }
      const passwordHash = await bcrypt.hash(newPassword, 10)
      await prisma.user.update({ where: { id: normalizedUserTargetId }, data: { passwordHash } })
      await writeAdminLog(admin.id, action, "USER", targetId, message || `管理员重置用户 @${user.username} 的密码`, requestIp)
      return NextResponse.json({ code: 0, message: `用户 @${user.username} 的密码已更新` })
    }
    case "user.profile.note": {
      await writeAdminLog(admin.id, action, "USER", targetId, message || "管理员添加用户备注", requestIp)
      return NextResponse.json({ code: 0, message: "备注已记录" })
    }
    case "user.vip": {
      if (!normalizedUserTargetId) {
        return NextResponse.json({ code: 400, message: "用户标识不合法" }, { status: 400 })
      }
      const user = await prisma.user.findUnique({ where: { id: normalizedUserTargetId }, select: { vipLevel: true, vipExpiresAt: true } })
      if (!user) {
        return NextResponse.json({ code: 404, message: "用户不存在" }, { status: 404 })
      }
      const isVipActive = Boolean(user.vipExpiresAt && new Date(user.vipExpiresAt).getTime() > Date.now())
      await prisma.user.update({ where: { id: normalizedUserTargetId }, data: { vipLevel: isVipActive ? 0 : Math.max(1, user.vipLevel || 1), vipExpiresAt: isVipActive ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } })
      await writeAdminLog(admin.id, action, "USER", targetId, message || "管理员切换用户 VIP 状态", requestIp)
      return NextResponse.json({ code: 0, message: isVipActive ? "已取消 VIP" : "已设为 VIP1（月卡 30 天）" })
    }
    case "user.vip.configure": {
      if (!normalizedUserTargetId) {
        return NextResponse.json({ code: 400, message: "用户标识不合法" }, { status: 400 })
      }
      const vipLevel = Math.max(1, Number(body.vipLevel ?? 1) || 1)
      const vipExpiresAt = body.vipExpiresAt ? new Date(String(body.vipExpiresAt)) : null
      if (vipExpiresAt && Number.isNaN(vipExpiresAt.getTime())) {
        return NextResponse.json({ code: 400, message: "VIP 到期时间不合法" }, { status: 400 })
      }
      await prisma.user.update({ where: { id: normalizedUserTargetId }, data: { vipLevel, vipExpiresAt } })
      await writeAdminLog(admin.id, action, "USER", targetId, message || "管理员配置用户 VIP 等级与到期时间", requestIp)
      return NextResponse.json({ code: 0, message: "VIP 设置已更新" })
    }

    case "post.feature": {
      const post = await prisma.post.findUnique({ where: { id: targetId }, select: { isFeatured: true } })
      if (!post) {
        return NextResponse.json({ code: 404, message: "帖子不存在" }, { status: 404 })
      }
      await prisma.post.update({ where: { id: targetId }, data: { isFeatured: !post.isFeatured } })
      await writeAdminLog(admin.id, action, "POST", targetId, message || "管理员切换推荐状态", requestIp)
      return NextResponse.json({ code: 0, message: post.isFeatured ? "已取消推荐" : "已设为推荐" })
    }
    case "post.pin": {
      const scope = String(body.scope ?? "BOARD").toUpperCase()
      const normalizedScope = scope === "GLOBAL" || scope === "ZONE" || scope === "BOARD" ? scope : "NONE"
      const post = await prisma.post.findUnique({ where: { id: targetId }, select: { id: true, isPinned: true, pinScope: true } })
      if (!post) {
        return NextResponse.json({ code: 404, message: "帖子不存在" }, { status: 404 })
      }

      const nextPinned = normalizedScope !== "NONE"
      await prisma.post.update({
        where: { id: targetId },
        data: {
          isPinned: nextPinned,
          pinScope: normalizedScope,
        },
      })
      await writeAdminLog(admin.id, action, "POST", targetId, message || `管理员设置帖子置顶范围为 ${normalizedScope}`, requestIp)
      const scopeLabel = normalizedScope === "GLOBAL" ? "全局置顶" : normalizedScope === "ZONE" ? "分区置顶" : normalizedScope === "BOARD" ? "节点置顶" : "取消置顶"
      return NextResponse.json({ code: 0, message: scopeLabel })
    }
    case "post.hide": {
      await prisma.post.update({ where: { id: targetId }, data: { status: PostStatus.OFFLINE } })
      await writeAdminLog(admin.id, action, "POST", targetId, message || "管理员下线帖子", requestIp)
      return NextResponse.json({ code: 0, message: "帖子已下线" })
    }
    case "post.approve": {
      await prisma.post.update({ where: { id: targetId }, data: { status: PostStatus.NORMAL, publishedAt: new Date(), reviewNote: message || null } })
      await writeAdminLog(admin.id, action, "POST", targetId, message || "管理员审核通过帖子", requestIp)
      return NextResponse.json({ code: 0, message: "帖子已审核通过" })
    }
    case "post.reject": {
      await prisma.post.update({ where: { id: targetId }, data: { status: PostStatus.OFFLINE, reviewNote: message || "审核未通过" } })
      await writeAdminLog(admin.id, action, "POST", targetId, message || "管理员驳回帖子审核", requestIp)
      return NextResponse.json({ code: 0, message: "帖子已驳回并下线" })
    }
    case "comment.hide": {
      await prisma.comment.update({ where: { id: targetId }, data: { status: CommentStatus.HIDDEN } })
      await writeAdminLog(admin.id, action, "COMMENT", targetId, message || "管理员下线评论", requestIp)
      return NextResponse.json({ code: 0, message: "评论已下线" })
    }

    case "board.togglePosting": {
      const board = await prisma.board.findUnique({ where: { id: targetId }, select: { allowPost: true } })
      if (!board) {
        return NextResponse.json({ code: 404, message: "版块不存在" }, { status: 404 })
      }
      await prisma.board.update({ where: { id: targetId }, data: { allowPost: !board.allowPost } })
      await writeAdminLog(admin.id, action, "BOARD", targetId, message || "管理员切换版块发帖权限", requestIp)
      return NextResponse.json({ code: 0, message: board.allowPost ? "已关闭发帖" : "已开放发帖" })
    }
    case "board.hide": {
      const board = await prisma.board.findUnique({ where: { id: targetId }, select: { status: true } })
      if (!board) {
        return NextResponse.json({ code: 404, message: "版块不存在" }, { status: 404 })
      }
      const nextStatus = board.status === BoardStatus.HIDDEN ? BoardStatus.ACTIVE : BoardStatus.HIDDEN
      await prisma.board.update({ where: { id: targetId }, data: { status: nextStatus } })
      await writeAdminLog(admin.id, action, "BOARD", targetId, message || "管理员切换版块显示状态", requestIp)
      return NextResponse.json({ code: 0, message: nextStatus === BoardStatus.HIDDEN ? "版块已隐藏" : "版块已恢复显示" })
    }
    case "report.process": {
      await prisma.report.update({ where: { id: targetId }, data: { status: ReportStatus.PROCESSING, handledBy: admin.id } })
      await writeAdminLog(admin.id, action, "REPORT", targetId, message || "管理员开始处理举报", requestIp)
      return NextResponse.json({ code: 0, message: "举报已标记为处理中" })
    }
    case "report.resolve": {
      await prisma.report.update({
        where: { id: targetId },
        data: {
          status: ReportStatus.RESOLVED,
          handledBy: admin.id,
          handledAt: new Date(),
          handledNote: message || "已确认违规并处理",
        },
      })
      await writeAdminLog(admin.id, action, "REPORT", targetId, message || "管理员确认举报成立", requestIp)
      return NextResponse.json({ code: 0, message: "举报已处理完成" })
    }
    case "report.reject": {
      await prisma.report.update({
        where: { id: targetId },
        data: {
          status: ReportStatus.REJECTED,
          handledBy: admin.id,
          handledAt: new Date(),
          handledNote: message || "举报不成立",
        },
      })
      await notifyReportResult(targetId, admin.id, false, message || "举报不成立")
      await writeAdminLog(admin.id, action, "REPORT", targetId, message || "管理员驳回举报", requestIp)
      return NextResponse.json({ code: 0, message: "举报已驳回" })
    }
    default:
      return NextResponse.json({ code: 400, message: "暂不支持该操作" }, { status: 400 })
  }
}
