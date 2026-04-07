import {
  countAdminUserActionLogs,
  countAdminUserCheckInLogs,
  countAdminUserLoginLogs,
  countAdminUserPointLogs,
  countAdminUserUploads,
  findAdminUserActionLogs,
  findAdminUserCheckInLogs,
  findAdminUserDetailById,
  findAdminUserLoginLogs,
  findAdminUserPointLogs,
  findAdminUserUploads,
} from "@/db/admin-user-detail-queries"
import { apiError } from "@/lib/api-route"
import type { AdminUserDetailLogItem, AdminUserDetailLogSection, AdminUserDetailResult } from "@/lib/admin-user-management"
import { resolvePointLogAuditPresentation } from "@/lib/point-log-audit"
import { requireSiteAdminActor } from "@/lib/moderator-permissions"
import { resolveUserProfileSettings } from "@/lib/user-profile-settings"

function buildAdminUserLogHref(
  logSubTab: "admin" | "login" | "checkins" | "points" | "uploads",
  keyword: string,
  extra: Record<string, string> = {},
) {
  const query = new URLSearchParams({
    tab: "logs",
    logSubTab,
    logKeyword: keyword,
    ...extra,
  })
  return `/admin?${query.toString()}`
}

function mapToneFromAdminAction(action: string) {
  if (/ban|reject|delete|hide|down|mute/i.test(action)) {
    return "danger" as const
  }
  if (/approve|resolve|activate|promote|setadmin|vip|update/i.test(action)) {
    return "success" as const
  }
  return "info" as const
}

export async function getAdminUserDetail(userId: number): Promise<AdminUserDetailResult> {
  const actor = await requireSiteAdminActor()
  if (!actor) {
    apiError(403, "无权限访问用户详情")
  }

  const [user, loginTotal, loginLogs, checkInTotal, checkInLogs, pointTotal, pointLogs, uploadTotal, uploads, adminActionTotal, adminActionLogs] = await Promise.all([
    findAdminUserDetailById(userId),
    countAdminUserLoginLogs(userId),
    findAdminUserLoginLogs(userId),
    countAdminUserCheckInLogs(userId),
    findAdminUserCheckInLogs(userId),
    countAdminUserPointLogs(userId),
    findAdminUserPointLogs(userId),
    countAdminUserUploads(userId),
    findAdminUserUploads(userId),
    countAdminUserActionLogs(userId),
    findAdminUserActionLogs(userId),
  ])

  if (!user) {
    apiError(404, "用户不存在")
  }

  const profileSettings = resolveUserProfileSettings(user.signature)

  const logSections: AdminUserDetailLogSection[] = [
    {
      key: "login",
      title: "登录日志",
      description: "最近登录时间、IP 和设备标识",
      total: loginTotal,
      href: buildAdminUserLogHref("login", user.username),
      emptyText: "暂无登录日志",
      items: loginLogs.map<AdminUserDetailLogItem>((log) => ({
        id: log.id,
        occurredAt: log.createdAt.toISOString(),
        title: log.ip ? `IP ${log.ip}` : "未记录 IP",
        description: log.userAgent?.trim() || "未记录 User-Agent",
        meta: [log.createdAt.toISOString()],
        tone: "info",
      })),
    },
    {
      key: "checkins",
      title: "签到日志",
      description: "签到和补签记录，便于追踪活跃节奏",
      total: checkInTotal,
      href: buildAdminUserLogHref("checkins", user.username),
      emptyText: "暂无签到日志",
      items: checkInLogs.map<AdminUserDetailLogItem>((log) => ({
        id: log.id,
        occurredAt: log.createdAt.toISOString(),
        title: `${log.isMakeUp ? "补签" : "签到"} · ${log.checkedInOn}`,
        description: log.isMakeUp
          ? `获得 ${log.reward}，消耗 ${log.makeUpCost}`
          : `签到获得 ${log.reward}`,
        meta: [log.createdAt.toISOString()],
        tone: log.isMakeUp ? "warning" : "success",
      })),
    },
    {
      key: "points",
      title: "积分日志",
      description: "运营操作、签到和业务奖励都会沉淀到这里",
      total: pointTotal,
      href: buildAdminUserLogHref("points", user.username),
      emptyText: "暂无积分日志",
      items: pointLogs.map<AdminUserDetailLogItem>((log) => {
        const parsed = resolvePointLogAuditPresentation(log.reason, log.eventData)
        return {
          id: log.id,
          occurredAt: log.createdAt.toISOString(),
          title: `${log.changeValue > 0 ? "+" : ""}${log.changeValue} · ${log.changeType}`,
          description: parsed.displayReason,
          meta: [
            log.createdAt.toISOString(),
            log.relatedType ?? "SYSTEM",
            parsed.afterBalance === null || parsed.afterBalance === undefined ? "余额未记录" : `余额 ${parsed.afterBalance}`,
          ],
          tone: log.changeValue < 0 || log.changeType === "DECREASE" ? "danger" : "success",
        }
      }),
    },
    {
      key: "uploads",
      title: "上传日志",
      description: "头像、帖子资源等用户上传轨迹",
      total: uploadTotal,
      href: buildAdminUserLogHref("uploads", user.username),
      emptyText: "暂无上传日志",
      items: uploads.map<AdminUserDetailLogItem>((upload) => ({
        id: upload.id,
        occurredAt: upload.createdAt.toISOString(),
        title: upload.originalName,
        description: `${upload.bucketType} · ${upload.mimeType}`,
        meta: [
          upload.createdAt.toISOString(),
          `${Math.max(1, Math.round(upload.fileSize / 1024))} KB`,
          upload.urlPath,
        ],
        tone: "info",
      })),
    },
    {
      key: "admin",
      title: "后台操作日志",
      description: "管理员对该用户执行过的操作记录",
      total: adminActionTotal,
      href: buildAdminUserLogHref("admin", String(user.id)),
      emptyText: "暂无后台操作日志",
      items: adminActionLogs.map<AdminUserDetailLogItem>((log) => ({
        id: log.id,
        occurredAt: log.createdAt.toISOString(),
        title: log.action,
        description: log.detail?.trim() || "未填写附加说明",
        meta: [
          log.createdAt.toISOString(),
          `操作者 ${(log.admin.nickname ?? log.admin.username)}`,
          log.ip ? `IP ${log.ip}` : "IP 未记录",
        ],
        tone: mapToneFromAdminAction(log.action),
      })),
    },
  ]

  return {
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
    editableProfile: {
      nickname: user.nickname ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      bio: user.bio ?? "",
      introduction: profileSettings.introduction,
      gender: user.gender ?? "unknown",
    },
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
    logSections,
  }
}
