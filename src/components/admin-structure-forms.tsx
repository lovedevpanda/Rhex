"use client"

import { AlertCircle, Building2, EyeOff, FolderTree, Plus, Search, ShieldCheck, Slash, Trash2 } from "lucide-react"

import { useEffect, useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { AdminModal } from "@/components/admin-modal"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"

import type { BoardItem, ZoneItem } from "@/lib/admin-structure-management"
import { DEFAULT_ALLOWED_POST_TYPES, normalizePostTypes } from "@/lib/post-types"

interface StructureManagerProps {
  zones: ZoneItem[]
  boards: BoardItem[]
  initialFilters: {
    keyword: string
    zoneId: string
    boardStatus: string
    posting: string
  }
}

type ModalMode =
  | { kind: "create-zone" }
  | { kind: "create-board"; zoneId?: string }
  | { kind: "edit-zone"; item: ZoneItem }
  | { kind: "edit-board"; item: BoardItem }
  | null

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

export function StructureManager({ zones, boards, initialFilters }: StructureManagerProps) {
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
            <Button type="button" className="h-8 rounded-full px-3 text-xs" onClick={() => setModal({ kind: "create-zone" })}>
              <Plus className="mr-1 h-3.5 w-3.5" />新建分区
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {zoneCards.map((zone) => {
              const active = visibleZoneId === zone.id
              return (
                <button key={zone.id} type="button" onClick={() => setSelectedZoneId(zone.id)} className={active ? "w-full rounded-[18px] border border-foreground/20 bg-accent px-3 py-3 text-left" : "w-full rounded-[18px] border border-border px-3 py-3 text-left transition-colors hover:bg-accent/50"}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span>{zone.icon}</span>
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
              {visibleZoneId ? <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => setModal({ kind: "edit-zone", item: zones.find((zone) => zone.id === visibleZoneId)! })}>编辑分区</Button> : null}
              <Button type="button" className="h-8 rounded-full px-3 text-xs" onClick={() => setModal({ kind: "create-board", zoneId: visibleZoneId })}>
                <Plus className="mr-1 h-3.5 w-3.5" />新建节点
              </Button>
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
              <BoardRow key={board.id} board={board} onEdit={() => setModal({ kind: "edit-board", item: board })} />
            ))}
          </div>
        </section>
      </div>

      <StructureModal modal={modal} zones={zones} onClose={() => setModal(null)} />
    </div>
  )
}

function BoardRow({ board, onEdit }: { board: BoardItem; onEdit: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function runAction(type: "PUT" | "DELETE", body: Record<string, unknown>, successMessage: string) {
    if (type === "DELETE") {
      const confirmed = window.confirm(`确认删除节点“${board.name}”吗？如果该节点下仍有帖子，系统会阻止删除。`)
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
          <span className="text-base">{board.icon || "💬"}</span>
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
        <div>帖子 {board.postCount}</div>
        <div>关注 {board.followerCount}</div>
        <div>今日 {board.todayPostCount}</div>
      </div>

      <div className="grid gap-1 text-muted-foreground md:grid-cols-2">
        <span className="rounded-full bg-secondary/50 px-2 py-1 text-center">发帖 {board.postPointDelta ?? "继承"}</span>
        <span className="rounded-full bg-secondary/50 px-2 py-1 text-center">回复 {board.replyPointDelta ?? "继承"}</span>
        <span className="rounded-full bg-secondary/50 px-2 py-1 text-center">间隔 {board.postIntervalSeconds ?? "继承"}</span>
        <span className="rounded-full bg-secondary/50 px-2 py-1 text-center">VIP {board.minPostVipLevel ?? 0}</span>
      </div>

      <div className="flex flex-wrap justify-end gap-1.5">
        <Button type="button" variant="outline" className="h-7 rounded-full px-2.5 text-xs" onClick={onEdit}>编辑</Button>
        <Button type="button" variant="outline" disabled={isPending} className="h-7 rounded-full px-2.5 text-xs" onClick={() => runAction("PUT", { type: "board", id: board.id, name: board.name, slug: board.slug, description: board.description, sortOrder: board.sortOrder, zoneId: board.zoneId, allowPost: !board.allowPost, status: board.status, icon: board.icon }, board.allowPost ? "节点已暂停发帖" : "节点已开放发帖")}>
          {board.allowPost ? "暂停发帖" : "开放发帖"}
        </Button>
        <Button type="button" variant="outline" disabled={isPending} className="h-7 rounded-full px-2.5 text-xs" onClick={() => runAction("PUT", { type: "board", id: board.id, name: board.name, slug: board.slug, description: board.description, sortOrder: board.sortOrder, zoneId: board.zoneId, allowPost: board.allowPost, status: board.status === "HIDDEN" ? "ACTIVE" : "HIDDEN", icon: board.icon }, board.status === "HIDDEN" ? "节点已恢复显示" : "节点已隐藏")}>
          {board.status === "HIDDEN" ? "恢复显示" : "隐藏"}
        </Button>
        <Button type="button" disabled={isPending} className="h-7 rounded-full bg-red-600 px-2.5 text-xs text-white hover:bg-red-500" onClick={() => runAction("DELETE", { type: "board", id: board.id }, "节点已删除")}>
          <Trash2 className="mr-1 h-3.5 w-3.5" />删除
        </Button>

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

function StructureModal({ modal, zones, onClose }: { modal: ModalMode; zones: ZoneItem[]; onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [icon, setIcon] = useState("📚")
  const [sortOrder, setSortOrder] = useState("0")
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "")
  const [postPointDelta, setPostPointDelta] = useState("0")
  const [replyPointDelta, setReplyPointDelta] = useState("0")
  const [postIntervalSeconds, setPostIntervalSeconds] = useState("120")
  const [replyIntervalSeconds, setReplyIntervalSeconds] = useState("3")
  const [allowedPostTypes, setAllowedPostTypes] = useState<string[]>(DEFAULT_ALLOWED_POST_TYPES)

  const [minViewPoints, setMinViewPoints] = useState("0")
  const [minViewLevel, setMinViewLevel] = useState("0")
  const [minPostPoints, setMinPostPoints] = useState("0")
  const [minPostLevel, setMinPostLevel] = useState("0")
  const [minReplyPoints, setMinReplyPoints] = useState("0")
  const [minReplyLevel, setMinReplyLevel] = useState("0")
  const [minViewVipLevel, setMinViewVipLevel] = useState("0")
  const [minPostVipLevel, setMinPostVipLevel] = useState("0")
  const [minReplyVipLevel, setMinReplyVipLevel] = useState("0")
  const [requirePostReview, setRequirePostReview] = useState(false)

  const [feedback, setFeedback] = useState("")
  const [feedbackTone, setFeedbackTone] = useState<"error" | "success">("success")
  const [isPending, startTransition] = useTransition()


  const title = useMemo(() => {
    if (!modal) return ""
    switch (modal.kind) {
      case "create-zone":
        return "新建分区"
      case "create-board":
        return "新建节点"
      case "edit-zone":
        return "编辑分区"
      case "edit-board":
        return "编辑节点"
    }
  }, [modal])

  useEffect(() => {
    if (!modal) {
      return
    }
    if (modal.kind === "create-zone") {
      setName("")
      setSlug("")
      setDescription("")
      setIcon("📚")
      setSortOrder(String(zones.length + 1))
      setZoneId(zones[0]?.id ?? "")
      setPostPointDelta("0")
      setReplyPointDelta("0")
      setPostIntervalSeconds("120")
      setReplyIntervalSeconds("3")
      setAllowedPostTypes(DEFAULT_ALLOWED_POST_TYPES)

      setMinViewPoints("0")
      setMinViewLevel("0")
      setMinPostPoints("0")
      setMinPostLevel("0")
      setMinReplyPoints("0")
      setMinReplyLevel("0")
      setMinViewVipLevel("0")
      setMinPostVipLevel("0")
      setMinReplyVipLevel("0")
      setRequirePostReview(false)

      setFeedback("")
      setFeedbackTone("success")
      return
    }
    if (modal.kind === "create-board") {
      setName("")
      setSlug("")
      setDescription("")
      setIcon("💬")
      setSortOrder("0")
      setZoneId(modal.zoneId ?? zones[0]?.id ?? "")
      setPostPointDelta("")
      setReplyPointDelta("")
      setPostIntervalSeconds("")
      setReplyIntervalSeconds("")
      setAllowedPostTypes(DEFAULT_ALLOWED_POST_TYPES)

      setMinViewPoints("")
      setMinViewLevel("")
      setMinPostPoints("")
      setMinPostLevel("")
      setMinReplyPoints("")
      setMinReplyLevel("")
      setMinViewVipLevel("")
      setMinPostVipLevel("")
      setMinReplyVipLevel("")
      setRequirePostReview(false)

      setFeedback("")
      setFeedbackTone("success")
      return
    }
    if (modal.kind === "edit-zone") {
      setName(modal.item.name)
      setSlug(modal.item.slug)
      setDescription(modal.item.description)
      setIcon(modal.item.icon)
      setSortOrder(String(modal.item.sortOrder))
      setPostPointDelta(String(modal.item.postPointDelta))
      setReplyPointDelta(String(modal.item.replyPointDelta))
      setPostIntervalSeconds(String(modal.item.postIntervalSeconds))
      setReplyIntervalSeconds(String(modal.item.replyIntervalSeconds))
      setAllowedPostTypes(normalizePostTypes(modal.item.allowedPostTypes))
      setMinViewPoints(String(modal.item.minViewPoints))
      setMinViewLevel(String(modal.item.minViewLevel))
      setMinPostPoints(String(modal.item.minPostPoints))
      setMinPostLevel(String(modal.item.minPostLevel))
      setMinReplyPoints(String(modal.item.minReplyPoints))
      setMinReplyLevel(String(modal.item.minReplyLevel))
      setMinViewVipLevel(String(modal.item.minViewVipLevel))
      setMinPostVipLevel(String(modal.item.minPostVipLevel))
      setMinReplyVipLevel(String(modal.item.minReplyVipLevel))
      setRequirePostReview(modal.item.requirePostReview)

      setFeedback("")
      setFeedbackTone("success")
      return
    }
    if (modal.kind === "edit-board") {
      setName(modal.item.name)
      setSlug(modal.item.slug)
      setDescription(modal.item.description ?? "")
      setIcon(modal.item.icon ?? "💬")
      setSortOrder(String(modal.item.sortOrder ?? 0))
      setZoneId(modal.item.zoneId ?? zones[0]?.id ?? "")
      setPostPointDelta(modal.item.postPointDelta == null ? "" : String(modal.item.postPointDelta))
      setReplyPointDelta(modal.item.replyPointDelta == null ? "" : String(modal.item.replyPointDelta))
      setPostIntervalSeconds(modal.item.postIntervalSeconds == null ? "" : String(modal.item.postIntervalSeconds))
      setReplyIntervalSeconds(modal.item.replyIntervalSeconds == null ? "" : String(modal.item.replyIntervalSeconds))
      setAllowedPostTypes(normalizePostTypes(modal.item.allowedPostTypes))

      setMinViewPoints(modal.item.minViewPoints == null ? "" : String(modal.item.minViewPoints))
      setMinViewLevel(modal.item.minViewLevel == null ? "" : String(modal.item.minViewLevel))
      setMinPostPoints(modal.item.minPostPoints == null ? "" : String(modal.item.minPostPoints))
      setMinPostLevel(modal.item.minPostLevel == null ? "" : String(modal.item.minPostLevel))
      setMinReplyPoints(modal.item.minReplyPoints == null ? "" : String(modal.item.minReplyPoints))
      setMinReplyLevel(modal.item.minReplyLevel == null ? "" : String(modal.item.minReplyLevel))
      setMinViewVipLevel(modal.item.minViewVipLevel == null ? "" : String(modal.item.minViewVipLevel))
      setMinPostVipLevel(modal.item.minPostVipLevel == null ? "" : String(modal.item.minPostVipLevel))
      setMinReplyVipLevel(modal.item.minReplyVipLevel == null ? "" : String(modal.item.minReplyVipLevel))
      setRequirePostReview(Boolean(modal.item.requirePostReview))

      setFeedback("")
      setFeedbackTone("success")
    }
  }, [modal, zones])


  if (!modal) {
    return null
  }

  const isBoard = modal.kind === "create-board" || modal.kind === "edit-board"
  const isEdit = modal.kind === "edit-zone" || modal.kind === "edit-board"
  const editingItemId = modal.kind === "edit-zone" || modal.kind === "edit-board" ? modal.item.id : undefined

  function togglePostType(type: string) {
    setAllowedPostTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type])
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback("")

    const payload: Record<string, unknown> = {
      type: isBoard ? "board" : "zone",
      name,
      slug,
      description,
      sortOrder: Number(sortOrder) || 0,
      icon,
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

        setFeedback(message)
        setFeedbackTone(response.ok ? "success" : "error")

        if (response.ok) {
          router.refresh()
          onClose()
        }
      } catch {
        setFeedback("网络异常，请稍后重试")
        setFeedbackTone("error")
      }
    })

  }

  return (
    <AdminModal open={Boolean(modal)} onClose={onClose} size="xl" title={title} description="统一维护分区默认策略与节点覆盖策略。">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={isBoard ? "节点名称" : "分区名称"} value={name} onChange={setName} placeholder={isBoard ? "如 摄影" : "如 生活方式"} />
          <Field label="标识 slug" value={slug} onChange={setSlug} placeholder={isBoard ? "如 camera" : "如 lifestyle"} />
          <Field label="图标" value={icon} onChange={setIcon} placeholder={isBoard ? "如 📷" : "如 🌿"} />
          <Field label="排序" value={sortOrder} onChange={setSortOrder} placeholder="数字越小越靠前" />
        </div>

        {isBoard ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">所属分区</p>
            <select value={zoneId} onChange={(event) => setZoneId(event.target.value)} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none">
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.name}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-medium">描述</p>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="填写结构描述，帮助用户理解这个分区或节点的定位" className="min-h-[120px] w-full rounded-[24px] border border-border bg-background px-4 py-3 text-sm outline-none" />
        </div>

        <div className="rounded-[24px] border border-border p-5">
          <h4 className="text-sm font-semibold">积分与频率设置</h4>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="发帖积分" value={postPointDelta} onChange={setPostPointDelta} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
            <Field label="回复积分" value={replyPointDelta} onChange={setReplyPointDelta} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
            <Field label="发帖间隔(秒)" value={postIntervalSeconds} onChange={setPostIntervalSeconds} placeholder={isBoard ? "留空继承分区" : "默认 120"} />
            <Field label="回复间隔(秒)" value={replyIntervalSeconds} onChange={setReplyIntervalSeconds} placeholder={isBoard ? "留空继承分区" : "默认 3"} />
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
            <Field label="浏览最低积分" value={minViewPoints} onChange={setMinViewPoints} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
            <Field label="浏览最低等级" value={minViewLevel} onChange={setMinViewLevel} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
            <Field label="浏览最低 VIP 等级" value={minViewVipLevel} onChange={setMinViewVipLevel} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
            <Field label="发帖最低积分" value={minPostPoints} onChange={setMinPostPoints} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
            <Field label="发帖最低等级" value={minPostLevel} onChange={setMinPostLevel} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
            <Field label="发帖最低 VIP 等级" value={minPostVipLevel} onChange={setMinPostVipLevel} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
            <Field label="回复最低积分" value={minReplyPoints} onChange={setMinReplyPoints} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
            <Field label="回复最低等级" value={minReplyLevel} onChange={setMinReplyLevel} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
            <Field label="回复最低 VIP 等级" value={minReplyVipLevel} onChange={setMinReplyVipLevel} placeholder={isBoard ? "留空继承分区" : "默认 0"} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Toggle label="开启发帖审核" checked={requirePostReview} onChange={setRequirePostReview} />
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

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
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
