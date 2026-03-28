"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { SELF_SERVE_AD_BACKGROUND_COLORS, SELF_SERVE_AD_DURATION_OPTIONS, SELF_SERVE_AD_TEXT_COLORS, type SelfServeAdSlotType } from "@/lib/self-serve-ads.shared"


interface SelfServeAdsPurchasePageProps {
  slotType: SelfServeAdSlotType
  slotIndex: number
  pointName: string
  prices: {
    IMAGE: Record<1 | 3 | 6 | 12, number>
    TEXT: Record<1 | 3 | 6 | 12, number>
  }
}

const INITIAL_FORM = {
  title: "",
  linkUrl: "",
  imageUrl: "",
  textColor: "#0f172a",
  backgroundColor: "#f8fafc",
  durationMonths: 1 as 1 | 3 | 6 | 12,
}

export function SelfServeAdsPurchasePage({ slotType, slotIndex, pointName, prices }: SelfServeAdsPurchasePageProps) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [successMessage, setSuccessMessage] = useState("")
  const [isPending, startTransition] = useTransition()
  const currentPrice = useMemo(() => prices[slotType][form.durationMonths], [form.durationMonths, prices, slotType])

  function submitPurchase() {
    const confirmationMessage = `确认购买第 ${slotIndex + 1} 个${slotType === "IMAGE" ? "图片" : "文字"}广告位吗？\n购买时长：${form.durationMonths} 个月\n需支付：${currentPrice} ${pointName}\n提交后将进入后台审核。`
    if (!window.confirm(confirmationMessage)) {
      return
    }

    setSuccessMessage("")
    startTransition(async () => {
      const response = await fetch(`/api/self-serve-ads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotType, slotIndex, title: form.title, linkUrl: form.linkUrl, imageUrl: form.imageUrl, textColor: form.textColor, backgroundColor: form.backgroundColor, durationMonths: form.durationMonths }),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "广告申请提交失败", "提交失败")
        return
      }
      const message = result.message ?? "广告申请已提交，待管理员审核"
      setSuccessMessage(`${message} 已扣除 ${currentPrice} ${pointName}。`)
      setForm(INITIAL_FORM)
      toast.success(message, "提交成功")
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm shadow-black/5 dark:shadow-black/30">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">购买{slotType === "IMAGE" ? "图片" : "文字"}广告位</h1>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">当前购买的是第 {slotIndex + 1} 个{slotType === "IMAGE" ? "图片" : "文字"}广告位，提交后进入后台审核。</p>
          </div>
          <Link href="/" className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground">返回首页</Link>
        </div>
      </section>

      {successMessage ? (
        <section className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          {successMessage}
        </section>
      ) : null}

      <section className="rounded-[24px] border border-border bg-card p-5 space-y-4">
        <Field label="广告链接" hint="必须以 http:// 或 https:// 开头。">
          <input value={form.linkUrl} onChange={(event) => setForm((current) => ({ ...current, linkUrl: event.target.value }))} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none" placeholder="https://example.com" />
        </Field>

        {slotType === "IMAGE" ? (
          <Field label="广告图片 URL" hint="由广告主自行提供图片地址。">
            <input value={form.imageUrl} onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none" placeholder="https://example.com/banner.jpg" />
          </Field>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
            <Field label="广告标题" hint="建议 12 字以内。" className="lg:col-span-3">
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-none" placeholder="请输入文字广告标题" />
            </Field>
            <ColorPicker label="文字颜色" value={form.textColor} presets={SELF_SERVE_AD_TEXT_COLORS} onChange={(value) => setForm((current) => ({ ...current, textColor: value }))} />
            <ColorPicker label="文字背景" value={form.backgroundColor} presets={SELF_SERVE_AD_BACKGROUND_COLORS} onChange={(value) => setForm((current) => ({ ...current, backgroundColor: value }))} />
            <div className="rounded-[16px] border border-dashed border-border px-3 py-2.5 lg:min-w-[220px]">
              <p className="text-[11px] text-muted-foreground">预览</p>
              <div className="mt-2 inline-flex min-w-[160px] rounded-[12px] px-3 py-2 text-xs font-medium" style={{ color: form.textColor, backgroundColor: form.backgroundColor }}>{form.title || "文字广告预览"}</div>
            </div>
          </div>
        )}

        <Field label="购买时长" hint={`当前价格：${currentPrice} ${pointName}`}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {SELF_SERVE_AD_DURATION_OPTIONS.map((option) => {
              const active = option.months === form.durationMonths
              return (
                <button key={option.months} type="button" onClick={() => setForm((current) => ({ ...current, durationMonths: option.months }))} className={active ? "rounded-[14px] border border-foreground bg-accent px-2.5 py-2.5 text-xs font-medium text-foreground" : "rounded-[14px] border border-border bg-background px-2.5 py-2.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"}>
                  <div>{option.label}</div>
                  <div className="mt-1 text-[11px]">{prices[slotType][option.months]} {pointName}</div>
                </button>
              )
            })}
          </div>
        </Field>

        <div className="rounded-[16px] border border-dashed border-border bg-accent/40 px-4 py-3 text-xs leading-6 text-muted-foreground">
          <p>提交前请确认广告内容、链接地址与购买时长无误。</p>
          <p>点击“提交购买申请”后，会先进行二次确认；确认提交后将立即扣除 {currentPrice} {pointName}，并进入后台审核。</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" className="h-8 rounded-lg px-3 text-xs" disabled={isPending} onClick={submitPurchase}>{isPending ? "提交中..." : "提交购买申请"}</Button>
          <Link href="/" className="inline-flex h-8 items-center rounded-lg px-3 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground">取消</Link>
        </div>
      </section>
    </div>
  )
}

function Field({ label, hint, children, className = "" }: { label: string; hint: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1.5 text-sm ${className}`.trim()}>
      <span className="font-medium text-foreground">{label}</span>
      <p className="text-[11px] leading-5 text-muted-foreground">{hint}</p>
      {children}
    </label>
  )
}

function ColorPicker({ label, value, presets, onChange }: { label: string; value: string; presets: readonly string[]; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-10 rounded-lg border border-border bg-background p-1" />
        <input value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-24 rounded-full border border-border bg-background px-3 text-xs outline-none" />
        {presets.map((preset) => <button key={`${label}-${preset}`} type="button" className="h-6 w-6 rounded-full border border-border" style={{ backgroundColor: preset }} onClick={() => onChange(preset)} />)}
      </div>
    </div>
  )
}

