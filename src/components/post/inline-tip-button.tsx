"use client"

import { Gift } from "lucide-react"
import { useMemo, useState, useTransition } from "react"

import { LevelIcon } from "@/components/level-icon"
import { Button } from "@/components/ui/rbutton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "@/components/ui/toast"
import { Tooltip } from "@/components/ui/tooltip"
import { formatNumber } from "@/lib/formatters"
import type { SiteTippingGiftItem } from "@/lib/site-settings"
import { cn } from "@/lib/utils"

interface GiftStatItem {
  giftId: string
  giftName: string
  giftIcon: string
  unitPrice: number
  totalCount: number
  totalPoints: number
  lastSentAt: string
}

interface TipSummaryPayload {
  enabled: boolean
  isLoggedIn: boolean
  pointName: string
  currentUserPoints: number
  allowedAmounts: number[]
  gifts: SiteTippingGiftItem[]
  giftStats: GiftStatItem[]
  dailyLimit: number
  perPostLimit: number
  usedDailyCount: number
  usedPostCount: number
  tipCount: number
  tipTotalPoints: number
}

export interface InlineTipButtonProps {
  endpoint: string
  payload: Record<string, string | number | undefined>
  label?: string
  targetLabel?: string
  enabled: boolean
  isLoggedIn: boolean
  pointName: string
  currentUserPoints: number
  allowedAmounts: number[]
  gifts?: SiteTippingGiftItem[]
  giftStats?: GiftStatItem[]
  dailyLimit: number
  perTargetLimit: number
  usedDailyCount?: number
  usedTargetCount?: number
  totalCount?: number
  totalPoints?: number
  className?: string
}

export function InlineTipButton({
  endpoint,
  payload,
  label = "打赏",
  targetLabel = "内容",
  enabled,
  isLoggedIn,
  pointName,
  currentUserPoints,
  allowedAmounts,
  gifts = [],
  giftStats = [],
  dailyLimit,
  perTargetLimit,
  usedDailyCount = 0,
  usedTargetCount = 0,
  totalCount = 0,
  totalPoints = 0,
  className,
}: InlineTipButtonProps) {
  const normalizedAmounts = useMemo(() => allowedAmounts.filter((amount) => Number.isInteger(amount) && amount > 0), [allowedAmounts])
  const normalizedGifts = useMemo(() => gifts.filter((gift) => gift.id && gift.price > 0), [gifts])
  const [open, setOpen] = useState(false)
  const [selectedAmount, setSelectedAmount] = useState(normalizedAmounts[0] ?? 0)
  const [points, setPoints] = useState(currentUserPoints)
  const [todayUsed, setTodayUsed] = useState(usedDailyCount)
  const [targetUsed, setTargetUsed] = useState(usedTargetCount)
  const [tipCount, setTipCount] = useState(totalCount)
  const [tipTotalPoints, setTipTotalPoints] = useState(totalPoints)
  const [currentGiftStats, setCurrentGiftStats] = useState(giftStats)
  const [message, setMessage] = useState("")
  const [isPending, startTransition] = useTransition()
  const effectiveAmount = normalizedAmounts.includes(selectedAmount) ? selectedAmount : normalizedAmounts[0] ?? 0
  const giftStatMap = useMemo(() => new Map(currentGiftStats.map((item) => [item.giftId, item])), [currentGiftStats])

  function getBlockedMessage(amount: number) {
    if (!enabled) {
      return "当前未开启积分打赏"
    }
    if (!isLoggedIn) {
      return "请登录后参与打赏"
    }
    if (todayUsed >= dailyLimit) {
      return `今日打赏次数已用完（${dailyLimit}/${dailyLimit}）`
    }
    if (targetUsed >= perTargetLimit) {
      return `该${targetLabel}打赏次数已达上限（${perTargetLimit}/${perTargetLimit}）`
    }
    if (amount <= 0) {
      return "请选择有效的打赏金额"
    }
    if (points < amount) {
      return `${pointName}不足，无法完成打赏`
    }

    return null
  }

  function syncSummary(data: TipSummaryPayload) {
    setPoints(data.currentUserPoints)
    setTodayUsed(data.usedDailyCount)
    setTargetUsed(data.usedPostCount)
    setTipCount(data.tipCount)
    setTipTotalPoints(data.tipTotalPoints)
    setCurrentGiftStats(data.giftStats)
  }

  function handleTip(options?: { amount?: number; gift?: SiteTippingGiftItem | null }) {
    const targetGift = options?.gift ?? null
    const targetAmount = targetGift?.price ?? options?.amount ?? effectiveAmount
    const blockedMessage = getBlockedMessage(targetAmount)

    if (isPending) {
      return
    }

    if (blockedMessage) {
      setMessage(blockedMessage)
      toast.error(blockedMessage, "打赏失败")
      return
    }

    setMessage("")

    startTransition(async () => {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, amount: targetAmount, giftId: targetGift?.id }),
        })
        const result = await response.json()

        if (!response.ok) {
          const errorMessage = result.message ?? "打赏失败，请稍后重试"
          setMessage(errorMessage)
          toast.error(errorMessage, "打赏失败")
          return
        }

        if (result.data) {
          syncSummary(result.data)
        }

        const successMessage = result.message ?? (targetGift ? `已送出 ${targetGift.name}` : `已成功打赏 ${formatNumber(targetAmount)} ${pointName}`)
        setMessage(successMessage)
        toast.success(successMessage, "打赏成功")
      } catch {
        const errorMessage = "打赏失败，请稍后重试"
        setMessage(errorMessage)
        toast.error(errorMessage, "打赏失败")
      }
    })
  }

  if (!enabled || (normalizedAmounts.length === 0 && normalizedGifts.length === 0)) {
    return null
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content={tipTotalPoints > 0 ? `已收到 ${formatNumber(tipTotalPoints)} ${pointName}` : label}>
        <PopoverTrigger
          type="button"
          className={cn("inline-flex items-center gap-1 rounded-full text-muted-foreground transition-colors hover:text-foreground", className)}
        >
          <Gift className="h-3.5 w-3.5" />
          <span>{label}</span>
          {tipCount > 0 ? <span className="rounded-full bg-amber-500/10 px-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-200">{formatNumber(tipCount)}</span> : null}
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="end" sideOffset={8} className="w-64 rounded-xl border border-border bg-background p-3 shadow-2xl">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{targetLabel}打赏</span>
            <span>{pointName} {formatNumber(points)}</span>
          </div>
          {normalizedGifts.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-muted-foreground">送礼物</span>
              <div className="grid grid-cols-4 gap-1.5">
                {normalizedGifts.map((gift) => {
                  const stat = giftStatMap.get(gift.id)
                  return (
                    <button
                      key={gift.id}
                      type="button"
                      className="relative flex h-10 items-center justify-center rounded-xl border border-border bg-card text-base transition-colors hover:bg-accent/60 disabled:opacity-60"
                      onClick={() => handleTip({ gift })}
                      disabled={isPending}
                      title={`${gift.name} · ${formatNumber(gift.price)} ${pointName}`}
                    >
                      <LevelIcon icon={gift.icon} className="h-4 w-4 text-base" emojiClassName="text-inherit leading-none" svgClassName="[&>svg]:block [&>svg]:h-full [&>svg]:w-full" title={gift.name} />
                      {stat?.totalCount ? <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-amber-500 px-1 text-[10px] font-semibold leading-4 text-white">{formatNumber(stat.totalCount)}</span> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
          {normalizedAmounts.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-muted-foreground">积分打赏</span>
              <div className="grid grid-cols-4 gap-1.5">
                {normalizedAmounts.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className={cn(
                      "rounded-xl border px-2 py-2 text-xs font-medium transition-colors",
                      effectiveAmount === amount ? "border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100" : "border-border bg-card hover:bg-accent/60",
                    )}
                    onClick={() => setSelectedAmount(amount)}
                  >
                    {amount}
                  </button>
                ))}
              </div>
              <Button type="button" size="sm" onClick={() => handleTip()} disabled={isPending} className="w-full">
                {isPending ? "提交中..." : `打赏 ${effectiveAmount} ${pointName}`}
              </Button>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>今日 {todayUsed}/{dailyLimit}</span>
            <span>本{targetLabel} {targetUsed}/{perTargetLimit}</span>
          </div>
          {tipTotalPoints > 0 ? <p className="text-[11px] text-muted-foreground">累计收到 {formatNumber(tipTotalPoints)} {pointName}</p> : null}
          {message ? <p className="text-[11px] text-muted-foreground">{message}</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
