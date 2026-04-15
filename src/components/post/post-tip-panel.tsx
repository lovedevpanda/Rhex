"use client"

import { ChevronDown, ChevronUp, Gift, Zap } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react"
import { createPortal } from "react-dom"

import type { PostGiftRecentEventItem, PostGiftStatItem } from "@/db/post-gift-queries"
import { LevelIcon } from "@/components/level-icon"
import { UserAvatar } from "@/components/user/user-avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/rbutton"
import { Tooltip } from "@/components/ui/tooltip"
import { toast } from "@/components/ui/toast"
import { formatNumber } from "@/lib/formatters"
import type { SiteTippingGiftItem } from "@/lib/site-settings"
import { cn } from "@/lib/utils"

interface PostTipPanelProps {
  postId: string
  enabled: boolean
  isLoggedIn: boolean
  pointName: string
  currentUserPoints: number
  gifts: SiteTippingGiftItem[]
  giftStats: PostGiftStatItem[]
  recentGiftEvents: PostGiftRecentEventItem[]
  allowedAmounts: number[]
  dailyLimit: number
  perPostLimit: number
  usedDailyCount: number
  usedPostCount: number
  totalCount: number
  totalPoints: number
  topSupporters: Array<{
    userId: number
    username: string
    nickname?: string | null
    avatarPath?: string | null
    totalAmount: number
  }>
}

interface TipSummaryPayload {
  enabled: boolean
  isLoggedIn: boolean
  pointName: string
  currentUserPoints: number
  gifts: SiteTippingGiftItem[]
  giftStats: PostGiftStatItem[]
  recentGiftEvents: PostGiftRecentEventItem[]
  allowedAmounts: number[]
  dailyLimit: number
  perPostLimit: number
  usedDailyCount: number
  usedPostCount: number
  tipCount: number
  tipTotalPoints: number
  topSupporters: Array<{
    userId: number
    username: string
    nickname?: string | null
    avatarPath?: string | null
    totalAmount: number
  }>
}

interface FloatingGiftPulse {
  id: string
  giftId: string
  senderName: string
  senderAvatarPath?: string | null
  lane: number
}

interface GiftAnchorPosition {
  left: number
  top: number
}

const GIFT_FLOAT_LANES = [-18, 0, 18] as const

export function PostTipPanel({
  postId,
  enabled,
  isLoggedIn,
  pointName,
  currentUserPoints,
  gifts,
  giftStats,
  recentGiftEvents,
  allowedAmounts,
  dailyLimit,
  perPostLimit,
  usedDailyCount,
  usedPostCount,
  totalCount,
  totalPoints,
  topSupporters,
}: PostTipPanelProps) {
  const animationTimersRef = useRef<number[]>([])
  const seededRecentEventIdsRef = useRef(new Set<string>())
  const laneCursorRef = useRef(0)
  const giftButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const [open, setOpen] = useState(false)
  const [selectedGiftId, setSelectedGiftId] = useState(gifts[0]?.id ?? "")
  const [selectedAmount, setSelectedAmount] = useState<number>(allowedAmounts[0] ?? 0)
  const [expanded, setExpanded] = useState(false)
  const [points, setPoints] = useState(currentUserPoints)
  const [tipCount, setTipCount] = useState(totalCount)
  const [tipTotalPoints, setTipTotalPoints] = useState(totalPoints)
  const [todayUsed, setTodayUsed] = useState(usedDailyCount)
  const [postUsed, setPostUsed] = useState(usedPostCount)
  const [supporters, setSupporters] = useState(topSupporters)
  const [giftSummary, setGiftSummary] = useState(giftStats)
  const [recentGiftFeeds, setRecentGiftFeeds] = useState(recentGiftEvents)
  const [floatingGiftPulses, setFloatingGiftPulses] = useState<FloatingGiftPulse[]>([])
  const [giftAnchorPositions, setGiftAnchorPositions] = useState<Record<string, GiftAnchorPosition>>({})
  const [message, setMessage] = useState("")
  const [isPending, startTransition] = useTransition()
  const isClient = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  )

  const effectiveSelectedGift = useMemo(
    () => gifts.find((item) => item.id === selectedGiftId) ?? gifts[0] ?? null,
    [gifts, selectedGiftId],
  )
  const effectiveSelectedAmount = allowedAmounts.includes(selectedAmount) ? selectedAmount : (allowedAmounts[0] ?? 0)
  const canTip = enabled && isLoggedIn && effectiveSelectedAmount > 0 && todayUsed < dailyLimit && postUsed < perPostLimit && points >= effectiveSelectedAmount
  const tipHelperText = useMemo(() => {
    if (!enabled) {
      return "当前未开启积分打赏"
    }
    if (!isLoggedIn) {
      return "请登录后参与打赏"
    }
    if (todayUsed >= dailyLimit) {
      return `今日打赏次数已用完（${dailyLimit}/${dailyLimit}）`
    }
    if (postUsed >= perPostLimit) {
      return `该帖子打赏次数已达上限（${perPostLimit}/${perPostLimit}）`
    }
    if (points <= 0) {
      return `当前${pointName}余额不足，暂时无法打赏`
    }
    return `今日还能打赏 ${Math.max(0, dailyLimit - todayUsed)} 次，本帖还能打赏 ${Math.max(0, perPostLimit - postUsed)} 次`
  }, [dailyLimit, enabled, isLoggedIn, perPostLimit, pointName, points, postUsed, todayUsed])
  const compactSupporters = supporters.slice(0, 6)
  const giftStatMap = useMemo(
    () => new Map(giftSummary.map((item) => [item.giftId, item])),
    [giftSummary],
  )
  const giftItemMap = useMemo(
    () => new Map(gifts.map((item) => [item.id, item])),
    [gifts],
  )
  const triggerGiftPreview = useMemo(
    () => recentGiftFeeds
      .slice(0, 3)
      .map((event) => {
        const giftItem = giftItemMap.get(event.giftId)
        if (giftItem) {
          return {
            id: giftItem.id,
            name: giftItem.name,
            icon: giftItem.icon,
          }
        }

        const giftStat = giftSummary.find((item) => item.giftId === event.giftId)
        if (!giftStat) {
          return null
        }

        return {
          id: giftStat.giftId,
          name: giftStat.giftName,
          icon: giftStat.giftIcon,
        }
      })
      .filter((item): item is { id: string; name: string; icon: string } => Boolean(item)),
    [giftItemMap, giftSummary, recentGiftFeeds],
  )
  const totalGiftCount = useMemo(() => giftSummary.reduce((total, item) => total + item.totalCount, 0), [giftSummary])
  const triggerTooltip = tipTotalPoints > 0
    ? `本帖已收到 ${totalGiftCount > 0 ? `${totalGiftCount} 份礼物，` : ""}${formatNumber(tipTotalPoints)} ${pointName}`
    : "送礼或积分打赏支持作者"

  const clearAnimationTimers = useCallback(() => {
    animationTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    animationTimersRef.current = []
  }, [])

  const measureGiftAnchors = useCallback(() => {
    const nextPositions: Record<string, GiftAnchorPosition> = {}

    for (const gift of gifts) {
      const buttonElement = giftButtonRefs.current[gift.id]
      if (!buttonElement) {
        continue
      }

      const buttonRect = buttonElement.getBoundingClientRect()
      nextPositions[gift.id] = {
        left: buttonRect.left + buttonRect.width / 2,
        top: buttonRect.top,
      }
    }

    setGiftAnchorPositions(nextPositions)
  }, [gifts])

  const resetFloatingGiftState = useCallback(() => {
    clearAnimationTimers()
    seededRecentEventIdsRef.current.clear()
    laneCursorRef.current = 0
    setFloatingGiftPulses([])
  }, [clearAnimationTimers])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      setExpanded(false)
      return
    }

    resetFloatingGiftState()
  }, [resetFloatingGiftState])

  const closeTipPanel = useCallback(() => {
    handleOpenChange(false)
  }, [handleOpenChange])

  function scheduleFloatingGiftPulse(event: PostGiftRecentEventItem, delay = 0) {
    const lane = GIFT_FLOAT_LANES[laneCursorRef.current % GIFT_FLOAT_LANES.length] ?? 0
    laneCursorRef.current += 1

    const enqueue = () => {
      const pulseId = `${event.id}-${Date.now()}-${laneCursorRef.current}`
      setFloatingGiftPulses((current) => [
        ...current,
        {
          id: pulseId,
          giftId: event.giftId,
          senderName: event.senderName,
          senderAvatarPath: event.senderAvatarPath,
          lane,
        },
      ])

      const removeTimer = window.setTimeout(() => {
        setFloatingGiftPulses((current) => current.filter((item) => item.id !== pulseId))
      }, 1700)
      animationTimersRef.current.push(removeTimer)
    }

    if (delay <= 0) {
      enqueue()
      return
    }

    const timer = window.setTimeout(enqueue, delay)
    animationTimersRef.current.push(timer)
  }

  function getTipBlockedMessage(amount: number, mode: "gift" | "tip") {
    if (!enabled) {
      return "当前未开启积分打赏"
    }
    if (!isLoggedIn) {
      return mode === "gift" ? "请登录后参与送礼" : "请登录后参与打赏"
    }
    if (todayUsed >= dailyLimit) {
      return `今日打赏次数已用完（${dailyLimit}/${dailyLimit}）`
    }
    if (postUsed >= perPostLimit) {
      return `该帖子打赏次数已达上限（${perPostLimit}/${perPostLimit}）`
    }
    if (amount <= 0) {
      return mode === "gift" ? "当前礼物价格无效，请稍后重试" : "请选择有效的打赏金额"
    }
    if (points < amount) {
      return `${pointName}不足，无法完成${mode === "gift" ? "送礼" : "打赏"}`
    }

    return null
  }

  function syncSummary(data: TipSummaryPayload) {
    setPoints(data.currentUserPoints)
    setTodayUsed(data.usedDailyCount)
    setPostUsed(data.usedPostCount)
    setTipCount(data.tipCount)
    setTipTotalPoints(data.tipTotalPoints)
    setSupporters(data.topSupporters)
    setGiftSummary(data.giftStats)
    setRecentGiftFeeds(data.recentGiftEvents)
  }

  function handleTip(options?: { mode?: "gift" | "tip"; gift?: SiteTippingGiftItem | null; amount?: number }) {
    const mode = options?.mode ?? "tip"
    const targetGift = mode === "gift" ? (options?.gift ?? effectiveSelectedGift) : null
    const targetAmount = mode === "gift"
      ? (targetGift?.price ?? 0)
      : (options?.amount ?? effectiveSelectedAmount)
    const blockedMessage = getTipBlockedMessage(targetAmount, mode)

    if (isPending) {
      return
    }

    if (blockedMessage) {
      setMessage(blockedMessage)
      toast.error(blockedMessage, mode === "gift" ? "送礼失败" : "打赏失败")
      return
    }

    setMessage("")

    startTransition(async () => {
      try {
        const response = await fetch("/api/posts/tip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId, amount: targetAmount, giftId: targetGift?.id }),
        })
        const result = await response.json()

        if (!response.ok) {
          const errorMessage = result.message ?? (mode === "gift" ? "送礼失败，请稍后重试" : "打赏失败，请稍后重试")
          setMessage(errorMessage)
          toast.error(errorMessage, mode === "gift" ? "送礼失败" : "打赏失败")
          return
        }

        if (result.data) {
          syncSummary(result.data)
        }

        const successMessage = result.message ?? (targetGift ? `已送出 ${targetGift.name}` : `已成功打赏 ${formatNumber(targetAmount)} ${pointName}`)
        setMessage(successMessage)
        toast.success(successMessage, mode === "gift" ? "送礼成功" : "打赏成功")
      } catch {
        const errorMessage = mode === "gift" ? "送礼失败，请稍后重试" : "打赏失败，请稍后重试"
        setMessage(errorMessage)
        toast.error(errorMessage, mode === "gift" ? "送礼失败" : "打赏失败")
      }
    })
  }

  useEffect(() => {
    if (!open) {
      return
    }

    const unseenEvents = recentGiftFeeds
      .slice()
      .reverse()
      .filter((event) => !seededRecentEventIdsRef.current.has(event.id))

    unseenEvents.forEach((event, index) => {
      seededRecentEventIdsRef.current.add(event.id)
      scheduleFloatingGiftPulse(event, index * 180)
    })
  }, [open, recentGiftFeeds])

  useEffect(() => {
    if (!open) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      measureGiftAnchors()
    })

    const handleWindowChange = () => {
      measureGiftAnchors()
    }

    window.addEventListener("resize", handleWindowChange)
    window.addEventListener("scroll", handleWindowChange, true)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener("resize", handleWindowChange)
      window.removeEventListener("scroll", handleWindowChange, true)
    }
  }, [measureGiftAnchors, open])

  useEffect(() => {
    return () => {
      clearAnimationTimers()
    }
  }, [clearAnimationTimers])

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <div className="relative">
        <Tooltip content={triggerTooltip}>
          <PopoverTrigger
            title="送礼"
            aria-label="送礼"
            aria-expanded={open}
            aria-haspopup="dialog"
            className={cn(
              "group relative inline-flex h-9 min-w-9 items-center justify-center overflow-visible rounded-full px-1.5 text-left transition-all duration-300 hover:-translate-y-0.5",
              open
                ? "border-foreground/60 bg-foreground text-background shadow-[0_10px_22px_rgba(15,23,42,0.16)]"
                : giftSummary.length > 0
                  ? "border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,237,213,0.94))] text-slate-900 shadow-[0_10px_24px_rgba(245,158,11,0.16)] hover:shadow-[0_14px_30px_rgba(245,158,11,0.22)] dark:border-amber-400/25 dark:bg-[linear-gradient(135deg,rgba(120,53,15,0.3),rgba(67,20,7,0.4))] dark:text-amber-50"
                  : "border-border bg-card text-foreground hover:border-amber-200/80 hover:bg-[linear-gradient(135deg,rgba(255,251,235,0.88),rgba(255,255,255,1))] hover:shadow-[0_10px_22px_rgba(245,158,11,0.1)] dark:hover:border-amber-400/20 dark:hover:bg-[linear-gradient(135deg,rgba(64,24,10,0.28),rgba(15,23,42,0.96))]",
            )}
          >
            <span className="inline-flex items-center overflow-visible rounded-full">
              <span className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/12 text-amber-600 dark:bg-amber-400/15 dark:text-amber-200">
                <Gift className="h-4 w-4" />
                {triggerGiftPreview.slice(0, 3).map((item, index) => (
                  <span
                    key={`${item.id}-${index}`}
                    className="absolute inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white/90 bg-white text-slate-800 shadow-xs dark:border-slate-900/80 dark:bg-slate-950 dark:text-amber-50"
                    style={{
                      right: -4 + index * 4,
                      bottom: -4 + index * 1,
                      zIndex: triggerGiftPreview.length - index,
                      opacity: Math.max(0.58, 1 - index * 0.18),
                      transform: `scale(${1 - index * 0.08})`,
                    }}
                  >
                    <LevelIcon
                      icon={item.icon}
                      className="h-2.5 w-2.5"
                      emojiClassName="text-[9px] leading-none"
                      svgClassName="[&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                      title={item.name}
                    />
                  </span>
                ))}
              </span>
              <span className="overflow-hidden rounded-full">
                <span
                  className={cn(
                    "block whitespace-nowrap text-[10px] font-semibold leading-none transition-all duration-300",
                    open || tipTotalPoints <= 0
                      ? "ml-0 max-w-0 opacity-0"
                      : "ml-0 max-w-0 opacity-0 text-amber-700 dark:text-amber-200 group-hover:ml-1.5 group-hover:max-w-[88px] group-hover:opacity-100 group-focus-visible:ml-1.5 group-focus-visible:max-w-[88px] group-focus-visible:opacity-100",
                  )}
                >
                  + {tipTotalPoints}
                </span>
              </span>
            </span>
            {tipCount > 0 ? (
              <span className="pointer-events-none absolute -right-1 -top-1 z-20 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold leading-none text-white shadow-[0_6px_14px_rgba(244,63,94,0.35)]">
                {tipCount}
              </span>
            ) : null}

            {giftSummary.length > 0 ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{ animation: "tipTriggerGlow 2.2s ease-in-out infinite" }}
              />
            ) : null}
          </PopoverTrigger>
        </Tooltip>
        {open && isClient
          ? createPortal(
              <div className="pointer-events-none fixed inset-0 z-70 overflow-visible">
                {floatingGiftPulses.map((pulse) => {
                  const anchor = giftAnchorPositions[pulse.giftId]
                  if (!anchor) {
                    return null
                  }

                  return (
                    <div
                      key={pulse.id}
                      className="pointer-events-none fixed"
                      style={{
                        left: anchor.left,
                        top: anchor.top,
                        animation: "giftPulseFloat 1.7s ease-out forwards",
                        marginLeft: pulse.lane,
                      }}
                    >
                      <div className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50/95 px-2 py-1 text-[10px] font-medium text-emerald-700 shadow-xs backdrop-blur-xs dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100">
                        <UserAvatar name={pulse.senderName} avatarPath={pulse.senderAvatarPath} size="xs" />
                        <span className="max-w-[72px] truncate">{pulse.senderName}</span>
                      </div>
                    </div>
                  )
                })}
              </div>,
              document.body,
            )
          : null}
        <PopoverContent
          side="bottom"
          align="end"
          sideOffset={8}
          className="w-fit max-w-[calc(100vw-1rem)] gap-0 overflow-x-hidden overflow-y-auto rounded-[22px] border border-border bg-background p-2.5 shadow-2xl ring-0 sm:max-w-[calc(100vw-2rem)]"
          style={{ maxHeight: "min(85vh, calc(100dvh - 1.5rem))" }}
        >
          <div className="flex flex-wrap items-start gap-1.5 sm:flex-nowrap">
            {gifts.map((gift) => {
              const giftStat = giftStatMap.get(gift.id)

              return (
                <div key={gift.id} className="relative shrink-0 overflow-visible">
                  {giftStat?.totalCount ? (
                    <div className="pointer-events-none absolute right-[-6px] top-[-6px] z-10 min-w-[18px] rounded-full bg-amber-500 px-1.5 text-center text-[10px] font-semibold leading-5 text-white shadow-xs">
                      {giftStat.totalCount}
                    </div>
                  ) : null}
                  <Tooltip content={`${gift.name} · ${formatNumber(gift.price)} ${pointName}${giftStat?.totalCount ? ` · 已收 ${giftStat.totalCount} 个` : ""}`}>
                    <button
                      ref={(node) => {
                        giftButtonRefs.current[gift.id] = node
                      }}
                      type="button"
                      className={cn(
                        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-lg transition-colors",
                        effectiveSelectedGift?.id === gift.id ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-accent/60",
                        getTipBlockedMessage(gift.price, "gift") ? "opacity-60" : "",
                      )}
                      onClick={() => {
                        setSelectedGiftId(gift.id)
                        void handleTip({ mode: "gift", gift })
                      }}
                      disabled={isPending}
                      aria-label={`赠送${gift.name}`}
                    >
                      <LevelIcon icon={gift.icon} className="h-4 w-4 text-base" emojiClassName="text-inherit leading-none" svgClassName="[&>svg]:block [&>svg]:h-full [&>svg]:w-full" title={gift.name} />
                    </button>
                  </Tooltip>
                </div>
              )
            })}
            <button
              type="button"
              className="inline-flex h-9 shrink-0 items-center gap-0.5 rounded-xl border border-border bg-card px-2 text-xs font-medium transition-colors hover:bg-accent/60"
              onClick={() => setExpanded((current) => !current)}
            >
              打赏
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          {expanded ? (
            <div className="mt-2.5 space-y-2.5 border-t border-border/70 pt-2.5">
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>积分打赏</span>
                <span>{pointName} {formatNumber(points)} · 累计 {formatNumber(tipTotalPoints)}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {allowedAmounts.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className={cn(
                      "rounded-xl border px-2 py-2 text-xs font-medium transition-colors",
                      effectiveSelectedAmount === amount ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-accent/60",
                    )}
                    onClick={() => setSelectedAmount(amount)}
                  >
                    {amount}
                  </button>
                ))}
              </div>

              <div className="rounded-[16px] bg-secondary/40 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
                <p>{tipHelperText}</p>
                {message ? <p className="text-foreground">{message}</p> : null}
              </div>

              <div className="flex items-center justify-between gap-3">
                <Button type="button" onClick={() => handleTip({ mode: "tip", amount: effectiveSelectedAmount })} disabled={!canTip || isPending} className="h-8 rounded-xl px-3.5 text-xs">
                  {isPending ? "打赏中..." : effectiveSelectedAmount > 0 ? `打赏 ${formatNumber(effectiveSelectedAmount)} ${pointName}` : "选择金额"}
                </Button>
                {!isLoggedIn ? (
                  <Link href="/login" className="text-xs text-primary hover:opacity-80">
                    去登录
                  </Link>
                ) : points <= 0 ? (
                  <Link href="/topup" className="text-xs text-primary hover:opacity-80">
                    去充值 / 兑换
                  </Link>
                ) : (
                  <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={closeTipPanel}>
                    关闭
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-[11px] text-muted-foreground">打赏记录</div>
                {compactSupporters.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                    暂无打赏记录
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {compactSupporters.map((supporter) => (
                      <div key={supporter.userId} className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/70 bg-card px-2.5 py-1.5">
                        <UserAvatar name={supporter.nickname ?? supporter.username} avatarPath={supporter.avatarPath} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-medium leading-4">{supporter.nickname ?? supporter.username}</p>
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-300">
                            <Zap className="h-3 w-3 fill-current" />
                            +{formatNumber(supporter.totalAmount)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </PopoverContent>
        <style jsx>{`
          @keyframes tipTriggerGlow {
            0%,
            100% {
              box-shadow: inset 0 0 0 0 rgba(251, 191, 36, 0), 0 0 0 0 rgba(251, 191, 36, 0);
            }
            50% {
              box-shadow: inset 0 0 0 1px rgba(251, 191, 36, 0.18), 0 0 0 6px rgba(251, 191, 36, 0.08);
            }
          }

          @keyframes giftPulseFloat {
            0% {
              opacity: 0;
              transform: translate(-50%, 8px) scale(0.88);
            }
            18% {
              opacity: 1;
              transform: translate(-50%, -4px) scale(1);
            }
            100% {
              opacity: 0;
              transform: translate(-50%, -50px) scale(1.04);
            }
          }
        `}</style>
      </div>
    </Popover>
  )
}
