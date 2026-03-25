"use client"

import { useState, useTransition } from "react"
import { Heart } from "lucide-react"



interface BoardFollowButtonProps {
  boardId: string
  initialFollowed: boolean
}

export function BoardFollowButton({ boardId, initialFollowed }: BoardFollowButtonProps) {
  const [followed, setFollowed] = useState(initialFollowed)
  const [isPending, startTransition] = useTransition()


  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={followed ? "inline-flex items-center gap-1 rounded-full border border-border bg-accent px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors" : "inline-flex items-center gap-1 rounded-full border border-transparent bg-transparent px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border/70 hover:bg-accent hover:text-foreground"}
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {

            const response = await fetch("/api/boards/follow", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ boardId }),
            })
            const result = await response.json()
            if (!response.ok) {
              return
            }
            setFollowed(Boolean(result.data?.followed))

          })
        }}
      >
        <Heart className={followed ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5"} />
      </button>

    </div>
  )
}
