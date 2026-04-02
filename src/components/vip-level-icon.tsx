"use client"

import { LevelIcon } from "@/components/level-icon"
import { useVipLevelIcons } from "@/components/site-settings-provider"
import { getVipLevelIcon, type VipLevelIcons } from "@/lib/vip-level-icons"
import { cn } from "@/lib/utils"

interface VipLevelIconProps {
  level?: number | null
  className?: string
  iconClassName?: string
  title?: string
  icons?: VipLevelIcons
}

export function VipLevelIcon({ level = 1, className, iconClassName, title, icons }: VipLevelIconProps) {
  const resolvedIcons = useVipLevelIcons(icons)
  const normalizedLevel = Math.max(1, level ?? 1)
  const icon = getVipLevelIcon(normalizedLevel, resolvedIcons)

  return (
    <LevelIcon
      icon={icon}
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      emojiClassName="text-inherit"
      svgClassName={cn("[&>svg]:block [&>svg]:h-full [&>svg]:w-full", iconClassName)}
      title={title}
    />
  )
}
