import { Coins, Sparkles } from "lucide-react"

import { PostRewardPoolIcon } from "@/components/post-list-shared"
import type { PostRedPacketSummary } from "@/lib/post-red-packets"
import { cn } from "@/lib/utils"

interface PostRewardPoolHighlightBarProps {
  summary?: PostRedPacketSummary
  className?: string
  attachedTop?: boolean
  attachedBottom?: boolean
}

function shouldShowRewardPoolHighlight(summary?: PostRedPacketSummary) {
  if (!summary?.enabled || summary.status !== "ACTIVE") {
    return false
  }

  if (summary.rewardMode === "JACKPOT") {
    return summary.remainingPoints > 0
  }

  return summary.remainingCount > 0 && summary.remainingPoints > 0
}

export function PostRewardPoolHighlightBar({
  summary,
  className,
  attachedTop = false,
  attachedBottom = false,
}: PostRewardPoolHighlightBarProps) {
  if (!shouldShowRewardPoolHighlight(summary)) {
    return null
  }

  const activeSummary = summary
  if (!activeSummary) {
    return null
  }

  const isJackpot = activeSummary.rewardMode === "JACKPOT"
  const wrapperClassName = isJackpot
    ? "border-amber-200/80 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 text-amber-950 dark:border-amber-950/80 dark:bg-[linear-gradient(135deg,rgba(24,20,16,0.985),rgba(39,31,20,0.96),rgba(21,18,16,0.985))] dark:text-amber-100"
    : "border-rose-200/80 bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 text-rose-950 dark:border-rose-950/80 dark:bg-[linear-gradient(135deg,rgba(25,19,19,0.985),rgba(43,24,24,0.96),rgba(23,18,17,0.985))] dark:text-rose-100"
  const iconWrapClassName = isJackpot
    ? "bg-amber-500/12 text-amber-700 shadow-amber-200/70 dark:bg-amber-500/10 dark:text-amber-200 dark:shadow-black/30"
    : "bg-rose-500/12 text-rose-700 shadow-rose-200/70 dark:bg-rose-500/10 dark:text-rose-200 dark:shadow-black/30"
  const badgeClassName = isJackpot
    ? "border-amber-300/70 bg-white/70 text-amber-800 dark:border-amber-500/18 dark:bg-white/[0.04] dark:text-amber-100"
    : "border-rose-300/70 bg-white/70 text-rose-800 dark:border-rose-500/18 dark:bg-white/[0.04] dark:text-rose-100"
  const accentGlowClassName = isJackpot ? "bg-amber-300/40 dark:bg-amber-500/8" : "bg-rose-300/40 dark:bg-rose-500/8"
  const sweepClassName = isJackpot
    ? "pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.1)_35%,rgba(255,255,255,0.3)_50%,transparent_65%)] opacity-70 motion-safe:animate-[pulse_3.6s_ease-in-out_infinite] dark:bg-[linear-gradient(110deg,transparent_0%,rgba(251,191,36,0.01)_34%,rgba(251,191,36,0.07)_50%,transparent_66%)] dark:opacity-100"
    : "pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.1)_35%,rgba(255,255,255,0.3)_50%,transparent_65%)] opacity-70 motion-safe:animate-[pulse_3.6s_ease-in-out_infinite] dark:bg-[linear-gradient(110deg,transparent_0%,rgba(251,113,133,0.01)_34%,rgba(251,113,133,0.07)_50%,transparent_66%)] dark:opacity-100"
  const label = isJackpot ? "聚宝盆进行中" : "红包进行中"
  const title = isJackpot
    ? `当前池中还剩 ${activeSummary.remainingPoints} ${activeSummary.pointName}`
    : `当前还剩 ${activeSummary.remainingCount} 个红包，共 ${activeSummary.remainingPoints} ${activeSummary.pointName}`
  const secondary = isJackpot
    ? `已中 ${activeSummary.claimedCount} 次`
    : `已领 ${activeSummary.claimedCount}/${activeSummary.packetCount}`

  return (
    <div
      className={cn(
        "relative overflow-hidden border px-4 py-3   sm:px-5 sm:py-3.5",
        attachedTop ? "rounded-t-none border-t-0" : "rounded-t-[24px]",
        attachedBottom ? "rounded-b-none" : "rounded-b-[24px]",
        wrapperClassName,
        className,
      )}
    >
      <div aria-hidden="true" className={cn("pointer-events-none absolute -left-8 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full blur-3xl motion-safe:animate-pulse", accentGlowClassName)} />
      <div aria-hidden="true" className={sweepClassName} />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-white/60 dark:ring-white/5", iconWrapClassName)}>
            <PostRewardPoolIcon mode={activeSummary.rewardMode} className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em]", badgeClassName)}>
                <Sparkles className="h-3 w-3" />
                {label}
              </span>
              <span className="text-[11px] font-medium opacity-80 dark:text-white/72">{secondary}</span>
            </div>
            <p className="mt-1 text-sm font-semibold leading-6 dark:text-white/92 sm:text-[15px]">{title}</p>
          </div>
        </div>
        <div className={cn("inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm", badgeClassName)}>
          <Coins className="h-3.5 w-3.5" />
          {isJackpot ? `${activeSummary.remainingPoints} ${activeSummary.pointName}` : `${activeSummary.remainingCount} 个`}
        </div>
      </div>
    </div>
  )
}
