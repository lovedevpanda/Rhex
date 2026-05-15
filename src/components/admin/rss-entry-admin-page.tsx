"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/rbutton"
import { showConfirm } from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/toast"
import { formatDateTime } from "@/lib/formatters"
import type { RssEntryAdminListItem, RssEntryAdminPageData } from "@/lib/rss-entry-admin"

interface RssEntryAdminPageProps {
  initialData: RssEntryAdminPageData
}

type EditDraft = {
  id: string
  title: string
  linkUrl: string
  author: string
  summary: string
  contentHtml: string
  contentText: string
  publishedAt: string
  reviewStatus: string
  reviewNote: string
}

const pageSizeOptions = [20, 50, 100]

function createEditDraft(entry: RssEntryAdminListItem): EditDraft {
  return {
    id: entry.id,
    title: entry.title,
    linkUrl: entry.linkUrl ?? "",
    author: entry.author ?? "",
    summary: entry.summary ?? "",
    contentHtml: entry.contentHtml ?? "",
    contentText: entry.contentText ?? "",
    publishedAt: entry.publishedAt ? entry.publishedAt.slice(0, 16) : "",
    reviewStatus: entry.reviewStatus,
    reviewNote: entry.reviewNote ?? "",
  }
}

export function RssEntryAdminPage({ initialData }: RssEntryAdminPageProps) {
  const router = useRouter()
  const [selectedIdsState, setSelectedIds] = useState<string[]>([])
  const [editingEntry, setEditingEntry] = useState<RssEntryAdminListItem | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const visibleEntryIds = useMemo(() => new Set(initialData.entries.map((entry) => entry.id)), [initialData.entries])
  const selectedIds = useMemo(
    () => selectedIdsState.filter((id) => visibleEntryIds.has(id)),
    [selectedIdsState, visibleEntryIds],
  )
  const allSelected = initialData.entries.length > 0 && selectedIds.length === initialData.entries.length
  const selectedCount = selectedIds.length

  const baseQuery = useMemo(() => new URLSearchParams({
    keyword: initialData.filters.keyword,
    sourceId: initialData.filters.sourceId,
    reviewStatus: initialData.filters.reviewStatus,
    pageSize: String(initialData.pagination.pageSize),
  }), [initialData.filters.keyword, initialData.filters.reviewStatus, initialData.filters.sourceId, initialData.pagination.pageSize])

  function buildPageHref(page: number) {
    const query = new URLSearchParams(baseQuery)
    query.set("page", String(page))
    return `/admin/apps/rss-harvest/entries?${query.toString()}`
  }

  async function submitAction(payload: Record<string, unknown>, successMessage: string) {
    const response = await fetch("/api/admin/apps/rss-harvest/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message ?? "操作失败")
    }

    toast.success(result.message ?? successMessage, "操作成功")
    router.refresh()
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : initialData.entries.map((entry) => entry.id))
  }

  function openEdit(entry: RssEntryAdminListItem) {
    setEditingEntry(entry)
    setEditDraft(createEditDraft(entry))
    setEditOpen(true)
  }

  function updateDraft<K extends keyof EditDraft>(key: K, value: EditDraft[K]) {
    setEditDraft((current) => current ? { ...current, [key]: value } : current)
  }

  function saveEdit() {
    if (!editDraft) {
      return
    }

    startTransition(async () => {
      try {
        await submitAction({
          action: "update-entry",
          entryId: editDraft.id,
          title: editDraft.title,
          linkUrl: editDraft.linkUrl,
          author: editDraft.author,
          summary: editDraft.summary,
          contentHtml: editDraft.contentHtml,
          contentText: editDraft.contentText,
          publishedAt: editDraft.publishedAt ? new Date(editDraft.publishedAt).toISOString() : "",
          reviewStatus: editDraft.reviewStatus,
          reviewNote: editDraft.reviewNote,
        }, "采集数据已更新")
        setEditOpen(false)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "采集数据保存失败", "操作失败")
      }
    })
  }

  function reviewEntry(entryId: string, reviewStatus: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      try {
        await submitAction({
          action: "review-entry",
          entryId,
          reviewStatus,
        }, reviewStatus === "APPROVED" ? "采集数据已通过审核" : "采集数据已驳回")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "审核失败", "操作失败")
      }
    })
  }

  async function deleteEntry(entry: RssEntryAdminListItem) {
    const confirmed = await showConfirm({
      title: "删除采集数据",
      description: `确认删除《${entry.title}》吗？此操作不可撤销。`,
      confirmText: "删除",
      cancelText: "取消",
      variant: "danger",
    })
    if (!confirmed) {
      return
    }

    startTransition(async () => {
      try {
        await submitAction({
          action: "delete-entry",
          entryId: entry.id,
        }, "采集数据已删除")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "删除失败", "操作失败")
      }
    })
  }

  function batchReview(reviewStatus: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      try {
        await submitAction({
          action: "batch-review",
          entryIds: selectedIds,
          reviewStatus,
        }, reviewStatus === "APPROVED" ? "批量审核已完成" : "批量驳回已完成")
        setSelectedIds([])
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "批量审核失败", "操作失败")
      }
    })
  }

  async function batchDelete() {
    const confirmed = await showConfirm({
      title: "批量删除采集数据",
      description: `确认删除已选中的 ${selectedCount} 条采集数据吗？此操作不可撤销。`,
      confirmText: "批量删除",
      cancelText: "取消",
      variant: "danger",
    })
    if (!confirmed) {
      return
    }

    startTransition(async () => {
      try {
        await submitAction({
          action: "batch-delete",
          entryIds: selectedIds,
        }, "批量删除已完成")
        setSelectedIds([])
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "批量删除失败", "操作失败")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">RSS 采集数据</h3>
            <p className="mt-1 text-sm text-muted-foreground">查看抓取入库内容，支持分页、审核、编辑、删除和批量处理。</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/apps/rss-harvest">
              <Button type="button" variant="outline">返回抓取中心</Button>
            </Link>
            <Button type="button" variant="outline" onClick={() => router.refresh()}>刷新</Button>
          </div>
        </div>
      </div>

      <form className="grid gap-3 rounded-xl border border-border bg-card p-4 xl:grid-cols-[minmax(180px,1.6fr)_170px_120px_100px_auto]">
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">搜索内容</span>
          <input name="keyword" defaultValue={initialData.filters.keyword} placeholder="标题 / 摘要 / 正文 / 作者 / 链接" className="h-10 w-full rounded-full border border-border bg-background px-4 text-sm outline-hidden" />
        </label>
        <CompactSelect name="sourceId" label="RSS 源" value={initialData.filters.sourceId} options={[{ value: "", label: "全部源" }, ...initialData.sourceOptions.map((item) => ({ value: item.id, label: item.siteName }))]} />
        <CompactSelect name="reviewStatus" label="审核状态" value={initialData.filters.reviewStatus} options={[{ value: "ALL", label: "全部状态" }, { value: "PENDING", label: "待审核" }, { value: "APPROVED", label: "已通过" }, { value: "REJECTED", label: "已驳回" }]} />
        <CompactSelect name="pageSize" label="每页" value={String(initialData.pagination.pageSize)} options={pageSizeOptions.map((item) => ({ value: String(item), label: `${item} 条` }))} />
        <div className="flex items-end gap-2">
          <input type="hidden" name="page" value="1" />
          <button type="submit" className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90">筛选</button>
          <Link href="/admin/apps/rss-harvest/entries" className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">重置</Link>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="总条数" value={initialData.summary.total} />
        <StatCard label="待审核" value={initialData.summary.pending} />
        <StatCard label="已通过" value={initialData.summary.approved} />
        <StatCard label="已驳回" value={initialData.summary.rejected} />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="h-4 w-4 rounded border-border" />
              <span>全选本页</span>
            </label>
            <span className="text-sm text-muted-foreground">第 {initialData.pagination.page} / {initialData.pagination.totalPages} 页，共 {initialData.pagination.total} 条</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" disabled={selectedCount === 0 || isPending} onClick={() => batchReview("APPROVED")}>批量通过</Button>
            <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" disabled={selectedCount === 0 || isPending} onClick={() => batchReview("REJECTED")}>批量驳回</Button>
            <Button type="button" variant="outline" className="h-8 rounded-full border-rose-200 px-3 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700" disabled={selectedCount === 0 || isPending} onClick={() => void batchDelete()}>批量删除</Button>
          </div>
        </div>

        {initialData.entries.length === 0 ? <div className="px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下没有采集数据。</div> : null}

        <div className="divide-y divide-border">
          {initialData.entries.map((entry) => (
            <article key={entry.id} className="grid gap-3 px-4 py-4 xl:grid-cols-[36px_minmax(0,1.7fr)_180px_120px_250px]">
              <div className="pt-1">
                <input type="checkbox" checked={selectedIds.includes(entry.id)} onChange={() => toggleSelect(entry.id)} className="h-4 w-4 rounded border-border" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">{entry.sourceName}</span>
                  <ReviewStatusBadge status={entry.reviewStatus} />
                </div>
                <h4 className="mt-2 line-clamp-2 text-sm font-semibold">{entry.title}</h4>
                {entry.summary ? <p className="mt-2 line-clamp-2 text-xs leading-6 text-muted-foreground">{entry.summary}</p> : null}
                {entry.contentText ? <p className="mt-2 line-clamp-3 text-xs leading-6 text-muted-foreground">{entry.contentText}</p> : null}
                {entry.reviewNote ? <p className="mt-2 text-xs text-amber-700">审核备注：{entry.reviewNote}</p> : null}
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>作者：{entry.author ?? "未知"}</p>
                <p>发布时间：{entry.publishedAt ? formatDateTime(entry.publishedAt) : "暂无"}</p>
                <p>入库时间：{formatDateTime(entry.createdAt)}</p>
                <p>更新时间：{formatDateTime(entry.updatedAt)}</p>
                <p>审核人：{entry.reviewerName ?? "暂无"}</p>
                <p>审核时间：{entry.reviewedAt ? formatDateTime(entry.reviewedAt) : "暂无"}</p>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p className="break-all">GUID：{entry.guid ?? "暂无"}</p>
                <p className="break-all">链接：{entry.linkUrl ?? "暂无"}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {entry.linkUrl ? (
                  <Link href={entry.linkUrl} target="_blank" className="inline-flex h-8 items-center justify-center rounded-full border border-border px-3 text-xs transition-colors hover:bg-accent hover:text-accent-foreground">
                    原文
                  </Link>
                ) : null}
                <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openEdit(entry)}>编辑</Button>
                <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => reviewEntry(entry.id, "APPROVED")}>通过</Button>
                <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => reviewEntry(entry.id, "REJECTED")}>驳回</Button>
                <Button type="button" variant="outline" className="h-8 rounded-full border-rose-200 px-3 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700" disabled={isPending} onClick={() => void deleteEntry(entry)}>删除</Button>
              </div>
            </article>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground pr-16 sm:pr-20">
          <div className="flex flex-wrap items-center gap-3">
            <span>第 {initialData.pagination.page} / {initialData.pagination.totalPages} 页</span>
            <span>每页 {initialData.pagination.pageSize} 条</span>
            <span>共 {initialData.pagination.total} 条采集数据</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={initialData.pagination.hasPrevPage ? buildPageHref(initialData.pagination.page - 1) : "#"} aria-disabled={!initialData.pagination.hasPrevPage} className={initialData.pagination.hasPrevPage ? "inline-flex h-8 items-center justify-center rounded-full border border-border bg-card px-3 font-medium transition-colors hover:bg-accent hover:text-accent-foreground" : "pointer-events-none inline-flex h-8 items-center justify-center rounded-full border border-border px-3 opacity-40"}>上一页</Link>
            <span className="inline-flex h-8 items-center rounded-full bg-accent px-3 font-medium text-foreground">{initialData.pagination.page}</span>
            <Link href={initialData.pagination.hasNextPage ? buildPageHref(initialData.pagination.page + 1) : "#"} aria-disabled={!initialData.pagination.hasNextPage} className={initialData.pagination.hasNextPage ? "inline-flex h-8 items-center justify-center rounded-full border border-border bg-card px-3 font-medium transition-colors hover:bg-accent hover:text-accent-foreground" : "pointer-events-none inline-flex h-8 items-center justify-center rounded-full border border-border px-3 opacity-40"}>下一页</Link>
          </div>
        </div>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={editingEntry ? `编辑采集数据 · ${editingEntry.sourceName}` : "编辑采集数据"}
        description="允许修改采集内容和审核状态。"
        size="xl"
        footer={(
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)} disabled={isPending}>取消</Button>
            <Button type="button" onClick={saveEdit} disabled={isPending || !editDraft}>{isPending ? "保存中..." : "保存"}</Button>
          </div>
        )}
      >
        {editDraft ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="标题" value={editDraft.title} onChange={(value) => updateDraft("title", value)} className="md:col-span-2" />
            <Field label="原文链接" value={editDraft.linkUrl} onChange={(value) => updateDraft("linkUrl", value)} className="md:col-span-2" />
            <Field label="作者" value={editDraft.author} onChange={(value) => updateDraft("author", value)} />
            <Field label="发布时间" type="datetime-local" value={editDraft.publishedAt} onChange={(value) => updateDraft("publishedAt", value)} />
            <TextAreaField label="摘要" value={editDraft.summary} onChange={(value) => updateDraft("summary", value)} className="md:col-span-2" rows={4} />
            <TextAreaField label="正文文本" value={editDraft.contentText} onChange={(value) => updateDraft("contentText", value)} className="md:col-span-2" rows={8} />
            <TextAreaField label="正文 HTML" value={editDraft.contentHtml} onChange={(value) => updateDraft("contentHtml", value)} className="md:col-span-2" rows={8} />
            <SelectField label="审核状态" value={editDraft.reviewStatus} onChange={(value) => updateDraft("reviewStatus", value)} options={[{ value: "PENDING", label: "待审核" }, { value: "APPROVED", label: "已通过" }, { value: "REJECTED", label: "已驳回" }]} />
            <TextAreaField label="审核备注" value={editDraft.reviewNote} onChange={(value) => updateDraft("reviewNote", value)} rows={4} />
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function CompactSelect({ name, label, value, options }: { name: string; label: string; value: string; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <select name={name} defaultValue={value} className="h-10 w-full rounded-full border border-border bg-background px-3 text-sm outline-hidden">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-[16px] border border-border bg-background px-4 text-sm outline-hidden">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function Field({ label, value, onChange, className = "", type = "text" }: { label: string; value: string; onChange: (value: string) => void; className?: string; type?: "text" | "datetime-local" }) {
  return (
    <label className={`space-y-2 ${className}`.trim()}>
      <span className="text-sm font-medium">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-[16px] border border-border bg-background px-4 text-sm outline-hidden" />
    </label>
  )
}

function TextAreaField({ label, value, onChange, className = "", rows = 5 }: { label: string; value: string; onChange: (value: string) => void; className?: string; rows?: number }) {
  return (
    <label className={`space-y-2 ${className}`.trim()}>
      <span className="text-sm font-medium">{label}</span>
      <textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} className="w-full rounded-[16px] border border-border bg-background px-4 py-3 text-sm outline-hidden" />
    </label>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[18px] border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function ReviewStatusBadge({ status }: { status: string }) {
  const className = status === "APPROVED"
    ? "bg-emerald-100 text-emerald-700"
    : status === "REJECTED"
      ? "bg-rose-100 text-rose-700"
      : "bg-amber-100 text-amber-700"

  const label = status === "APPROVED" ? "已通过" : status === "REJECTED" ? "已驳回" : "待审核"
  return <span className={`rounded-full px-2.5 py-1 text-[11px] ${className}`}>{label}</span>
}


