"use client"

import Image from "next/image"

import { AvatarVipBadge } from "@/components/avatar-vip-badge"
import { getAvatarColor, getAvatarFallback, getAvatarUrl } from "@/lib/avatar"
import { cn } from "@/lib/utils"

interface UserAvatarProps {
  name: string
  avatarPath?: string | null
  size?: "xs" | "sm" | "md" | "lg"
  isVip?: boolean
  vipLevel?: number | null
}

const sizeClasses = {
  xs: "h-7 w-7",
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-16 w-16",
}

const fallbackSizeClasses = {
  xs: "text-[11px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-lg",
}

export function UserAvatar({ name, avatarPath, size = "md", isVip = false, vipLevel }: UserAvatarProps) {
  const avatarUrl = getAvatarUrl(avatarPath, name)
  const fallback = getAvatarFallback(name)
  const colors = getAvatarColor(name)
  const showVipBadge = isVip && Boolean(vipLevel && vipLevel > 0)

  return (
    <div className={cn("group/avatar relative aspect-square shrink-0", sizeClasses[size])}>
      <div className="relative h-full w-full overflow-hidden rounded-2xl border border-border bg-card transition-[transform,box-shadow,border-color] duration-200 ease-out group-hover/avatar:-translate-y-0.5 group-hover/avatar:border-foreground/15 group-hover/avatar:shadow-[0_10px_24px_rgba(15,23,42,0.12)] dark:group-hover/avatar:shadow-[0_10px_28px_rgba(0,0,0,0.32)]" style={{ backgroundColor: colors.background, color: colors.foreground }}>
        {avatarPath ? (
          <Image src={avatarUrl} alt={name} fill sizes={size === "lg" ? "64px" : size === "md" ? "44px" : size === "sm" ? "36px" : "32px"} className="object-cover transition-transform duration-300 ease-out group-hover/avatar:scale-[1.06]" unoptimized />
        ) : (
          <div className={cn("flex h-full w-full items-center justify-center font-semibold tracking-wide transition-transform duration-300 ease-out group-hover/avatar:scale-[1.03]", fallbackSizeClasses[size])}>{fallback}</div>
        )}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent_42%,rgba(15,23,42,0.08))] opacity-0 transition-opacity duration-200 group-hover/avatar:opacity-100 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.12),transparent_42%,rgba(15,23,42,0.18))]" />
      </div>
      {showVipBadge ? <AvatarVipBadge level={vipLevel} size={size} /> : null}
    </div>
  )
}
