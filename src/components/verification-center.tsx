"use client"

import { useMemo, useState, useTransition } from "react"
import { CheckCircle2, Clock3, ShieldCheck, XCircle } from "lucide-react"

import { LevelIcon } from "@/components/level-icon"
import { Button } from "@/components/ui/rbutton"
import { showConfirm } from "@/components/ui/alert-dialog"
import { IconPicker } from "@/components/ui/icon-picker"
import { formatDateTime } from "@/lib/formatters"
import type { VerificationFormField } from "@/lib/verification-form-schema"

type VerificationApplicationStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"

type VerificationApplicationItem = {
  id: string
  status: VerificationApplicationStatus
  submittedAt: string
  reviewedAt?: string | null
  rejectReason?: string | null
  note?: string | null
  content?: string | null
  customIconText?: string | null
  customDescription?: string | null
  formResponse?: Record<string, string>
  type: {
    id: string
    name: string
    iconText: string
    color: string
    description?: string | null
  }
}

type VerificationTypeItem = {
  id: string
  name: string
  slug: string
  description?: string | null
  iconText: string
  color: string
  sortOrder: number
  status: boolean
  userLimit: number
  allowResubmitAfterReject: boolean
  formFields: VerificationFormField[]
  currentApplication?: VerificationApplicationItem | null
}

type ApprovedVerificationItem = {
  id: string
  name: string
  iconText: string
  customIconText?: string | null
  color: string
  description?: string | null
  customDescription?: string | null
}

interface VerificationCenterProps {
  types: VerificationTypeItem[]
  approvedVerification?: ApprovedVerificationItem | null
}

function getInitialDraft(type: VerificationTypeItem | null, approvedVerification?: ApprovedVerificationItem | null) {
  if (!type) {
    return {
      content: "",
      customIconText: "",
      customDescription: "",
      formValues: {} as Record<string, string>,
    }
  }

  const currentApplication = type.currentApplication ?? null
  const isApprovedType = approvedVerification?.id === type.id

  return {
    content: currentApplication && currentApplication.status !== "APPROVED" && type.formFields.length === 0
      ? currentApplication.content ?? ""
      : "",
    customIconText: currentApplication?.customIconText
      ?? (isApprovedType ? approvedVerification?.customIconText ?? "" : ""),
    customDescription: currentApplication?.customDescription
      ?? (isApprovedType ? approvedVerification?.customDescription ?? "" : ""),
    formValues: currentApplication && currentApplication.status !== "APPROVED"
      ? currentApplication.formResponse ?? {}
      : {},
  }
}

export function VerificationCenter({ types, approvedVerification }: VerificationCenterProps) {
  const [selectedTypeId, setSelectedTypeId] = useState(types[0]?.id ?? "")
  const initialDraft = getInitialDraft(types[0] ?? null, approvedVerification)
  const [content, setContent] = useState(initialDraft.content)
  const [customIconText, setCustomIconText] = useState(initialDraft.customIconText)
  const [customDescription, setCustomDescription] = useState(initialDraft.customDescription)
  const [formValues, setFormValues] = useState<Record<string, string>>(initialDraft.formValues)
  const [feedback, setFeedback] = useState("")
  const [isUnbinding, setIsUnbinding] = useState(false)
  const [isPending, startTransition] = useTransition()

  const selectedType = useMemo(() => types.find((item) => item.id === selectedTypeId) ?? types[0] ?? null, [selectedTypeId, types])
  const currentApplication = selectedType?.currentApplication ?? null
  const approvedTypeId = approvedVerification?.id ?? ""
  const hasApprovedVerification = Boolean(approvedVerification)
  const isSelectedApprovedType = Boolean(selectedType && approvedTypeId === selectedType.id)
  const showDynamicFields = Boolean(selectedType && selectedType.formFields.length > 0)
  const showCustomizationForm = isSelectedApprovedType && currentApplication?.status !== "PENDING"
  const showApprovedPendingState = isSelectedApprovedType && currentApplication?.status === "PENDING"

  function resetDraft(nextType: VerificationTypeItem | null) {
    const nextDraft = getInitialDraft(nextType, approvedVerification)
    setContent(nextDraft.content)
    setCustomIconText(nextDraft.customIconText)
    setCustomDescription(nextDraft.customDescription)
    setFormValues(nextDraft.formValues)
    setFeedback("")
  }

  function updateFieldValue(fieldId: string, value: string) {
    setFormValues((current) => ({
      ...current,
      [fieldId]: value,
    }))
  }

  function submit() {
    if (!selectedType) {
      return
    }

    setFeedback("")
    startTransition(async () => {
      const response = await fetch("/api/verifications/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationTypeId: selectedType.id,
          content: showCustomizationForm ? undefined : content,
          customIconText,
          customDescription,
          formResponse: !showCustomizationForm && selectedType.formFields.length > 0 ? formValues : undefined,
        }),
      })
      const result = await response.json()
      setFeedback(result.message ?? (response.ok ? "提交成功" : "提交失败"))
      if (response.ok) {
        window.location.reload()
      }
    })
  }

  async function unbindVerification() {
    const confirmed = await showConfirm({
      title: "解除认证绑定",
      description: "确认解除当前认证绑定吗？解除后你将失去当前认证标识，并可以重新申请其它认证。",
      confirmText: "确认解除",
      variant: "danger",
    })

    if (!confirmed) {
      return
    }

    setFeedback("")
    setIsUnbinding(true)

    try {
      const response = await fetch("/api/verifications/unbind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const result = await response.json()
      setFeedback(result.message ?? (response.ok ? "解除绑定成功" : "解除绑定失败"))
      if (response.ok) {
        window.location.reload()
      }
    } finally {
      setIsUnbinding(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Verification Center</p>
            <h1 className="mt-2 text-3xl font-semibold">账号认证中心</h1>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">在这里提交个人认证、商家认证或其它认证资料。通过认证后，你还可以继续提交自定义图标和介绍，仍需管理员复审。</p>
          </div>
          {approvedVerification ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: `${approvedVerification.color}18`, color: approvedVerification.color }}>
                  <LevelIcon icon={approvedVerification.customIconText?.trim() || approvedVerification.iconText} color={approvedVerification.color} className="h-5 w-5 text-[20px]" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
                </div>
                <div>
                  <p>当前已通过：<span className="font-medium">{approvedVerification.name}</span></p>
                  {approvedVerification.customDescription ? <p className="text-emerald-600/90 dark:text-emerald-200/90">{approvedVerification.customDescription}</p> : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">当前尚未通过任何认证</div>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold">可申请认证</h4>
              <span className="text-sm text-muted-foreground">共 {types.length} 项</span>
            </div>
            <div className="mt-4 space-y-3">
              {types.map((item) => {
                const isApprovedType = approvedTypeId === item.id
                const isDisabledItem = hasApprovedVerification && !isApprovedType
                const isActiveItem = selectedType?.id === item.id || isApprovedType
                const hasReviewTrail = isApprovedType && item.currentApplication?.status && item.currentApplication.status !== "APPROVED"

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isDisabledItem}
                    onClick={() => {
                      if (isDisabledItem) {
                        return
                      }
                      setSelectedTypeId(item.id)
                      resetDraft(item)
                    }}
                    className={isApprovedType ? "w-full rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 text-left dark:border-emerald-500/30 dark:bg-emerald-500/10" : isActiveItem ? "w-full rounded-xl border border-foreground bg-accent/60 p-4 text-left" : isDisabledItem ? "w-full rounded-xl border border-border bg-background/60 p-4 text-left opacity-55" : "w-full rounded-xl border border-border bg-background p-4 text-left hover:bg-accent/40"}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ backgroundColor: `${item.color}18`, color: item.color }}>
                        <LevelIcon icon={item.iconText} color={item.color} className="h-5 w-5 text-[20px]" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">{item.name}</p>
                          {isApprovedType ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700"><CheckCircle2 className="h-3 w-3" />已认证</span> : null}
                          {!isApprovedType ? renderStatusPill(item.currentApplication?.status) : null}
                          {hasReviewTrail ? renderStatusPill(item.currentApplication?.status) : null}
                        </div>
                        <p className="mt-1 text-xs leading-6 text-muted-foreground line-clamp-2">{item.description || "暂无说明"}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">字段数：{item.formFields.length || 1}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          {!selectedType ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">当前没有可申请的认证类型，请等待管理员配置。</div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl" style={{ backgroundColor: `${selectedType.color}18`, color: selectedType.color }}>
                  <LevelIcon icon={selectedType.iconText} color={selectedType.color} className="h-7 w-7 text-[28px]" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{showCustomizationForm || showApprovedPendingState ? `定制 ${selectedType.name}` : `申请 ${selectedType.name}`}</h2>
                  <p className="mt-1 text-sm leading-7 text-muted-foreground">{selectedType.description || "请填写你的认证材料，后台会尽快审核。"}</p>
                </div>
              </div>

              {currentApplication ? (
                <div className="mt-5 rounded-xl border border-border bg-secondary/20 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">当前申请状态：{renderStatusLabel(currentApplication.status)}</div>
                    <div className="text-xs text-muted-foreground">提交于 {formatDateTime(currentApplication.submittedAt)}</div>
                  </div>
                  {currentApplication.formResponse && Object.keys(currentApplication.formResponse).length > 0 ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {selectedType.formFields.map((field) => (
                        <div key={field.id} className="rounded-[18px] bg-background px-3 py-2.5">
                          <p className="text-xs text-muted-foreground">{field.label}</p>
                          <p className="mt-1 break-all text-foreground">{currentApplication.formResponse?.[field.id] || "-"}</p>
                        </div>
                      ))}
                    </div>
                  ) : currentApplication.content ? <p className="mt-3 text-muted-foreground whitespace-pre-wrap">{currentApplication.content}</p> : null}
                  {currentApplication.customIconText ? (
                    <div className="mt-3 rounded-[18px] bg-background px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">自定义图标</p>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: `${selectedType.color}18`, color: selectedType.color }}>
                          <LevelIcon icon={currentApplication.customIconText} color={selectedType.color} className="h-5 w-5 text-[20px]" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
                        </div>
                        <p className="break-all text-foreground">{currentApplication.customIconText}</p>
                      </div>
                    </div>
                  ) : null}
                  {currentApplication.customDescription ? (
                    <div className="mt-3 rounded-[18px] bg-background px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">个性描述</p>
                      <p className="mt-1 text-foreground">{currentApplication.customDescription}</p>
                    </div>
                  ) : null}
                  {currentApplication.note ? <p className="mt-2 text-muted-foreground">审核备注：{currentApplication.note}</p> : null}
                  {currentApplication.rejectReason ? <p className="mt-2 text-rose-600 dark:text-rose-300">驳回原因：{currentApplication.rejectReason}</p> : null}
                </div>
              ) : null}

              {showApprovedPendingState ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-4 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                    你的当前认证仍然有效，新的定制申请正在审核中；审核通过前，前台会继续显示旧的认证样式。
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" className="rounded-full" disabled={isUnbinding} onClick={() => void unbindVerification()}>
                      {isUnbinding ? "解绑中..." : "解除认证绑定"}
                    </Button>
                  </div>
                </div>
              ) : showCustomizationForm ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-4 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                    {currentApplication?.status === "REJECTED"
                      ? "你可以修改自定义图标或介绍后重新提交，当前认证继续保持生效。"
                      : "当前认证继续生效。提交新的自定义图标或介绍后，需等待管理员复审通过才会更新前台展示。"}
                  </div>

                  <label className="space-y-2">
                    <IconPicker
                      label="自定义图标（可选）"
                      value={customIconText}
                      onChange={setCustomIconText}
                      uploadFolder="icon"
                      placeholder="支持 emoji、图片链接、SVG 文件链接或上传后的本地路径"
                      description="支持 emoji、站内上传图片路径、远程图片链接和 .svg 文件链接。为了安全，认证图标暂不支持直接粘贴 SVG 源码。"
                      popoverTitle="设置自定义认证图标"
                      textareaRows={3}
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium">个性描述（可选）</span>
                    <input
                      value={customDescription}
                      onChange={(event) => setCustomDescription(event.target.value)}
                      placeholder="例如：独立开发者 / 认证摄影师"
                      className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-hidden transition-colors focus:border-foreground/30"
                    />
                    <p className="text-xs leading-6 text-muted-foreground">留空则不展示个性描述。提交时至少要修改一个定制项。</p>
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs leading-6 text-muted-foreground">定制申请只会修改展示样式，不会影响你当前已通过的认证主体。</p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="rounded-full" disabled={isUnbinding} onClick={() => void unbindVerification()}>
                        {isUnbinding ? "解绑中..." : "解除认证绑定"}
                      </Button>
                      <Button type="button" disabled={isPending} onClick={submit} className="rounded-full px-5">
                        {isPending ? "提交中..." : currentApplication?.status === "REJECTED" ? "重新提交定制审核" : "提交定制审核"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {showDynamicFields ? (
                    <div className="grid gap-4">
                      {selectedType.formFields.map((field) => (
                        <label key={field.id} className="space-y-2">
                          <span className="text-sm font-medium">{field.label}{field.required ? " *" : ""}</span>
                          {field.type === "textarea" ? (
                            <textarea
                              value={formValues[field.id] ?? ""}
                              onChange={(event) => updateFieldValue(field.id, event.target.value)}
                              rows={5}
                              placeholder={field.placeholder}
                              className="min-h-[120px] w-full rounded-xl border border-border bg-background px-4 py-3 text-sm leading-7 outline-hidden transition-colors focus:border-foreground/30"
                            />
                          ) : (
                            <input
                              type={field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
                              value={formValues[field.id] ?? ""}
                              onChange={(event) => updateFieldValue(field.id, event.target.value)}
                              placeholder={field.placeholder}
                              className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-hidden transition-colors focus:border-foreground/30"
                            />
                          )}
                          {field.helpText ? <p className="text-xs leading-6 text-muted-foreground">{field.helpText}</p> : null}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <label className="space-y-2">
                      <span className="text-sm font-medium">申请说明</span>
                      <textarea
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                        rows={8}
                        placeholder={`请填写 ${selectedType.name} 的身份说明、资质链接、联系方式等审核材料`}
                        className="min-h-[180px] w-full rounded-xl border border-border bg-background px-4 py-3 text-sm leading-7 outline-hidden transition-colors focus:border-foreground/30"
                      />
                    </label>
                  )}

                  <label className="space-y-2">
                    <IconPicker
                      label="自定义图标（可选）"
                      value={customIconText}
                      onChange={setCustomIconText}
                      uploadFolder="icon"
                      placeholder="支持 emoji、图片链接、SVG 文件链接或上传后的本地路径"
                      description="可直接上传图片，也可填写远程图片链接、本地上传路径或 .svg 文件链接。为了安全，认证图标暂不支持直接粘贴 SVG 源码。"
                      popoverTitle="设置自定义认证图标"
                      textareaRows={3}
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium">个性描述（可选）</span>
                    <input
                      value={customDescription}
                      onChange={(event) => setCustomDescription(event.target.value)}
                      placeholder="用于前台认证徽章提示展示，例如：独立开发者 / 认证摄影师"
                      className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-hidden transition-colors focus:border-foreground/30"
                    />
                    <p className="text-xs leading-6 text-muted-foreground">这条描述会跟随认证图标展示，留空时仅显示认证名称。</p>
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs leading-6 text-muted-foreground">建议填写真实身份说明、业务介绍、可核验链接或其它辅助材料，便于后台快速审核。</p>
                    <Button type="button" disabled={isPending || currentApplication?.status === "PENDING"} onClick={submit} className="rounded-full px-5">
                      {isPending ? "提交中..." : currentApplication?.status === "PENDING" ? "审核中" : currentApplication?.status === "REJECTED" ? "重新提交申请" : "提交申请"}
                    </Button>
                  </div>
                </div>
              )}

              {feedback ? <div className="mt-4 rounded-[18px] border border-border bg-background px-4 py-3 text-sm text-muted-foreground">{feedback}</div> : null}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function renderStatusLabel(status?: VerificationApplicationStatus | null) {
  switch (status) {
    case "PENDING":
      return "审核中"
    case "APPROVED":
      return "已通过"
    case "REJECTED":
      return "已驳回"
    case "CANCELLED":
      return "已取消"
    default:
      return "未申请"
  }
}

function renderStatusPill(status?: VerificationApplicationStatus | null) {
  if (!status) {
    return null
  }

  if (status === "PENDING") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700"><Clock3 className="h-3 w-3" />审核中</span>
  }

  if (status === "APPROVED") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700"><CheckCircle2 className="h-3 w-3" />已通过</span>
  }

  if (status === "REJECTED") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] text-rose-700"><XCircle className="h-3 w-3" />已驳回</span>
  }

  return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"><ShieldCheck className="h-3 w-3" />已取消</span>
}

