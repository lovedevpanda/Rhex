"use client"

import { CircleAlert, Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface PostDraftNoticeAction {
  label: string
  onClick: () => void
  variant?: "default" | "outline" | "ghost"
}

interface PostDraftNoticeProps {
  title: string
  description?: string
  tone?: "info" | "warning"
  compact?: boolean
  size?: "default" | "compact" | "dense"
  meta?: string
  primaryAction?: PostDraftNoticeAction
  secondaryAction?: PostDraftNoticeAction
  actions?: PostDraftNoticeAction[]
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

const sizeStyles = {
  default: {
    wrapper: "rounded-[24px] px-5 py-4",
    layout: "items-start gap-3",
    icon: "h-5 w-5",
    title: "text-sm",
    meta: "text-xs",
    description: "text-sm leading-6",
    titleRow: "gap-x-3 gap-y-1 mb-1",
    actions: "gap-2",
    button: "h-8 rounded-full px-3",
  },
  compact: {
    wrapper: "min-h-[44px] rounded-[20px] px-4 py-3",
    layout: "items-center gap-3",
    icon: "h-4 w-4",
    title: "text-sm",
    meta: "text-xs",
    description: "text-xs leading-5",
    titleRow: "gap-x-3 gap-y-1",
    actions: "gap-2",
    button: "h-8 rounded-full px-3",
  },
  dense: {
    wrapper: "rounded-2xl px-3 py-2",
    layout: "items-center gap-2.5",
    icon: "h-3.5 w-3.5",
    title: "text-xs",
    meta: "text-[11px]",
    description: "text-[11px] leading-4",
    titleRow: "gap-x-2 gap-y-0.5",
    actions: "gap-1.5",
    button: "h-7 rounded-full px-2.5 text-[11px]",
  },
} as const

export function PostDraftNotice({
  title,
  description,
  tone = "info",
  compact = false,
  size,
  meta,
  primaryAction,
  secondaryAction,
  actions,
  className,
}: PostDraftNoticeProps) {
  const toneStyle = toneStyles[tone]
  const Icon = tone === "warning" ? CircleAlert : Info
  const resolvedSize = size ?? (compact ? "compact" : "default")
  const sizeStyle = sizeStyles[resolvedSize]
  const resolvedActions = actions ?? [secondaryAction, primaryAction].filter((action): action is PostDraftNoticeAction => Boolean(action))

  return (
    <section
      className={cn(
        "border",
        sizeStyle.wrapper,
        toneStyle.wrapper,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className={cn("flex", sizeStyle.layout)}>
        <div className={cn("mt-0.5 shrink-0", toneStyle.icon)}>
          <Icon className={sizeStyle.icon} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("flex flex-wrap items-center", sizeStyle.titleRow)}>
            <p className={cn("font-medium", sizeStyle.title)}>{title}</p>
            {meta ? <span className={cn("opacity-80", sizeStyle.meta)}>{meta}</span> : null}
          </div>
          {description ? <p className={cn("opacity-90", sizeStyle.description)}>{description}</p> : null}
        </div>
        {resolvedActions.length > 0 ? (
          <div className={cn("flex shrink-0 flex-wrap items-center justify-end", sizeStyle.actions)}>
            {resolvedActions.map((action) => (
              <Button key={`${title}-${action.label}`} type="button" variant={action.variant ?? "outline"} className={sizeStyle.button} onClick={action.onClick}>
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
