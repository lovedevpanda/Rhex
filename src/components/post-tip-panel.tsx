"use client"

import { Gift, Zap } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState, useTransition } from "react"

import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"


interface PostTipPanelProps {
  postId: string
  enabled: boolean
  pointName: string
  currentUserPoints: number
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
  pointName: string
  currentUserPoints: number
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

export function PostTipPanel({ postId, enabled, pointName, currentUserPoints, allowedAmounts, dailyLimit, perPostLimit, usedDailyCount, usedPostCount, totalCount, totalPoints, topSupporters }: PostTipPanelProps) {
  const [open, setOpen] = useState(false)
  const [selectedAmount, setSelectedAmount] = useState<number>(allowedAmounts[0] ?? 0)
  const [points, setPoints] = useState(currentUserPoints)
  const [tipCount, setTipCount] = useState(totalCount)
  const [tipTotalPoints, setTipTotalPoints] = useState(totalPoints)
  const [todayUsed, setTodayUsed] = useState(usedDailyCount)
  const [postUsed, setPostUsed] = useState(usedPostCount)
  const [supporters, setSupporters] = useState(topSupporters)
  const [message, setMessage] = useState("")
  const [isPending, startTransition] = useTransition()



  useEffect(() => {
    setSelectedAmount((current) => (allowedAmounts.includes(current) ? current : (allowedAmounts[0] ?? 0)))
  }, [allowedAmounts])

  const canTip = enabled && selectedAmount > 0 && todayUsed < dailyLimit && postUsed < perPostLimit && points >= selectedAmount
  const helperText = useMemo(() => {
    if (!enabled) {
      return "当前未开启帖子打赏"
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
  }, [dailyLimit, enabled, perPostLimit, pointName, points, postUsed, todayUsed])

  function syncSummary(data: TipSummaryPayload) {
    setPoints(data.currentUserPoints)
    setTodayUsed(data.usedDailyCount)
    setPostUsed(data.usedPostCount)
    setTipCount(data.tipCount)
    setTipTotalPoints(data.tipTotalPoints)
    setSupporters(data.topSupporters)
  }

  function handleTip() {
    if (!canTip || isPending) {
      return
    }

    setMessage("")

    startTransition(async () => {
      try {
        const response = await fetch("/api/posts/tip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId, amount: selectedAmount }),
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

        const successMessage = result.message ?? `已成功打赏 ${selectedAmount} ${pointName}`
        setMessage(successMessage)
        toast.success(successMessage, "打赏成功")
      } catch {
        const errorMessage = "打赏失败，请稍后重试"
        setMessage(errorMessage)
        toast.error(errorMessage, "打赏失败")
      }
    })
  }


  return (
    <div className="relative">
      <button
        type="button"
        title="打赏"
        aria-label="打赏"
        className="flex items-center gap-1 hover:text-foreground"
        onClick={() => setOpen((current) => !current)}
      >

        <Gift className="h-4 w-4" />
         {tipCount > 0 ? tipCount : ""}
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="关闭打赏弹层遮罩"
            className="fixed inset-0 z-30 bg-black/40 sm:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-3 bottom-3 top-auto z-40 max-h-[85vh] overflow-y-auto rounded-[28px] border border-border bg-background p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-[calc(100%+12px)] sm:right-0 sm:w-[360px] sm:max-h-[70vh] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold">打赏</h4>
                <p className="mt-1 text-sm text-muted-foreground">{pointName} {points}</p>
              </div>
              <div className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">已有 {tipCount} 次 {pointName} 打赏</div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              {allowedAmounts.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className={cn(
                    "rounded-2xl border px-3 py-3 text-sm font-medium transition-colors",
                    selectedAmount === amount ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-accent/60",
                  )}
                  onClick={() => setSelectedAmount(amount)}
                >
                  {amount}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-[20px] bg-secondary/40 px-4 py-3 text-xs leading-6 text-muted-foreground">
              <p>{helperText}</p>
              <p>本帖累计获得 {tipTotalPoints} {pointName}</p>
              {message ? <p className="text-foreground">{message}</p> : null}
            </div>


            <div className="mt-4 flex items-center justify-between gap-3">
              <Button type="button" onClick={handleTip} disabled={!canTip || isPending} className="h-10 rounded-xl px-5">
                {isPending ? "打赏中..." : selectedAmount > 0 ? `打赏 ${selectedAmount} ${pointName}` : "选择金额"}
              </Button>
              {points <= 0 ? (
                <Link href="/points" className="text-sm text-primary hover:opacity-80">
                  去充值 / 兑换
                </Link>
              ) : (
                <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>
                  关闭
                </button>
              )}
            </div>

            <div className="mt-5 space-y-3">
              {supporters.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  暂无打赏记录
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {supporters.map((supporter) => (
                    <div key={supporter.userId} className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-2">
                      <UserAvatar name={supporter.nickname ?? supporter.username} avatarPath={supporter.avatarPath} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium leading-5">{supporter.nickname ?? supporter.username}</p>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                          <Zap className="h-3.5 w-3.5 fill-current" />
                          +{supporter.totalAmount}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

    </div>
  )
}

