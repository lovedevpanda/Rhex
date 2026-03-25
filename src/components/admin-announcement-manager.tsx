"use client"

import { Loader2, Megaphone, Pin, Plus, Save, Trash2 } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { formatMonthDayTime } from "@/lib/formatters"
import type { AdminAnnouncementItem } from "@/lib/admin-announcements"

interface AdminAnnouncementManagerProps {
  initialItems: AdminAnnouncementItem[]
}

type DraftStatus = "DRAFT" | "PUBLISHED" | "OFFLINE"

interface AnnouncementDraft {
  id?: string
  title: string
  content: string
  status: DraftStatus
  isPinned: boolean
}

const EMPTY_DRAFT: AnnouncementDraft = {
  title: "",
  content: "",
  status: "DRAFT",
  isPinned: false,
}

export function AdminAnnouncementManager({ initialItems }: AdminAnnouncementManagerProps) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createDraft, setCreateDraft] = useState<AnnouncementDraft>(EMPTY_DRAFT)
  const [editingDrafts, setEditingDrafts] = useState<Record<string, AnnouncementDraft>>(() => Object.fromEntries(initialItems.map((item) => [item.id, toDraft(item)])))
  const [isPending, startTransition] = useTransition()

  const stats = useMemo(() => ({
    total: items.length,
    published: items.filter((item) => item.status === "PUBLISHED").length,
    pinned: items.filter((item) => item.isPinned).length,
  }), [items])

  function updateCreateDraft<K extends keyof AnnouncementDraft>(key: K, value: AnnouncementDraft[K]) {
    setCreateDraft((current) => ({ ...current, [key]: value }))
  }

  function updateEditingDraft<K extends keyof AnnouncementDraft>(id: string, key: K, value: AnnouncementDraft[K]) {
    setEditingDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? EMPTY_DRAFT),
        [key]: value,
      },
    }))
  }

  async function refreshList() {
    const response = await fetch("/api/admin/announcements", { cache: "no-store" })
    const result = await response.json()
    if (!response.ok || !Array.isArray(result.data)) {
      throw new Error(result.message ?? "刷新公告列表失败")
    }

    setItems(result.data)
    setEditingDrafts(Object.fromEntries(result.data.map((item: AdminAnnouncementItem) => [item.id, toDraft(item)])))
  }

  function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", ...createDraft }),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "公告创建失败", "创建失败")
        return
      }

      await refreshList()
      setCreateDraft(EMPTY_DRAFT)
      setCreateOpen(false)
      toast.success(result.message ?? "公告已创建", "创建成功")
      router.refresh()
    })
  }

  function submitUpdate(id: string) {
    const draft = editingDrafts[id]
    if (!draft) {
      return
    }

    startTransition(async () => {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", id, ...draft }),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "公告保存失败", "保存失败")
        return
      }

      await refreshList()
      setEditingId(null)
      toast.success(result.message ?? "公告已更新", "保存成功")
      router.refresh()
    })
  }

  function submitDelete(id: string) {
    startTransition(async () => {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "公告删除失败", "删除失败")
        return
      }

      await refreshList()
      if (editingId === id) {
        setEditingId(null)
      }
      toast.success(result.message ?? "公告已删除", "删除成功")
      router.refresh()
    })
  }

  function submitTogglePin(id: string, isPinned: boolean) {
    startTransition(async () => {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-pin", id, isPinned }),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "公告置顶状态更新失败", "操作失败")
        return
      }

      await refreshList()
      toast.success(result.message ?? "公告置顶状态已更新", "操作成功")
      router.refresh()
    })
  }

  function submitStatus(id: string, status: DraftStatus) {
    startTransition(async () => {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-status", id, status }),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "公告状态更新失败", "操作失败")
        return
      }

      await refreshList()
      toast.success(result.message ?? "公告状态已更新", "操作成功")
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[22px] border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">公告管理</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">统一管理首页右栏与公告页展示的社区公告。</p>
          </div>
          <Button type="button" className="rounded-full" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />新增公告
          </Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Stat label="公告总数" value={String(stats.total)} />
          <Stat label="已发布" value={String(stats.published)} />
          <Stat label="已置顶" value={String(stats.pinned)} />
        </div>
      </section>

      <section className="rounded-[22px] border border-border p-4">
        <div className="mb-3 flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-sky-500" />
          <h3 className="text-sm font-semibold">公告列表</h3>
        </div>
        <div className="space-y-3">
          {items.map((item) => {
            const activeEditing = editingId === item.id
            const draft = editingDrafts[item.id] ?? toDraft(item)

            return (
              <article key={item.id} className="rounded-[18px] border border-border bg-card px-3 py-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate text-sm font-semibold">{item.title}</h4>
                      <StatusBadge status={item.status} />
                      {item.isPinned ? <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] text-orange-700 dark:bg-orange-500/15 dark:text-orange-300"><Pin className="h-3 w-3" />置顶</span> : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-6 text-muted-foreground whitespace-pre-wrap">{item.content}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>发布人：{item.creatorName}</span>
                      <span>·</span>
                      <span>创建于 {formatMonthDayTime(item.createdAt)}</span>
                      <span>·</span>
                      <span>{item.publishedAt ? `发布时间 ${formatMonthDayTime(item.publishedAt)}` : "未发布"}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => setEditingId(activeEditing ? null : item.id)}>
                      {activeEditing ? "收起" : "编辑"}
                    </Button>
                    <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => submitTogglePin(item.id, !item.isPinned)}>
                      {item.isPinned ? "取消置顶" : "置顶"}
                    </Button>
                    <Button type="button" variant="ghost" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => submitDelete(item.id)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" />删除
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button type="button" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => submitStatus(item.id, "PUBLISHED")}>发布</Button>
                  <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => submitStatus(item.id, "DRAFT")}>转草稿</Button>
                  <Button type="button" variant="ghost" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => submitStatus(item.id, "OFFLINE")}>下线</Button>
                </div>

                {activeEditing ? (
                  <div className="mt-3 grid gap-3 rounded-[18px] border border-border bg-background/70 p-3">
                    <Field label="公告标题">
                      <input value={draft.title} onChange={(event) => updateEditingDraft(item.id, "title", event.target.value)} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none" placeholder="请输入公告标题" />
                    </Field>
                    <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                      <Field label="公告状态">
                        <select value={draft.status} onChange={(event) => updateEditingDraft(item.id, "status", event.target.value as DraftStatus)} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none">
                          <option value="DRAFT">草稿</option>
                          <option value="PUBLISHED">已发布</option>
                          <option value="OFFLINE">已下线</option>
                        </select>
                      </Field>
                      <label className="flex items-center gap-2 rounded-[16px] border border-border bg-background px-3 text-sm">
                        <input type="checkbox" checked={draft.isPinned} onChange={(event) => updateEditingDraft(item.id, "isPinned", event.target.checked)} className="h-4 w-4" />
                        设为置顶公告
                      </label>
                    </div>
                    <Field label="公告内容">
                      <textarea value={draft.content} onChange={(event) => updateEditingDraft(item.id, "content", event.target.value)} className="min-h-[180px] w-full rounded-[18px] border border-border bg-background px-3 py-3 text-sm outline-none" placeholder="支持 Markdown，前台公告页会按富文本内容展示。" />
                    </Field>
                    <div className="flex justify-end">
                      <Button type="button" disabled={isPending} className="rounded-full" onClick={() => submitUpdate(item.id)}>
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}保存公告
                      </Button>
                    </div>
                  </div>
                ) : null}
              </article>
            )
          })}

          {items.length === 0 ? <p className="text-sm text-muted-foreground">当前还没有公告，创建后即可在首页右栏展示。</p> : null}
        </div>
      </section>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
          <div className="w-full max-w-3xl rounded-[24px] border border-border bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">新增公告</h3>
                <p className="mt-1 text-sm text-muted-foreground">创建后可选择先保存为草稿，或直接发布到前台。</p>
              </div>
              <Button type="button" variant="ghost" className="h-8 px-2" onClick={() => setCreateOpen(false)}>关闭</Button>
            </div>
            <form onSubmit={submitCreate} className="mt-5 space-y-4">
              <Field label="公告标题">
                <input value={createDraft.title} onChange={(event) => updateCreateDraft("title", event.target.value)} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none" placeholder="请输入公告标题" />
              </Field>
              <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                <Field label="公告状态">
                  <select value={createDraft.status} onChange={(event) => updateCreateDraft("status", event.target.value as DraftStatus)} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none">
                    <option value="DRAFT">草稿</option>
                    <option value="PUBLISHED">已发布</option>
                    <option value="OFFLINE">已下线</option>
                  </select>
                </Field>
                <label className="flex items-center gap-2 rounded-[16px] border border-border bg-background px-3 text-sm">
                  <input type="checkbox" checked={createDraft.isPinned} onChange={(event) => updateCreateDraft("isPinned", event.target.checked)} className="h-4 w-4" />
                  设为置顶公告
                </label>
              </div>
              <Field label="公告内容">
                <textarea value={createDraft.content} onChange={(event) => updateCreateDraft("content", event.target.value)} className="min-h-[220px] w-full rounded-[18px] border border-border bg-background px-3 py-3 text-sm outline-none" placeholder="支持 Markdown，前台公告页会按富文本内容展示。" />
              </Field>
              <div className="flex items-center gap-3">
                <Button disabled={isPending} className="rounded-full">
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}创建公告
                </Button>
                <Button type="button" variant="ghost" disabled={isPending} onClick={() => setCreateOpen(false)}>取消</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function toDraft(item: AdminAnnouncementItem): AnnouncementDraft {
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    status: item.status,
    isPinned: item.isPinned,
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-border bg-card px-4 py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

function StatusBadge({ status }: { status: DraftStatus }) {
  if (status === "PUBLISHED") {
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">已发布</span>
  }

  if (status === "OFFLINE") {
    return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-700 dark:bg-slate-500/15 dark:text-slate-200">已下线</span>
  }

  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">草稿</span>
}
