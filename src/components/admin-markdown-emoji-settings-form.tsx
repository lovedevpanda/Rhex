"use client"

import { useState, useTransition } from "react"

import { AdminIconPickerField } from "@/components/admin-icon-picker-field"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { DEFAULT_MARKDOWN_EMOJI_ITEMS, type MarkdownEmojiItem, isMarkdownEmojiSvg, normalizeMarkdownEmojiItems } from "@/lib/markdown-emoji"

interface AdminMarkdownEmojiSettingsFormProps {
  initialItems: MarkdownEmojiItem[]
}

export function AdminMarkdownEmojiSettingsForm({ initialItems }: AdminMarkdownEmojiSettingsFormProps) {
  const [items, setItems] = useState<MarkdownEmojiItem[]>(normalizeMarkdownEmojiItems(initialItems))
  const [isPending, startTransition] = useTransition()

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          const response = await fetch("/api/admin/site-settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              markdownEmojiMap: items,
              section: "site-markdown-emoji",
            }),
          })
          const result = await response.json()
          if (!response.ok) {
            toast.error(result.message ?? "保存失败", "保存失败")
            return
          }
          toast.success(result.message ?? "保存成功", "保存成功")
        })
      }}
    >
      <div className="rounded-[24px] border border-border p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Markdown 表情</h3>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">独立配置 Markdown 短码表情，例如 `:smile:`、`:rocket:`，支持 emoji 与完整 SVG 图标。</p>
        </div>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={`${item.shortcode}-${index}`} className="rounded-[20px] border border-border bg-card/60 p-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[180px_minmax(0,1fr)_auto] xl:items-start">
                <Field
                  label="短码"
                  value={item.shortcode}
                  onChange={(value) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, shortcode: value.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase() } : row))}
                  placeholder="如 smile"
                />
                <div className="space-y-2">
                  <Field
                    label="显示名称"
                    value={item.label}
                    onChange={(value) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, label: value } : row))}
                    placeholder="如 微笑"
                  />
                  <AdminIconPickerField
                    label="图标"
                    value={item.icon}
                    onChange={(value) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, icon: value } : row))}
                    popoverTitle="选择 Markdown 表情图标"
                    containerClassName="space-y-2"
                    triggerClassName="flex h-11 w-full items-center gap-3 rounded-[18px] border border-border bg-background px-4 text-left text-sm transition-colors hover:bg-accent"
                    textareaRows={4}
                  />
                </div>
                <div className="flex justify-end xl:pt-8">
                  <Button type="button" variant="outline" className="rounded-full" disabled={items.length <= 1} onClick={() => setItems((current) => current.filter((_, rowIndex) => rowIndex !== index))}>删除</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => setItems((current) => [...current, { shortcode: `emoji_${current.length + 1}`, label: "新表情", icon: "😀" }])}>新增表情</Button>
          <Button type="button" variant="ghost" className="rounded-full" onClick={() => setItems(DEFAULT_MARKDOWN_EMOJI_ITEMS)}>恢复默认</Button>
        </div>
        <div className="rounded-[20px] border border-dashed border-border bg-card/40 p-4 space-y-2">
          <p className="text-sm font-medium">使用方式预览</p>
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <span key={`preview-${item.shortcode}`} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs">
                <EmojiPreview icon={item.icon} label={item.label} />
                <span>{item.label}</span>
                <code>:{item.shortcode}:</code>
              </span>
            ))}
          </div>
          <p className="text-xs leading-6 text-muted-foreground">前台帖子中输入对应短码，例如 <code>:smile:</code>，渲染时才会替换为表情；编辑器工具栏会优先展示前 8 个已配置表情。</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button disabled={isPending}>{isPending ? "保存中..." : "保存 Markdown 表情"}</Button>
      </div>
    </form>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none" />
    </div>
  )
}

function EmojiPreview({ icon, label }: { icon: string; label: string }) {
  if (isMarkdownEmojiSvg(icon)) {
    return (
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center leading-none" title={label} aria-label={label}>
        <span
          aria-hidden={label ? undefined : true}
          className={cn("inline-flex h-full w-full items-center justify-center [&>svg]:h-full [&>svg]:w-full [&>svg]:block")}
          dangerouslySetInnerHTML={{ __html: icon.trim() }}
        />
      </span>
    )
  }

  return <span className="inline-flex shrink-0 items-center justify-center leading-none">{icon}</span>
}
