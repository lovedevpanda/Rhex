"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { useInboxRealtime } from "@/components/inbox-realtime-provider"
import { Button } from "@/components/ui/rbutton"

export function NotificationsToolbar() {
  const router = useRouter()
  const { unreadNotificationCount: unreadCount } = useInboxRealtime()
  const [isPending, setIsPending] = useState(false)

  async function handleReadAll() {
    if (isPending || unreadCount === 0) {
      return
    }

    setIsPending(true)

    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      })

      if (!response.ok) {
        return
      }

      router.refresh()
    } finally {
      setIsPending(false)
    }
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
