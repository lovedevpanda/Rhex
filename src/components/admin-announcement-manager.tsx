"use client"

import Link from "next/link"
import { ArrowUpRight, BookOpen, ExternalLink, Loader2, Pin, Plus, Save, Trash2 } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { PickerPopover, PickerTriggerField, normalizeHexColor } from "@/components/admin-picker-popover"
import { RefinedRichPostEditor } from "@/components/refined-rich-post-editor"
import { Button } from "@/components/ui/button"
import { DialogBackdrop, DialogPanel, DialogPortal, DialogPositioner } from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"
import type { AdminAnnouncementItem } from "@/lib/admin-announcements"
import { buildSiteDocumentHref, getSiteDocumentTypeLabel, isExternalSiteDocumentHref, normalizeSiteDocumentSlug } from "@/lib/site-document-types"

interface AdminAnnouncementManagerProps {
  initialItems: AdminAnnouncementItem[]
}

type DraftStatus = "DRAFT" | "PUBLISHED" | "OFFLINE"
type DraftType = "ANNOUNCEMENT" | "HELP"
type DraftSourceType = "DOCUMENT" | "LINK"

interface AnnouncementDraft {
  id?: string
  type: DraftType
  title: string
  content: string
  sourceType: DraftSourceType
  slug: string
  linkUrl: string
  titleColor: string
  titleBold: boolean
  status: DraftStatus
  isPinned: boolean
}

const EMPTY_DRAFT: AnnouncementDraft = {
  type: "ANNOUNCEMENT",
  title: "",
  content: "",
  sourceType: "DOCUMENT",
  slug: "",
  linkUrl: "",
  titleColor: "",
  titleBold: false,
  status: "DRAFT",
  isPinned: false,
}

const TITLE_COLOR_PRESETS = [
  "#111827",
  "#1d4ed8",
  "#0f766e",
  "#15803d",
  "#b45309",
  "#dc2626",
  "#db2777",
  "#7c3aed",
] as const

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
    announcements: items.filter((item) => item.type === "ANNOUNCEMENT").length,
    helpDocuments: items.filter((item) => item.type === "HELP").length,
    published: items.filter((item) => item.status === "PUBLISHED").length,
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
      throw new Error(result.message ?? "刷新站点文档列表失败")
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
        toast.error(result.message ?? "站点文档创建失败", "创建失败")
        return
      }

      await refreshList()
      setCreateDraft(EMPTY_DRAFT)
      setCreateOpen(false)
      toast.success(result.message ?? "站点文档已创建", "创建成功")
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
        toast.error(result.message ?? "站点文档保存失败", "保存失败")
        return
      }

      await refreshList()
      setEditingId(null)
      toast.success(result.message ?? "站点文档已更新", "保存成功")
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
        toast.error(result.message ?? "站点文档删除失败", "删除失败")
        return
      }

      await refreshList()
      if (editingId === id) {
        setEditingId(null)
      }
      toast.success(result.message ?? "站点文档已删除", "删除成功")
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
        toast.error(result.message ?? "置顶状态更新失败", "操作失败")
        return
      }

      await refreshList()
      toast.success(result.message ?? "置顶状态已更新", "操作成功")
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
        toast.error(result.message ?? "站点文档状态更新失败", "操作失败")
        return
      }

      await refreshList()
      toast.success(result.message ?? "站点文档状态已更新", "操作成功")
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[22px] border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">站点文档管理</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">统一管理公告和帮助文档，支持内部文档、外部链接、slug 与标题样式。</p>
          </div>
          <Button type="button" className="rounded-full" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />新增站点文档
          </Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Stat label="文档总数" value={String(stats.total)} />
          <Stat label="公告" value={String(stats.announcements)} />
          <Stat label="帮助文档" value={String(stats.helpDocuments)} />
          <Stat label="已发布" value={String(stats.published)} />
        </div>
      </section>

      <section className="rounded-[22px] border border-border p-4">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-sky-500" />
          <h3 className="text-sm font-semibold">文档列表</h3>
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
                      <h4 style={{ color: item.titleColor ?? undefined }} className={item.titleBold ? "truncate text-sm font-semibold" : "truncate text-sm font-medium"}>
                        {item.title}
                      </h4>
                      <TypeBadge type={item.type} />
                      <SourceTypeBadge sourceType={item.sourceType} />
                      <StatusBadge status={item.status} />
                      {item.isPinned ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                          <Pin className="h-3 w-3" />
                          置顶
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 line-clamp-2 text-xs leading-6 text-muted-foreground whitespace-pre-wrap">
                      {item.sourceType === "DOCUMENT" ? item.content : item.linkUrl}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>发布人：{item.creatorName}</span>
                      <span>·</span>
                      <span>创建于 {item.createdAtText}</span>
                      <span>·</span>
                      <span>{item.publishedAtText ? `发布时间 ${item.publishedAtText}` : "未发布"}</span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="text-muted-foreground">访问地址：</span>
                      <DocumentAnchor href={item.href} isExternal={item.isExternal} className="inline-flex items-center gap-1 text-primary underline underline-offset-4">
                        {item.href}
                      </DocumentAnchor>
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

                {activeEditing ? <EditorForm draft={draft} isPending={isPending} onChange={(key, value) => updateEditingDraft(item.id, key, value)} onSubmit={() => submitUpdate(item.id)} /> : null}
              </article>
            )
          })}

          {items.length === 0 ? <p className="text-sm text-muted-foreground">当前还没有站点文档，创建后即可在首页公告区或帮助文档页展示。</p> : null}
        </div>
      </section>

      <DialogPortal open={createOpen} onClose={() => setCreateOpen(false)} closeOnEscape={!isPending}>
        <div className="fixed inset-0 z-[120]">
          <DialogBackdrop onClick={isPending ? undefined : () => setCreateOpen(false)} />
          <DialogPositioner className="px-3 py-4">
            <DialogPanel className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col p-0">
              <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold">新增站点文档</h3>
                  <p className="mt-1 text-sm text-muted-foreground">一个入口管理公告与帮助文档，支持文档页和跳转链接两种模式。</p>
                </div>
                <Button type="button" variant="ghost" className="h-8 px-2" onClick={() => setCreateOpen(false)} disabled={isPending}>关闭</Button>
              </div>
              <form onSubmit={submitCreate} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                  <div className="space-y-4">
                    <EditorFields draft={createDraft} onChange={updateCreateDraft} />
                  </div>
                </div>
                <div className="flex items-center gap-3 border-t border-border px-5 py-4">
                  <Button disabled={isPending} className="rounded-full">
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}创建站点文档
                  </Button>
                  <Button type="button" variant="ghost" disabled={isPending} onClick={() => setCreateOpen(false)}>取消</Button>
                </div>
              </form>
            </DialogPanel>
          </DialogPositioner>
        </div>
      </DialogPortal>
    </div>
  )
}

function EditorForm({
  draft,
  isPending,
  onChange,
  onSubmit,
}: {
  draft: AnnouncementDraft
  isPending: boolean
  onChange: <K extends keyof AnnouncementDraft>(key: K, value: AnnouncementDraft[K]) => void
  onSubmit: () => void
}) {
  return (
    <div className="mt-3 grid gap-3 rounded-[18px] border border-border bg-background/70 p-3">
      <EditorFields draft={draft} onChange={onChange} />
      <div className="flex justify-end">
        <Button type="button" disabled={isPending} className="rounded-full" onClick={onSubmit}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}保存站点文档
        </Button>
      </div>
    </div>
  )
}

function EditorFields({
  draft,
  onChange,
}: {
  draft: AnnouncementDraft
  onChange: <K extends keyof AnnouncementDraft>(key: K, value: AnnouncementDraft[K]) => void
}) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="文档类型">
          <select value={draft.type} onChange={(event) => onChange("type", event.target.value as DraftType)} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none">
            <option value="ANNOUNCEMENT">公告</option>
            <option value="HELP">帮助文档</option>
          </select>
        </Field>
        <Field label="内容模式">
          <select value={draft.sourceType} onChange={(event) => onChange("sourceType", event.target.value as DraftSourceType)} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none">
            <option value="DOCUMENT">内部文档</option>
            <option value="LINK">链接跳转</option>
          </select>
        </Field>
      </div>

      <Field label="文档标题">
        <input value={draft.title} onChange={(event) => onChange("title", event.target.value)} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none" placeholder="请输入文档标题" />
      </Field>

      <div className="grid gap-3 md:grid-cols-[180px_1fr_1fr]">
        <Field label="发布状态">
          <select value={draft.status} onChange={(event) => onChange("status", event.target.value as DraftStatus)} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none">
            <option value="DRAFT">草稿</option>
            <option value="PUBLISHED">已发布</option>
            <option value="OFFLINE">已下线</option>
          </select>
        </Field>
        <TitleColorField value={draft.titleColor} onChange={(value) => onChange("titleColor", value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-[16px] border border-border bg-background px-3 text-sm">
            <input type="checkbox" checked={draft.titleBold} onChange={(event) => onChange("titleBold", event.target.checked)} className="h-4 w-4" />
            标题加粗
          </label>
          <label className="flex items-center gap-2 rounded-[16px] border border-border bg-background px-3 text-sm">
            <input type="checkbox" checked={draft.isPinned} onChange={(event) => onChange("isPinned", event.target.checked)} className="h-4 w-4" />
            置顶显示
          </label>
        </div>
      </div>

      {draft.sourceType === "DOCUMENT" ? (
        <>
          <Field label="自定义 slug">
            <input value={draft.slug} onChange={(event) => onChange("slug", event.target.value)} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none" placeholder="如 node 或 guide/getting-started" />
          </Field>
          <PreviewPath draft={draft} />
          <Field label="文档内容">
            <RefinedRichPostEditor
              value={draft.content}
              onChange={(value) => onChange("content", value)}
              placeholder="支持 Markdown，帮助文档与公告正文都从这里渲染。"
              minHeight={280}
              uploadFolder="posts"
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="跳转地址">
            <input value={draft.linkUrl} onChange={(event) => onChange("linkUrl", event.target.value)} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none" placeholder="如 /help/node 或 https://example.com/docs" />
          </Field>
          <PreviewPath draft={draft} />
        </>
      )}
    </>
  )
}

function toDraft(item: AdminAnnouncementItem): AnnouncementDraft {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    content: item.content,
    sourceType: item.sourceType,
    slug: item.slug ?? "",
    linkUrl: item.linkUrl ?? "",
    titleColor: item.titleColor ?? "",
    titleBold: item.titleBold,
    status: item.status,
    isPinned: item.isPinned,
  }
}

function getDraftPreviewHref(draft: AnnouncementDraft) {
  const slug = draft.sourceType === "DOCUMENT" ? normalizeSiteDocumentSlug(draft.slug || draft.title) : null
  const href = buildSiteDocumentHref({
    type: draft.type,
    sourceType: draft.sourceType,
    slug,
    linkUrl: draft.linkUrl.trim(),
  })

  return {
    href,
    isExternal: isExternalSiteDocumentHref(href),
    label: draft.sourceType === "DOCUMENT" ? `${getSiteDocumentTypeLabel(draft.type)}访问路径` : "链接跳转地址",
  }
}

function PreviewPath({ draft }: { draft: AnnouncementDraft }) {
  const preview = getDraftPreviewHref(draft)

  return (
    <div className="rounded-[16px] border border-dashed border-border bg-background px-3 py-3 text-xs leading-6 text-muted-foreground">
      <span className="font-medium text-foreground">{preview.label}：</span>
      <span className="ml-1 break-all">{preview.href}</span>
      {preview.isExternal ? <ExternalLink className="ml-2 inline h-3.5 w-3.5" /> : null}
    </div>
  )
}

function TitleColorField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const normalizedValue = normalizeHexColor(value || "#111827", "#111827")

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">标题颜色</p>
      <div>
        <PickerTriggerField value={value || normalizedValue} previewColor={value || normalizedValue} fallbackColor="#111827" onClick={() => setOpen((current) => !current)} />
        {open ? (
          <PickerPopover title="选择标题颜色" onClose={() => setOpen(false)}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={normalizedValue}
                onChange={(event) => onChange(event.target.value)}
                className="h-8 w-10 cursor-pointer rounded-lg border border-border bg-background p-0.5"
                aria-label="选择标题颜色"
              />
              <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-8 w-28 rounded-full border border-border bg-background px-3 text-xs outline-none"
                placeholder="#111827"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {TITLE_COLOR_PRESETS.map((preset) => {
                const active = (value || "").toLowerCase() === preset.toLowerCase()
                return (
                  <button
                    key={preset}
                    type="button"
                    className={active ? "h-7 w-7 rounded-full ring-2 ring-foreground/20 ring-offset-1 ring-offset-background" : "h-7 w-7 rounded-full border border-border"}
                    style={{ backgroundColor: preset }}
                    onClick={() => {
                      onChange(preset)
                      setOpen(false)
                    }}
                    aria-label={`使用颜色 ${preset}`}
                  />
                )
              })}
            </div>
          </PickerPopover>
        ) : null}
      </div>
    </div>
  )
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

function TypeBadge({ type }: { type: DraftType }) {
  return type === "HELP"
    ? <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">帮助文档</span>
    : <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">公告</span>
}

function SourceTypeBadge({ sourceType }: { sourceType: DraftSourceType }) {
  return sourceType === "LINK"
    ? <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-200">链接</span>
    : <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">文档</span>
}

function DocumentAnchor({ href, isExternal, className, children }: { href: string; isExternal: boolean; className?: string; children: React.ReactNode }) {
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
        <ExternalLink className="h-3 w-3" />
      </a>
    )
  }

  return (
    <Link href={href} className={className}>
      {children}
      <ArrowUpRight className="h-3 w-3" />
    </Link>
  )
}
