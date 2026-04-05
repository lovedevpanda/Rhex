"use client"

import { useMemo, useState, useTransition } from "react"
import { CheckCircle2, Clock3, ShieldCheck, XCircle } from "lucide-react"

import { LevelIcon } from "@/components/level-icon"
import { Button } from "@/components/ui/button"
import { showConfirm } from "@/components/ui/confirm-dialog"
import type { VerificationFormField } from "@/lib/verification-form-schema"


type VerificationApplicationStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"

interface VerificationCenterProps {
  types: Array<{
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
    currentApplication?: {
      id: string
      status: VerificationApplicationStatus
      submittedAt: string
      reviewedAt?: string | null
      rejectReason?: string | null
      note?: string | null
      content?: string | null
      formResponse?: Record<string, string>
      type: {
        id: string
        name: string
        iconText: string
        color: string
        description?: string | null
      }
    } | null
  }>
  approvedVerification?: {
    id: string
    name: string
    iconText: string
    color: string
    description?: string | null
  } | null
}

export function VerificationCenter({ types, approvedVerification }: VerificationCenterProps) {
  const [selectedTypeId, setSelectedTypeId] = useState(types[0]?.id ?? "")
  const [content, setContent] = useState("")
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState("")
  const [isUnbinding, setIsUnbinding] = useState(false)
  const [isPending, startTransition] = useTransition()


  const selectedType = useMemo(() => types.find((item) => item.id === selectedTypeId) ?? types[0] ?? null, [selectedTypeId, types])
  const currentApplication = selectedType?.currentApplication ?? null
  const hasApprovedVerification = Boolean(approvedVerification)


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
          content,
          formResponse: selectedType.formFields.length > 0 ? formValues : undefined,
        }),
      })
      const result = await response.json()
      setFeedback(result.message ?? (response.ok ? "提交成功" : "提交失败"))
      if (response.ok) {
        setContent("")
        setFormValues({})
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


  const showDynamicFields = Boolean(selectedType && selectedType.formFields.length > 0)


  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Verification Center</p>
            <h1 className="mt-2 text-3xl font-semibold">账号认证中心</h1>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">在这里提交个人认证、商家认证或其它认证资料，后台审核通过后会在你的帖子和评论作者名前显示认证图标。</p>
          </div>
          {approvedVerification ? (
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
              当前已通过：<span className="font-medium">{approvedVerification.name}</span>
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">当前尚未通过任何认证</div>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="rounded-[24px] border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold">可申请认证</h4>
              <span className="text-sm text-muted-foreground">共 {types.length} 项</span>
            </div>
            <div className="mt-4 space-y-3">
              {types.map((item) => {
                const isApprovedItem = item.currentApplication?.status === "APPROVED"
                const isDisabledItem = hasApprovedVerification && !isApprovedItem
                const isActiveItem = selectedType?.id === item.id || isApprovedItem

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
                      setContent("")
                      setFormValues({})
                      setFeedback("")
                    }}
                    className={isApprovedItem ? "w-full rounded-[22px] border border-emerald-300 bg-emerald-50/70 p-4 text-left dark:border-emerald-500/30 dark:bg-emerald-500/10" : isActiveItem ? "w-full rounded-[22px] border border-foreground bg-accent/60 p-4 text-left" : isDisabledItem ? "w-full rounded-[22px] border border-border bg-background/60 p-4 text-left opacity-55" : "w-full rounded-[22px] border border-border bg-background p-4 text-left hover:bg-accent/40"}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ backgroundColor: `${item.color}18`, color: item.color }}>
                        <LevelIcon icon={item.iconText} color={item.color} className="h-5 w-5 text-[20px]" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">{item.name}</p>
                          {isApprovedItem ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700"><CheckCircle2 className="h-3 w-3" />已认证</span> : renderStatusPill(item.currentApplication?.status)}
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
            <div className="rounded-[28px] border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">当前没有可申请的认证类型，请等待管理员配置。</div>
          ) : (
            <div className="rounded-[28px] border border-border bg-card p-5 shadow-soft">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[22px] text-2xl" style={{ backgroundColor: `${selectedType.color}18`, color: selectedType.color }}>
                  <LevelIcon icon={selectedType.iconText} color={selectedType.color} className="h-7 w-7 text-[28px]" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">申请 {selectedType.name}</h2>
                  <p className="mt-1 text-sm leading-7 text-muted-foreground">{selectedType.description || "请填写你的认证材料，后台会尽快审核。"}</p>
                </div>
              </div>

              {currentApplication ? (
                <div className="mt-5 rounded-[22px] border border-border bg-secondary/20 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">当前申请状态：{renderStatusLabel(currentApplication.status)}</div>
                    <div className="text-xs text-muted-foreground">提交于 {new Date(currentApplication.submittedAt).toLocaleString()}</div>
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
                  {currentApplication.note ? <p className="mt-2 text-muted-foreground">审核备注：{currentApplication.note}</p> : null}
                  {currentApplication.rejectReason ? <p className="mt-2 text-rose-600 dark:text-rose-300">驳回原因：{currentApplication.rejectReason}</p> : null}
                </div>
              ) : null}

              {currentApplication?.status === "APPROVED" ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-[22px] border border-emerald-200 bg-emerald-50/70 px-4 py-4 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                    你已通过当前认证，申请表单已隐藏。若你希望改绑为其它认证，可先手动解除当前认证绑定。
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" className="rounded-full" disabled={isUnbinding} onClick={() => void unbindVerification()}>
                      {isUnbinding ? "解绑中..." : "解除认证绑定"}
                    </Button>
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
                              className="min-h-[120px] w-full rounded-[22px] border border-border bg-background px-4 py-3 text-sm leading-7 outline-none transition-colors focus:border-foreground/30"
                            />
                          ) : (
                            <input
                              type={field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
                              value={formValues[field.id] ?? ""}
                              onChange={(event) => updateFieldValue(field.id, event.target.value)}
                              placeholder={field.placeholder}
                              className="h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-foreground/30"
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
                        className="min-h-[180px] w-full rounded-[22px] border border-border bg-background px-4 py-3 text-sm leading-7 outline-none transition-colors focus:border-foreground/30"
                      />
                    </label>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs leading-6 text-muted-foreground">建议填写真实身份说明、业务介绍、可核验链接或其它辅助材料，便于后台快速审核。</p>
                    <Button type="button" disabled={isPending || currentApplication?.status === "PENDING"} onClick={submit} className="rounded-full px-5">
                      {isPending ? "提交中..." : currentApplication?.status === "PENDING" ? "审核中" : "提交申请"}
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
