"use client"

import { UserX } from "lucide-react"
import { useState } from "react"

import { showConfirm } from "@/components/ui/confirm-dialog"
import { toast } from "@/components/ui/toast"

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
  const [blocked, setBlocked] = useState(initialBlocked)
  const [isPending, setIsPending] = useState(false)

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
      setBlocked(resolvedBlocked)
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
    <button
      type="button"
      disabled={isPending}
      title={blocked ? activeLabel : inactiveLabel}
      aria-label={blocked ? activeLabel : inactiveLabel}
      className={`${blocked
        ? "inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
        : "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border/70 hover:bg-accent hover:text-foreground"
      } ${isPending ? "cursor-not-allowed opacity-70" : ""} ${className}`.trim()}
      onClick={() => {
        void handleToggle()
      }}
    >
      <UserX className="h-3.5 w-3.5" />
      {showLabel ? <span>{blocked ? activeLabel : inactiveLabel}</span> : null}
    </button>
  )
}
