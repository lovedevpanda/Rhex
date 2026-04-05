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
import { isVipActive } from "@/lib/vip-status"

interface AdminUserModalProps {
  user: AdminUserListItem
  moderatorScopeOptions: AdminUserListResult["moderatorScopeOptions"]
}

interface EditableScopeItem {
  id: string
  canEditSettings: boolean
}

interface ApiEnvelope<T> {
  code: number
  message?: string
  data?: T
}

function toEditableScopes<T extends { canEditSettings: boolean }>(items: T[], key: keyof T) {
  return items.map((item) => ({
    id: String(item[key]),
    canEditSettings: item.canEditSettings,
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
  const [scopeFeedback, setScopeFeedback] = useState("")
  const [zoneScopes, setZoneScopes] = useState<EditableScopeItem[]>(() => toEditableScopes(user.moderatedZoneScopes, "zoneId"))
  const [boardScopes, setBoardScopes] = useState<EditableScopeItem[]>(() => toEditableScopes(user.moderatedBoardScopes, "boardId"))
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const activeUser = detail ?? user
  const vipActive = isVipActive({ vipLevel: activeUser.vipLevel, vipExpiresAt: activeUser.vipExpiresAt })
  const isModerator = activeUser.role === "MODERATOR"

  const metrics = useMemo(
    () => [
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
    setZoneScopes(toEditableScopes(data.moderatedZoneScopes, "zoneId"))
    setBoardScopes(toEditableScopes(data.moderatedBoardScopes, "boardId"))
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
      : [...current, { id, canEditSettings: false }])
  }

  function toggleScopeEdit(setter: Dispatch<SetStateAction<EditableScopeItem[]>>, id: string) {
    setter((current) => current.map((item) => item.id === id ? { ...item, canEditSettings: !item.canEditSettings } : item))
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
          zoneScopes: zoneScopes.map((scope) => ({ zoneId: scope.id, canEditSettings: scope.canEditSettings })),
          boardScopes: boardScopes.map((scope) => ({ boardId: scope.id, canEditSettings: scope.canEditSettings })),
        }),
      })
      const result = await parseResponse(response)
      setScopeFeedback(result?.message ?? (response.ok ? "版主管辖范围已保存" : "保存失败"))
      if (response.ok) {
        refreshData()
      }
    })
  }

  return (
    <>
      <Button type="button" variant="outline" className="h-7 rounded-full px-2.5 text-xs" onClick={() => setOpen(true)}>
        详情
      </Button>
      <AdminModal
        open={open}
        onClose={() => setOpen(false)}
        size="xl"
        title={`${activeUser.displayName} · @${activeUser.username}`}
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
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {metrics.map((item) => (
                <Info key={item.label} label={item.label} value={item.value} compact />
              ))}
            </div>

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
                  <h4 className="text-sm font-semibold">积分校正</h4>
                  <div className="mt-3 space-y-3">
                    <Field label="积分值" value={points} onChange={setPoints} />
                    <TextAreaField label="操作备注" value={pointsMessage} onChange={setPointsMessage} placeholder="记录调整原因、工单号或审核说明" rows={4} />
                    {pointsFeedback ? <p className="text-xs text-muted-foreground">{pointsFeedback}</p> : null}
                    <Button type="button" disabled={isPending} className="h-9 rounded-full px-4 text-xs" onClick={savePoints}>
                      {isPending ? "保存中..." : "保存积分"}
                    </Button>
                  </div>
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

                {isModerator && moderatorScopeOptions ? (
                  <section className="rounded-[20px] border border-border p-4">
                    <h4 className="text-sm font-semibold">版主管辖范围</h4>
                    <p className="mt-1 text-xs text-muted-foreground">分区授权自动覆盖分区下全部节点；勾选“可改设置”后，版主才能编辑对应分区或节点设置。</p>
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
                      />
                      {scopeFeedback ? <p className="text-xs text-muted-foreground">{scopeFeedback}</p> : null}
                      <Button type="button" disabled={isPending} className="h-9 rounded-full px-4 text-xs" onClick={saveModeratorScopes}>
                        {isPending ? "保存中..." : "保存版主管辖范围"}
                      </Button>
                    </div>
                  </section>
                ) : null}
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
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
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
}: {
  title: string
  items: Array<{ id: string; label: string; description: string }>
  activeScopes: EditableScopeItem[]
  onToggle: (id: string) => void
  onToggleEdit: (id: string) => void
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
                  <button
                    type="button"
                    className={active.canEditSettings ? "rounded-full bg-foreground px-2.5 py-1 text-[11px] text-background" : "rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"}
                    onClick={() => onToggleEdit(item.id)}
                  >
                    可改设置
                  </button>
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
