"use client"

import { useState, useTransition } from "react"
import { ThumbsUp } from "lucide-react"

import { toast } from "@/components/ui/toast"

interface CommentLikeButtonProps {
  commentId: string
  initialCount: number
  initialLiked?: boolean
}

export function CommentLikeButton({ commentId, initialCount, initialLiked = false }: CommentLikeButtonProps) {
  const [count, setCount] = useState(initialCount)
  const [liked, setLiked] = useState(initialLiked)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        title={liked ? "取消点赞" : "点赞"}
        aria-label={liked ? "取消点赞" : "点赞"}
        disabled={isPending}
        className={liked ? "inline-flex items-center gap-1 text-primary" : "inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"}
        onClick={() => {
          startTransition(async () => {
            const response = await fetch("/api/comments/like", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ commentId }),
            })
            const result = await response.json()
            if (!response.ok) {
              toast.error(result.message ?? "点赞失败", "评论点赞失败")
              return
            }
            const nextLiked = Boolean(result.data?.liked)
            setLiked(nextLiked)
            setCount((current) => current + (nextLiked ? 1 : -1))
            toast.success(result.message ?? (nextLiked ? "点赞成功" : "已取消点赞"), nextLiked ? "点赞成功" : "取消点赞成功")
          })
        }}
      >
        <ThumbsUp className="h-4 w-4" />
      </button>
      {count > 0 ? <span>{count}</span> : null}
    </div>
  )
}
