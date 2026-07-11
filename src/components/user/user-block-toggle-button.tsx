"use client"

import { useState } from "react"
import { UserX } from "lucide-react"

import { showConfirm } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

interface UserBlockToggleButtonProps {
  targetUserId: number
  initialBlocked: boolean
  activeLabel?: string
  inactiveLabel?: string
  showLabel?: boolean
  className?: string
  reloadOnChange?: boolean
  onBlockStateChange?: (state: { blocked: boolean; changed: boolean }) => void
}

export function UserBlockToggleButton({
  targetUserId,
  initialBlocked,
  activeLabel = "已拉黑",
  inactiveLabel = "拉黑用户",
  showLabel = false,
  className = "",
  reloadOnChange = false,
  onBlockStateChange,
}: UserBlockToggleButtonProps) {
  const [blockedState, setBlockedState] = useState(() => ({
    targetUserId,
    initialBlocked,
    value: initialBlocked,
  }))
  const blocked = blockedState.targetUserId === targetUserId && blockedState.initialBlocked === initialBlocked
    ? blockedState.value
    : initialBlocked
  const [isPending, setIsPending] = useState(false)
  const label = blocked ? activeLabel : inactiveLabel

  async function handleToggle() {
    const desiredBlocked = !blocked

    if (desiredBlocked) {
      const confirmed = await showConfirm({
        title: "确认拉黑用户",
        description: "拉黑后，你将不再看到对方的评论，双方不能继续关注或私信，对方也无法访问你的主页。",
        confirmText: "确认拉黑",
        cancelText: "取消",
        variant: "danger",
      })

      if (!confirmed) {
        return
      }
    }

    setIsPending(true)

    try {
      const response = await fetch("/api/blocks/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetId: String(targetUserId),
          desiredBlocked,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.message ?? "拉黑操作失败")
        return
      }

      const resolvedBlocked = Boolean(result.data?.blocked)
      const changed = Boolean(result.data?.changed)
      setBlockedState({
        targetUserId,
        initialBlocked,
        value: resolvedBlocked,
      })
      onBlockStateChange?.({ blocked: resolvedBlocked, changed })
      toast.success(result.message ?? (resolvedBlocked ? "已拉黑该用户" : "已取消拉黑"))

      if (reloadOnChange && changed) {
        window.location.reload()
      }
    } catch {
      toast.error("拉黑操作失败")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Button
      type="button"
      disabled={isPending}
      title={label}
      aria-label={label}
      aria-pressed={blocked}
      variant={blocked ? "destructive" : "outline"}
      size={showLabel ? "xs" : "icon"}
      className={cn("rounded-full", className)}
      onClick={() => {
        void handleToggle()
      }}
    >
      {isPending
        ? <Spinner data-icon={showLabel ? "inline-start" : undefined} />
        : <UserX data-icon={showLabel ? "inline-start" : undefined} />}
      {showLabel ? <span>{label}</span> : null}
    </Button>
  )
}

