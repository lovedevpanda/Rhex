"use client"

import { useMemo, useState, useTransition } from "react"
import { Pencil, Plus, Save, ShieldCheck, ShieldQuestion, Trash2, XCircle } from "lucide-react"

import { AdminIconPickerField } from "@/components/admin-icon-picker-field"
import { LevelIcon } from "@/components/level-icon"
import { Button } from "@/components/ui/button"

export type AdminVerificationFieldItem = {
  id: string
  label: string
  type: "text" | "textarea" | "number" | "url"
  placeholder?: string
  required: boolean
  helpText?: string
  sortOrder: number
}

export type AdminVerificationTypeItem = {
  id?: string
  name: string
  slug: string
  description: string
  iconText: string
  color: string
  formFields: AdminVerificationFieldItem[]
  sortOrder: number
  status: boolean
  needRemark: boolean
  userLimit: number
  allowResubmitAfterReject: boolean
  applicationCount?: number
}

export type AdminVerificationApplicationItem = {
  id: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  content: string
  formResponseJson?: string | null
  note?: string | null
  rejectReason?: string | null
  submittedAt: string
  reviewedAt?: string | null
  user: {
    id: number
    username: string
    displayName: string
  }
  type: {
    id: string
    name: string
    iconText?: string | null
    color: string
  }
  reviewer?: {
    id: number
    username: string
    displayName: string
  } | null
}

interface AdminVerificationManagerProps {
  initialTypes: AdminVerificationTypeItem[]
  initialApplications: AdminVerificationApplicationItem[]
}

const COLOR_PRESETS = ["#2563eb", "#0f766e", "#9333ea", "#dc2626", "#ea580c", "#0891b2", "#16a34a", "#64748b"]
const FIELD_TYPE_OPTIONS: Array<{ value: AdminVerificationFieldItem["type"]; label: string }> = [
  { value: "text", label: "单行文本" },
  { value: "textarea", label: "多行文本" },
  { value: "number", label: "数字" },
  { value: "url", label: "链接" },
]

function createField(sortOrder: number): AdminVerificationFieldItem {
  return {
    id: `field_${Date.now()}_${sortOrder}`,
    label: "新字段",
    type: "text",
    placeholder: "",
    required: true,
    helpText: "",
    sortOrder,
  }
}

function createVerificationType(nextSortOrder: number): AdminVerificationTypeItem {
  return {
    name: "新认证",
    slug: `verification_${Date.now()}`,
    description: "",
    iconText: "✔️",
    color: "#2563eb",
    formFields: [],
    sortOrder: nextSortOrder,
    status: true,
    needRemark: true,
    userLimit: 1,
    allowResubmitAfterReject: true,
    applicationCount: 0,
  }
}

function normalizeColor(color: string) {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color
  }

  return "#2563eb"
}

function parseApplicationFormResponse(input?: string | null) {
  if (!input?.trim()) {
    return [] as Array<{ key: string; value: string }>
  }

  try {
    const parsed = JSON.parse(input) as Record<string, unknown>
    return Object.entries(parsed).map(([key, value]) => ({ key, value: String(value ?? "") }))
  } catch {
    return []
  }
}

export function AdminVerificationManager({ initialTypes, initialApplications }: AdminVerificationManagerProps) {
  const [types, setTypes] = useState(initialTypes)
  const [applications] = useState(initialApplications)
  const [editingIndex, setEditingIndex] = useState<number | null>(initialTypes[0] ? 0 : null)
  const [feedback, setFeedback] = useState("")
  const [reviewMessage, setReviewMessage] = useState<Record<string, string>>({})
  const [reviewRejectReason, setReviewRejectReason] = useState<Record<string, string>>({})
  const [applicationStatusFilter, setApplicationStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED">("ALL")
  const [applicationKeyword, setApplicationKeyword] = useState("")
  const [isPending, startTransition] = useTransition()

  const editingType = editingIndex === null ? null : types[editingIndex] ?? null
  const filteredApplications = useMemo(() => {
    const keyword = applicationKeyword.trim().toLowerCase()
    return applications.filter((item) => {
      if (applicationStatusFilter !== "ALL" && item.status !== applicationStatusFilter) {
        return false
      }
      if (!keyword) {
        return true
      }
      return [item.user.displayName, item.user.username, item.type.name, item.content]
        .some((value) => value.toLowerCase().includes(keyword))
    })
  }, [applicationKeyword, applicationStatusFilter, applications])
  const pendingApplications = useMemo(() => filteredApplications.filter((item) => item.status === "PENDING"), [filteredApplications])
  const handledApplications = useMemo(() => filteredApplications.filter((item) => item.status !== "PENDING"), [filteredApplications])

  function updateType(index: number, patch: Partial<AdminVerificationTypeItem>) {
    setTypes((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  function updateField(typeIndex: number, fieldIndex: number, patch: Partial<AdminVerificationFieldItem>) {
    setTypes((current) => current.map((item, itemIndex) => {
      if (itemIndex !== typeIndex) {
        return item
      }

      return {
        ...item,
        formFields: item.formFields.map((field, currentFieldIndex) => currentFieldIndex === fieldIndex ? { ...field, ...patch } : field),
      }
    }))
  }

  function appendType() {
    setTypes((current) => {
      const next = [...current, createVerificationType(current.length)]
      setEditingIndex(next.length - 1)
      return next
    })
  }

  function appendField(typeIndex: number) {
    setTypes((current) => current.map((item, itemIndex) => {
      if (itemIndex !== typeIndex) {
        return item
      }

      return {
        ...item,
        formFields: [...item.formFields, createField(item.formFields.length)],
      }
    }))
  }

  function removeField(typeIndex: number, fieldIndex: number) {
    setTypes((current) => current.map((item, itemIndex) => {
      if (itemIndex !== typeIndex) {
        return item
      }

      return {
        ...item,
        formFields: item.formFields.filter((_, currentFieldIndex) => currentFieldIndex !== fieldIndex).map((field, nextIndex) => ({
          ...field,
          sortOrder: nextIndex,
        })),
      }
    }))
  }

  function saveType(index: number) {
    const item = types[index]
    setFeedback("")

    startTransition(async () => {
      const response = await fetch("/api/admin/verifications", {
        method: item.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...item,
          formSchemaJson: JSON.stringify(item.formFields.map((field, fieldIndex) => ({
            ...field,
            sortOrder: fieldIndex,
          }))),
        }),
      })
      const result = await response.json()
      setFeedback(result.message ?? (response.ok ? "保存成功" : "保存失败"))
      if (response.ok) {
        window.location.reload()
      }
    })
  }

  function removeType(index: number) {
    const item = types[index]
    if (!item.id) {
      setTypes((current) => current.filter((_, itemIndex) => itemIndex !== index))
      setEditingIndex((current) => {
        if (current === null) return null
        if (current === index) return null
        return current > index ? current - 1 : current
      })
      return
    }

    if (!window.confirm(`确认删除认证类型“${item.name}”吗？`)) {
      return
    }

    startTransition(async () => {
      const response = await fetch("/api/admin/verifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      })
      const result = await response.json()
      setFeedback(result.message ?? (response.ok ? "删除成功" : "删除失败"))
      if (response.ok) {
        window.location.reload()
      }
    })
  }

  function reviewApplication(applicationId: string, status: "APPROVED" | "REJECTED") {
    setFeedback("")
    startTransition(async () => {
      const response = await fetch("/api/admin/verifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          applicationId,
          status,
          note: reviewMessage[applicationId] ?? "",
          rejectReason: reviewRejectReason[applicationId] ?? "",
        }),
      })
      const result = await response.json()
      setFeedback(result.message ?? (response.ok ? "审核完成" : "审核失败"))
      if (response.ok) {
        window.location.reload()
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-border bg-card p-5">
        <div>
          <h3 className="text-lg font-semibold">认证系统</h3>
          <p className="mt-1 text-sm text-muted-foreground">后台可自定义认证类型、图标以及申请表单字段，前台用户按模板提交资料后由管理员审核通过。</p>
        </div>
        <Button className="gap-2 rounded-full" onClick={appendType} type="button">
          <Plus className="h-4 w-4" />
          新建认证
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="rounded-[24px] border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold">认证类型</h4>
              <span className="text-sm text-muted-foreground">共 {types.length} 项</span>
            </div>
            <div className="mt-4 space-y-3">
              {types.length === 0 ? <p className="text-sm text-muted-foreground">还没有认证类型，先创建一项。</p> : null}
              {types.map((item, index) => (
                <button
                  key={item.id ?? `${item.slug}-${index}`}
                  type="button"
                  onClick={() => setEditingIndex(index)}
                  className={editingIndex === index ? "w-full rounded-[22px] border border-foreground bg-accent/60 p-4 text-left" : "w-full rounded-[22px] border border-border bg-background p-4 text-left hover:bg-accent/40"}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ backgroundColor: `${item.color}18`, color: item.color }}>
                        <LevelIcon icon={item.iconText} color={item.color} className="h-5 w-5 text-[20px]" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">{item.name}</p>
                          <span className={item.status ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700" : "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"}>{item.status ? "启用" : "停用"}</span>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{item.slug} · 字段 {item.formFields.length} · 申请 {item.applicationCount ?? 0}</p>
                      </div>
                    </div>
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-border bg-card p-4">
            <h4 className="text-base font-semibold">申请筛选</h4>
            <p className="mt-1 text-sm text-muted-foreground">支持按状态和关键词快速筛选认证申请。</p>
            <div className="mt-4 grid gap-3">
              <label className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">关键词</span>
                <input value={applicationKeyword} onChange={(event) => setApplicationKeyword(event.target.value)} placeholder="用户名 / 昵称 / 认证类型 / 申请内容" className="h-10 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-foreground/30" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">状态</span>
                <select value={applicationStatusFilter} onChange={(event) => setApplicationStatusFilter(event.target.value as "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED")} className="h-10 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-foreground/30">
                  <option value="ALL">全部状态</option>
                  <option value="PENDING">待审核</option>
                  <option value="APPROVED">已通过</option>
                  <option value="REJECTED">已驳回</option>
                  <option value="CANCELLED">已取消</option>
                </select>
              </label>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">当前筛选后待审核 {pendingApplications.length} 条。</p>
          </div>
        </section>

        <section className="space-y-6">
          {!editingType ? (
            <div className="rounded-[28px] border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">请选择左侧认证类型，或新建一项认证开始配置。</div>
          ) : (
            <div className="rounded-[28px] border border-border bg-card p-5 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold">认证编辑</h4>
                  <p className="mt-1 text-sm text-muted-foreground">可定义个人认证、商家认证或其它认证，并自定义前台申请字段。</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="gap-2 rounded-full" onClick={() => removeType(editingIndex!)}>
                    <Trash2 className="h-4 w-4" />
                    删除
                  </Button>
                  <Button type="button" className="gap-2 rounded-full" disabled={isPending} onClick={() => saveType(editingIndex!)}>
                    <Save className="h-4 w-4" />
                    {isPending ? "保存中..." : "保存认证"}
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="认证名称" value={editingType.name} onChange={(value) => updateType(editingIndex!, { name: value })} placeholder="如 个人认证" />
                <Field label="唯一标识" value={editingType.slug} onChange={(value) => updateType(editingIndex!, { slug: value.replace(/\s+/g, "-") })} placeholder="如 personal-verified" />
                <Field label="排序" type="number" value={String(editingType.sortOrder)} onChange={(value) => updateType(editingIndex!, { sortOrder: Math.max(0, Number(value) || 0) })} placeholder="0" />
                <AdminIconPickerField
                  label="认证图标"
                  value={editingType.iconText}
                  onChange={(value) => updateType(editingIndex!, { iconText: value })}
                  previewColor={editingType.color}
                  popoverTitle="选择认证图标"
                  containerClassName="space-y-2"
                  triggerClassName="flex h-11 w-full items-center gap-3 rounded-[18px] border border-border bg-background px-4 text-left text-sm transition-colors hover:bg-accent"
                  textareaRows={4}
                />
                <ColorField color={editingType.color} onChange={(value) => updateType(editingIndex!, { color: value })} />
                <Field label="每用户可通过数量" type="number" value={String(editingType.userLimit)} onChange={(value) => updateType(editingIndex!, { userLimit: Math.max(1, Number(value) || 1) })} placeholder="1" />
                <Field className="md:col-span-2 xl:col-span-3" label="说明" value={editingType.description} onChange={(value) => updateType(editingIndex!, { description: value })} placeholder="前台申请时展示给用户的说明" />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <CheckItem checked={editingType.status} onChange={(checked) => updateType(editingIndex!, { status: checked })} label="启用该认证" />
                <CheckItem checked={editingType.needRemark} onChange={(checked) => updateType(editingIndex!, { needRemark: checked })} label="申请时需要说明" />
                <CheckItem checked={editingType.allowResubmitAfterReject} onChange={(checked) => updateType(editingIndex!, { allowResubmitAfterReject: checked })} label="驳回后允许重提" />
              </div>

              <div className="mt-6 rounded-[24px] border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-semibold">申请表单字段</h5>
                    <p className="mt-1 text-xs text-muted-foreground">不同认证可以配置不同字段，例如真实姓名、店铺名称、官网链接、资质说明等。</p>
                  </div>
                  <Button type="button" variant="outline" className="gap-2 rounded-full" onClick={() => appendField(editingIndex!)}>
                    <Plus className="h-4 w-4" />
                    新增字段
                  </Button>
                </div>

                <div className="mt-4 space-y-3">
                  {editingType.formFields.length === 0 ? <p className="text-sm text-muted-foreground">当前未配置字段，前台将退回到单一“申请说明”文本框。</p> : null}
                  {editingType.formFields.map((field, fieldIndex) => (
                    <div key={field.id} className="rounded-[22px] border border-border bg-secondary/20 p-4">
                      <div className="grid gap-3 xl:grid-cols-[1fr_180px_1fr_1fr_auto] xl:items-end">
                        <Field label="字段名称" value={field.label} onChange={(value) => updateField(editingIndex!, fieldIndex, { label: value })} placeholder="如 真实姓名" />
                        <SelectField label="字段类型" value={field.type} options={FIELD_TYPE_OPTIONS} onChange={(value) => updateField(editingIndex!, fieldIndex, { type: value as AdminVerificationFieldItem["type"] })} />
                        <Field label="占位提示" value={field.placeholder ?? ""} onChange={(value) => updateField(editingIndex!, fieldIndex, { placeholder: value })} placeholder="如 请输入真实姓名" />
                        <Field label="帮助说明" value={field.helpText ?? ""} onChange={(value) => updateField(editingIndex!, fieldIndex, { helpText: value })} placeholder="如 将展示给审核员" />
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => removeField(editingIndex!, fieldIndex)}>删除</Button>
                      </div>
                      <div className="mt-3">
                        <CheckItem checked={field.required} onChange={(checked) => updateField(editingIndex!, fieldIndex, { required: checked })} label="该字段为必填" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {feedback ? <p className="mt-4 text-sm text-muted-foreground">{feedback}</p> : null}
            </div>
          )}

          <div className="rounded-[28px] border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold">认证审核</h4>
                <p className="mt-1 text-sm text-muted-foreground">审核通过后，用户会在帖子详情和评论作者名前展示认证图标。</p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">待审 {pendingApplications.length}</span>
            </div>

            <div className="mt-4 space-y-4">
              {pendingApplications.length === 0 ? <p className="text-sm text-muted-foreground">当前没有待审核的认证申请。</p> : null}
              {pendingApplications.map((item) => {
                const formEntries = parseApplicationFormResponse(item.formResponseJson)
                return (
                  <div key={item.id} className="rounded-[22px] border border-border bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold">{item.user.displayName}</span>
                          <span className="text-muted-foreground">@{item.user.username}</span>
                          <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ color: item.type.color, backgroundColor: `${item.type.color}12` }}>{item.type.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">提交时间：{new Date(item.submittedAt).toLocaleString()}</p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700">待审核</span>
                    </div>
                    {formEntries.length > 0 ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {formEntries.map((entry) => (
                          <div key={entry.key} className="rounded-[18px] bg-secondary/30 p-3 text-sm">
                            <p className="text-xs text-muted-foreground">{entry.key}</p>
                            <p className="mt-1 break-all leading-7 text-foreground/90">{entry.value || "-"}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-[18px] bg-secondary/30 p-3 text-sm leading-7 text-foreground/90">{item.content}</div>
                    )}
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <textarea
                        value={reviewMessage[item.id] ?? item.note ?? ""}
                        onChange={(event) => setReviewMessage((current) => ({ ...current, [item.id]: event.target.value }))}
                        placeholder="审核备注（可选）"
                        className="min-h-[88px] rounded-[18px] border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-foreground/30"
                      />
                      <textarea
                        value={reviewRejectReason[item.id] ?? item.rejectReason ?? ""}
                        onChange={(event) => setReviewRejectReason((current) => ({ ...current, [item.id]: event.target.value }))}
                        placeholder="驳回原因（驳回时必填）"
                        className="min-h-[88px] rounded-[18px] border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-foreground/30"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" className="gap-2 rounded-full" disabled={isPending} onClick={() => reviewApplication(item.id, "APPROVED")}>
                        <ShieldCheck className="h-4 w-4" />
                        通过
                      </Button>
                      <Button type="button" variant="outline" className="gap-2 rounded-full" disabled={isPending} onClick={() => reviewApplication(item.id, "REJECTED")}>
                        <XCircle className="h-4 w-4" />
                        驳回
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            {handledApplications.length > 0 ? (
              <div className="mt-6 border-t border-border pt-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldQuestion className="h-4 w-4" />
                  最近处理记录
                </div>
                <div className="mt-3 space-y-3">
                  {handledApplications.slice(0, 12).map((item) => (
                    <div key={item.id} className="rounded-[18px] border border-border bg-secondary/20 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{item.user.displayName}</span>
                          <span className="text-muted-foreground">{item.type.name}</span>
                        </div>
                        <span className={item.status === "APPROVED" ? "rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] text-emerald-700" : item.status === "REJECTED" ? "rounded-full bg-rose-100 px-2.5 py-1 text-[11px] text-rose-700" : "rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600"}>{item.status === "APPROVED" ? "已通过" : item.status === "REJECTED" ? "已驳回" : "已取消"}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">处理时间：{item.reviewedAt ? new Date(item.reviewedAt).toLocaleString() : "-"}{item.reviewer ? ` · 审核人 ${item.reviewer.displayName}` : ""}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = "text", className = "" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; className?: string }) {
  return (
    <label className={`space-y-2 ${className}`}>
      <span className="text-sm font-medium">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-foreground/30" />
    </label>
  )
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-foreground/30">
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function CheckItem({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 rounded-[20px] border border-border px-4 py-3 text-sm">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  )
}

function ColorField({ color, onChange }: { color: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">主题色</span>
      <div className="flex items-center gap-2 rounded-[18px] border border-border bg-background px-3 py-2.5">
        <input type="color" value={normalizeColor(color)} onChange={(event) => onChange(event.target.value)} className="h-8 w-10 cursor-pointer rounded-lg border border-border bg-background p-0.5" aria-label="选择认证主题色" />
        <input value={color} onChange={(event) => onChange(event.target.value)} className="h-8 w-28 rounded-full border border-border bg-background px-3 text-xs outline-none" />
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {COLOR_PRESETS.map((preset) => (
            <button key={preset} type="button" className="h-6 w-6 rounded-full border border-border" style={{ backgroundColor: preset }} onClick={() => onChange(preset)} aria-label={`使用颜色 ${preset}`} />
          ))}
        </div>
      </div>
    </div>
  )
}
