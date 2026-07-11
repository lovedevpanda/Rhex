"use client"

import Link from "next/link"
import { Bell, ChevronRight, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/rbutton"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const NOTIFICATIONS_HREF = "/notifications"
const UNREAD_PREVIEW_LIMIT = 5

interface HeaderNotificationsPopoverProps {
  unreadCount: number
  badgeClassName?: string
}

interface HeaderNotificationItem {
  id: string
  typeLabel: string
  title: string
  content: string
  createdAt: string
  senderName: string
  relatedUrl: string
}

interface HeaderNotificationsResponse {
  data?: {
    items?: HeaderNotificationItem[]
    unreadCount?: number
  }
  message?: string
}

interface HeaderNotificationsActionResponse {
  message?: string
}

function formatUnreadBadge(count: number) {
  if (count <= 0) {
    return null
  }

  return count > 99 ? "99+" : String(count)
}

function HeaderUnreadBadge({ count, className }: { count: number; className?: string }) {
  const label = formatUnreadBadge(count)

  if (!label) {
    return null
  }

  const isOverflowLabel = label.length > 2

  return (
    <span
      className={cn(
        "absolute flex min-h-4 min-w-4 items-center justify-center whitespace-nowrap rounded-full border border-background bg-rose-500 px-1.5 text-[10px] font-semibold leading-none tabular-nums text-white shadow-[0_4px_12px_rgba(244,63,94,0.22)] dark:border-background dark:bg-rose-300 dark:text-rose-950 dark:shadow-none",
        className,
        isOverflowLabel && "min-w-6 translate-x-1",
      )}
    >
      {label}
    </span>
  )
}

export function HeaderNotificationsPopover({ unreadCount, badgeClassName }: HeaderNotificationsPopoverProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<HeaderNotificationItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [markingReadId, setMarkingReadId] = useState("")
  const [markingAllRead, setMarkingAllRead] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [visibleUnreadCount, setVisibleUnreadCount] = useState(unreadCount)

  useEffect(() => {
    queueMicrotask(() => {
      setVisibleUnreadCount(unreadCount)

      if (unreadCount > 0) {
        setLoaded(false)
      }
    })
  }, [unreadCount])

  useEffect(() => {
    if (!open || loaded) {
      return
    }

    const abortController = new AbortController()

    queueMicrotask(() => {
      if (abortController.signal.aborted) {
        return
      }

      setLoading(true)
      setErrorMessage("")

      void fetch(`/api/notifications/unread?limit=${UNREAD_PREVIEW_LIMIT}`, {
      cache: "no-store",
      signal: abortController.signal,
      })
        .then(async (response) => {
        const payload = await response.json().catch(() => null) as HeaderNotificationsResponse | null

        if (!response.ok) {
          throw new Error(payload?.message || "未读通知加载失败")
        }

        const nextItems = Array.isArray(payload?.data?.items) ? payload.data.items : []
        setItems(nextItems)
        setVisibleUnreadCount(payload?.data?.unreadCount ?? nextItems.length)
        setLoaded(true)
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) {
          return
        }

        setErrorMessage(error instanceof Error ? error.message : "未读通知加载失败")
      })
        .finally(() => {
          if (!abortController.signal.aborted) {
            setLoading(false)
          }
        })
    })

    return () => {
      abortController.abort()
    }
  }, [loaded, open])

  async function handleMarkAllRead() {
    if (markingAllRead || visibleUnreadCount <= 0) {
      return
    }

    setMarkingAllRead(true)
    setErrorMessage("")

    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      })
      const payload = await response.json().catch(() => null) as HeaderNotificationsActionResponse | null

      if (!response.ok) {
        throw new Error(payload?.message || "全部已读失败")
      }

      setItems([])
      setVisibleUnreadCount(0)
      setLoaded(true)
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "全部已读失败")
    } finally {
      setMarkingAllRead(false)
    }
  }

  async function handleNotificationClick(event: React.MouseEvent<HTMLAnchorElement>, item: HeaderNotificationItem) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }

    event.preventDefault()

    if (markingReadId) {
      return
    }

    setMarkingReadId(item.id)
    setErrorMessage("")

    try {
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notificationId: item.id }),
      })
      const payload = await response.json().catch(() => null) as HeaderNotificationsActionResponse | null

      if (!response.ok) {
        throw new Error(payload?.message || "标记通知失败")
      }

      setItems((current) => current.filter((candidate) => candidate.id !== item.id))
      setVisibleUnreadCount((current) => Math.max(0, current - 1))
      setOpen(false)
      window.location.assign(item.relatedUrl)
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "标记通知失败")
    } finally {
      setMarkingReadId("")
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative size-8 rounded-md"
            aria-label={visibleUnreadCount > 0 ? `打开通知，${visibleUnreadCount} 条未读` : "打开通知"}
          />
        )}
      >
        <Bell className={visibleUnreadCount > 0 ? "text-rose-600 dark:text-rose-300" : undefined} />
        <HeaderUnreadBadge count={visibleUnreadCount} className={badgeClassName} />
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[min(calc(100vw-1rem),360px)] gap-0 overflow-hidden rounded-2xl border border-border bg-background p-0 shadow-2xl ring-0"
      >
        <PopoverHeader className="gap-0 p-4 pb-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-foreground text-background">
              <Bell className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <PopoverTitle className="text-base font-semibold">通知消息</PopoverTitle>
              <PopoverDescription className="text-xs">
                {visibleUnreadCount > 0 ? `${visibleUnreadCount} 条未读消息` : "暂无未读消息"}
              </PopoverDescription>
            </div>
            {visibleUnreadCount > 0 ? (
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary">
                  未读
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={markingAllRead}
                  onClick={handleMarkAllRead}
                >
                  {markingAllRead ? "处理中" : "全部已读"}
                </Button>
              </div>
            ) : null}
          </div>
        </PopoverHeader>

        <Separator />

        <div className="max-h-[min(60vh,360px)] overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在加载未读消息
            </div>
          ) : errorMessage ? (
            <div className="rounded-xl bg-destructive/10 px-3 py-4 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : items.length > 0 ? (
            <div className="flex flex-col gap-1">
              {items.map((item) => (
                <a
                  key={item.id}
                  href={item.relatedUrl}
                  className="group rounded-xl px-3 py-2.5 outline-hidden transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={(event) => handleNotificationClick(event, item)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-xs text-muted-foreground">{item.typeLabel}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{item.createdAt}</span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm font-medium text-foreground group-hover:text-primary">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.content}</p>
                  <p className="mt-1.5 truncate text-[11px] text-muted-foreground">来源：{item.senderName}</p>
                </a>
              ))}
            </div>
          ) : (
            <div className="px-3 py-8 text-center">
              <p className="text-sm font-medium">暂时没有未读消息</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">可以前往通知中心查看全部历史消息。</p>
            </div>
          )}
        </div>

        <Separator />

        <Link
          href={NOTIFICATIONS_HREF}
          className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setOpen(false)}
        >
          <span>{items.length > 0 ? "查看更多通知" : "前往通知中心"}</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </PopoverContent>
    </Popover>
  )
}
