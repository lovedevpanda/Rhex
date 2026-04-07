"use client"

import { AlertCircle, Building2, CircleHelp, EyeOff, FolderTree, Plus, Search, ShieldCheck, Slash, Trash2 } from "lucide-react"

import { useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { AdminIconPickerField } from "@/components/admin-icon-picker-field"
import { AdminFormModal, AdminModal } from "@/components/admin-modal"
import { PickerPopover, PickerTriggerField, normalizeHexColor } from "@/components/admin-picker-popover"
import { LevelIcon } from "@/components/level-icon"
import { RefinedRichPostEditor } from "@/components/refined-rich-post-editor"
import { Button } from "@/components/ui/button"
import { showConfirm } from "@/components/ui/confirm-dialog"
import { toast } from "@/components/ui/toast"
import { Tooltip } from "@/components/ui/tooltip"




import type { BoardItem, ZoneItem } from "@/lib/admin-structure-management"
import type { BoardSidebarLinkItem } from "@/lib/board-sidebar-config"
import { formatNumber } from "@/lib/formatters"
import { POST_LIST_LOAD_MODE_INFINITE, POST_LIST_LOAD_MODE_PAGINATION } from "@/lib/post-list-load-mode"
import { POST_LIST_DISPLAY_MODE_DEFAULT, POST_LIST_DISPLAY_MODE_GALLERY } from "@/lib/post-list-display"
import { DEFAULT_ALLOWED_POST_TYPES, normalizePostTypes } from "@/lib/post-types"

interface StructureManagerProps {
  zones: ZoneItem[]
  boards: BoardItem[]
  permissions: {
    canCreateZone: boolean
    canCreateBoard: boolean
    canDeleteZone: boolean
    canDeleteBoard: boolean
  }
  canReviewBoardApplications: boolean
  pendingBoardApplicationCount: number
  initialFilters: {
    keyword: string
    zoneId: string
    boardStatus: string
    posting: string
  }
}

interface BoardApplicationItem {
  id: string
  applicantId: number
  zoneId: string
  boardId: string | null
  name: string
  slug: string
  description: string
  icon: string
  reason: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  reviewNote: string
  reviewedAt: string | null
  createdAt: string
  applicant: {
    id: number
    username: string
    displayName: string
    role: "USER" | "MODERATOR" | "ADMIN"
    status: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  }
  reviewer: {
    id: number
    displayName: string
  } | null
  zone: {
    id: string
    name: string
    slug: string
  }
  board: {
    id: string
    name: string
    slug: string
    treasuryPoints: number
  } | null
}

interface AdminBoardApplicationManagerProps {
  zones: ZoneItem[]
  boardApplications: BoardApplicationItem[]
  canReviewBoardApplications: boolean
}

type ModalMode =
  | { kind: "create-zone" }
  | { kind: "create-board"; zoneId?: string }
  | { kind: "edit-zone"; item: ZoneItem }
  | { kind: "edit-board"; item: BoardItem }
  | null

interface BoardApplicationReviewFormState {
  zoneId: string
  name: string
  slug: string
  description: string
  icon: string
  reason: string
  reviewNote: string
}

type BoardSidebarLinkDraft = BoardSidebarLinkItem

interface StructureFormState {
  name: string
  slug: string
  description: string
  icon: string
  sidebarLinks: BoardSidebarLinkDraft[]
  rulesMarkdown: string
  moderatorsCanWithdrawTreasury: boolean
  sortOrder: string
  hiddenFromSidebar: boolean
  zoneId: string
  postPointDelta: string
  replyPointDelta: string
  postIntervalSeconds: string
  replyIntervalSeconds: string
  allowedPostTypes: string[]
  minViewPoints: string
  minViewLevel: string
  minPostPoints: string
  minPostLevel: string
  minReplyPoints: string
  minReplyLevel: string
  minViewVipLevel: string
  minPostVipLevel: string
  minReplyVipLevel: string
  requirePostReview: boolean
  postListDisplayMode: string
  postListLoadMode: string
  feedback: string
  feedbackTone: "error" | "success"
}

const postTypeOptions = [
  { value: "NORMAL", label: "普通帖" },
  { value: "BOUNTY", label: "悬赏帖" },
  { value: "POLL", label: "投票帖" },
  { value: "LOTTERY", label: "抽奖帖" },
] as const


const boardStatusOptions = [
  { value: "ALL", label: "全部状态" },
  { value: "ACTIVE", label: "启用中" },
  { value: "HIDDEN", label: "已隐藏" },
  { value: "DISABLED", label: "已停用" },
]

const postingOptions = [
  { value: "ALL", label: "全部发帖权限" },
  { value: "on", label: "允许发帖" },
  { value: "off", label: "暂停发帖" },
]

function createEmptyBoardSidebarLink(): BoardSidebarLinkDraft {
  return {
    title: "",
    url: "",
    icon: null,
    titleColor: null,
  }
}

export function StructureManager({ zones, boards, permissions, canReviewBoardApplications, pendingBoardApplicationCount, initialFilters }: StructureManagerProps) {
  const [modal, setModal] = useState<ModalMode>(null)
  const [selectedZoneId, setSelectedZoneId] = useState(initialFilters.zoneId || zones[0]?.id || "")

  const filteredZones = useMemo(() => {
    const keyword = initialFilters.keyword.trim().toLowerCase()
    return zones.filter((zone) => {
      if (selectedZoneId && initialFilters.zoneId && zone.id !== initialFilters.zoneId) {
        return false
      }
      if (!keyword) {
        return true
      }
      return [zone.name, zone.slug, zone.description].some((item) => item.toLowerCase().includes(keyword))
    })
  }, [initialFilters.keyword, initialFilters.zoneId, selectedZoneId, zones])

  const visibleZoneId = selectedZoneId || filteredZones[0]?.id || zones[0]?.id || ""

  const filteredBoards = useMemo(() => {
    const keyword = initialFilters.keyword.trim().toLowerCase()
    return boards.filter((board) => {
      if (visibleZoneId && board.zoneId !== visibleZoneId) {
        return false
      }
      if (initialFilters.boardStatus !== "ALL" && board.status !== initialFilters.boardStatus) {
        return false
      }
      if (initialFilters.posting === "on" && !board.allowPost) {
        return false
      }
      if (initialFilters.posting === "off" && board.allowPost) {
        return false
      }
      if (!keyword) {
        return true
      }
      return [board.name, board.slug, board.description ?? "", board.zoneName ?? ""].some((item) => item.toLowerCase().includes(keyword))
    })
  }, [boards, initialFilters.boardStatus, initialFilters.keyword, initialFilters.posting, visibleZoneId])

  const summary = useMemo(() => ({
    zoneCount: zones.length,
    boardCount: boards.length,
    activeBoardCount: boards.filter((board) => board.status === "ACTIVE").length,
    hiddenBoardCount: boards.filter((board) => board.status === "HIDDEN").length,
    reviewBoardCount: boards.filter((board) => board.requirePostReview).length,
    lockedPostingBoardCount: boards.filter((board) => !board.allowPost).length,
  }), [boards, zones.length])

  const zoneCards = useMemo(() => zones.map((zone) => ({
    ...zone,
    boards: boards.filter((board) => board.zoneId === zone.id),
  })), [boards, zones])
  const activeZone = zones.find((zone) => zone.id === visibleZoneId) ?? null

  async function handleDeleteZone() {
    if (!activeZone || !permissions.canDeleteZone) {
      return
    }

    const confirmed = await showConfirm({
      title: "删除分区",
      description: `确认删除分区“${activeZone.name}”吗？如果分区下仍有节点，系统会阻止删除。`,
      confirmText: "删除",
      variant: "danger",
    })

    if (!confirmed) {
      return
    }

    try {
      const response = await fetch("/api/admin/structure", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "zone",
          id: activeZone.id,
        }),
      })
      const result = (await response.json().catch(() => null)) as { message?: string } | null
      const message = result?.message ?? (response.ok ? "分区已删除" : "删除失败，请稍后重试")

      if (!response.ok) {
        toast.error(message)
        return
      }

      toast.success(message)
      window.location.href = "/admin?tab=structure"
    } catch {
      toast.error("网络异常，请稍后重试")
    }
  }

  return (
    <div className="space-y-4">
      <form className="grid gap-3 rounded-[22px] border border-border bg-card p-4 xl:grid-cols-[minmax(260px,1.4fr)_180px_160px_160px_auto]">
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">搜索分区 / 节点</span>
          <div className="flex h-10 items-center gap-2 rounded-full border border-border bg-background px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input name="structureKeyword" defaultValue={initialFilters.keyword} placeholder="名称 / slug / 描述" className="w-full bg-transparent text-sm outline-none" />
          </div>
        </label>
        <CompactSelect name="structureZoneId" label="聚焦分区" value={initialFilters.zoneId} options={[{ value: "", label: "全部分区" }, ...zones.map((zone) => ({ value: zone.id, label: zone.name }))]} />
        <CompactSelect name="structureBoardStatus" label="节点状态" value={initialFilters.boardStatus} options={boardStatusOptions} />
        <CompactSelect name="structurePosting" label="发帖权限" value={initialFilters.posting} options={postingOptions} />
        <div className="flex items-end gap-2">
          <input type="hidden" name="tab" value="structure" />
          <Button type="submit" className="h-10 rounded-full px-4 text-xs">筛选</Button>
          <a href="/admin?tab=structure" className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">重置</a>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="分区总数" value={summary.zoneCount} icon={<FolderTree className="h-4 w-4" />} />
        <SummaryCard label="节点总数" value={summary.boardCount} icon={<Building2 className="h-4 w-4" />} />
        <SummaryCard label="启用节点" value={summary.activeBoardCount} icon={<ShieldCheck className="h-4 w-4" />} />
        <SummaryCard label="隐藏节点" value={summary.hiddenBoardCount} icon={<EyeOff className="h-4 w-4" />} />
        <SummaryCard label="审核节点" value={summary.reviewBoardCount} icon={<ShieldCheck className="h-4 w-4" />} />
        <SummaryCard label="暂停发帖" value={summary.lockedPostingBoardCount} icon={<Slash className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-[22px] border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-semibold">分区总览</h3>
              <p className="mt-1 text-xs text-muted-foreground">先选中一个分区，再集中管理它下面的节点。</p>
            </div>
            {permissions.canCreateZone ? (
              <Button type="button" className="h-8 rounded-full px-3 text-xs" onClick={() => setModal({ kind: "create-zone" })}>
                <Plus className="mr-1 h-3.5 w-3.5" />新建分区
              </Button>
            ) : null}
          </div>
          <div className="mt-3 space-y-2">
            {zoneCards.map((zone) => {
              const active = visibleZoneId === zone.id
              return (
                <button key={zone.id} type="button" onClick={() => setSelectedZoneId(zone.id)} className={active ? "w-full rounded-[18px] border border-foreground/20 bg-accent px-3 py-3 text-left" : "w-full rounded-[18px] border border-border px-3 py-3 text-left transition-colors hover:bg-accent/50"}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <LevelIcon icon={zone.icon} className="h-4 w-4 text-sm" svgClassName="[&>svg]:block" />
                        <span className="truncate text-sm font-semibold">{zone.name}</span>
                      </div>

                      <p className="mt-1 truncate text-[11px] text-muted-foreground">/{zone.slug} · 排序 {zone.sortOrder}</p>
                    </div>
                    <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">{zone.boards.length} 节点</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                    <span className="rounded-full bg-background px-2 py-0.5">帖 {zone.postCount}</span>
                    <span className="rounded-full bg-background px-2 py-0.5">关注 {zone.followerCount}</span>
                    <span className="rounded-full bg-background px-2 py-0.5">{zone.requirePostReview ? "发帖审核" : "直发"}</span>
                    <span className="rounded-full bg-background px-2 py-0.5">{zone.hiddenFromSidebar ? "左侧导航隐藏" : "左侧导航显示"}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-[22px] border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">节点工作台</h3>
              <p className="mt-1 text-xs text-muted-foreground">围绕当前分区集中查看节点状态、发帖权限、审核策略和流量表现。</p>
            </div>
            <div className="flex items-center gap-2">
              {visibleZoneId && activeZone?.canEditSettings ? <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => setModal({ kind: "edit-zone", item: activeZone })}>编辑分区</Button> : null}
              {permissions.canDeleteZone && activeZone ? (
                <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={handleDeleteZone}>
                  删除分区
                </Button>
              ) : null}
              {permissions.canCreateBoard ? (
                <Button type="button" className="h-8 rounded-full px-3 text-xs" onClick={() => setModal({ kind: "create-board", zoneId: visibleZoneId })}>
                  <Plus className="mr-1 h-3.5 w-3.5" />新建节点
                </Button>
              ) : null}
              {canReviewBoardApplications ? (
                <a href="/admin?tab=board-applications" className="inline-flex h-8 items-center justify-center rounded-full border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                  节点申请{pendingBoardApplicationCount > 0 ? ` ${pendingBoardApplicationCount}` : ""}
                </a>
              ) : null}
            </div>
          </div>

          <div className="grid items-center gap-3 border-b border-border bg-secondary/40 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground lg:grid-cols-[minmax(0,1.3fr)_120px_120px_160px_230px]">
            <span>节点</span>
            <span>状态</span>
            <span>流量</span>
            <span>策略</span>
            <span className="text-right">操作</span>
          </div>

          <div>
            {filteredBoards.length === 0 ? <div className="px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下没有节点。</div> : null}
            {filteredBoards.map((board) => (
              <BoardRow key={board.id} board={board} canDelete={permissions.canDeleteBoard} onEdit={() => setModal({ kind: "edit-board", item: board })} />
            ))}
          </div>
        </section>
      </div>

      <StructureModal modal={modal} zones={zones} isSiteAdmin={permissions.canCreateBoard} onClose={() => setModal(null)} />
    </div>
  )
}

export function AdminBoardApplicationManager({ zones, boardApplications, canReviewBoardApplications }: AdminBoardApplicationManagerProps) {
  const [applicationModal, setApplicationModal] = useState<BoardApplicationItem | null>(null)
  const pendingBoardApplications = useMemo(
    () => boardApplications.filter((item) => item.status === "PENDING"),
    [boardApplications],
  )
  const approvedBoardApplications = useMemo(
    () => boardApplications.filter((item) => item.status === "APPROVED"),
    [boardApplications],
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="申请总数" value={boardApplications.length} icon={<FolderTree className="h-4 w-4" />} />
        <SummaryCard label="待审核" value={pendingBoardApplications.length} icon={<AlertCircle className="h-4 w-4" />} />
        <SummaryCard label="已通过" value={approvedBoardApplications.length} icon={<ShieldCheck className="h-4 w-4" />} />
      </div>

      <section className="rounded-[22px] border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">节点申请</h3>
            <p className="mt-1 text-xs text-muted-foreground">用户提交新建节点申请后，会在这里等待管理员审核；通过后将自动创建节点并把申请人设为该节点版主。</p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700">待审核 {pendingBoardApplications.length}</span>
        </div>

        {!canReviewBoardApplications ? (
          <div className="mt-4 rounded-[18px] border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            当前无权审核节点申请。
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {boardApplications.map((item) => (
              <div key={item.id} className="rounded-[18px] border border-border bg-background/70 px-4 py-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-sm font-semibold">{item.name}</span>
                      <BoardApplicationStatusBadge status={item.status} />
                      <span className="text-xs text-muted-foreground">{item.zone.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">申请人：@{item.applicant.username} · slug：/{item.slug}</p>
                    {item.reason ? <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.reason}</p> : null}
                    {item.reviewNote ? <p className="mt-2 text-xs text-muted-foreground">审核备注：{item.reviewNote}</p> : null}
                    {item.board ? <p className="mt-2 text-xs text-emerald-700">已创建节点：/boards/{item.board.slug} · 节点金库 {formatNumber(item.board.treasuryPoints)}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => setApplicationModal(item)}>
                      {item.status === "PENDING" ? "审核" : "查看"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {boardApplications.length === 0 ? <div className="rounded-[18px] border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">当前还没有节点申请。</div> : null}
          </div>
        )}
      </section>

      <BoardApplicationReviewModal key={applicationModal?.id ?? "board-application-modal"} application={applicationModal} zones={zones} onClose={() => setApplicationModal(null)} />
    </div>
  )
}

function BoardRow({ board, canDelete, onEdit }: { board: BoardItem; canDelete: boolean; onEdit: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  async function runAction(type: "PUT" | "DELETE", body: Record<string, unknown>, successMessage: string) {

    if (type === "DELETE") {
      const confirmed = await showConfirm({

        title: "删除节点",
        description: `确认删除节点“${board.name}”吗？如果该节点下仍有帖子，系统会阻止删除。`,
        confirmText: "删除",
        variant: "danger",
      })
      if (!confirmed) {
        return
      }
    }


    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/structure", {
          method: type,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const result = (await response.json().catch(() => null)) as { message?: string } | null
        const message = result?.message ?? (response.ok ? successMessage : "操作失败，请稍后重试")

        if (!response.ok) {
          toast.error(message)
          return
        }

        toast.success(message || successMessage)
        router.refresh()
      } catch {
        toast.error("网络异常，请稍后重试")
      }
    })
  }


  return (
    <div className="grid items-center gap-3 border-b border-border px-4 py-3 text-xs last:border-b-0 lg:grid-cols-[minmax(0,1.3fr)_120px_120px_160px_230px]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <LevelIcon icon={board.icon} className="h-4 w-4 text-base" svgClassName="[&>svg]:block" />
          <span className="truncate text-sm font-semibold">{board.name}</span>
        </div>

        <p className="mt-1 truncate text-[11px] text-muted-foreground">所属分区：{board.zoneName ?? "未分配"} · 排序 {board.sortOrder}</p>
      </div>

      <div className="space-y-1 text-muted-foreground">
        <div>{board.status}</div>
        <div>{board.allowPost ? "允许发帖" : "暂停发帖"}</div>
        <div>{board.requirePostReview ? "发帖审核" : "默认直发"}</div>
      </div>

      <div className="space-y-1 text-muted-foreground">
        <div>帖子 {formatNumber(board.postCount)}</div>
        <div>关注 {formatNumber(board.followerCount)}</div>
        <div>今日 {formatNumber(board.todayPostCount)}</div>
        <div>金库 {formatNumber(board.treasuryPoints)}</div>
      </div>

      <div className="grid gap-1 text-muted-foreground md:grid-cols-2">
        <span className="rounded-full bg-secondary/50 px-2 py-1 text-center">发帖 {board.postPointDelta ?? "继承"}</span>
        <span className="rounded-full bg-secondary/50 px-2 py-1 text-center">回复 {board.replyPointDelta ?? "继承"}</span>
        <span className="rounded-full bg-secondary/50 px-2 py-1 text-center">间隔 {board.postIntervalSeconds ?? "继承"}</span>
        <span className="rounded-full bg-secondary/50 px-2 py-1 text-center">VIP {board.minPostVipLevel ?? 0}</span>
        <span className="rounded-full bg-secondary/50 px-2 py-1 text-center">{board.moderatorsCanWithdrawTreasury ? "版主可提金库" : "仅管理员提金库"}</span>
        <span className="rounded-full bg-secondary/50 px-2 py-1 text-center">列表 {board.postListDisplayMode === POST_LIST_DISPLAY_MODE_GALLERY ? "画廊" : board.postListDisplayMode === POST_LIST_DISPLAY_MODE_DEFAULT ? "普通" : "继承分区"}</span>
        <span className="rounded-full bg-secondary/50 px-2 py-1 text-center">加载 {board.postListLoadMode === POST_LIST_LOAD_MODE_INFINITE ? "无限下拉" : board.postListLoadMode === POST_LIST_LOAD_MODE_PAGINATION ? "分页" : "继承分区"}</span>
      </div>

      <div className="flex flex-wrap justify-end gap-1.5">
        {board.canEditSettings ? <Button type="button" variant="outline" className="h-7 rounded-full px-2.5 text-xs" onClick={onEdit}>编辑</Button> : null}
        {board.canEditSettings ? (
          <Button type="button" variant="outline" disabled={isPending} className="h-7 rounded-full px-2.5 text-xs" onClick={() => runAction("PUT", { type: "board", id: board.id, name: board.name, slug: board.slug, description: board.description, sortOrder: board.sortOrder, zoneId: board.zoneId, allowPost: !board.allowPost, status: board.status, icon: board.icon }, board.allowPost ? "节点已暂停发帖" : "节点已开放发帖")}>
            {board.allowPost ? "暂停发帖" : "开放发帖"}
          </Button>
        ) : null}
        {board.canEditSettings ? (
          <Button type="button" variant="outline" disabled={isPending} className="h-7 rounded-full px-2.5 text-xs" onClick={() => runAction("PUT", { type: "board", id: board.id, name: board.name, slug: board.slug, description: board.description, sortOrder: board.sortOrder, zoneId: board.zoneId, allowPost: board.allowPost, status: board.status === "HIDDEN" ? "ACTIVE" : "HIDDEN", icon: board.icon }, board.status === "HIDDEN" ? "节点已恢复显示" : "节点已隐藏")}>
            {board.status === "HIDDEN" ? "恢复显示" : "隐藏"}
          </Button>
        ) : null}
        {canDelete ? (
          <Button type="button" disabled={isPending} className="h-7 rounded-full bg-red-600 px-2.5 text-xs text-white hover:bg-red-500" onClick={() => runAction("DELETE", { type: "board", id: board.id }, "节点已删除")}>
            <Trash2 className="mr-1 h-3.5 w-3.5" />删除
          </Button>
        ) : null}

      </div>
    </div>
  )
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-[18px] border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-muted-foreground">
        <span className="text-xs">{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function CompactSelect({ name, label, value, options }: { name: string; label: string; value: string; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <select name={name} defaultValue={value} className="h-10 w-full rounded-full border border-border bg-background px-3 text-sm outline-none">
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function StructureModal({
  modal,
  zones,
  isSiteAdmin,
  onClose,
}: {
  modal: ModalMode
  zones: ZoneItem[]
  isSiteAdmin: boolean
  onClose: () => void
}) {
  if (!modal) {
    return null
  }

  return <StructureModalForm key={getStructureModalKey(modal)} modal={modal} zones={zones} isSiteAdmin={isSiteAdmin} onClose={onClose} />
}

function StructureModalForm({
  modal,
  zones,
  isSiteAdmin,
  onClose,
}: {
  modal: Exclude<ModalMode, null>
  zones: ZoneItem[]
  isSiteAdmin: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [form, setForm] = useState<StructureFormState>(() => getInitialStructureFormState(modal, zones))
  const [isPending, startTransition] = useTransition()
  const title = getStructureModalTitle(modal)

  const isBoard = modal.kind === "create-board" || modal.kind === "edit-board"
  const isEdit = modal.kind === "edit-zone" || modal.kind === "edit-board"
  const isModeratorBoardEdit = isBoard && isEdit && !isSiteAdmin
  const editingItemId = modal.kind === "edit-zone" || modal.kind === "edit-board" ? modal.item.id : undefined

  const {
    name,
    slug,
    description,
    icon,
    sidebarLinks,
    rulesMarkdown,
    moderatorsCanWithdrawTreasury,
    sortOrder,
    hiddenFromSidebar,
    zoneId,
    postPointDelta,
    replyPointDelta,
    postIntervalSeconds,
    replyIntervalSeconds,
    allowedPostTypes,
    minViewPoints,
    minViewLevel,
    minPostPoints,
    minPostLevel,
    minReplyPoints,
    minReplyLevel,
    minViewVipLevel,
    minPostVipLevel,
    minReplyVipLevel,
    requirePostReview,
    postListDisplayMode,
    postListLoadMode,
    feedback,
    feedbackTone,
  } = form

  function updateField<K extends keyof StructureFormState>(field: K, value: StructureFormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function togglePostType(type: string) {
    setForm((current) => ({
      ...current,
      allowedPostTypes: current.allowedPostTypes.includes(type)
        ? current.allowedPostTypes.filter((item) => item !== type)
        : [...current.allowedPostTypes, type],
    }))
  }

  function updateSidebarLink(index: number, key: keyof BoardSidebarLinkDraft, value: BoardSidebarLinkDraft[keyof BoardSidebarLinkDraft]) {
    setForm((current) => ({
      ...current,
      sidebarLinks: current.sidebarLinks.map((item, currentIndex) => (currentIndex === index ? { ...item, [key]: value } : item)),
    }))
  }

  function addSidebarLink() {
    setForm((current) => ({
      ...current,
      sidebarLinks: [...current.sidebarLinks, createEmptyBoardSidebarLink()],
    }))
  }

  function removeSidebarLink(index: number) {
    setForm((current) => ({
      ...current,
      sidebarLinks: current.sidebarLinks.filter((_, currentIndex) => currentIndex !== index),
    }))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateField("feedback", "")

    if (isModeratorBoardEdit) {
      const limitedFields = [
        { label: "发帖积分", value: postPointDelta },
        { label: "回复积分", value: replyPointDelta },
        { label: "发帖间隔", value: postIntervalSeconds },
        { label: "回复间隔", value: replyIntervalSeconds },
      ]
      const invalidField = limitedFields.find((field) => field.value !== "" && Number(field.value) > 0)

      if (invalidField) {
        setForm((current) => ({
          ...current,
          feedback: `版主编辑节点时，${invalidField.label}只能填写留空、0 或负数`,
          feedbackTone: "error",
        }))
        return
      }
    }

    const payload: Record<string, unknown> = {
      type: isBoard ? "board" : "zone",
      name,
      slug,
      description,
      sortOrder: Number(sortOrder) || 0,
      icon,
      sidebarLinks: isBoard ? sidebarLinks : undefined,
      rulesMarkdown: isBoard ? rulesMarkdown : undefined,
      moderatorsCanWithdrawTreasury: isBoard && !isModeratorBoardEdit ? moderatorsCanWithdrawTreasury : undefined,
      hiddenFromSidebar: isBoard ? undefined : hiddenFromSidebar,
      zoneId: isBoard ? zoneId : undefined,
      id: editingItemId,
      postPointDelta: postPointDelta === "" ? undefined : Number(postPointDelta),
      replyPointDelta: replyPointDelta === "" ? undefined : Number(replyPointDelta),
      postIntervalSeconds: postIntervalSeconds === "" ? undefined : Number(postIntervalSeconds),
      replyIntervalSeconds: replyIntervalSeconds === "" ? undefined : Number(replyIntervalSeconds),
      allowedPostTypes,
      minViewPoints: minViewPoints === "" ? undefined : Number(minViewPoints),
      minViewLevel: minViewLevel === "" ? undefined : Number(minViewLevel),
      minPostPoints: minPostPoints === "" ? undefined : Number(minPostPoints),
      minPostLevel: minPostLevel === "" ? undefined : Number(minPostLevel),
      minReplyPoints: minReplyPoints === "" ? undefined : Number(minReplyPoints),
      minReplyLevel: minReplyLevel === "" ? undefined : Number(minReplyLevel),
      minViewVipLevel: minViewVipLevel === "" ? undefined : Number(minViewVipLevel),
      minPostVipLevel: minPostVipLevel === "" ? undefined : Number(minPostVipLevel),
      minReplyVipLevel: minReplyVipLevel === "" ? undefined : Number(minReplyVipLevel),
      requirePostReview,
      postListDisplayMode,
      postListLoadMode,

    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/structure", {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const result = (await response.json().catch(() => null)) as { message?: string } | null
        const message = result?.message ?? (response.ok ? "保存成功" : "保存失败，请稍后重试")

        setForm((current) => ({
          ...current,
          feedback: message,
          feedbackTone: response.ok ? "success" : "error",
        }))

        if (response.ok) {
          router.refresh()
          onClose()
        }
      } catch {
        setForm((current) => ({
          ...current,
          feedback: "网络异常，请稍后重试",
          feedbackTone: "error",
        }))
      }
    })

  }

  return (
    <AdminModal open={Boolean(modal)} onClose={onClose} size="xl" title={title} description="统一维护分区默认策略与节点覆盖策略。">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={isBoard ? "节点名称" : "分区名称"} value={name} onChange={(value) => updateField("name", value)} placeholder={isBoard ? "如 摄影" : "如 生活方式"} />
          <Field label="标识 slug" value={slug} onChange={(value) => updateField("slug", value)} placeholder={isBoard ? "如 camera" : "如 lifestyle"} />
          <AdminIconPickerField
            label="图标"
            value={icon}
            onChange={(value) => updateField("icon", value)}
            popoverTitle={isBoard ? "选择节点图标" : "选择分区图标"}
            containerClassName="space-y-2 md:col-span-2"
            triggerClassName="flex h-11 w-full items-center gap-3 rounded-full border border-border bg-background px-4 text-left text-sm transition-colors hover:bg-accent"
            textareaRows={4}
          />


          <Field label="排序" value={sortOrder} onChange={(value) => updateField("sortOrder", value)} placeholder="数字越小越靠前" />
        </div>

        {!isBoard ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Toggle label="在左侧导航隐藏" checked={hiddenFromSidebar} onChange={(value) => updateField("hiddenFromSidebar", value)} />
          </div>
        ) : null}

        {isBoard ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">所属分区</p>
            {isModeratorBoardEdit ? (
              <div className="flex h-11 items-center rounded-full border border-border bg-background px-4 text-sm text-muted-foreground">
                {modal.kind === "edit-board" ? (modal.item.zoneName ?? "未分配分区") : "当前节点所属分区"}
              </div>
            ) : (
              <select value={zoneId} onChange={(event) => updateField("zoneId", event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none">
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>{zone.name}</option>
                ))}
              </select>
            )}
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-medium">描述</p>
          <textarea value={description} onChange={(event) => updateField("description", event.target.value)} placeholder="填写结构描述，帮助用户理解这个分区或节点的定位" className="min-h-[120px] w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm outline-none" />
        </div>

        {isBoard ? (
          <div className="rounded-[24px] ">
            <h4 className="text-sm font-semibold">节点侧栏</h4>
            <div className="mt-4 space-y-2">
              {sidebarLinks.length > 0 ? (
                <div className="hidden items-center gap-3 px-3 text-[11px] font-medium text-muted-foreground lg:grid lg:grid-cols-[120px_minmax(0,1fr)_110px_120px_80px]">
                  <span>图标 / 标题</span>
                  <span>URL</span>
                  <span>标题颜色</span>
                  <span className="text-right">操作</span>
                </div>
              ) : null}
              {sidebarLinks.map((item, index) => (
                <BoardSidebarLinkEditor
                  key={`sidebar-link-${index}`}
                  item={item}
                  index={index}
                  onChange={updateSidebarLink}
                  onRemove={removeSidebarLink}
                />
              ))}
              <Button type="button" variant="outline" className="h-9 rounded-full px-4 text-xs" onClick={addSidebarLink}>
                <Plus className="mr-2 h-4 w-4" />新增节点链接
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">节点规则 Markdown</p>
              <RefinedRichPostEditor value={rulesMarkdown} onChange={(value) => updateField("rulesMarkdown", value)} placeholder="留空时前台显示系统默认节点规则" minHeight={220} uploadFolder="posts" />

            </div>
            {!isModeratorBoardEdit ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Toggle label="版主可提取节点金库" checked={moderatorsCanWithdrawTreasury} onChange={(value) => updateField("moderatorsCanWithdrawTreasury", value)} />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-[24px] border border-border p-5">
          <h4 className="text-sm font-semibold">积分与频率设置</h4>
          {isModeratorBoardEdit ? (
            <p className="mt-2 text-xs leading-6 text-muted-foreground">编辑节点时，这四项只能填写留空、0 或负数；留空表示继续继承分区设置。</p>
          ) : null}
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="发帖积分" help={getStructureNumericFieldHelp({ field: "postPointDelta", isBoard, isModeratorBoardEdit })} value={postPointDelta} onChange={(value) => updateField("postPointDelta", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
            <Field label="回复积分" help={getStructureNumericFieldHelp({ field: "replyPointDelta", isBoard, isModeratorBoardEdit })} value={replyPointDelta} onChange={(value) => updateField("replyPointDelta", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
            <Field label="发帖间隔(秒)" help={getStructureNumericFieldHelp({ field: "postIntervalSeconds", isBoard, isModeratorBoardEdit })} value={postIntervalSeconds} onChange={(value) => updateField("postIntervalSeconds", value)} placeholder={isBoard ? "留空继承分区" : "默认 120"} />
            <Field label="回复间隔(秒)" help={getStructureNumericFieldHelp({ field: "replyIntervalSeconds", isBoard, isModeratorBoardEdit })} value={replyIntervalSeconds} onChange={(value) => updateField("replyIntervalSeconds", value)} placeholder={isBoard ? "留空继承分区" : "默认 3"} />
          </div>
        </div>

        <div className="rounded-[24px] border border-border p-5">
          <h4 className="text-sm font-semibold">支持的帖子类型</h4>
          <div className="mt-4 flex flex-wrap gap-3">
            {postTypeOptions.map((item) => (
              <label key={item.value} className={allowedPostTypes.includes(item.value) ? "inline-flex items-center gap-2 rounded-full border border-foreground bg-accent px-4 py-2 text-sm" : "inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm"}>
                <input type="checkbox" className="hidden" checked={allowedPostTypes.includes(item.value)} onChange={() => togglePostType(item.value)} />
                {item.label}
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-border p-5">
          <h4 className="text-sm font-semibold">浏览 / 发帖 / 回复权限</h4>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="浏览最低积分" help={getStructureAccessFieldHelp({ field: "minViewPoints", isBoard })} value={minViewPoints} onChange={(value) => updateField("minViewPoints", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
            <Field label="浏览最低等级" help={getStructureAccessFieldHelp({ field: "minViewLevel", isBoard })} value={minViewLevel} onChange={(value) => updateField("minViewLevel", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
            <Field label="浏览最低 VIP 等级" help={getStructureAccessFieldHelp({ field: "minViewVipLevel", isBoard })} value={minViewVipLevel} onChange={(value) => updateField("minViewVipLevel", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
            <Field label="发帖最低积分" help={getStructureAccessFieldHelp({ field: "minPostPoints", isBoard })} value={minPostPoints} onChange={(value) => updateField("minPostPoints", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
            <Field label="发帖最低等级" help={getStructureAccessFieldHelp({ field: "minPostLevel", isBoard })} value={minPostLevel} onChange={(value) => updateField("minPostLevel", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
            <Field label="发帖最低 VIP 等级" help={getStructureAccessFieldHelp({ field: "minPostVipLevel", isBoard })} value={minPostVipLevel} onChange={(value) => updateField("minPostVipLevel", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
            <Field label="回复最低积分" help={getStructureAccessFieldHelp({ field: "minReplyPoints", isBoard })} value={minReplyPoints} onChange={(value) => updateField("minReplyPoints", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
            <Field label="回复最低等级" help={getStructureAccessFieldHelp({ field: "minReplyLevel", isBoard })} value={minReplyLevel} onChange={(value) => updateField("minReplyLevel", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
            <Field label="回复最低 VIP 等级" help={getStructureAccessFieldHelp({ field: "minReplyVipLevel", isBoard })} value={minReplyVipLevel} onChange={(value) => updateField("minReplyVipLevel", value)} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Toggle label="开启发帖审核" checked={requirePostReview} onChange={(value) => updateField("requirePostReview", value)} />
          <div className="space-y-2 md:col-span-1 xl:col-span-2">
            <p className="text-sm font-medium">帖子列表形式</p>
            <select value={postListDisplayMode} onChange={(event) => updateField("postListDisplayMode", event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none">
              {isBoard ? <option value="">继承分区</option> : <option value="">默认列表</option>}
              <option value={POST_LIST_DISPLAY_MODE_DEFAULT}>普通列表</option>
              <option value={POST_LIST_DISPLAY_MODE_GALLERY}>画廊模式</option>
            </select>
            <p className="text-xs leading-6 text-muted-foreground">{isBoard ? "留空时自动继承分区；显式设置后优先使用节点自己的列表形式。" : "留空时使用站点默认普通列表；设置后该分区下未覆盖的节点会继承这里。"}</p>
          </div>
          <div className="space-y-2 md:col-span-1 xl:col-span-1">
            <p className="text-sm font-medium">帖子加载方式</p>
            <select value={postListLoadMode} onChange={(event) => updateField("postListLoadMode", event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none">
              {isBoard ? <option value="">继承分区</option> : <option value={POST_LIST_LOAD_MODE_PAGINATION}>分页加载</option>}
              {!isBoard ? null : <option value={POST_LIST_LOAD_MODE_PAGINATION}>分页加载</option>}
              <option value={POST_LIST_LOAD_MODE_INFINITE}>无限下拉</option>
            </select>
            <p className="text-xs leading-6 text-muted-foreground">{isBoard ? "留空时自动继承分区；显式设置后优先使用节点自己的加载方式。" : "分区可配置为传统分页或滚动到底自动继续加载。"}</p>
          </div>
        </div>


        <div className="space-y-3">
          {feedback ? (
            <div className={feedbackTone === "error" ? "flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" : "flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"}>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{feedback}</p>
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <Button disabled={isPending}>{isPending ? "保存中..." : isEdit ? "保存修改" : "确认创建"}</Button>
            <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
          </div>
        </div>

      </form>
    </AdminModal>
  )
}

function getInitialStructureFormState(modal: Exclude<ModalMode, null>, zones: ZoneItem[]): StructureFormState {
  const defaultZoneId = zones[0]?.id ?? ""

  if (modal.kind === "create-zone") {
    return {
      name: "",
      slug: "",
      description: "",
      icon: "📚",
      sidebarLinks: [],
      rulesMarkdown: "",
      moderatorsCanWithdrawTreasury: false,
      sortOrder: String(zones.length + 1),
      hiddenFromSidebar: false,
      zoneId: defaultZoneId,
      postPointDelta: "0",
      replyPointDelta: "0",
      postIntervalSeconds: "120",
      replyIntervalSeconds: "3",
      allowedPostTypes: DEFAULT_ALLOWED_POST_TYPES,
      minViewPoints: "0",
      minViewLevel: "0",
      minPostPoints: "0",
      minPostLevel: "0",
      minReplyPoints: "0",
      minReplyLevel: "0",
      minViewVipLevel: "0",
      minPostVipLevel: "0",
      minReplyVipLevel: "0",
      requirePostReview: false,
      postListDisplayMode: "",
      postListLoadMode: POST_LIST_LOAD_MODE_PAGINATION,
      feedback: "",
      feedbackTone: "success",
    }
  }

  if (modal.kind === "create-board") {
    return {
      name: "",
      slug: "",
      description: "",
      icon: "💬",
      sidebarLinks: [],
      rulesMarkdown: "",
      moderatorsCanWithdrawTreasury: false,
      sortOrder: "0",
      hiddenFromSidebar: false,
      zoneId: modal.zoneId ?? defaultZoneId,
      postPointDelta: "",
      replyPointDelta: "",
      postIntervalSeconds: "",
      replyIntervalSeconds: "",
      allowedPostTypes: DEFAULT_ALLOWED_POST_TYPES,
      minViewPoints: "",
      minViewLevel: "",
      minPostPoints: "",
      minPostLevel: "",
      minReplyPoints: "",
      minReplyLevel: "",
      minViewVipLevel: "",
      minPostVipLevel: "",
      minReplyVipLevel: "",
      requirePostReview: false,
      postListDisplayMode: "",
      postListLoadMode: "",
      feedback: "",
      feedbackTone: "success",
    }
  }

  if (modal.kind === "edit-zone") {
    return {
      name: modal.item.name,
      slug: modal.item.slug,
      description: modal.item.description,
      icon: modal.item.icon,
      sidebarLinks: [],
      rulesMarkdown: "",
      moderatorsCanWithdrawTreasury: false,
      sortOrder: String(modal.item.sortOrder),
      hiddenFromSidebar: modal.item.hiddenFromSidebar,
      zoneId: defaultZoneId,
      postPointDelta: String(modal.item.postPointDelta),
      replyPointDelta: String(modal.item.replyPointDelta),
      postIntervalSeconds: String(modal.item.postIntervalSeconds),
      replyIntervalSeconds: String(modal.item.replyIntervalSeconds),
      allowedPostTypes: normalizePostTypes(modal.item.allowedPostTypes),
      minViewPoints: String(modal.item.minViewPoints),
      minViewLevel: String(modal.item.minViewLevel),
      minPostPoints: String(modal.item.minPostPoints),
      minPostLevel: String(modal.item.minPostLevel),
      minReplyPoints: String(modal.item.minReplyPoints),
      minReplyLevel: String(modal.item.minReplyLevel),
      minViewVipLevel: String(modal.item.minViewVipLevel),
      minPostVipLevel: String(modal.item.minPostVipLevel),
      minReplyVipLevel: String(modal.item.minReplyVipLevel),
      requirePostReview: modal.item.requirePostReview,
      postListDisplayMode: modal.item.postListDisplayMode ?? "",
      postListLoadMode: modal.item.postListLoadMode ?? POST_LIST_LOAD_MODE_PAGINATION,
      feedback: "",
      feedbackTone: "success",
    }
  }

  return {
    name: modal.item.name,
    slug: modal.item.slug,
    description: modal.item.description ?? "",
    icon: modal.item.icon ?? "💬",
    sidebarLinks: modal.item.sidebarLinks.length > 0 ? modal.item.sidebarLinks.map((item) => ({ ...item })) : [],
    rulesMarkdown: modal.item.rulesMarkdown ?? "",
    moderatorsCanWithdrawTreasury: Boolean(modal.item.moderatorsCanWithdrawTreasury),
    sortOrder: String(modal.item.sortOrder ?? 0),
    hiddenFromSidebar: false,
    zoneId: modal.item.zoneId ?? defaultZoneId,
    postPointDelta: modal.item.postPointDelta == null ? "" : String(modal.item.postPointDelta),
    replyPointDelta: modal.item.replyPointDelta == null ? "" : String(modal.item.replyPointDelta),
    postIntervalSeconds: modal.item.postIntervalSeconds == null ? "" : String(modal.item.postIntervalSeconds),
    replyIntervalSeconds: modal.item.replyIntervalSeconds == null ? "" : String(modal.item.replyIntervalSeconds),
    allowedPostTypes: normalizePostTypes(modal.item.allowedPostTypes),
    minViewPoints: modal.item.minViewPoints == null ? "" : String(modal.item.minViewPoints),
    minViewLevel: modal.item.minViewLevel == null ? "" : String(modal.item.minViewLevel),
    minPostPoints: modal.item.minPostPoints == null ? "" : String(modal.item.minPostPoints),
    minPostLevel: modal.item.minPostLevel == null ? "" : String(modal.item.minPostLevel),
    minReplyPoints: modal.item.minReplyPoints == null ? "" : String(modal.item.minReplyPoints),
    minReplyLevel: modal.item.minReplyLevel == null ? "" : String(modal.item.minReplyLevel),
    minViewVipLevel: modal.item.minViewVipLevel == null ? "" : String(modal.item.minViewVipLevel),
    minPostVipLevel: modal.item.minPostVipLevel == null ? "" : String(modal.item.minPostVipLevel),
    minReplyVipLevel: modal.item.minReplyVipLevel == null ? "" : String(modal.item.minReplyVipLevel),
    requirePostReview: Boolean(modal.item.requirePostReview),
    postListDisplayMode: modal.item.postListDisplayMode ?? "",
    postListLoadMode: modal.item.postListLoadMode ?? "",
    feedback: "",
    feedbackTone: "success",
  }
}

function getStructureModalKey(modal: Exclude<ModalMode, null>) {
  if (modal.kind === "create-zone") return "create-zone"
  if (modal.kind === "create-board") return `create-board:${modal.zoneId ?? "default"}`
  if (modal.kind === "edit-zone") return `edit-zone:${modal.item.id}`
  return `edit-board:${modal.item.id}`
}

function getStructureModalTitle(modal: Exclude<ModalMode, null>) {
  if (modal.kind === "create-zone") return "新建分区"
  if (modal.kind === "create-board") return "新建节点"
  if (modal.kind === "edit-zone") return "编辑分区"
  return "编辑节点"
}

function getStructureNumericFieldHelp({
  field,
  isBoard,
  isModeratorBoardEdit,
}: {
  field: "postPointDelta" | "replyPointDelta" | "postIntervalSeconds" | "replyIntervalSeconds"
  isBoard: boolean
  isModeratorBoardEdit: boolean
}) {
  const isPointsField = field === "postPointDelta" || field === "replyPointDelta"
  const inheritText = isBoard ? "留空：继承所属分区的设置。" : "分区建议直接填写明确数值；留空时会回落到系统默认值。"
  const zeroText = isPointsField ? "填写 0：不加分也不扣分。" : "填写 0：不限制操作频率。"
  const negativeText = isPointsField ? "填写负数：执行操作时扣除对应积分。" : "填写负数：系统会按“无频率限制”处理。"
  const positiveText = isPointsField ? "填写正数：执行成功后奖励对应积分。" : "填写正数：要求用户等待这么多秒后才能再次操作。"

  return (
    <div className="space-y-1.5 text-[12px] leading-5">
      <p>{inheritText}</p>
      <p>{zeroText}</p>
      <p>{negativeText}</p>
      {!isModeratorBoardEdit ? <p>{positiveText}</p> : <p>版主编辑节点时：只能填写留空、0 或负数，不能填写正数。</p>}
    </div>
  )
}

function getStructureAccessFieldHelp({
  field,
  isBoard,
}: {
  field:
    | "minViewPoints"
    | "minViewLevel"
    | "minPostPoints"
    | "minPostLevel"
    | "minReplyPoints"
    | "minReplyLevel"
    | "minViewVipLevel"
    | "minPostVipLevel"
    | "minReplyVipLevel"
  isBoard: boolean
}) {
  const inheritText = isBoard ? "留空：继承所属分区的限制。" : "分区建议直接填写明确数值；留空时会回落到系统默认值。"
  const isVipField = field === "minViewVipLevel" || field === "minPostVipLevel" || field === "minReplyVipLevel"
  const isLevelField = field === "minViewLevel" || field === "minPostLevel" || field === "minReplyLevel"
  const actionText = field.startsWith("minView") ? "浏览" : field.startsWith("minPost") ? "发帖" : "回复"
  const thresholdText = isVipField
    ? `填写数值：只有 VIP 等级大于等于该值的用户才能${actionText}。`
    : isLevelField
      ? `填写数值：只有等级大于等于该值的用户才能${actionText}。`
      : `填写数值：只有积分大于等于该值的用户才能${actionText}。`
  const zeroText = "填写 0：不额外限制这项权限。"

  return (
    <div className="space-y-1.5 text-[12px] leading-5">
      <p>{inheritText}</p>
      <p>{zeroText}</p>
      <p>{thresholdText}</p>
    </div>
  )
}

function getInitialBoardApplicationReviewState(application: BoardApplicationItem | null): BoardApplicationReviewFormState {
  return {
    zoneId: application?.zone.id ?? "",
    name: application?.name ?? "",
    slug: application?.slug ?? "",
    description: application?.description ?? "",
    icon: application?.icon ?? "💬",
    reason: application?.reason ?? "",
    reviewNote: application?.reviewNote ?? "",
  }
}

function BoardApplicationReviewModal({
  application,
  zones,
  onClose,
}: {
  application: BoardApplicationItem | null
  zones: ZoneItem[]
  onClose: () => void
}) {
  const router = useRouter()
  const [form, setForm] = useState<BoardApplicationReviewFormState>(() => getInitialBoardApplicationReviewState(application))
  const [isPending, startTransition] = useTransition()

  if (!application) {
    return null
  }

  const currentApplication = application

  function updateField<K extends keyof BoardApplicationReviewFormState>(field: K, value: BoardApplicationReviewFormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function runReviewAction(action: "update" | "approve" | "reject") {
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/board-applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: currentApplication.id,
            action,
            zoneId: form.zoneId,
            name: form.name,
            slug: form.slug,
            description: form.description,
            icon: form.icon,
            reason: form.reason,
            reviewNote: form.reviewNote,
          }),
        })
        const result = await response.json().catch(() => null) as { message?: string } | null

        if (!response.ok) {
          toast.error(result?.message ?? "处理节点申请失败", "节点申请")
          return
        }

        toast.success(result?.message ?? "节点申请已处理", "节点申请")
        router.refresh()
        onClose()
      } catch {
        toast.error("处理节点申请失败", "节点申请")
      }
    })
  }

  return (
    <AdminFormModal
      open
      onClose={onClose}
      closeDisabled={isPending}
      closeOnEscape={!isPending}
      size="lg"
      title={currentApplication.status === "PENDING" ? "审核节点申请" : "查看节点申请"}
      description={`申请人 @${currentApplication.applicant.username}，提交于 ${new Date(currentApplication.createdAt).toLocaleString("zh-CN")}`}
      onSubmit={(event) => {
        event.preventDefault()
        runReviewAction("update")
      }}
      footer={({ formId }) => (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" form={formId} variant="outline" disabled={isPending}>
            {isPending ? "保存中..." : "保存修改"}
          </Button>
          {currentApplication.status === "PENDING" ? (
            <>
              <Button type="button" disabled={isPending} onClick={() => runReviewAction("approve")}>
                通过并创建节点
              </Button>
              <Button type="button" variant="outline" disabled={isPending} onClick={() => runReviewAction("reject")}>
                驳回申请
              </Button>
            </>
          ) : null}
          <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>
            关闭
          </Button>
        </div>
      )}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">所属分区</p>
          <select value={form.zoneId} onChange={(event) => updateField("zoneId", event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none">
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>{zone.name}</option>
            ))}
          </select>
        </div>
        <Field label="节点名称" value={form.name} onChange={(value) => updateField("name", value)} placeholder="请输入节点名称" />
        <Field label="slug" value={form.slug} onChange={(value) => updateField("slug", value)} placeholder="例如 photography" />
        <Field label="图标" value={form.icon} onChange={(value) => updateField("icon", value)} placeholder="例如 📷" />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">节点描述</p>
        <textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} className="min-h-[120px] w-full rounded-[20px] border border-border bg-background px-4 py-3 text-sm outline-none" placeholder="补充这个节点的定位和用途" />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">申请理由</p>
        <textarea value={form.reason} onChange={(event) => updateField("reason", event.target.value)} className="min-h-[120px] w-full rounded-[20px] border border-border bg-background px-4 py-3 text-sm outline-none" placeholder="申请人补充说明为什么需要这个节点" />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">审核备注</p>
        <textarea value={form.reviewNote} onChange={(event) => updateField("reviewNote", event.target.value)} className="min-h-[100px] w-full rounded-[20px] border border-border bg-background px-4 py-3 text-sm outline-none" placeholder="填写审核意见、补充说明或驳回原因" />
      </div>

      <div className="rounded-[18px] border border-border bg-background/70 px-4 py-3 text-xs text-muted-foreground">
        <p>申请人：@{currentApplication.applicant.username}（{currentApplication.applicant.displayName}）</p>
        <p className="mt-1">当前状态：{getBoardApplicationStatusLabel(currentApplication.status)}</p>
        {currentApplication.board ? <p className="mt-1">已创建节点：/boards/{currentApplication.board.slug} · 节点金库 {formatNumber(currentApplication.board.treasuryPoints)}</p> : null}
      </div>
    </AdminFormModal>
  )
}

function getBoardApplicationStatusLabel(status: BoardApplicationItem["status"]) {
  if (status === "APPROVED") return "已通过"
  if (status === "REJECTED") return "已驳回"
  if (status === "CANCELLED") return "已取消"
  return "待审核"
}

function BoardApplicationStatusBadge({ status }: { status: BoardApplicationItem["status"] }) {
  const className = status === "APPROVED"
    ? "rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] text-emerald-700"
    : status === "REJECTED"
      ? "rounded-full bg-rose-100 px-2.5 py-1 text-[11px] text-rose-700"
      : status === "CANCELLED"
        ? "rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-700"
        : "rounded-full bg-amber-100 px-2.5 py-1 text-[11px] text-amber-700"

  return <span className={className}>{getBoardApplicationStatusLabel(status)}</span>
}

function BoardSidebarLinkEditor({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: BoardSidebarLinkDraft
  index: number
  onChange: (index: number, key: keyof BoardSidebarLinkDraft, value: BoardSidebarLinkDraft[keyof BoardSidebarLinkDraft]) => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="rounded-[18px] border border-border bg-card/60 p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(360px,1.6fr)_110px_72px] lg:items-center">
        <div className="flex items-center gap-2">
          <AdminIconPickerField
            label="图标"
            value={item.icon ?? ""}
            onChange={(value) => onChange(index, "icon", value.trim() ? value : null)}
            popoverTitle="选择节点链接图标"
            containerClassName="shrink-0"
            triggerClassName="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-background text-left text-sm transition-colors hover:bg-accent"
            textareaRows={3}
            hideLabel
            triggerMode="icon"
          />
          <input
            value={item.title}
            onChange={(event) => onChange(index, "title", event.target.value)}
            placeholder="标题"
            className="h-9 min-w-0 flex-1 rounded-full border border-border bg-background px-3 text-sm outline-none"
          />
        </div>
        <input
          value={item.url}
          onChange={(event) => onChange(index, "url", event.target.value)}
          placeholder="/help/pkq 或 https://example.com"
          className="h-9 min-w-0 rounded-full border border-border bg-background px-3 text-sm outline-none"
        />
        <BoardSidebarLinkColorField value={item.titleColor ?? ""} onChange={(value) => onChange(index, "titleColor", value || null)} />
        <div className="flex justify-end">
          <Button type="button" variant="outline" className="h-9 rounded-full px-3 text-xs" onClick={() => onRemove(index)}>删除</Button>
        </div>
      </div>
    </div>
  )
}

function BoardSidebarLinkColorField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const normalizedValue = normalizeHexColor(value || "#111827", "#111827")

  return (
    <div className="relative">
      <PickerTriggerField value={value || normalizedValue} previewColor={value || normalizedValue} fallbackColor="#111827" onClick={() => setOpen((current) => !current)} />
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-[280px]">
          <PickerPopover title="选择标题颜色" onClose={() => setOpen(false)}>
            <div className="flex items-center gap-2">
              <input type="color" value={normalizedValue} onChange={(event) => onChange(event.target.value)} className="h-8 w-10 cursor-pointer rounded-lg border border-border bg-background p-0.5" aria-label="选择标题颜色" />
              <input value={value} onChange={(event) => onChange(event.target.value)} className="h-8 w-28 rounded-full border border-border bg-background px-3 text-xs outline-none" placeholder="#111827" />
              <Button type="button" variant="ghost" className="h-8 rounded-full px-3 text-xs" onClick={() => onChange("")}>清空</Button>
            </div>
          </PickerPopover>
        </div>
      ) : null}
    </div>
  )
}

function Field({
  label,
  help,
  value,
  onChange,
  placeholder,
}: {
  label: string
  help?: React.ReactNode
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-medium">{label}</p>
        {help ? (
          <Tooltip content={help} contentClassName="max-w-[320px]" enableMobileTap>
            <button type="button" className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground" aria-label={`${label}填写说明`}>
              <CircleHelp className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        ) : null}
      </div>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" />
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {


  return (
    <label className="flex h-11 items-center justify-between rounded-full border border-border bg-background px-4 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}
