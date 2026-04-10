"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useEffectEvent, useMemo, useState, useTransition, type Dispatch, type SetStateAction } from "react"
import { ExternalLink, Loader2 } from "lucide-react"

import { AdminModal } from "@/components/admin-modal"
import { Button } from "@/components/ui/button"
import type {
  AdminUserDetailLogSection,
  AdminUserDetailResult,
  AdminUserEditableProfile,
  AdminUserListItem,
  AdminUserListResult,
} from "@/lib/admin-user-management"
import { formatDateTime } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import { CONFIGURABLE_VIP_LEVELS, isVipActive, normalizeConfigurableVipLevel } from "@/lib/vip-status"

interface AdminUserModalProps {
  user: AdminUserListItem
  moderatorScopeOptions: AdminUserListResult["moderatorScopeOptions"]
}

interface EditableScopeItem {
  id: string
  canEditSettings: boolean
  canWithdrawTreasury: boolean
}

interface ApiEnvelope<T> {
  code: number
  message?: string
  data?: T
}

type AdminUserPanel = "detail" | "account" | "permissions" | "operations"

const ADMIN_USER_PANELS: Array<{ key: AdminUserPanel; label: string }> = [
  { key: "detail", label: "详情" },
  { key: "account", label: "账号状态" },
  { key: "permissions", label: "权限身份" },
  { key: "operations", label: "运营发放" },
]

const VIP_LEVEL_OPTIONS = CONFIGURABLE_VIP_LEVELS.map((level) => ({
  value: String(level),
  label: `VIP${level}`,
}))

function toEditableScopes<T extends { canEditSettings: boolean; canWithdrawTreasury: boolean }>(items: T[], key: keyof T) {
  return items.map((item) => ({
    id: String(item[key]),
    canEditSettings: item.canEditSettings,
    canWithdrawTreasury: item.canWithdrawTreasury,
  }))
}

function buildFallbackProfile(user: AdminUserListItem): AdminUserEditableProfile {
  return {
    nickname: user.nickname ?? user.username,
    email: user.email ?? "",
    phone: user.phone ?? "",
    bio: user.bio ?? "",
    introduction: "",
    gender: "unknown",
  }
}

async function parseResponse<T>(response: Response) {
  return (await response.json().catch(() => null)) as ApiEnvelope<T> | null
}

export function AdminUserModal({ user, moderatorScopeOptions }: AdminUserModalProps) {
  const [open, setOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<AdminUserPanel>("detail")
  const [detail, setDetail] = useState<AdminUserDetailResult | null>(null)
  const [detailError, setDetailError] = useState("")
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [profileDraft, setProfileDraft] = useState<AdminUserEditableProfile>(() => buildFallbackProfile(user))
  const [profileFeedback, setProfileFeedback] = useState("")
  const [points, setPoints] = useState(String(user.points))
  const [pointsMessage, setPointsMessage] = useState("")
  const [pointsFeedback, setPointsFeedback] = useState("")
  const [adminNote, setAdminNote] = useState("")
  const [noteFeedback, setNoteFeedback] = useState("")
  const [operationMessage, setOperationMessage] = useState("")
  const [operationFeedback, setOperationFeedback] = useState("")
  const [vipLevelDraft, setVipLevelDraft] = useState(String(normalizeConfigurableVipLevel(user.vipLevel, 1)))
  const [vipExpiresAtDraft, setVipExpiresAtDraft] = useState(user.vipExpiresAt ? user.vipExpiresAt.slice(0, 16) : "")
  const [vipMessage, setVipMessage] = useState("")
  const [vipFeedback, setVipFeedback] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordMessage, setPasswordMessage] = useState("")
  const [passwordFeedback, setPasswordFeedback] = useState("")
  const [badgeId, setBadgeId] = useState("")
  const [badgeMessage, setBadgeMessage] = useState("")
  const [badgeFeedback, setBadgeFeedback] = useState("")
  const [notificationTitle, setNotificationTitle] = useState("")
  const [notificationContent, setNotificationContent] = useState("")
  const [notificationMessage, setNotificationMessage] = useState("")
  const [notificationFeedback, setNotificationFeedback] = useState("")
  const [scopeFeedback, setScopeFeedback] = useState("")
  const [zoneScopes, setZoneScopes] = useState<EditableScopeItem[]>(() => toEditableScopes(user.moderatedZoneScopes, "zoneId"))
  const [boardScopes, setBoardScopes] = useState<EditableScopeItem[]>(() => toEditableScopes(user.moderatedBoardScopes, "boardId"))
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const activeUser = detail ?? user
  const vipActive = isVipActive({ vipLevel: activeUser.vipLevel, vipExpiresAt: activeUser.vipExpiresAt })
  const isModerator = activeUser.role === "MODERATOR"
  const grantedBadgeIds = useMemo(() => new Set(detail?.grantedBadges.map((item) => item.badgeId) ?? []), [detail?.grantedBadges])
  const grantableBadges = useMemo(
    () => (detail?.availableBadges ?? []).filter((item) => !grantedBadgeIds.has(item.id)),
    [detail?.availableBadges, grantedBadgeIds],
  )
  const activePanelTitle = activePanel === "account"
    ? "账号状态"
    : activePanel === "permissions"
      ? "权限身份"
      : activePanel === "operations"
        ? "运营发放"
        : "用户详情"

  const metrics = useMemo(
    () => [
      { label: "UID", value: String(activeUser.id) },
      { label: "角色", value: activeUser.role },
      { label: "状态", value: activeUser.status },
      { label: "等级", value: `Lv.${activeUser.level}` },
      { label: "积分", value: String(activeUser.points) },
      { label: "发帖", value: String(activeUser.postCount) },
      { label: "评论", value: String(activeUser.commentCount) },
      { label: "获赞", value: String(activeUser.likeReceivedCount) },
      { label: "收藏", value: String(activeUser.favoriteCount) },
      { label: "签到天数", value: String(activeUser.checkInDays) },
      { label: "邀请数", value: String(activeUser.inviteCount) },
      { label: "邮箱", value: activeUser.email ?? "-" },
      { label: "手机", value: activeUser.phone ?? "-" },
      { label: "注册时间", value: formatDateTime(activeUser.createdAt) },
      { label: "最近登录", value: activeUser.lastLoginAt ? formatDateTime(activeUser.lastLoginAt) : "-" },
      { label: "登录 IP", value: activeUser.lastLoginIp ?? "-" },
      { label: "VIP", value: vipActive ? `VIP${activeUser.vipLevel}` : "非 VIP" },
      { label: "VIP 到期", value: activeUser.vipExpiresAt ? formatDateTime(activeUser.vipExpiresAt) : "长期 / 无" },
      { label: "邀请人", value: activeUser.inviterName ?? "-" },
    ],
    [activeUser, vipActive],
  )

  function syncLocalState(data: AdminUserDetailResult) {
    setDetail(data)
    setProfileDraft(data.editableProfile)
    setPoints(String(data.points))
    setVipLevelDraft(String(normalizeConfigurableVipLevel(data.vipLevel, 1)))
    setVipExpiresAtDraft(data.vipExpiresAt ? data.vipExpiresAt.slice(0, 16) : "")
    setZoneScopes(toEditableScopes(data.moderatedZoneScopes, "zoneId"))
    setBoardScopes(toEditableScopes(data.moderatedBoardScopes, "boardId"))
    const nextGrantedIds = new Set(data.grantedBadges.map((item) => item.badgeId))
    const defaultBadgeId = data.availableBadges.find((item) => !nextGrantedIds.has(item.id))?.id ?? ""
    setBadgeId((current) => current && !nextGrantedIds.has(current) ? current : defaultBadgeId)
  }

  async function loadDetail() {
    setIsLoadingDetail(true)
    setDetailError("")

    const response = await fetch(`/api/admin/users/detail?userId=${user.id}`, {
      method: "GET",
      cache: "no-store",
    })
    const result = await parseResponse<AdminUserDetailResult>(response)

    if (!response.ok || !result?.data) {
      setDetailError(result?.message ?? "加载用户详情失败")
      setIsLoadingDetail(false)
      return
    }

    syncLocalState(result.data)
    setIsLoadingDetail(false)
  }

  const loadDetailOnOpen = useEffectEvent(() => {
    void loadDetail()
  })

  useEffect(() => {
    if (!open) {
      return
    }

    loadDetailOnOpen()
  }, [open, user.id])

  async function submitAdminAction(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const result = await parseResponse(response)
    return {
      ok: response.ok,
      message: result?.message ?? (response.ok ? "操作成功" : "操作失败"),
    }
  }

  function refreshData() {
    router.refresh()
    void loadDetail()
  }

  function toggleScope(setter: Dispatch<SetStateAction<EditableScopeItem[]>>, id: string) {
    setter((current) => current.some((item) => item.id === id)
      ? current.filter((item) => item.id !== id)
      : [...current, { id, canEditSettings: false, canWithdrawTreasury: true }])
  }

  function toggleScopeEdit(setter: Dispatch<SetStateAction<EditableScopeItem[]>>, id: string) {
    setter((current) => current.map((item) => item.id === id ? { ...item, canEditSettings: !item.canEditSettings } : item))
  }

  function toggleScopeWithdraw(setter: Dispatch<SetStateAction<EditableScopeItem[]>>, id: string) {
    setter((current) => current.map((item) => item.id === id ? { ...item, canWithdrawTreasury: !item.canWithdrawTreasury } : item))
  }

  function saveProfile() {
    setProfileFeedback("")
    startTransition(async () => {
      const result = await submitAdminAction({
        action: "user.profile.update",
        targetId: String(user.id),
        message: "后台更新用户基础资料",
        ...profileDraft,
      })

      setProfileFeedback(result.message)
      if (result.ok) {
        refreshData()
      }
    })
  }

  function savePoints() {
    setPointsFeedback("")
    startTransition(async () => {
      const result = await submitAdminAction({
        action: "user.points.adjust",
        targetId: String(user.id),
        message: pointsMessage,
        points: Number(points) || 0,
      })

      setPointsFeedback(result.message)
      if (result.ok) {
        setPointsMessage("")
        refreshData()
      }
    })
  }

  function saveNote() {
    setNoteFeedback("")
    startTransition(async () => {
      const result = await submitAdminAction({
        action: "user.profile.note",
        targetId: String(user.id),
        message: adminNote,
      })

      setNoteFeedback(result.message)
      if (result.ok) {
        setAdminNote("")
        refreshData()
      }
    })
  }

  function saveModeratorScopes() {
    setScopeFeedback("")
    startTransition(async () => {
      const response = await fetch("/api/admin/moderator-scopes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          zoneScopes: zoneScopes.map((scope) => ({ zoneId: scope.id, canEditSettings: scope.canEditSettings, canWithdrawTreasury: scope.canWithdrawTreasury })),
          boardScopes: boardScopes.map((scope) => ({ boardId: scope.id, canEditSettings: scope.canEditSettings, canWithdrawTreasury: scope.canWithdrawTreasury })),
        }),
      })
      const result = await parseResponse(response)
      setScopeFeedback(result?.message ?? (response.ok ? "版主管辖范围已保存" : "保存失败"))
      if (response.ok) {
        refreshData()
      }
    })
  }

  function runQuickAction(action: string, confirmText?: string) {
    setOperationFeedback("")
    if (confirmText && typeof window !== "undefined" && !window.confirm(confirmText)) {
      return
    }

    startTransition(async () => {
      const result = await submitAdminAction({
        action,
        targetId: String(user.id),
        message: operationMessage,
      })

      setOperationFeedback(result.message)
      if (result.ok) {
        setOperationMessage("")
        refreshData()
      }
    })
  }

  function saveVip() {
    setVipFeedback("")
    startTransition(async () => {
      const result = await submitAdminAction({
        action: "user.vip.configure",
        targetId: String(user.id),
        vipLevel: normalizeConfigurableVipLevel(Number(vipLevelDraft), 1),
        vipExpiresAt: vipExpiresAtDraft || null,
        message: vipMessage,
      })

      setVipFeedback(result.message)
      if (result.ok) {
        setVipMessage("")
        refreshData()
      }
    })
  }

  function savePassword() {
    setPasswordFeedback("")

    if (!newPassword || !confirmPassword) {
      setPasswordFeedback("请完整填写新密码与确认密码")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback("两次输入的新密码不一致")
      return
    }
    if (newPassword.length < 6 || newPassword.length > 64) {
      setPasswordFeedback("新密码长度需为 6-64 位")
      return
    }

    startTransition(async () => {
      const result = await submitAdminAction({
        action: "user.password.update",
        targetId: String(user.id),
        newPassword,
        message: passwordMessage,
      })

      setPasswordFeedback(result.message)
      if (result.ok) {
        setNewPassword("")
        setConfirmPassword("")
        setPasswordMessage("")
      }
    })
  }

  function grantBadge() {
    setBadgeFeedback("")
    if (!badgeId) {
      setBadgeFeedback("请先选择要颁发的勋章")
      return
    }

    const selectedBadge = detail?.availableBadges.find((item) => item.id === badgeId)
    startTransition(async () => {
      const result = await submitAdminAction({
        action: "user.badge.grant",
        targetId: String(user.id),
        badgeId,
        badgeName: selectedBadge?.name ?? "",
        message: badgeMessage,
      })

      setBadgeFeedback(result.message)
      if (result.ok) {
        setBadgeMessage("")
        refreshData()
      }
    })
  }

  function sendNotification() {
    setNotificationFeedback("")
    if (!notificationTitle.trim()) {
      setNotificationFeedback("请填写通知标题")
      return
    }
    if (!notificationContent.trim()) {
      setNotificationFeedback("请填写通知内容")
      return
    }

    startTransition(async () => {
      const result = await submitAdminAction({
        action: "user.notification.send",
        targetId: String(user.id),
        title: notificationTitle,
        content: notificationContent,
        message: notificationMessage,
      })

      setNotificationFeedback(result.message)
      if (result.ok) {
        setNotificationTitle("")
        setNotificationContent("")
        setNotificationMessage("")
      }
    })
  }

  function openPanel(panel: AdminUserPanel) {
    setActivePanel(panel)
    setOpen(true)
  }

  function renderDetailPanel() {
    return (
      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          <section className="rounded-[20px] border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold">基础资料</h4>
                <p className="mt-1 text-xs text-muted-foreground">运营可直接维护昵称、邮箱、手机号、简介与介绍。</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="昵称" value={profileDraft.nickname} onChange={(value) => setProfileDraft((current) => ({ ...current, nickname: value }))} />
              <Field label="邮箱" value={profileDraft.email} onChange={(value) => setProfileDraft((current) => ({ ...current, email: value }))} placeholder="可留空" />
              <Field label="手机号" value={profileDraft.phone} onChange={(value) => setProfileDraft((current) => ({ ...current, phone: value }))} placeholder="11 位手机号，可留空" />
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">性别</span>
                <select
                  value={profileDraft.gender}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, gender: event.target.value }))}
                  className="h-10 w-full rounded-full border border-border bg-background px-3 text-sm outline-none"
                >
                  <option value="unknown">未知</option>
                  <option value="male">男</option>
                  <option value="female">女</option>
                </select>
              </label>
              <TextAreaField label="个人简介" value={profileDraft.bio} onChange={(value) => setProfileDraft((current) => ({ ...current, bio: value }))} className="md:col-span-2" />
              <TextAreaField label="个人介绍" value={profileDraft.introduction} onChange={(value) => setProfileDraft((current) => ({ ...current, introduction: value }))} className="md:col-span-2" rows={5} />
            </div>
            {profileFeedback ? <p className="mt-3 text-xs text-muted-foreground">{profileFeedback}</p> : null}
            <Button type="button" disabled={isPending} className="mt-3 h-9 rounded-full px-4 text-xs" onClick={saveProfile}>
              {isPending ? "保存中..." : "保存基础资料"}
            </Button>
          </section>

          <section className="rounded-[20px] border border-border p-4">
            <h4 className="text-sm font-semibold">管理员备注</h4>
            <p className="mt-1 text-xs text-muted-foreground">备注会写入后台操作日志，方便交接班和工单追溯。</p>
            <div className="mt-3 space-y-3">
              <TextAreaField label="备注内容" value={adminNote} onChange={setAdminNote} placeholder="例如：邮箱申诉通过，已人工核验历史工单" rows={4} />
              {noteFeedback ? <p className="text-xs text-muted-foreground">{noteFeedback}</p> : null}
              <Button type="button" variant="outline" disabled={isPending} className="h-9 rounded-full px-4 text-xs" onClick={saveNote}>
                {isPending ? "记录中..." : "保存备注"}
              </Button>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          {detail ? (
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {detail.logSections.map((section) => (
                <LogSummaryCard key={section.key} section={section} />
              ))}
            </section>
          ) : null}

          {detail?.logSections.map((section) => (
            <LogSectionCard key={section.key} section={section} />
          ))}
        </div>
      </div>
    )
  }

  function renderAccountPanel() {
    const canMute = activeUser.status === "ACTIVE"
    const canActivate = activeUser.status !== "ACTIVE"
    const activateLabel = activeUser.status === "BANNED" ? "解除拉黑" : "恢复状态"

    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-[20px] border border-border p-4">
          <h4 className="text-sm font-semibold">账号状态</h4>
          <p className="mt-1 text-xs text-muted-foreground">禁言、恢复、拉黑等状态操作集中在这里，备注会进入后台日志。</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Info label="当前状态" value={activeUser.status} compact />
            <Info label="注册时间" value={formatDateTime(activeUser.createdAt)} compact />
            <Info label="最近登录" value={activeUser.lastLoginAt ? formatDateTime(activeUser.lastLoginAt) : "从未登录"} compact />
          </div>
          <div className="mt-4 space-y-3">
            <TextAreaField label="操作备注" value={operationMessage} onChange={setOperationMessage} placeholder="记录禁言、恢复或拉黑原因" rows={4} />
            <div className="flex flex-wrap gap-2">
              {canMute ? (
                <Button type="button" variant="outline" disabled={isPending} className="h-8 rounded-full px-3 text-xs" onClick={() => runQuickAction("user.mute")}>
                  {isPending ? "处理中..." : "禁言"}
                </Button>
              ) : null}
              {canActivate ? (
                <Button type="button" variant="outline" disabled={isPending} className="h-8 rounded-full px-3 text-xs" onClick={() => runQuickAction("user.activate")}>
                  {isPending ? "处理中..." : activateLabel}
                </Button>
              ) : null}
              {activeUser.status !== "BANNED" ? (
                <Button type="button" disabled={isPending} className="h-8 rounded-full bg-red-600 px-3 text-xs text-white hover:bg-red-500" onClick={() => runQuickAction("user.ban", `确认拉黑 @${activeUser.username} 吗？`)}>
                  {isPending ? "处理中..." : "拉黑"}
                </Button>
              ) : null}
            </div>
            {operationFeedback ? <p className="text-xs text-muted-foreground">{operationFeedback}</p> : null}
          </div>
        </section>

        <section className="rounded-[20px] border border-border p-4">
          <h4 className="text-sm font-semibold">重置密码</h4>
          <p className="mt-1 text-xs text-muted-foreground">用于人工核验后的账号找回或安全处置。</p>
          <div className="mt-4 space-y-3">
            <Field type="password" label="新密码" value={newPassword} onChange={setNewPassword} placeholder="请输入 6-64 位新密码" />
            <Field type="password" label="确认新密码" value={confirmPassword} onChange={setConfirmPassword} placeholder="请再次输入新密码" />
            <TextAreaField label="操作备注" value={passwordMessage} onChange={setPasswordMessage} placeholder="记录重置原因、工单号或核验说明" rows={4} />
            {passwordFeedback ? <p className="text-xs text-muted-foreground">{passwordFeedback}</p> : null}
            <Button type="button" variant="outline" disabled={isPending} className="h-8 rounded-full px-3 text-xs" onClick={savePassword}>
              {isPending ? "保存中..." : "确认修改密码"}
            </Button>
          </div>
        </section>
      </div>
    )
  }

  function renderPermissionsPanel() {
    const canPromoteModerator = activeUser.role === "USER"
    const canSetAdmin = activeUser.role !== "ADMIN"
    const canDemote = activeUser.role !== "USER"

    return (
      <div className="space-y-4">
        <section className="rounded-[20px] border border-border p-4">
          <h4 className="text-sm font-semibold">权限身份</h4>
          <p className="mt-1 text-xs text-muted-foreground">提权、降权和版主管辖范围配置集中在这里。</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Info label="当前角色" value={activeUser.role} compact />
            <Info label="分区授权" value={`${activeUser.moderatedZoneScopes.length} 个`} compact />
            <Info label="节点授权" value={`${activeUser.moderatedBoardScopes.length} 个`} compact />
          </div>
          <div className="mt-4 space-y-3">
            <TextAreaField label="操作备注" value={operationMessage} onChange={setOperationMessage} placeholder="记录提权、降权或权限调整原因" rows={4} />
            <div className="flex flex-wrap gap-2">
              {canPromoteModerator ? (
                <Button type="button" variant="outline" disabled={isPending} className="h-8 rounded-full px-3 text-xs" onClick={() => runQuickAction("user.promoteModerator")}>
                  {isPending ? "处理中..." : "设为版主"}
                </Button>
              ) : null}
              {canSetAdmin ? (
                <Button type="button" variant="outline" disabled={isPending} className="h-8 rounded-full px-3 text-xs" onClick={() => runQuickAction("user.setAdmin", `确认将 @${activeUser.username} 提升为管理员吗？`)}>
                  {isPending ? "处理中..." : "设为管理员"}
                </Button>
              ) : null}
              {canDemote ? (
                <Button type="button" variant="outline" disabled={isPending} className="h-8 rounded-full px-3 text-xs" onClick={() => runQuickAction("user.demoteToUser", `确认将 @${activeUser.username} 降为普通用户吗？`)}>
                  {isPending ? "处理中..." : "降为普通用户"}
                </Button>
              ) : null}
            </div>
            {operationFeedback ? <p className="text-xs text-muted-foreground">{operationFeedback}</p> : null}
          </div>
        </section>

        {isModerator && moderatorScopeOptions ? (
          <section className="rounded-[20px] border border-border p-4">
            <h4 className="text-sm font-semibold">版主管辖范围</h4>
            <p className="mt-1 text-xs text-muted-foreground">分区授权自动覆盖分区下全部节点；“可改设置”控制结构编辑，“可提金库”控制节点金库提取权限。</p>
            <div className="mt-4 space-y-4">
              <ScopeBlock
                title="分区授权"
                items={moderatorScopeOptions.zones.map((zone) => ({
                  id: zone.id,
                  label: zone.name,
                  description: `/${zone.slug}`,
                }))}
                activeScopes={zoneScopes}
                onToggle={(id) => toggleScope(setZoneScopes, id)}
                onToggleEdit={(id) => toggleScopeEdit(setZoneScopes, id)}
                onToggleWithdraw={(id) => toggleScopeWithdraw(setZoneScopes, id)}
              />
              <ScopeBlock
                title="节点授权"
                items={moderatorScopeOptions.boards.map((board) => ({
                  id: board.id,
                  label: board.name,
                  description: `${board.zoneName ? `${board.zoneName} / ` : ""}/${board.slug}`,
                }))}
                activeScopes={boardScopes}
                onToggle={(id) => toggleScope(setBoardScopes, id)}
                onToggleEdit={(id) => toggleScopeEdit(setBoardScopes, id)}
                onToggleWithdraw={(id) => toggleScopeWithdraw(setBoardScopes, id)}
              />
              {scopeFeedback ? <p className="text-xs text-muted-foreground">{scopeFeedback}</p> : null}
              <Button type="button" disabled={isPending} className="h-9 rounded-full px-4 text-xs" onClick={saveModeratorScopes}>
                {isPending ? "保存中..." : "保存版主管辖范围"}
              </Button>
            </div>
          </section>
        ) : (
          <section className="rounded-[20px] border border-dashed border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
            当前用户不是版主，无需配置版主管辖范围。
          </section>
        )}
      </div>
    )
  }

  function renderOperationsPanel() {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-[20px] border border-border p-4">
            <h4 className="text-sm font-semibold">积分校正</h4>
            <p className="mt-1 text-xs text-muted-foreground">支持手动修正积分，并记录发放或扣减原因。</p>
            <div className="mt-4 space-y-3">
              <Field label="积分值" value={points} onChange={setPoints} />
              <TextAreaField label="操作备注" value={pointsMessage} onChange={setPointsMessage} placeholder="记录调整原因、工单号或审核说明" rows={4} />
              {pointsFeedback ? <p className="text-xs text-muted-foreground">{pointsFeedback}</p> : null}
              <Button type="button" disabled={isPending} className="h-9 rounded-full px-4 text-xs" onClick={savePoints}>
                {isPending ? "保存中..." : "保存积分"}
              </Button>
            </div>
          </section>

          <section className="rounded-[20px] border border-border p-4">
            <h4 className="text-sm font-semibold">VIP 配置</h4>
            <p className="mt-1 text-xs text-muted-foreground">支持人工开通、续期或修正 VIP 到期时间。</p>
            <div className="mt-4 space-y-3">
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">VIP 等级</span>
                <select
                  value={vipLevelDraft}
                  onChange={(event) => setVipLevelDraft(event.target.value)}
                  className="h-10 w-full rounded-full border border-border bg-background px-3 text-sm outline-none"
                >
                  {VIP_LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">到期时间</span>
                <input type="datetime-local" value={vipExpiresAtDraft} onChange={(event) => setVipExpiresAtDraft(event.target.value)} className="h-10 w-full rounded-full border border-border bg-background px-3 text-sm outline-none" />
              </label>
              <TextAreaField label="操作备注" value={vipMessage} onChange={setVipMessage} placeholder="记录套餐来源、补偿原因或工单号" rows={4} />
              {vipFeedback ? <p className="text-xs text-muted-foreground">{vipFeedback}</p> : null}
              <Button type="button" disabled={isPending} className="h-8 rounded-full px-3 text-xs" onClick={saveVip}>
                {isPending ? "保存中..." : "保存 VIP 设置"}
              </Button>
            </div>
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-[20px] border border-border p-4">
            <h4 className="text-sm font-semibold">手动颁发勋章</h4>
            <p className="mt-1 text-xs text-muted-foreground">可按用户当前持有情况筛掉重复勋章，并在发放后发通知。</p>
            <div className="mt-4 space-y-3">
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">选择勋章</span>
                <select value={badgeId} onChange={(event) => setBadgeId(event.target.value)} className="h-10 w-full rounded-full border border-border bg-background px-3 text-sm outline-none">
                  <option value="">请选择勋章</option>
                  {grantableBadges.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.category ? ` · ${item.category}` : ""}
                      {!item.status ? " · 已停用" : ""}
                      {item.isHidden ? " · 隐藏" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <TextAreaField label="操作备注" value={badgeMessage} onChange={setBadgeMessage} placeholder="记录发放理由、活动来源或补发说明" rows={4} />
              {detail?.grantedBadges.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">已持有勋章</p>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.grantedBadges.map((item) => (
                      <span key={`${item.badgeId}-${item.grantedAt}`} className="rounded-full border border-border px-2.5 py-1 text-[11px]" style={{ color: item.color, borderColor: `${item.color}55`, backgroundColor: `${item.color}12` }}>
                        {item.name}
                        {item.isDisplayed ? ` · 展示第 ${item.displayOrder || 1} 位` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {badgeFeedback ? <p className="text-xs text-muted-foreground">{badgeFeedback}</p> : null}
              <Button type="button" variant="outline" disabled={isPending || grantableBadges.length === 0} className="h-8 rounded-full px-3 text-xs" onClick={grantBadge}>
                {isPending ? "处理中..." : grantableBadges.length === 0 ? "无可颁发勋章" : "颁发勋章"}
              </Button>
            </div>
          </section>

          <section className="rounded-[20px] border border-border p-4">
            <h4 className="text-sm font-semibold">手动发送通知</h4>
            <p className="mt-1 text-xs text-muted-foreground">用于人工补发说明、活动通知或申诉处理结果通知。</p>
            <div className="mt-4 space-y-3">
              <Field label="通知标题" value={notificationTitle} onChange={setNotificationTitle} placeholder="如 资料申诉已通过" />
              <TextAreaField label="通知内容" value={notificationContent} onChange={setNotificationContent} placeholder="填写要发给用户的通知正文" rows={4} />
              <TextAreaField label="操作备注" value={notificationMessage} onChange={setNotificationMessage} placeholder="记录通知背景、工单号或内部说明" rows={4} />
              {notificationFeedback ? <p className="text-xs text-muted-foreground">{notificationFeedback}</p> : null}
              <Button type="button" variant="outline" disabled={isPending} className="h-8 rounded-full px-3 text-xs" onClick={sendNotification}>
                {isPending ? "发送中..." : "发送通知"}
              </Button>
            </div>
          </section>
        </div>
      </div>
    )
  }

  function renderPanelContent() {
    switch (activePanel) {
      case "account":
        return renderAccountPanel()
      case "permissions":
        return renderPermissionsPanel()
      case "operations":
        return renderOperationsPanel()
      case "detail":
      default:
        return renderDetailPanel()
    }
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-1.5">
        {ADMIN_USER_PANELS.map((panel) => (
          <Button key={panel.key} type="button" variant="outline" className="h-7 rounded-full px-2.5 text-xs" onClick={() => openPanel(panel.key)}>
            {panel.label}
          </Button>
        ))}
      </div>
      <AdminModal
        open={open}
        onClose={() => setOpen(false)}
        size="xl"
        title={`${activeUser.displayName}  @${activeUser.username}  UID ${activeUser.id}  ${activePanelTitle}`}
        description={`角色 ${activeUser.role} · 状态 ${activeUser.status} · ${vipActive ? `VIP${activeUser.vipLevel}` : "非 VIP"}`}
        footer={(
          <div className="flex items-center justify-end">
            <Button type="button" variant="ghost" className="h-8 px-3 text-xs" onClick={() => setOpen(false)}>
              关闭
            </Button>
          </div>
        )}
      >
        {isLoadingDetail && !detail ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-border bg-secondary/20">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>加载用户详情中...</span>
            </div>
          </div>
        ) : detailError ? (
          <div className="rounded-[24px] border border-rose-200 bg-rose-50/70 p-5 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
            <p>{detailError}</p>
            <Button type="button" variant="outline" className="mt-3 h-8 rounded-full px-3 text-xs" onClick={() => void loadDetail()}>
              重试
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {ADMIN_USER_PANELS.map((panel) => (
                <Button key={panel.key} type="button" variant={activePanel === panel.key ? "default" : "outline"} className="h-8 rounded-full px-3 text-xs" onClick={() => setActivePanel(panel.key)}>
                  {panel.label}
                </Button>
              ))}
            </div>

            {activePanel === "detail" ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {metrics.map((item) => (
                  <Info key={item.label} label={item.label} value={item.value} compact />
                ))}
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <Info label="角色" value={activeUser.role} compact />
                <Info label="状态" value={activeUser.status} compact />
                <Info label="等级 / VIP" value={vipActive ? `Lv.${activeUser.level} · VIP${activeUser.vipLevel}` : `Lv.${activeUser.level} · 非 VIP`} compact />
                <Info label="最近登录" value={activeUser.lastLoginAt ? formatDateTime(activeUser.lastLoginAt) : "从未登录"} compact />
              </div>
            )}

            {renderPanelContent()}
          </div>
        )}
      </AdminModal>
    </>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: "text" | "password"
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-full border border-border bg-background px-3 text-sm outline-none"
      />
    </label>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  className,
  rows = 4,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  rows?: number
}) {
  return (
    <label className={cn("space-y-1", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="min-h-[96px] w-full rounded-[20px] border border-border bg-background px-3 py-2 text-sm outline-none"
      />
    </label>
  )
}

function ScopeBlock({
  title,
  items,
  activeScopes,
  onToggle,
  onToggleEdit,
  onToggleWithdraw,
}: {
  title: string
  items: Array<{ id: string; label: string; description: string }>
  activeScopes: EditableScopeItem[]
  onToggle: (id: string) => void
  onToggleEdit: (id: string) => void
  onToggleWithdraw: (id: string) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="space-y-2">
        {items.map((item) => {
          const active = activeScopes.find((scope) => scope.id === item.id)
          return (
            <label key={item.id} className="flex items-center justify-between gap-3 rounded-[16px] border border-border px-3 py-2">
              <span className="min-w-0 text-sm">
                <span className="font-medium">{item.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{item.description}</span>
              </span>
              <span className="flex items-center gap-3">
                {active ? (
                  <>
                    <button
                      type="button"
                      className={active.canEditSettings ? "rounded-full bg-foreground px-2.5 py-1 text-[11px] text-background" : "rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"}
                      onClick={() => onToggleEdit(item.id)}
                    >
                      可改设置
                    </button>
                    <button
                      type="button"
                      className={active.canWithdrawTreasury ? "rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] text-white" : "rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"}
                      onClick={() => onToggleWithdraw(item.id)}
                    >
                      可提金库
                    </button>
                  </>
                ) : null}
                <input type="checkbox" checked={Boolean(active)} onChange={() => onToggle(item.id)} />
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function LogSummaryCard({ section }: { section: AdminUserDetailLogSection }) {
  return (
    <div className="rounded-[18px] border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{section.title}</p>
          <p className="mt-2 text-2xl font-semibold">{section.total}</p>
        </div>
        <Link href={section.href} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{section.description}</p>
    </div>
  )
}

function LogSectionCard({ section }: { section: AdminUserDetailLogSection }) {
  return (
    <section className="rounded-[20px] border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">{section.title}</h4>
          <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
        </div>
        <Link href={section.href} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
          <span>日志中心</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-3 space-y-2">
        {section.items.length === 0 ? <p className="rounded-[16px] border border-dashed border-border px-3 py-5 text-sm text-muted-foreground">{section.emptyText}</p> : null}
        {section.items.map((item) => (
          <div key={item.id} className={cn("rounded-[16px] border px-3 py-2.5", resolveToneClassName(item.tone))}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{item.title}</p>
              <span className="text-[11px] opacity-80">{formatDateTime(item.occurredAt)}</span>
            </div>
            <p className="mt-1 text-xs leading-5 opacity-90">{item.description}</p>
            {item.meta.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] opacity-80">
                {item.meta.map((meta, index) => (
                  <span key={`${item.id}-${index}`} className="rounded-full bg-white/70 px-2 py-0.5 dark:bg-black/20">{meta}</span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}

function resolveToneClassName(tone: AdminUserDetailLogSection["items"][number]["tone"]) {
  switch (tone) {
    case "success":
      return "border-emerald-200/80 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100"
    case "warning":
      return "border-amber-200/80 bg-amber-50/70 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100"
    case "danger":
      return "border-rose-200/80 bg-rose-50/70 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-100"
    case "info":
      return "border-sky-200/80 bg-sky-50/70 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100"
    default:
      return "border-border bg-secondary/20"
  }
}

function Info({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={compact ? "rounded-[16px] border border-border px-3 py-2" : "rounded-[18px] border border-border p-4"}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium break-all">{value}</p>
    </div>
  )
}
