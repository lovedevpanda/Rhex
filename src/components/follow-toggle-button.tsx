"use client"

import { Heart } from "lucide-react"
import { useState, useTransition, type ComponentProps } from "react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
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
  variant?: ComponentProps<typeof Button>["variant"]
  size?: ComponentProps<typeof Button>["size"]
}

export function FollowToggleButton(props: FollowToggleButtonProps) {
  return <FollowToggleButtonContent key={String(props.initialFollowed)} {...props} />
}

function FollowToggleButtonContent({
  targetType,
  targetId,
  initialFollowed,
  activeLabel = "??",
  inactiveLabel = "??",
  showLabel = false,
  onFollowStateChange,
  className = "",
  variant,
  size,
}: FollowToggleButtonProps) {
  const [followed, setFollowed] = useState(initialFollowed)
  const [isPending, startTransition] = useTransition()
  const label = followed ? activeLabel : inactiveLabel

  return (
    <Button
      type="button"
      disabled={isPending}
      title={label}
      aria-label={label}
      aria-pressed={followed}
      variant={variant ?? (followed ? "secondary" : "outline")}
      size={size ?? (showLabel ? "xs" : "icon")}
      className={cn("rounded-full", className)}
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
      {isPending
        ? <Spinner data-icon={showLabel ? "inline-start" : undefined} />
        : <Heart data-icon={showLabel ? "inline-start" : undefined} className={cn(followed && "fill-current")} />}
      {showLabel ? <span>{label}</span> : null}
    </Button>
  )
}
