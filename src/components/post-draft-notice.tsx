"use client"

import { CircleAlert, Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PostDraftNoticeAction {
  label: string
  onClick: () => void
  variant?: "default" | "outline" | "ghost"
}

interface PostDraftNoticeProps {
  title: string
  description: string
  tone?: "info" | "warning"
  compact?: boolean
  meta?: string
  primaryAction?: PostDraftNoticeAction
  secondaryAction?: PostDraftNoticeAction
  className?: string
}

const toneStyles = {
  info: {
    wrapper: "border-sky-200/80 bg-sky-50/80 text-sky-950 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100",
    icon: "text-sky-600 dark:text-sky-300",
  },
  warning: {
    wrapper: "border-amber-200/80 bg-amber-50/80 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100",
    icon: "text-amber-600 dark:text-amber-300",
  },
} as const

export function PostDraftNotice({
  title,
  description,
  tone = "info",
  compact = false,
  meta,
  primaryAction,
  secondaryAction,
  className,
}: PostDraftNoticeProps) {
  const toneStyle = toneStyles[tone]
  const Icon = tone === "warning" ? CircleAlert : Info

  return (
    <section
      className={cn(
        "rounded-[20px] border px-4 py-3",
        compact ? "min-h-[44px]" : "rounded-[24px] px-5 py-4",
        toneStyle.wrapper,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className={cn("flex gap-3", compact ? "items-center" : "items-start") }>
        <div className={cn("mt-0.5 shrink-0", toneStyle.icon)}>
          <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", compact ? "" : "mb-1")}>
            <p className={cn("font-medium", compact ? "text-sm" : "text-sm")}>{title}</p>
            {meta ? <span className="text-xs opacity-80">{meta}</span> : null}
          </div>
          <p className={cn("opacity-90", compact ? "text-xs leading-5" : "text-sm leading-6")}>{description}</p>
        </div>
        {(primaryAction || secondaryAction) ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {secondaryAction ? (
              <Button type="button" variant={secondaryAction.variant ?? "ghost"} className="h-8 rounded-full px-3" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            ) : null}
            {primaryAction ? (
              <Button type="button" variant={primaryAction.variant ?? "outline"} className="h-8 rounded-full px-3" onClick={primaryAction.onClick}>
                {primaryAction.label}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
