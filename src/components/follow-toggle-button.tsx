"use client"

import { Heart } from "lucide-react"
import { useEffect, useState, useTransition } from "react"

import { toast } from "@/components/ui/toast"
import type { FollowTargetType } from "@/lib/follows"
import { cn } from "@/lib/utils"

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
  activeLabel = "取关",
  inactiveLabel = "关注",
  showLabel = false,
  onFollowStateChange,
  className = "",
}: FollowToggleButtonProps) {
  const [followed, setFollowed] = useState(initialFollowed)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setFollowed(initialFollowed)
  }, [initialFollowed])

  return (
    <button
      type="button"
      disabled={isPending}
      title={followed ? activeLabel : inactiveLabel}
      aria-label={followed ? activeLabel : inactiveLabel}
      aria-pressed={followed}
      className={cn(
        "inline-flex items-center rounded-full border font-medium transition-colors",
        showLabel ? "gap-1.5 px-3 py-1.5 text-xs" : "size-8 justify-center p-0",
        followed
          ? "border-border bg-accent text-foreground"
          : showLabel
            ? "border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:bg-accent hover:text-foreground"
            : "border-border/70 bg-secondary/40 text-foreground hover:border-border hover:bg-accent hover:text-foreground",
        isPending && "cursor-not-allowed opacity-70",
        className,
      )}
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
