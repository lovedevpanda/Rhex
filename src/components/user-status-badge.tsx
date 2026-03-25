import { cn } from "@/lib/utils"
import type { PublicUserStatus } from "@/lib/users"

const STATUS_CONFIG: Record<Extract<PublicUserStatus, "MUTED" | "BANNED">, { label: string; shortLabel: string; className: string }> = {
  BANNED: {
    label: "已封禁",
    shortLabel: "封",
    className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
  },
  MUTED: {
    label: "已禁言",
    shortLabel: "禁",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-200",
  },
}

export function UserStatusBadge({ status, compact = false, className }: { status?: PublicUserStatus; compact?: boolean; className?: string }) {
  if (status !== "BANNED" && status !== "MUTED") {
    return null
  }

  const config = STATUS_CONFIG[status]

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold tracking-wide",
        compact ? "h-7 min-w-7 px-2 text-xs" : "px-3 py-1 text-xs",
        config.className,
        className,
      )}
      aria-label={config.label}
      title={config.label}
    >
      {compact ? config.shortLabel : config.label}
    </span>
  )
}
