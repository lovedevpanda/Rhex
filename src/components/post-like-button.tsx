"use client"

import { useState, useTransition } from "react"
import { ThumbsUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"


interface PostLikeButtonProps {
  postId: string
  initialCount: number
}

export function PostLikeButton({ postId, initialCount }: PostLikeButtonProps) {
  const [count, setCount] = useState(initialCount)
  const [liked, setLiked] = useState(false)
  const [isPending, startTransition] = useTransition()


  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        className="gap-2 rounded-full"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const response = await fetch("/api/posts/like", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ postId }),
            })
            const result = await response.json()
            if (!response.ok) {
              toast.error(result.message ?? "点赞失败", "帖子点赞失败")
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
        {liked ? "已点赞" : "点赞"}
      </Button>
      <span className="text-sm text-muted-foreground">{count} 人点赞</span>

    </div>
  )
}
