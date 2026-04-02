"use client"

import Link from "next/link"
import { ArrowRight, Clock3, Eraser, History } from "lucide-react"
import { useMemo, useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import { formatDateTime, formatRelativeTime, getLocalDateKey } from "@/lib/formatters"
import {
  clearReadingHistory,
  filterReadingHistoryByDate,
  readReadingHistorySnapshot,
  subscribeReadingHistory,
  type ReadingHistoryEntry,
} from "@/lib/local-reading-history"
import { cn } from "@/lib/utils"

type ReadingHistoryPanelVariant = "sidebar" | "feed" | "page"
const EMPTY_READING_HISTORY_SNAPSHOT: ReadingHistoryEntry[] = []

interface ReadingHistoryPanelProps {
  variant?: ReadingHistoryPanelVariant
  title?: string
  emptyTitle?: string
  emptyDescription?: string
  limit?: number
  moreHref?: string
  moreLabel?: string
  showOnlyToday?: boolean
  showClearButton?: boolean
  requireLoggedIn?: boolean
  isLoggedIn?: boolean
  hideWhenEmpty?: boolean
  stabilizeLayoutOnHydration?: boolean
  className?: string
}

export function ReadingHistoryPanel({
  variant = "page",
  title,
  emptyTitle,
  emptyDescription,
  limit,
  moreHref,
  moreLabel = "更多",
  showOnlyToday = false,
  showClearButton = false,
  requireLoggedIn = false,
  isLoggedIn = true,
  hideWhenEmpty = false,
  stabilizeLayoutOnHydration = false,
  className,
}: ReadingHistoryPanelProps) {
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  )
  const snapshot = useSyncExternalStore(
    subscribeReadingHistory,
    readReadingHistorySnapshot,
    () => EMPTY_READING_HISTORY_SNAPSHOT,
  )
  const todayKey = getLocalDateKey()
  const entries = useMemo(() => {
    const sourceEntries = showOnlyToday ? filterReadingHistoryByDate(snapshot, todayKey) : snapshot

    if (!limit || limit < 1) {
      return sourceEntries
    }

    return sourceEntries.slice(0, limit)
  }, [limit, showOnlyToday, snapshot, todayKey])

  const cardClassName = variant === "sidebar"
    ? "rounded-[20px] border border-border bg-card p-3 shadow-sm shadow-black/5 dark:shadow-black/30"
    : variant === "feed"
      ? "rounded-[24px] border border-border bg-card p-4 shadow-sm shadow-black/5 dark:shadow-black/30"
      : "rounded-[28px] border border-border bg-card p-4 shadow-sm shadow-black/5 dark:shadow-black/30 sm:p-5"

  if (requireLoggedIn && !isLoggedIn) {
    return null
  }

  if (stabilizeLayoutOnHydration && !hydrated && (!requireLoggedIn || isLoggedIn)) {
    return (
      <section className={cn(cardClassName, "pointer-events-none select-none")} aria-hidden="true">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 rounded-full bg-secondary/60" />
          <span className="h-4 w-16 rounded-full bg-secondary/60" />
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-10 rounded-[16px] bg-secondary/35" />
          <div className="h-10 rounded-[16px] bg-secondary/30" />
          <div className="h-10 rounded-[16px] bg-secondary/25" />
        </div>
      </section>
    )
  }

  if (entries.length === 0 && hideWhenEmpty) {
    return null
  }

  const panelTitle = title ?? (showOnlyToday ? "今日访问" : "足迹")
  const resolvedEmptyTitle = emptyTitle ?? (showOnlyToday ? "今天还没有访问记录" : "还没有浏览记录")
  const resolvedEmptyDescription = emptyDescription ?? "打开帖子后会自动写入本地，用于侧边栏和足迹页展示。"
  const panelIcon = showOnlyToday ? Clock3 : History
  const Icon = panelIcon

  return (
    <section className={cn(cardClassName, className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full",
            variant === "sidebar" ? "h-7 w-7 bg-sky-500/10 text-sky-600 dark:text-sky-300" : "h-9 w-9 bg-sky-500/10 text-sky-600 dark:text-sky-300",
          )}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={cn("truncate font-semibold", variant === "page" ? "text-base" : "text-sm")}>{panelTitle}</h3>
              {!showOnlyToday && snapshot.length > 0 ? <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">{snapshot.length}</span> : null}
            </div>
            {variant === "page" ? <p className="mt-0.5 text-xs text-muted-foreground">数据保存在当前浏览器本地，最多保留 2000 条。</p> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {showClearButton ? (
            <Button
              type="button"
              variant="ghost"
              className="h-8 rounded-full px-2.5 text-xs text-muted-foreground"
              onClick={() => clearReadingHistory()}
              disabled={snapshot.length === 0}
            >
              <Eraser className="mr-1 h-3.5 w-3.5" />
              清空
            </Button>
          ) : null}
          {moreHref ? (
            <Link href={moreHref} className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              {moreLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className={cn(
          "mt-3 rounded-[18px] border border-dashed border-border bg-secondary/15 text-muted-foreground",
          variant === "page" ? "px-4 py-6" : variant === "sidebar" ? "px-2.5 py-3" : "px-3 py-4",
        )}>
          <p className="text-sm font-medium text-foreground/80">{resolvedEmptyTitle}</p>
          <p className="mt-1 text-xs leading-6">{resolvedEmptyDescription}</p>
        </div>
      ) : (
        <div className={cn("mt-3", variant === "page" ? "space-y-2.5" : "space-y-1.5")}>
          {entries.map((entry) => (
            <HistoryRow key={buildReadingHistoryRowKey(entry)} entry={entry} variant={variant} />
          ))}
        </div>
      )}
    </section>
  )
}

function HistoryRow({ entry, variant }: { entry: ReadingHistoryEntry; variant: ReadingHistoryPanelVariant }) {
  const createdAtText = entry.postCreatedAt ? formatDateTime(entry.postCreatedAt) : null
  const viewedAtText = formatDateTime(entry.viewedAt)
  const viewedRelativeText = formatRelativeTime(entry.viewedAt)

  return (
    <Link
      href={entry.postPath}
      className={cn(
        "group block rounded-[18px] border border-transparent transition-colors hover:border-border hover:bg-accent/40",
        variant === "sidebar" ? "px-2 py-1.5" : variant === "feed" ? "px-3 py-2.5" : "px-3.5 py-3",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className={cn(
            "line-clamp-1 font-medium text-foreground transition-colors group-hover:text-primary",
            variant === "sidebar" ? "text-[12px]" : "text-sm",
          )}>
            {entry.title}
          </div>
          <div className={cn(
            "mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground",
            variant === "sidebar" ? "text-[10px]" : "text-[11px]",
          )}>
            {entry.boardName ? (
              <span className="inline-flex max-w-full items-center rounded-full bg-secondary/70 px-2 py-0.5 leading-none">
                <span className="truncate">{entry.boardName}</span>
              </span>
            ) : null}
            <Tooltip content={`浏览于 ${viewedAtText}`}>
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3 w-3" />
                <span>{viewedRelativeText}</span>
              </span>
            </Tooltip>
            {variant === "page" && createdAtText ? (
              <Tooltip content={`发帖于 ${createdAtText}`}>
                <span className="truncate">发帖 {createdAtText}</span>
              </Tooltip>
            ) : null}
          </div>
        </div>
        <ArrowRight className={cn(
          "mt-0.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground",
          variant === "sidebar" ? "h-3.5 w-3.5" : "h-4 w-4",
        )} />
      </div>
    </Link>
  )
}

function buildReadingHistoryRowKey(entry: ReadingHistoryEntry) {
  return entry.postId ?? entry.postSlug ?? entry.postPath
}
