"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

interface NotificationListItemProps {
  id: string
  href: string
  isRead: boolean
  typeLabel: string
  title: string
  content: string
  senderName: string
  createdAt: string
}

export function NotificationListItem({ id, href, isRead, typeLabel, title, content, senderName, createdAt }: NotificationListItemProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (isRead) {
      return
    }

    event.preventDefault()

    startTransition(async () => {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notificationId: id }),
      })
      router.push(href)
      router.refresh()
    })
  }

  return (
    <Link href={href} onClick={handleClick} className={isRead ? "block rounded-[20px] border border-border bg-card p-4 transition-colors hover:bg-accent/40" : "block rounded-[20px] border border-emerald-200 bg-emerald-50/50 p-4 transition-colors hover:bg-accent/40"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-full bg-secondary px-3 py-1 text-xs">{typeLabel}</span>
          {!isRead ? <span className="rounded-full bg-rose-100 px-2 py-1 text-xs text-rose-700">未读</span> : null}
        </div>
        <span className="text-xs text-muted-foreground">{createdAt}</span>
      </div>
      <h2 className="mt-3 text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">{content}</p>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>来源：{senderName}</span>
        <span>{isPending ? "跳转中..." : "点击查看详情"}</span>
      </div>
    </Link>
  )
}
