"use client"

import Image from "next/image"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Loader2, Plus, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import type { FriendLinkItem } from "@/lib/friend-links"

interface AdminFriendLinksSettingsFormProps {
  initialSettings: {
    friendLinksEnabled: boolean
    friendLinkApplicationEnabled: boolean
    friendLinkAnnouncement: string
  }
  items: FriendLinkItem[]
  pendingCount: number
}

interface FriendLinkDraft {
  name: string
  url: string
  logoPath: string
  sortOrder: string
  reviewNote: string
}

const EMPTY_DRAFT: FriendLinkDraft = {
  name: "",
  url: "",
  logoPath: "",
  sortOrder: "0",
  reviewNote: "",
}

export function AdminFriendLinksSettingsForm({ initialSettings, items, pendingCount }: AdminFriendLinksSettingsFormProps) {
  const router = useRouter()
  const [friendLinksEnabled, setFriendLinksEnabled] = useState(initialSettings.friendLinksEnabled)
  const [friendLinkApplicationEnabled, setFriendLinkApplicationEnabled] = useState(initialSettings.friendLinkApplicationEnabled)
  const [friendLinkAnnouncement, setFriendLinkAnnouncement] = useState(initialSettings.friendLinkAnnouncement)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [createDraft, setCreateDraft] = useState<FriendLinkDraft>(EMPTY_DRAFT)
  const [editingDrafts, setEditingDrafts] = useState<Record<string, FriendLinkDraft>>(() => Object.fromEntries(items.map((item) => [item.id, toDraft(item)])))
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function updateCreateDraft<K extends keyof FriendLinkDraft>(key: K, value: FriendLinkDraft[K]) {
    setCreateDraft((current) => ({ ...current, [key]: value }))
  }

  function updateEditingDraft<K extends keyof FriendLinkDraft>(id: string, key: K, value: FriendLinkDraft[K]) {
    setEditingDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? EMPTY_DRAFT),
        [key]: value,
      },
    }))
  }

  async function uploadLogo(file: File, target: "create" | string) {
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片格式的 LOGO 文件", "上传失败")
      return
    }

    setUploadingTarget(target)
    const formData = new FormData()
    formData.append("file", file)
    formData.append("folder", "friend-links")

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      const result = await response.json()

      if (!response.ok) {
        toast.error(result.message ?? "LOGO 上传失败", "上传失败")
        return
      }

      const logoPath = String(result.data?.urlPath ?? "")
      if (target === "create") {
        updateCreateDraft("logoPath", logoPath)
      } else {
        updateEditingDraft(target, "logoPath", logoPath)
      }
      toast.success("LOGO 上传成功", "上传成功")
    } catch {
      toast.error("LOGO 上传失败，请稍后重试", "上传失败")
    } finally {
      setUploadingTarget(null)
    }
  }

  function submitSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const response = await fetch("/api/admin/site-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "site-friend-links",
          friendLinksEnabled,
          friendLinkApplicationEnabled,
          friendLinkAnnouncement,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "友情链接设置保存失败", "保存失败")
        return
      }
      toast.success(result.message ?? "友情链接设置已保存", "保存成功")
      router.refresh()
    })
  }

  function createFriendLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const response = await fetch("/api/admin/friend-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: createDraft.name,
          url: createDraft.url,
          logoPath: createDraft.logoPath,
          sortOrder: Number(createDraft.sortOrder || 0),
          reviewNote: createDraft.reviewNote,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "新增友情链接失败", "新增失败")
        return
      }

      toast.success(result.message ?? "友情链接已创建", "新增成功")
      setCreateDraft(EMPTY_DRAFT)
      setCreateOpen(false)
      router.refresh()
    })
  }

  function submitReview(id: string, action: "approve" | "reject" | "disable" | "update") {
    const draft = editingDrafts[id] ?? EMPTY_DRAFT
    startTransition(async () => {
      const response = await fetch("/api/admin/friend-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          name: draft.name,
          url: draft.url,
          logoPath: draft.logoPath,
          reviewNote: draft.reviewNote,
          sortOrder: Number(draft.sortOrder || 0),
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "操作失败", "操作失败")
        return
      }
      toast.success(result.message ?? "操作成功", "操作成功")
      setEditingId(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submitSettings} className="rounded-[22px] border border-border p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">友情链接设置</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">控制首页展示、申请开关与公告内容。</p>
          </div>
          <Button type="button" className="rounded-full" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />新增友情链接
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ToggleRow label="开启友情链接" description="关闭后首页与 /link 页面不展示友情链接。" checked={friendLinksEnabled} onChange={setFriendLinksEnabled} />
          <ToggleRow label="开启申请入口" description={`当前待审核 ${pendingCount} 条。`} checked={friendLinkApplicationEnabled} onChange={setFriendLinkApplicationEnabled} />
        </div>
        <label className="block space-y-2">
          <span className="text-sm font-medium">友情链接公告</span>
          <textarea value={friendLinkAnnouncement} onChange={(event) => setFriendLinkAnnouncement(event.target.value)} className="min-h-[120px] w-full rounded-[20px] border border-border bg-background px-4 py-3 text-sm outline-none" placeholder="填写友情链接公告，将显示在申请弹窗与友情链接页中。" />
        </label>
        <div className="flex items-center gap-3">
          <Button disabled={isPending}>{isPending ? "保存中..." : "保存设置"}</Button>
        </div>
      </form>

      <section className="rounded-[22px] border border-border p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">友情链接列表</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">更紧凑的卡片列表，展开后再编辑详情。</p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700">待审核 {pendingCount}</span>
        </div>

        <div className="space-y-3">
          {items.map((item) => {
            const activeEditing = editingId === item.id
            const draft = editingDrafts[item.id] ?? toDraft(item)

            return (
              <article key={item.id} className="rounded-[18px] border border-border bg-card px-3 py-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white p-1.5">
                      {draft.logoPath ? <Image src={draft.logoPath} alt={`${draft.name || item.name} logo`} fill sizes="44px" className="object-contain" unoptimized /> : <span className="text-sm font-semibold text-muted-foreground">{(draft.name || item.name).slice(0, 1)}</span>}

                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-sm font-semibold">{item.name}</h4>
                        <StatusBadge status={item.status} />
                        {item.status === "APPROVED" ? <span className="text-[11px] text-emerald-600">首页可见</span> : null}
                      </div>

                      <p className="truncate text-xs text-muted-foreground">{item.url}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input value={draft.sortOrder} onChange={(event) => updateEditingDraft(item.id, "sortOrder", event.target.value)} className="h-9 w-20 rounded-full border border-border bg-background px-3 text-xs outline-none" placeholder="排序" />
                    <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => setEditingId(activeEditing ? null : item.id)}>
                      {activeEditing ? "收起" : "编辑"}
                    </Button>
                    <Button type="button" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => submitReview(item.id, "approve")}>通过</Button>
                    <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => submitReview(item.id, "reject")}>驳回</Button>
                    <Button type="button" variant="ghost" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => submitReview(item.id, "disable")}>停用</Button>
                  </div>
                </div>

                {activeEditing ? (
                  <div className="mt-3 grid gap-3 rounded-[18px] border border-border bg-background/70 p-3 lg:grid-cols-[1fr_1fr]">
                    <Field label="网站名称">
                      <input value={draft.name} onChange={(event) => updateEditingDraft(item.id, "name", event.target.value)} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none" />
                    </Field>
                    <Field label="网站链接">
                      <input value={draft.url} onChange={(event) => updateEditingDraft(item.id, "url", event.target.value)} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none" />
                    </Field>
                    <div className="lg:col-span-2">
                      <Field label="LOGO">
                        <LogoUploader
                          value={draft.logoPath}
                          uploading={uploadingTarget === item.id}
                          onValueChange={(value) => updateEditingDraft(item.id, "logoPath", value)}
                          onUpload={(file) => uploadLogo(file, item.id)}
                        />
                      </Field>
                    </div>
                    <div className="lg:col-span-2">
                      <Field label="审核备注">
                        <textarea value={draft.reviewNote} onChange={(event) => updateEditingDraft(item.id, "reviewNote", event.target.value)} className="min-h-[88px] w-full rounded-[18px] border border-border bg-background px-3 py-2.5 text-sm outline-none" placeholder="填写审核备注，例如驳回原因、补充说明等。" />
                      </Field>
                    </div>
                    <div className="lg:col-span-2 flex justify-end">
                      <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" disabled={isPending} onClick={() => submitReview(item.id, "update")}>保存编辑</Button>
                    </div>
                  </div>
                ) : null}
              </article>
            )
          })}
          {items.length === 0 ? <p className="text-sm text-muted-foreground">当前还没有友情链接记录。</p> : null}
        </div>
      </section>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
          <div className="w-full max-w-xl rounded-[24px] border border-border bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">新增友情链接</h3>
                <p className="mt-1 text-sm text-muted-foreground">管理员可直接创建友情链接，默认创建为已通过状态。</p>
              </div>
              <Button type="button" variant="ghost" className="h-8 px-2" onClick={() => setCreateOpen(false)}>关闭</Button>
            </div>
            <form onSubmit={createFriendLink} className="mt-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="网站名称">
                  <input value={createDraft.name} onChange={(event) => updateCreateDraft("name", event.target.value)} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none" placeholder="请输入网站名称" />
                </Field>
                <Field label="网站链接">
                  <input value={createDraft.url} onChange={(event) => updateCreateDraft("url", event.target.value)} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none" placeholder="请输入网站地址（以 http 开头）" />
                </Field>
                <Field label="排序值">
                  <input value={createDraft.sortOrder} onChange={(event) => updateCreateDraft("sortOrder", event.target.value)} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none" placeholder="数字越小越靠前" />
                </Field>
              </div>
              <Field label="LOGO">
                <LogoUploader
                  value={createDraft.logoPath}
                  uploading={uploadingTarget === "create"}
                  onValueChange={(value) => updateCreateDraft("logoPath", value)}
                  onUpload={(file) => uploadLogo(file, "create")}
                />
              </Field>
              <Field label="备注">
                <textarea value={createDraft.reviewNote} onChange={(event) => updateCreateDraft("reviewNote", event.target.value)} className="min-h-[100px] w-full rounded-[18px] border border-border bg-background px-3 py-2.5 text-sm outline-none" placeholder="例如：首页推荐、合作来源等。" />
              </Field>
              <div className="flex items-center gap-3">
                <Button disabled={isPending}>{isPending ? "提交中..." : "新增友情链接"}</Button>
                <Button type="button" variant="ghost" disabled={isPending} onClick={() => setCreateOpen(false)}>取消</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function toDraft(item: FriendLinkItem): FriendLinkDraft {
  return {
    name: item.name,
    url: item.url,
    logoPath: item.logoPath ?? "",
    sortOrder: String(item.sortOrder),
    reviewNote: item.reviewNote ?? "",
  }
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-[18px] border border-border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">{description}</p>
      </div>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4" />
    </label>
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

function LogoUploader({ value, uploading, onValueChange, onUpload }: { value: string; uploading: boolean; onValueChange: (value: string) => void; onUpload: (file: File) => void }) {
  return (
    <div className="space-y-3 rounded-[18px] border border-dashed border-border bg-card/60 p-3">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? "上传中..." : "上传 LOGO"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              onUpload(file)
            }
            event.target.value = ""
          }}
        />
      </label>
      <input value={value} onChange={(event) => onValueChange(event.target.value)} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none" placeholder="或直接填写 LOGO 地址" />
      {value ? (
        <div className="relative h-14 w-36 overflow-hidden rounded-xl border border-border bg-white p-2">
          <Image src={value} alt="友情链接 LOGO" fill sizes="144px" className="object-contain" unoptimized />
        </div>
      ) : null}

    </div>
  )
}

function StatusBadge({ status }: { status: FriendLinkItem["status"] }) {
  const className = status === "APPROVED"
    ? "bg-emerald-100 text-emerald-700"
    : status === "REJECTED"
      ? "bg-rose-100 text-rose-700"
      : status === "DISABLED"
        ? "bg-slate-100 text-slate-700"
        : "bg-amber-100 text-amber-700"

  const label = status === "APPROVED"
    ? "已通过"
    : status === "REJECTED"
      ? "已驳回"
      : status === "DISABLED"
        ? "已停用"
        : "待审核"

  return <span className={`rounded-full px-2.5 py-1 text-[11px] ${className}`}>{label}</span>
}
