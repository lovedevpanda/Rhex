"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"

import { Button } from "@/components/ui/button"

export function NotificationsToolbar({ unreadCount }: { unreadCount: number }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  async function handleReadAll() {
    startTransition(async () => {
      await fetch("/api/notifications/read-all", {
        method: "POST",
      })
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm text-muted-foreground">未读消息 {unreadCount} 条</p>
      </div>
      <Button type="button" variant="outline" disabled={isPending || unreadCount === 0} onClick={handleReadAll}>
        {isPending ? "处理中..." : "全部已读"}
      </Button>
    </div>
  )
}
