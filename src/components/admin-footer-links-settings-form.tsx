"use client"

import { useMemo, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import type { FooterLinkItem } from "@/lib/site-settings"

interface AdminFooterLinksSettingsFormProps {
  initialLinks: FooterLinkItem[]
}

function createEmptyLink(): FooterLinkItem {
  return { label: "", href: "" }
}

export function AdminFooterLinksSettingsForm({ initialLinks }: AdminFooterLinksSettingsFormProps) {
  const [links, setLinks] = useState<FooterLinkItem[]>(initialLinks.length > 0 ? initialLinks : [createEmptyLink()])
  const [feedback, setFeedback] = useState("")
  const [isPending, startTransition] = useTransition()

  const normalizedPreview = useMemo(
    () => links.map((item) => ({ label: item.label.trim(), href: item.href.trim() })).filter((item) => item.label || item.href),
    [links],
  )

  function updateLink(index: number, key: keyof FooterLinkItem, value: string) {
    setLinks((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, [key]: value } : item)))
  }

  function addLink() {
    setLinks((current) => [...current, createEmptyLink()])
  }

  function removeLink(index: number) {
    setLinks((current) => {
      const next = current.filter((_, currentIndex) => currentIndex !== index)
      return next.length > 0 ? next : [createEmptyLink()]
    })
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        setFeedback("")
        startTransition(async () => {
          const response = await fetch("/api/admin/site-settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              section: "site-footer-links",
              footerLinks: links,
            }),
          })
          const result = await response.json()
          setFeedback(result.message ?? (response.ok ? "保存成功" : "保存失败"))
        })
      }}
    >
      <div className="rounded-[24px] border border-border p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">页脚导航链接</h3>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">用于控制前台页脚的链接名称与跳转地址。支持站内路径，也支持完整外链地址。</p>
        </div>

        <div className="space-y-3">
          {links.map((item, index) => (
            <div key={`${index}-${item.label}-${item.href}`} className="grid gap-3 rounded-[20px] border border-border p-4 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
              <Field label="显示名称" value={item.label} onChange={(value) => updateLink(index, "label", value)} placeholder="如 关于我们" />
              <Field label="跳转地址" value={item.href} onChange={(value) => updateLink(index, "href", value)} placeholder="如 /about 或 https://example.com/about" />
              <Button type="button" variant="outline" onClick={() => removeLink(index)} className="rounded-full">删除</Button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={addLink} className="rounded-full">新增链接</Button>
        </div>

        <div className="rounded-[20px] bg-muted/40 p-4">
          <p className="text-xs font-medium text-foreground">预览</p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {normalizedPreview.length > 0 ? normalizedPreview.map((item) => (
              <span key={`${item.label}-${item.href}`} className="transition-colors hover:text-foreground">{item.label}</span>
            )) : <span>暂无可展示链接</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button disabled={isPending}>{isPending ? "保存中..." : "保存页脚导航"}</Button>
        {feedback ? <span className="text-sm text-muted-foreground">{feedback}</span> : null}
      </div>
    </form>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" />
    </label>
  )
}
