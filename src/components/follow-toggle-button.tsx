"use client"

import { Heart } from "lucide-react"
import { useState, useTransition } from "react"

import { toast } from "@/components/ui/toast"
import type { FollowTargetType } from "@/lib/follows"

interface FollowToggleButtonProps {
  targetType: FollowTargetType
  targetId: string | number
  initialFollowed: boolean
  activeLabel?: string
  inactiveLabel?: string
  showLabel?: boolean
  onFollowStateChange?: (state: { followed: boolean; changed: boolean }) => void
  className?: string
}

export function FollowToggleButton({
  targetType,
  targetId,
  initialFollowed,
  activeLabel = "已关注",
  inactiveLabel = "关注",
  showLabel = false,
  onFollowStateChange,
  className = "",
}: FollowToggleButtonProps) {
  const [followed, setFollowed] = useState(initialFollowed)
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      title={followed ? activeLabel : inactiveLabel}
      aria-label={followed ? activeLabel : inactiveLabel}
      className={`${followed
        ? "inline-flex items-center gap-1.5 rounded-full border border-border bg-accent px-3 py-1.5 text-xs font-medium text-foreground transition-colors"
        : "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border/70 hover:bg-accent hover:text-foreground"
      } ${isPending ? "cursor-not-allowed opacity-70" : ""} ${className}`.trim()}
      onClick={() => {
        const desiredFollowed = !followed

        startTransition(async () => {
          const response = await fetch("/api/follows/toggle", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              targetType,
              targetId: String(targetId),
              desiredFollowed,
            }),
          })
          const result = await response.json()

          if (!response.ok) {
            toast.error(result.message ?? "关注操作失败")
            return
          }

          const resolvedFollowed = Boolean(result.data?.followed)
          const changed = Boolean(result.data?.changed)
          setFollowed(resolvedFollowed)
          onFollowStateChange?.({ followed: resolvedFollowed, changed })
          toast.success(result.message ?? (resolvedFollowed ? "关注成功" : "已取消关注"))
        })
      }}
    >
      <Heart className={followed ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5"} />
      {showLabel ? <span>{followed ? activeLabel : inactiveLabel}</span> : null}
    </button>
  )
}
