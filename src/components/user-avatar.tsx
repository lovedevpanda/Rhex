import Image from "next/image"

import { getAvatarColor, getAvatarFallback, getAvatarUrl } from "@/lib/avatar"

interface UserAvatarProps {
  name: string
  avatarPath?: string | null
  size?: "sm" | "md" | "lg"
}

const sizeClasses = {
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-lg",
}

export function UserAvatar({ name, avatarPath, size = "md" }: UserAvatarProps) {
  const avatarUrl = getAvatarUrl(avatarPath, name)
  const fallback = getAvatarFallback(name)
  const colors = getAvatarColor(name)

  return (
    <div className={`relative aspect-square shrink-0 overflow-hidden rounded-2xl border border-border bg-card ${sizeClasses[size]}`} style={{ backgroundColor: colors.background, color: colors.foreground }}>
      {avatarPath ? (
        <Image src={avatarUrl} alt={name} fill sizes={size === "lg" ? "64px" : size === "md" ? "44px" : "36px"} className="object-cover" unoptimized />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-semibold tracking-wide">{fallback}</div>
      )}
    </div>
  )
}
