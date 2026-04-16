"use client"

import Link from "next/link"
import { ArrowUpRight, BookOpen, ExternalLink, Files, Loader2, Pin, Plus, Save, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

import { AdminSummaryStrip } from "@/components/admin/admin-summary-strip"
import { AddonEditor } from "@/components/addon-editor"
import { useAdminMutation } from "@/hooks/use-admin-mutation"
import { FormModal } from "@/components/ui/modal"
import { ColorPicker } from "@/components/ui/color-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import type { AdminAnnouncementItem } from "@/lib/admin-announcements"
import { adminGet, adminPost } from "@/lib/admin-client"
import { buildSiteDocumentHref, getSiteDocumentTypeLabel, isExternalSiteDocumentHref, normalizeSiteDocumentSlug } from "@/lib/site-document-types"
import { cn } from "@/lib/utils"

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

interface StatusAction {
  status: DraftStatus
  label: string
  variant: "default" | "outline" | "ghost"
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

function isNullableString(value: unknown) {
  return value === null || typeof value === "string"
}

function isAdminAnnouncementItem(value: unknown): value is AdminAnnouncementItem {
  if (!value || typeof value !== "object") {
    return false
  }

  const item = value as Partial<AdminAnnouncementItem>
  return typeof item.id === "string"
    && (item.type === "ANNOUNCEMENT" || item.type === "HELP")
    && typeof item.title === "string"
    && typeof item.content === "string"
    && (item.sourceType === "DOCUMENT" || item.sourceType === "LINK")
    && isNullableString(item.slug)
    && isNullableString(item.linkUrl)
    && isNullableString(item.titleColor)
    && typeof item.titleBold === "boolean"
    && (item.status === "DRAFT" || item.status === "PUBLISHED" || item.status === "OFFLINE")
    && typeof item.isPinned === "boolean"
}

function isAdminAnnouncementList(value: unknown): value is AdminAnnouncementItem[] {
  return Array.isArray(value) && value.every(isAdminAnnouncementItem)
}

function getAvailableStatusActions(status: DraftStatus): StatusAction[] {
  if (status === "PUBLISHED") {
    return [
      { status: "DRAFT", label: "转草稿", variant: "outline" },
      { status: "OFFLINE", label: "下线", variant: "ghost" },
    ]
  }

  if (status === "OFFLINE") {
    return [
      { status: "PUBLISHED", label: "发布", variant: "default" },
      { status: "DRAFT", label: "转草稿", variant: "outline" },
    ]
  }

  return [
    { status: "PUBLISHED", label: "发布", variant: "default" },
    { status: "OFFLINE", label: "下线", variant: "ghost" },
  ]
}

export function AdminAnnouncementManager({ initialItems }: AdminAnnouncementManagerProps) {
  const [items, setItems] = useState(initialItems)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createDraft, setCreateDraft] = useState<AnnouncementDraft>(EMPTY_DRAFT)
  const [editingDrafts, setEditingDrafts] = useState<Record<string, AnnouncementDraft>>(() => Object.fromEntries(initialItems.map((item) => [item.id, toDraft(item)])))
  const { isPending, runMutation } = useAdminMutation()

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

  function syncItems(nextItems: AdminAnnouncementItem[]) {
    setItems(nextItems)
    setEditingDrafts(Object.fromEntries(nextItems.map((item) => [item.id, toDraft(item)])))
  }

  async function refreshList() {
    const result = await adminGet<AdminAnnouncementItem[]>("/api/admin/announcements", {
      cache: "no-store",
      validateData: isAdminAnnouncementList,
      invalidDataMessage: "站点文档列表返回格式不正确",
      defaultErrorMessage: "刷新站点文档列表失败",
    })

    syncItems(result.data)
  }

  function runAnnouncementMutation(
    body: Record<string, unknown>,
    options: {
      successTitle: string
      errorTitle: string
      successMessage: string
      errorMessage: string
      onSuccess?: () => void | Promise<void>
    },
  ) {
    runMutation({
      mutation: async () => {
        const result = await adminPost("/api/admin/announcements", body, {
          defaultSuccessMessage: options.successMessage,
          defaultErrorMessage: options.errorMessage,
        })

        await refreshList()
        return result
      },
      successTitle: options.successTitle,
      errorTitle: options.errorTitle,
      refreshRouter: true,
      onSuccess: async () => {
        await options.onSuccess?.()
      },
    })
  }

  function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    runAnnouncementMutation({ action: "save", ...createDraft }, {
      successTitle: "创建成功",
      errorTitle: "创建失败",
      successMessage: "站点文档已创建",
      errorMessage: "站点文档创建失败",
      onSuccess: () => {
        setCreateDraft(EMPTY_DRAFT)
        setCreateOpen(false)
      },
    })
  }

  function submitUpdate(id: string) {
    const draft = editingDrafts[id]
    if (!draft) {
      return
    }

    runAnnouncementMutation({ action: "save", id, ...draft }, {
      successTitle: "保存成功",
      errorTitle: "保存失败",
      successMessage: "站点文档已更新",
      errorMessage: "站点文档保存失败",
      onSuccess: () => {
        setEditingId(null)
      },
    })
  }

  function submitDelete(id: string) {
    runAnnouncementMutation({ action: "delete", id }, {
      successTitle: "删除成功",
      errorTitle: "删除失败",
      successMessage: "站点文档已删除",
      errorMessage: "站点文档删除失败",
      onSuccess: () => {
        if (editingId === id) {
          setEditingId(null)
        }
      },
    })
  }

  function submitTogglePin(id: string, isPinned: boolean) {
    runAnnouncementMutation({ action: "toggle-pin", id, isPinned }, {
      successTitle: "操作成功",
      errorTitle: "操作失败",
      successMessage: "置顶状态已更新",
      errorMessage: "置顶状态更新失败",
    })
  }

  function submitStatus(id: string, status: DraftStatus) {
    runAnnouncementMutation({ action: "update-status", id, status }, {
      successTitle: "操作成功",
      errorTitle: "操作失败",
      successMessage: "站点文档状态已更新",
      errorMessage: "站点文档状态更新失败",
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b">
          <CardTitle>站点文档管理</CardTitle>
          <CardDescription>统一管理公告和帮助文档，支持内部文档、外部链接、slug 与标题样式。</CardDescription>
          <CardAction>
            <Button type="button" className="rounded-full" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />新增站点文档
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="py-4">
          <AdminSummaryStrip
            items={[
              { label: "文档总数", value: stats.total, icon: <Files className="h-4 w-4" /> },
              { label: "公告", value: stats.announcements, icon: <Pin className="h-4 w-4" />, tone: "amber" },
              { label: "帮助文档", value: stats.helpDocuments, icon: <BookOpen className="h-4 w-4" />, tone: "sky" },
              { label: "已发布", value: stats.published, icon: <ArrowUpRight className="h-4 w-4" />, tone: "emerald" },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-sky-500" />
            <CardTitle>文档列表</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 py-4">
          {items.map((item) => {
            const activeEditing = editingId === item.id
            const draft = editingDrafts[item.id] ?? toDraft(item)

            return (
              <Card key={item.id} size="sm" className="py-0">
                <CardContent className="py-3">
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
                        <Badge className="border-transparent bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                          <Pin className="h-3 w-3" />
                          置顶
                        </Badge>
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
                  {getAvailableStatusActions(item.status).map((action) => (
                    <Button
                      key={`${item.id}-${action.status}`}
                      type="button"
                      variant={action.variant}
                      className="h-8 rounded-full px-3 text-xs"
                      disabled={isPending}
                      onClick={() => submitStatus(item.id, action.status)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>

                {activeEditing ? <EditorForm draft={draft} isPending={isPending} onChange={(key, value) => updateEditingDraft(item.id, key, value)} onSubmit={() => submitUpdate(item.id)} /> : null}
                </CardContent>
              </Card>
            )
          })}

          {items.length === 0 ? <p className="text-sm text-muted-foreground">当前还没有站点文档，创建后即可在首页公告区或帮助文档页展示。</p> : null}
        </CardContent>
      </Card>

      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={submitCreate}
        title="新增站点文档"
        description="一个入口管理公告与帮助文档，支持文档页和跳转链接两种模式。"
        size="lg"
        closeDisabled={isPending}
        closeOnEscape={!isPending}
        footer={({ formId }) => (
          <div className="flex items-center gap-3">
            <Button type="submit" form={formId} disabled={isPending} className="rounded-full">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}创建站点文档
            </Button>
            <Button type="button" variant="ghost" disabled={isPending} onClick={() => setCreateOpen(false)}>取消</Button>
          </div>
        )}
      >
        <EditorFields draft={createDraft} onChange={updateCreateDraft} />
      </FormModal>
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
          <Select value={draft.type} onValueChange={(value) => onChange("type", value as DraftType)}>
            <SelectTrigger className="h-10 rounded-[16px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ANNOUNCEMENT">公告</SelectItem>
              <SelectItem value="HELP">帮助文档</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="内容模式">
          <Select value={draft.sourceType} onValueChange={(value) => onChange("sourceType", value as DraftSourceType)}>
            <SelectTrigger className="h-10 rounded-[16px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DOCUMENT">内部文档</SelectItem>
              <SelectItem value="LINK">链接跳转</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="文档标题">
        <Input value={draft.title} onChange={(event) => onChange("title", event.target.value)} className="h-10 rounded-[16px] bg-background px-3" placeholder="请输入文档标题" />
      </Field>

      <div className="grid gap-3 md:grid-cols-[180px_1fr_1fr]">
        <Field label="发布状态">
          <Select value={draft.status} onValueChange={(value) => onChange("status", value as DraftStatus)}>
            <SelectTrigger className="h-10 rounded-[16px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">草稿</SelectItem>
              <SelectItem value="PUBLISHED">已发布</SelectItem>
              <SelectItem value="OFFLINE">已下线</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <TitleColorField value={draft.titleColor} onChange={(value) => onChange("titleColor", value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <CheckItem checked={draft.titleBold} onChange={(checked) => onChange("titleBold", checked)} label="标题加粗" />
          <CheckItem checked={draft.isPinned} onChange={(checked) => onChange("isPinned", checked)} label="置顶显示" />
        </div>
      </div>

      {draft.sourceType === "DOCUMENT" ? (
        <>
          <Field label="自定义 slug">
            <Input value={draft.slug} onChange={(event) => onChange("slug", event.target.value)} className="h-10 rounded-[16px] bg-background px-3" placeholder="如 node 或 guide/getting-started" />
          </Field>
          <PreviewPath draft={draft} />
          <Field label="文档内容">
            <AddonEditor
              context="admin"
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
            <Input value={draft.linkUrl} onChange={(event) => onChange("linkUrl", event.target.value)} className="h-10 rounded-[16px] bg-background px-3" placeholder="如 /help/node 或 https://example.com/docs" />
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
  return (
    <ColorPicker
      label="标题颜色"
      value={value}
      onChange={onChange}
      presets={TITLE_COLOR_PRESETS}
      fallbackColor="#111827"
      placeholder="#111827"
      popoverTitle="选择标题颜色"
    />
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
    return <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">已发布</Badge>
  }

  if (status === "OFFLINE") {
    return <Badge className="border-transparent bg-slate-200 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200">已下线</Badge>
  }

  return <Badge className="border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">草稿</Badge>
}

function TypeBadge({ type }: { type: DraftType }) {
  return type === "HELP"
    ? <Badge className="border-transparent bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">帮助文档</Badge>
    : <Badge className="border-transparent bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">公告</Badge>
}

function SourceTypeBadge({ sourceType }: { sourceType: DraftSourceType }) {
  return sourceType === "LINK"
    ? <Badge className="border-transparent bg-zinc-200 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-200">链接</Badge>
    : <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">文档</Badge>
}

function CheckItem({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <Button type="button" variant={checked ? "default" : "outline"} className={cn("h-10 rounded-[16px] justify-start px-3 text-sm", checked ? "" : "text-muted-foreground")} onClick={() => onChange(!checked)}>
      {label}
    </Button>
  )
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

