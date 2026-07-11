"use client"

import Image from "next/image"
import { ExternalLink, Gift, Heart, Loader2 } from "lucide-react"
import { useMemo, useState, useTransition } from "react"

import { LevelIcon } from "@/components/level-icon"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "@/components/ui/toast"
import { getAvatarUrl } from "@/lib/avatar"
import { formatCompactNumber, formatCompactPointValue, formatNumber, formatRelativeTime } from "@/lib/formatters"
import type { RssEntrySupportSummary } from "@/lib/rss-interactions"
import type { RssUniverseFeedPageData } from "@/lib/rss-public-feed"
import { cn } from "@/lib/utils"

type RssItem = RssUniverseFeedPageData["items"][number]
type RssSupportConfig = RssUniverseFeedPageData["support"]

const defaultSupportConfig: RssSupportConfig = {
  enabled: false,
  isLoggedIn: false,
  pointName: "积分",
  currentUserPoints: 0,
  gifts: [],
  allowedAmounts: [],
}

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init)
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message ?? "请求失败")
  }

  return {
    message: result.message as string | undefined,
    data: result.data as T,
  }
}

type RssUniverseFeedViewProps = {
  items: RssUniverseFeedPageData["items"]
  support?: RssSupportConfig
}

export function RssUniverseFeedView({
  items,
  support = defaultSupportConfig,
}: RssUniverseFeedViewProps) {
  const feedKey = useMemo(
    () => JSON.stringify({ items, currentUserPoints: support.currentUserPoints }),
    [items, support.currentUserPoints],
  )

  return <RssUniverseFeedViewContent key={feedKey} items={items} support={support} />
}

function RssUniverseFeedViewContent({
  items,
  support,
}: Required<RssUniverseFeedViewProps>) {
  const [entries, setEntries] = useState(items)
  const [points, setPoints] = useState(support.currentUserPoints)
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const firstAmount = support.allowedAmounts[0] ?? 0

  const giftMap = useMemo(() => new Map(support.gifts.map((gift) => [gift.id, gift])), [support.gifts])

  function updateEntry(entryId: string, patch: Partial<RssItem>) {
    setEntries((current) => current.map((item) => item.id === entryId ? { ...item, ...patch } : item))
  }

  function handleLike(entry: RssItem) {
    if (isPending) {
      return
    }

    startTransition(async () => {
      try {
        const result = await readJson<{ liked: boolean; likeCount: number }>("/api/rss-universe/like", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entryId: entry.id }),
        })
        updateEntry(entry.id, {
          viewerLiked: result.data.liked,
          likeCount: result.data.likeCount,
        })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "点赞失败", "操作失败")
      }
    })
  }

  function handleTip(entry: RssItem, options: { amount: number; giftId?: string | null }) {
    if (isPending) {
      return
    }

    const gift = options.giftId ? giftMap.get(options.giftId) ?? null : null
    if (!support.enabled) {
      toast.error("当前未开启打赏", "打赏失败")
      return
    }
    if (!support.isLoggedIn) {
      toast.error("请登录后参与打赏", "打赏失败")
      return
    }
    if (options.amount <= 0) {
      toast.error("请选择有效的打赏金额", "打赏失败")
      return
    }
    if (points < options.amount) {
      toast.error(`${support.pointName}不足，无法完成打赏`, "打赏失败")
      return
    }

    startTransition(async () => {
      try {
        const result = await readJson<RssEntrySupportSummary>("/api/rss-universe/tip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entryId: entry.id,
            amount: options.amount,
            giftId: options.giftId,
          }),
        })
        setPoints(result.data.currentUserPoints)
        updateEntry(entry.id, {
          tipCount: result.data.tipCount,
          tipTotalPoints: result.data.tipTotalPoints,
        })
        setActiveEntryId(null)
        toast.success(result.message ?? (gift ? `已送出 ${gift.name}` : "打赏成功"), gift ? "送礼成功" : "打赏成功")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "打赏失败，请稍后重试", "打赏失败")
      }
    })
  }

  if (entries.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-3 lg:px-4">
      {entries.map((item) => {
        const timestamp = item.publishedAt ?? item.createdAt
        const logoUrl = getAvatarUrl(item.sourceLogoPath, item.sourceName)

        return (
          <article key={item.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="relative mt-0.5 size-11 shrink-0 overflow-hidden rounded-lg border border-border bg-background">
                <Image src={logoUrl} alt={`${item.sourceName} logo`} fill sizes="44px" className="object-cover" unoptimized />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {item.linkUrl ? (
                      <a href={item.linkUrl} target="_blank" rel="noreferrer" className="line-clamp-2 text-[15px] font-semibold leading-6 text-foreground transition hover:text-primary">
                        {item.title}
                      </a>
                    ) : (
                      <h2 className="line-clamp-2 text-[15px] font-semibold leading-6 text-foreground">{item.title}</h2>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{item.sourceName}</span>
                      <span>{formatRelativeTime(timestamp)}</span>
                      {item.author ? <span>作者 {item.author}</span> : null}
                    </div>
                  </div>

                  <span className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
                    {item.sourceName}
                  </span>
                </div>

                {item.summary ? (
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors",
                        item.viewerLiked ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                      disabled={isPending}
                      onClick={() => handleLike(item)}
                      title={`${formatNumber(item.likeCount)} 点赞`}
                    >
                      {isPending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Heart data-icon="inline-start" className={item.viewerLiked ? "fill-current" : ""} />}
                      <span className="tabular-nums">{formatCompactNumber(item.likeCount)}</span>
                    </button>

                    <Popover open={activeEntryId === item.id} onOpenChange={(open) => setActiveEntryId(open ? item.id : null)}>
                      <PopoverTrigger
                        className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background px-3.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        disabled={isPending}
                      >
                        <Gift data-icon="inline-start" />
                        打赏
                      </PopoverTrigger>
                      <PopoverContent align="start" sideOffset={8} className="z-[240] w-max min-w-72 max-w-[calc(100vw-1rem)] rounded-[22px] p-5 shadow-xl sm:max-w-[34rem]">
                        <div className="flex max-w-full flex-col gap-4">
                          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                            <span>余额 {formatCompactPointValue(points)} {support.pointName}</span>
                            <span>已消耗 {formatCompactPointValue(item.tipTotalPoints)}</span>
                          </div>

                          {support.gifts.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {support.gifts.map((gift) => (
                                <button
                                  key={gift.id}
                                  type="button"
                                  className="inline-flex h-14 min-w-20 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-lg transition-colors hover:bg-accent disabled:opacity-60"
                                  disabled={isPending}
                                  onClick={() => handleTip(item, { amount: gift.price, giftId: gift.id })}
                                  title={`${gift.name} · ${formatCompactPointValue(gift.price)} ${support.pointName}`}
                                >
                                  <LevelIcon icon={gift.icon} className="size-5" emojiClassName="text-xl leading-none" svgClassName="[&>svg]:block [&>svg]:size-full" title={gift.name} />
                                  <span className="text-base">{formatCompactPointValue(gift.price)}</span>
                                </button>
                              ))}
                            </div>
                          ) : null}

                          <div className="flex flex-wrap gap-3">
                            {support.allowedAmounts.map((amount) => (
                              <button
                                key={amount}
                                type="button"
                                className={cn(
                                  "h-12 min-w-16 rounded-full border border-border bg-card px-4 text-base transition-colors hover:bg-accent disabled:opacity-60",
                                  amount === firstAmount && "bg-secondary text-foreground",
                                )}
                                disabled={isPending}
                                onClick={() => handleTip(item, { amount })}
                              >
                                {amount}
                              </button>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {item.linkUrl ? (
                    <a href={item.linkUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-xs text-muted-foreground transition hover:text-foreground">
                      原文
                      <ExternalLink data-icon="inline-end" />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
