"use client"

import { useMemo, useState } from "react"

import { LevelIcon } from "@/components/level-icon"
import { PickerPopover } from "@/components/admin-picker-popover"

interface AdminIconPickerFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  presets?: string[]
  previewColor?: string
  triggerClassName?: string
  containerClassName?: string
  textareaRows?: number
  description?: string
  popoverTitle?: string
}

const DEFAULT_ICON_PRESETS = ["🌱", "⭐", "🔥", "⚡", "💎", "👑", "🛡️", "🚀", "🎯", "🏆", "🌈", "🧠", "📚", "💬", "📷", "🌿"]

export function AdminIconPickerField({
  label,
  value,
  onChange,
  placeholder = "输入 emoji、符号，或粘贴完整 <svg>...</svg>",
  presets = DEFAULT_ICON_PRESETS,
  previewColor,
  triggerClassName,
  containerClassName,
  textareaRows = 4,
  description = "预设支持快速选择 emoji，自定义输入同时支持内联 SVG。",
  popoverTitle,
}: AdminIconPickerFieldProps) {
  const [open, setOpen] = useState(false)
  const normalizedValue = useMemo(() => value?.trim() || "", [value])
  const title = popoverTitle ?? `选择${label}`

  return (
    <div className={containerClassName ?? "space-y-1"}>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={triggerClassName ?? "flex h-11 w-full items-center gap-3 rounded-full border border-border bg-background px-4 text-left text-sm transition-colors hover:bg-accent"}
        >
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground/80">
            <LevelIcon icon={normalizedValue} color={previewColor} className="h-4 w-4 text-sm" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
          </span>
          <span className="min-w-0 flex-1 truncate">{normalizedValue || placeholder}</span>
        </button>

        {open ? (
          <PickerPopover title={title} onClose={() => setOpen(false)}>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium text-muted-foreground">自定义图标</p>
                  <LevelIcon icon={normalizedValue} color={previewColor} className="h-4 w-4 text-sm" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
                </div>
                <textarea
                  value={value}
                  onChange={(event) => onChange(event.target.value)}
                  placeholder={placeholder}
                  rows={textareaRows}
                  className="min-h-[88px] w-full rounded-2xl border border-border bg-background px-3 py-2 text-xs leading-5 outline-none transition-colors focus:border-foreground/30"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">{description}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {presets.map((preset) => {
                  const active = normalizedValue === preset
                  return (
                    <button
                      key={preset}
                      type="button"
                      className={active ? "flex h-7 min-w-7 items-center justify-center rounded-full border border-foreground/15 bg-accent px-2 text-sm shadow-sm" : "flex h-7 min-w-7 items-center justify-center rounded-full border border-border bg-background px-2 text-sm transition-colors hover:bg-accent"}
                      onClick={() => {
                        onChange(preset)
                        setOpen(false)
                      }}
                      aria-label={`使用图标 ${preset}`}
                    >
                      {preset}
                    </button>
                  )
                })}
              </div>
            </div>
          </PickerPopover>
        ) : null}
      </div>
    </div>
  )
}
