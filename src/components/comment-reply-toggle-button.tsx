"use client"

import { useEffect, useState } from "react"

import { emitCommentReplyToggle, COMMENT_REPLY_STATE_EVENT, type CommentReplyStateDetail } from "@/lib/comment-reply-box-events"
import { cn } from "@/lib/utils"

interface CommentReplyToggleButtonProps {
  threadId: string
}

export function CommentReplyToggleButton({ threadId }: CommentReplyToggleButtonProps) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    function handleReplyState(event: Event) {
      const detail = (event as CustomEvent<CommentReplyStateDetail>).detail
      if (!detail || detail.threadId !== threadId) {
        return
      }

      setActive(detail.active)
    }

    window.addEventListener(COMMENT_REPLY_STATE_EVENT, handleReplyState as EventListener)

    return () => {
      window.removeEventListener(COMMENT_REPLY_STATE_EVENT, handleReplyState as EventListener)
    }
  }, [threadId])

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => emitCommentReplyToggle({ threadId })}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-primary/12 text-primary" : "text-primary hover:bg-primary/8",
      )}
    >
      <span>回复</span>
      <kbd
        className={cn(
          "rounded-full border px-2 py-0.5 font-mono text-[11px] leading-none transition-colors",
          active ? "border-primary/35 bg-primary/12 text-primary" : "border-border bg-background text-muted-foreground",
        )}
      >
        R
      </kbd>
    </button>
  )
}
