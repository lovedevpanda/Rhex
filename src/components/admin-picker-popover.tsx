"use client"

import type { ReactNode } from "react"

export function normalizeHexColor(value: string, fallback: string) {
  const trimmed = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback
}

export function PickerTriggerField({
  value,
  onClick,
  previewColor,
  fallbackColor,
}: {
  value: string
  onClick: () => void
  previewColor?: string
  fallbackColor?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-full items-center justify-between rounded-full border border-border bg-background px-3 text-xs text-left transition-colors hover:bg-accent"
    >
      <span className="truncate">{value}</span>
      {previewColor ? (
        <span
          className="ml-2 h-4 w-4 rounded-full border border-border"
          style={{ backgroundColor: normalizeHexColor(previewColor, fallbackColor ?? "#64748b") }}
        />
      ) : null}
    </button>
  )
}

export function PickerPopover({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="mt-2 rounded-[18px] border border-border bg-background p-3 shadow-lg shadow-black/10">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">{title}</p>
        <button type="button" onClick={onClose} className="text-[11px] text-muted-foreground transition-colors hover:text-foreground">
          关闭
        </button>
      </div>
      {children}
    </div>
  )
}
