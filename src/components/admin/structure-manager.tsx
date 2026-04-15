"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  Building2,
  EyeOff,
  FolderTree,
  Plus,
  ShieldCheck,
  Slash,
  Trash2,
} from "lucide-react"

import {
  AdminFilterActions,
  AdminFilterCard,
  AdminFilterSearchField,
  AdminFilterSelectField as SharedAdminFilterSelectField,
} from "@/components/admin/admin-filter-card"
import {
  StructureAccessTab,
  StructureBasicTab,
  StructureContentTab,
  StructurePolicyTab,
} from "@/components/admin/admin-structure-form-tabs"
import {
  boardStatusOptions,
  createEmptyBoardSidebarLink,
  getBoardHomeFeedVisibilityLabel,
  getBoardStatusBadgeClassName,
  getZoneHomeFeedVisibilityLabel,
  MetricBadge,
  postingOptions,
} from "@/components/admin/admin-structure.shared"
import type {
  BoardSidebarLinkDraft,
  ModalMode,
  StructureFormState,
  StructureFormTab,
  StructureManagerProps,
} from "@/components/admin/admin-structure.types"
import { AdminSummaryStrip } from "@/components/admin/admin-summary-strip"
import { showConfirm } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { LevelIcon } from "@/components/level-icon"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Modal } from "@/components/ui/modal"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import type { BoardItem, ZoneItem } from "@/lib/admin-structure-management"
import { formatNumber } from "@/lib/formatters"
import { DEFAULT_ALLOWED_POST_TYPES, normalizePostTypes } from "@/lib/post-types"
import { POST_LIST_LOAD_MODE_PAGINATION } from "@/lib/post-list-load-mode"
import { cn } from "@/lib/utils"

export function StructureManager({
  zones,
  boards,
  permissions,
  canReviewBoardApplications,
  pendingBoardApplicationCount,
  initialFilters,
}: StructureManagerProps) {
  const [modal, setModal] = useState<ModalMode>(null)
  const [filters, setFilters] = useState(initialFilters)
  const [selectedZoneId, setSelectedZoneId] = useState(
    initialFilters.zoneId || zones[0]?.id || "",
  )

  const filteredZones = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase()

    return zones.filter((zone) => {
      if (filters.zoneId && zone.id !== filters.zoneId) {
        return false
      }

      if (!keyword) {
        return true
      }

      return [zone.name, zone.slug, zone.description].some((item) =>
        item.toLowerCase().includes(keyword),
      )
    })
  }, [filters.keyword, filters.zoneId, zones])

  const visibleZoneId = filteredZones.some((zone) => zone.id === selectedZoneId)
    ? selectedZoneId
    : filters.zoneId || filteredZones[0]?.id || zones[0]?.id || ""

  const filteredBoards = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase()

    return boards.filter((board) => {
      if (visibleZoneId && board.zoneId !== visibleZoneId) {
        return false
      }
      if (filters.boardStatus !== "ALL" && board.status !== filters.boardStatus) {
        return false
      }
      if (filters.posting === "on" && !board.allowPost) {
        return false
      }
      if (filters.posting === "off" && board.allowPost) {
        return false
      }
      if (!keyword) {
        return true
      }

      return [board.name, board.slug, board.description ?? "", board.zoneName ?? ""].some(
        (item) => item.toLowerCase().includes(keyword),
      )
    })
  }, [boards, filters.boardStatus, filters.keyword, filters.posting, visibleZoneId])

  const summary = useMemo(
    () => ({
      zoneCount: zones.length,
      boardCount: boards.length,
      activeBoardCount: boards.filter((board) => board.status === "ACTIVE").length,
      hiddenBoardCount: boards.filter((board) => board.status === "HIDDEN").length,
      reviewBoardCount: boards.filter((board) => board.requirePostReview || board.requireCommentReview).length,
      lockedPostingBoardCount: boards.filter((board) => !board.allowPost).length,
    }),
    [boards, zones.length],
  )

  const zoneCards = useMemo(
    () =>
      filteredZones.map((zone) => ({
        ...zone,
        boards: boards.filter((board) => board.zoneId === zone.id),
      })),
    [boards, filteredZones],
  )
  const activeZone = zones.find((zone) => zone.id === visibleZoneId) ?? null

  const activeFilterBadges = useMemo(() => {
    const badges: string[] = []

    if (filters.keyword.trim()) {
      badges.push(`关键词: ${filters.keyword.trim()}`)
    }
    if (filters.zoneId) {
      badges.push(`分区: ${zones.find((zone) => zone.id === filters.zoneId)?.name ?? filters.zoneId}`)
    }
    if (filters.boardStatus !== "ALL") {
      badges.push(`节点状态: ${boardStatusOptions.find((item) => item.value === filters.boardStatus)?.label ?? filters.boardStatus}`)
    }
    if (filters.posting !== "ALL") {
      badges.push(`发帖权限: ${postingOptions.find((item) => item.value === filters.posting)?.label ?? filters.posting}`)
    }

    return badges
  }, [filters, zones])

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
      <AdminFilterCard
        title="分区与节点筛选"
        description="按分区、节点状态和发帖权限快速收敛管理范围。"
        badge={<Badge variant="secondary" className="rounded-full">分区 {formatNumber(filteredZones.length)} / 节点 {formatNumber(filteredBoards.length)}</Badge>}
        activeBadges={activeFilterBadges}
      >
        <form className="grid gap-2 xl:grid-cols-[minmax(180px,1.5fr)_120px_110px_110px_auto] xl:items-end">
          <input type="hidden" name="tab" value="structure" />
          <input type="hidden" name="structureZoneId" value={filters.zoneId} />
          <input type="hidden" name="structureBoardStatus" value={filters.boardStatus} />
          <input type="hidden" name="structurePosting" value={filters.posting} />
          <AdminFilterSearchField
            label="搜索分区 / 节点"
            name="structureKeyword"
            value={filters.keyword}
            onChange={(value) => setFilters((current) => ({ ...current, keyword: value }))}
            placeholder="名称 / slug / 描述"
          />
          <SharedAdminFilterSelectField
            label="聚焦分区"
            value={filters.zoneId}
            onValueChange={(value) => {
              setFilters((current) => ({ ...current, zoneId: value }))
              setSelectedZoneId(value)
            }}
            options={[{ value: "", label: "全部分区" }, ...zones.map((zone) => ({ value: zone.id, label: zone.name }))]}
          />
          <SharedAdminFilterSelectField label="节点状态" value={filters.boardStatus} onValueChange={(value) => setFilters((current) => ({ ...current, boardStatus: value }))} options={boardStatusOptions} />
          <SharedAdminFilterSelectField label="发帖权限" value={filters.posting} onValueChange={(value) => setFilters((current) => ({ ...current, posting: value }))} options={postingOptions} />
          <AdminFilterActions submitLabel="筛选" resetHref="/admin?tab=structure" />
        </form>
      </AdminFilterCard>

      <AdminSummaryStrip
        items={[
          { label: "分区总数", value: summary.zoneCount, icon: <FolderTree className="h-4 w-4" /> },
          { label: "节点总数", value: summary.boardCount, icon: <Building2 className="h-4 w-4" /> },
          { label: "启用节点", value: summary.activeBoardCount, icon: <ShieldCheck className="h-4 w-4" />, tone: "emerald" },
          { label: "隐藏节点", value: summary.hiddenBoardCount, icon: <EyeOff className="h-4 w-4" />, tone: "slate" },
          { label: "审核节点", value: summary.reviewBoardCount, icon: <ShieldCheck className="h-4 w-4" />, tone: "amber" },
          { label: "暂停发帖", value: summary.lockedPostingBoardCount, icon: <Slash className="h-4 w-4" />, tone: "rose" },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader className="border-b">
            <CardTitle>分区总览</CardTitle>
            <CardDescription>先选中一个分区，再集中管理它下面的节点。</CardDescription>
            {permissions.canCreateZone ? (
              <CardAction>
                <Button type="button" className="h-8 rounded-full px-3 text-xs" onClick={() => setModal({ kind: "create-zone" })}>
                  <Plus className="mr-1 h-3.5 w-3.5" />新建分区
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2 py-4">
            {zoneCards.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                当前筛选条件下没有分区。
              </div>
            ) : null}
            {zoneCards.map((zone) => {
              const active = visibleZoneId === zone.id
              return (
                <button key={zone.id} type="button" onClick={() => setSelectedZoneId(zone.id)} className="block w-full rounded-[18px] text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50">
                  <Card size="sm" className={cn("py-0 transition-colors", active ? "bg-accent ring-1 ring-foreground/15" : "hover:bg-muted/35")}>
                    <CardContent className="space-y-2 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <LevelIcon
                              icon={zone.icon}
                              className="h-5 w-5 shrink-0 text-base"
                              emojiClassName="text-inherit leading-none"
                              svgClassName="[&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                              title={`${zone.name} 图标`}
                            />
                            <span className="truncate text-sm font-semibold">{zone.name}</span>
                          </div>
                          <p className="mt-1 truncate text-[11px] text-muted-foreground">/{zone.slug} · 排序 {zone.sortOrder}</p>
                        </div>
                        <Badge variant="secondary" className="rounded-full">{zone.boards.length} 节点</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline">帖 {formatNumber(zone.postCount)}</Badge>
                        <Badge variant="outline">关注 {formatNumber(zone.followerCount)}</Badge>
                        <Badge variant="outline">{zone.requirePostReview ? "发帖审核" : "帖子直发"}</Badge>
                        <Badge variant="outline">{zone.requireCommentReview ? "回帖审核" : "回帖直发"}</Badge>
                        <Badge variant="outline">{getZoneHomeFeedVisibilityLabel(zone)}</Badge>
                        <Badge variant="outline">{zone.hiddenFromSidebar ? "左侧导航隐藏" : "左侧导航显示"}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <CardTitle>节点工作台</CardTitle>
                <CardDescription>围绕当前分区集中查看节点状态、发帖权限、审核策略和流量表现。</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {visibleZoneId && activeZone?.canEditSettings ? <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => setModal({ kind: "edit-zone", item: activeZone })}>编辑分区</Button> : null}
                {permissions.canDeleteZone && activeZone ? <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={handleDeleteZone}>删除分区</Button> : null}
                {permissions.canCreateBoard ? <Button type="button" className="h-8 rounded-full px-3 text-xs" onClick={() => setModal({ kind: "create-board", zoneId: visibleZoneId })}><Plus className="mr-1 h-3.5 w-3.5" />新建节点</Button> : null}
                {canReviewBoardApplications ? <Link href="/admin?tab=board-applications" className={cn(buttonVariants({ variant: "outline", size: "default" }), "h-8 rounded-full px-3 text-xs")}>节点申请{pendingBoardApplicationCount > 0 ? ` ${pendingBoardApplicationCount}` : ""}</Link> : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0 py-0">
            {!activeZone ? (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">当前没有可管理的分区。</div>
            ) : filteredBoards.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下没有节点。</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>节点</TableHead>
                    <TableHead className="w-[210px]">状态与权限</TableHead>
                    <TableHead className="w-[200px]">流量</TableHead>
                    <TableHead className="w-[260px]">策略</TableHead>
                    <TableHead className="w-[240px] text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBoards.map((board) => (
                    <BoardRow key={board.id} board={board} canDelete={permissions.canDeleteBoard} onEdit={() => setModal({ kind: "edit-board", item: board })} />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <StructureModal modal={modal} zones={zones} isSiteAdmin={permissions.canCreateBoard} onClose={() => setModal(null)} />
    </div>
  )
}

function BoardRow({
  board,
  canDelete,
  onEdit,
}: {
  board: BoardItem
  canDelete: boolean
  onEdit: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  async function runAction(
    type: "PUT" | "DELETE",
    body: Record<string, unknown>,
    successMessage: string,
  ) {
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
    <TableRow>
      <TableCell className="align-top">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <LevelIcon
              icon={board.icon}
              className="h-5 w-5 shrink-0 text-base"
              emojiClassName="text-inherit leading-none"
              svgClassName="[&>svg]:block [&>svg]:h-full [&>svg]:w-full"
              title={`${board.name} 图标`}
            />
            <span className="truncate text-sm font-semibold">{board.name}</span>
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">/{board.slug} · 所属分区 {board.zoneName ?? "未分配"} · 排序 {board.sortOrder}</p>
          {board.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{board.description}</p>
          ) : null}
        </div>
      </TableCell>

      <TableCell className="align-top">
        <div className="flex flex-wrap gap-1.5">
          <Badge className={getBoardStatusBadgeClassName(board.status)}>{board.status}</Badge>
          <Badge variant="outline">{board.allowPost ? "允许发帖" : "暂停发帖"}</Badge>
          <Badge variant="outline">{board.requirePostReview ? "发帖审核" : "帖子直发"}</Badge>
          <Badge variant="outline">{board.requireCommentReview ? "回帖审核" : "回帖直发"}</Badge>
        </div>
      </TableCell>

      <TableCell className="align-top">
        <div className="grid gap-1.5 sm:grid-cols-2">
          <MetricBadge label="帖子" value={board.postCount} />
          <MetricBadge label="关注" value={board.followerCount} />
          <MetricBadge label="今日" value={board.todayPostCount} />
          <MetricBadge label="金库" value={board.treasuryPoints} />
        </div>
      </TableCell>

      <TableCell className="align-top">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">发帖 {board.postPointDelta ?? "继承"}</Badge>
          <Badge variant="outline">回复 {board.replyPointDelta ?? "继承"}</Badge>
          <Badge variant="outline">间隔 {board.postIntervalSeconds ?? "继承"}</Badge>
          <Badge variant="outline">VIP {board.minPostVipLevel ?? 0}</Badge>
          <Badge variant="outline">{board.moderatorsCanWithdrawTreasury ? "版主可提金库" : "仅管理员提金库"}</Badge>
          <Badge variant="outline">{getBoardHomeFeedVisibilityLabel(board)}</Badge>
          <Badge variant="outline">列表 {board.postListDisplayMode === "GALLERY" ? "画廊" : board.postListDisplayMode === "DEFAULT" ? "普通" : "继承分区"}</Badge>
          <Badge variant="outline">加载 {board.postListLoadMode === "INFINITE" ? "无限下拉" : board.postListLoadMode === "PAGINATION" ? "分页" : "继承分区"}</Badge>
        </div>
      </TableCell>

      <TableCell className="align-top">
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
      </TableCell>
    </TableRow>
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
  const [activeTab, setActiveTab] = useState<StructureFormTab>("basic")
  const [isPending, startTransition] = useTransition()
  const title = getStructureModalTitle(modal)

  const isBoard = modal.kind === "create-board" || modal.kind === "edit-board"
  const isEdit = modal.kind === "edit-zone" || modal.kind === "edit-board"
  const isModeratorBoardEdit = isBoard && isEdit && !isSiteAdmin
  const editingItemId = modal.kind === "edit-zone" || modal.kind === "edit-board" ? modal.item.id : undefined

  const formTabs: Array<{ key: StructureFormTab; label: string; hint: string }> = isBoard
    ? [
        { key: "basic", label: "基础信息", hint: "名称、slug、图标、所属分区" },
        { key: "content", label: "内容展示", hint: "描述、侧栏链接、节点规则" },
        { key: "policy", label: "策略设置", hint: "积分、频率、列表呈现" },
        { key: "access", label: "权限审核", hint: "访问门槛与审核策略" },
      ]
    : [
        { key: "basic", label: "基础信息", hint: "名称、slug、图标、描述" },
        { key: "policy", label: "策略设置", hint: "积分、频率、帖子列表" },
        { key: "access", label: "权限审核", hint: "访问门槛与审核策略" },
      ]
  const activeTabMeta = formTabs.find((tab) => tab.key === activeTab) ?? formTabs[0]

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
        { label: "发帖积分", value: form.postPointDelta },
        { label: "回复积分", value: form.replyPointDelta },
        { label: "发帖间隔", value: form.postIntervalSeconds },
        { label: "回复间隔", value: form.replyIntervalSeconds },
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
      name: form.name,
      slug: form.slug,
      description: form.description,
      sortOrder: Number(form.sortOrder) || 0,
      icon: form.icon,
      sidebarLinks: isBoard ? form.sidebarLinks : undefined,
      rulesMarkdown: isBoard ? form.rulesMarkdown : undefined,
      moderatorsCanWithdrawTreasury: isBoard && !isModeratorBoardEdit ? form.moderatorsCanWithdrawTreasury : undefined,
      hiddenFromSidebar: isBoard ? undefined : form.hiddenFromSidebar,
      zoneId: isBoard ? form.zoneId : undefined,
      id: editingItemId,
      postPointDelta: form.postPointDelta === "" ? undefined : Number(form.postPointDelta),
      replyPointDelta: form.replyPointDelta === "" ? undefined : Number(form.replyPointDelta),
      postIntervalSeconds: form.postIntervalSeconds === "" ? undefined : Number(form.postIntervalSeconds),
      replyIntervalSeconds: form.replyIntervalSeconds === "" ? undefined : Number(form.replyIntervalSeconds),
      allowedPostTypes: form.allowedPostTypes,
      minViewPoints: form.minViewPoints === "" ? undefined : Number(form.minViewPoints),
      minViewLevel: form.minViewLevel === "" ? undefined : Number(form.minViewLevel),
      minPostPoints: form.minPostPoints === "" ? undefined : Number(form.minPostPoints),
      minPostLevel: form.minPostLevel === "" ? undefined : Number(form.minPostLevel),
      minReplyPoints: form.minReplyPoints === "" ? undefined : Number(form.minReplyPoints),
      minReplyLevel: form.minReplyLevel === "" ? undefined : Number(form.minReplyLevel),
      minViewVipLevel: form.minViewVipLevel === "" ? undefined : Number(form.minViewVipLevel),
      minPostVipLevel: form.minPostVipLevel === "" ? undefined : Number(form.minPostVipLevel),
      minReplyVipLevel: form.minReplyVipLevel === "" ? undefined : Number(form.minReplyVipLevel),
      requirePostReview: form.requirePostReview,
      requireCommentReview: form.requireCommentReview,
      showInHomeFeed: form.showInHomeFeed,
      postListDisplayMode: form.postListDisplayMode,
      postListLoadMode: form.postListLoadMode,
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
    <Modal open={Boolean(modal)} onClose={onClose} size="xl" title={title} description="统一维护分区默认策略与节点覆盖策略。">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-[24px] border border-border bg-card/40 p-2">
          <div className="flex flex-wrap gap-2">
            {formTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={tab.key === activeTab
                  ? "inline-flex items-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
                  : "inline-flex items-center rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="px-2 pt-3 text-xs leading-6 text-muted-foreground">{activeTabMeta.hint}</p>
        </div>

        {activeTab === "basic" ? <StructureBasicTab modal={modal} zones={zones} form={form} isBoard={isBoard} isModeratorBoardEdit={isModeratorBoardEdit} updateField={updateField} togglePostType={togglePostType} updateSidebarLink={updateSidebarLink} addSidebarLink={addSidebarLink} removeSidebarLink={removeSidebarLink} /> : null}

        {isBoard && activeTab === "content" ? <StructureContentTab modal={modal} zones={zones} form={form} isBoard={isBoard} isModeratorBoardEdit={isModeratorBoardEdit} updateField={updateField} togglePostType={togglePostType} updateSidebarLink={updateSidebarLink} addSidebarLink={addSidebarLink} removeSidebarLink={removeSidebarLink} /> : null}

        {activeTab === "policy" ? <StructurePolicyTab modal={modal} zones={zones} form={form} isBoard={isBoard} isModeratorBoardEdit={isModeratorBoardEdit} updateField={updateField} togglePostType={togglePostType} updateSidebarLink={updateSidebarLink} addSidebarLink={addSidebarLink} removeSidebarLink={removeSidebarLink} /> : null}

        {activeTab === "access" ? <StructureAccessTab modal={modal} zones={zones} form={form} isBoard={isBoard} isModeratorBoardEdit={isModeratorBoardEdit} updateField={updateField} togglePostType={togglePostType} updateSidebarLink={updateSidebarLink} addSidebarLink={addSidebarLink} removeSidebarLink={removeSidebarLink} /> : null}

        <div className="space-y-3">
          {form.feedback ? (
            <div className={form.feedbackTone === "error" ? "flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" : "flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"}>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{form.feedback}</p>
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isPending}>{isPending ? "保存中..." : isEdit ? "保存修改" : "确认创建"}</Button>
            <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
          </div>
        </div>
      </form>
    </Modal>
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
      requireCommentReview: false,
      showInHomeFeed: "true",
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
      requireCommentReview: false,
      showInHomeFeed: "",
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
      requireCommentReview: modal.item.requireCommentReview,
      showInHomeFeed: String(modal.item.showInHomeFeed),
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
    requireCommentReview: Boolean(modal.item.requireCommentReview),
    showInHomeFeed: modal.item.showInHomeFeed == null ? "" : String(modal.item.showInHomeFeed),
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
