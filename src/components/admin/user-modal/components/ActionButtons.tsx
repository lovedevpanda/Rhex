"use client"

import type { ComponentProps } from "react"

import { Button } from "@/components/ui/button"

export interface ActionButtonItem {
  key: string
  label: string
  onClick: () => void
  hidden?: boolean
  disabled?: boolean
  variant?: ComponentProps<typeof Button>["variant"]
  className?: string
}

export function ActionButtons({ items }: { items: ActionButtonItem[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items
        .filter((item) => !item.hidden)
        .map((item) => (
          <Button
            key={item.key}
            type="button"
            variant={item.variant ?? "outline"}
            disabled={item.disabled}
            className={item.className ?? "h-8 rounded-full px-3 text-xs"}
            onClick={item.onClick}
          >
            {item.label}
          </Button>
        ))}
    </div>
  )
}
