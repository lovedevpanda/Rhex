"use client"

import { VipLevelIcon } from "@/components/vip-level-icon"
import { cn } from "@/lib/utils"

interface AvatarVipBadgeProps {
  level?: number | null
  size?: "xs" | "sm" | "md" | "lg"
}

const badgeSizeClasses = {
  xs: "bottom-[-2px] right-[-2px] h-4 w-4",
  sm: "bottom-[-2px] right-[-2px] h-[18px] w-[18px]",
  md: "bottom-[-3px] right-[-3px] h-5 w-5",
  lg: "bottom-[-4px] right-[-4px] h-6 w-6",
}

const iconSizeClasses = {
  xs: "h-2 w-2 text-[10px]",
  sm: "h-2.5 w-2.5 text-[11px]",
  md: "h-3 w-3 text-[12px]",
  lg: "h-3.5 w-3.5 text-[14px]",
}

function getBadgeTone(level: number) {
  if (level >= 3) {
    return "text-amber-700 shadow-[0_6px_18px_rgba(245,158,11,0.26)] dark:border-amber-300/25 dark:bg-amber-400/18 dark:text-amber-100"
  }

  if (level === 2) {
    return "text-rose-700 shadow-[0_6px_18px_rgba(244,63,94,0.22)] dark:border-rose-300/25 dark:bg-rose-400/18 dark:text-rose-100"
  }

  return "text-violet-700 shadow-[0_6px_18px_rgba(124,58,237,0.2)] dark:border-violet-300/25 dark:bg-violet-400/18 dark:text-violet-100"
}

export function AvatarVipBadge({ level = 1, size = "md" }: AvatarVipBadgeProps) {
  const normalizedLevel = Math.max(1, level ?? 1)
  const label = `VIP${normalizedLevel} 会员`

  return (
      <span
        className={cn(
          "pointer-events-auto absolute z-[1] inline-flex items-center justify-center rounded-full transition-transform duration-200 ease-out group-hover/avatar:animate-[spin_1.1s_linear_infinite] hover:animate-[spin_1.1s_linear_infinite]",
          badgeSizeClasses[size],
          getBadgeTone(normalizedLevel),
        )}
        aria-label={label}
      >
        <VipLevelIcon level={normalizedLevel} className={iconSizeClasses[size]} title={label} />
      </span>
  )
}
