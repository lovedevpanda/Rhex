"use client"

import { CircleHelp, Settings2 } from "lucide-react"

import Link from "next/link"
import { useMemo, useState } from "react"

import { PostRewardPoolIcon } from "@/components/post/post-list-shared"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/rbutton"
import { Tooltip } from "@/components/ui/tooltip"
import { UserAvatar } from "@/components/user/user-avatar"
import { formatNumber } from "@/lib/formatters"
import { getPostRedPacketGrantModeLabel } from "@/lib/post-reward-pool-labels"
import type { PostRedPacketSummary } from "@/lib/post-red-packets"

interface PostRedPacketPanelProps {
  postId: string
  pointName: string
  summary: PostRedPacketSummary
}

export function PostRedPacketPanel({ postId, pointName, summary }: PostRedPacketPanelProps) {
  const [open, setOpen] = useState(false)
  const hoverSummary = summary.rewardMode === "JACKPOT"
    ? `余 ${formatNumber(summary.remainingPoints)} ${pointName}`
    : `余 ${summary.remainingCount} 个`
  const latestRecords = useMemo(() => summary.records.slice(-10).reverse(), [summary.records])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        title={summary.rewardMode === "JACKPOT" ? "聚宝盆" : "帖子红包"}
        aria-label={summary.rewardMode === "JACKPOT" ? "聚宝盆" : "帖子红包"}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-post-reward-pool-trigger={postId}
        className="group flex items-center gap-1 rounded-full px-1.5 py-1 transition-colors hover:bg-accent/60 hover:text-foreground"
      >
        <span data-post-reward-pool-trigger-icon={postId} className="inline-flex h-4 w-4 items-center justify-center">
          <PostRewardPoolIcon mode={summary.rewardMode} className="h-4 w-4" />
        </span>
        <span className="inline-flex items-center overflow-hidden">
          <span className="shrink-0 transition-all duration-200 group-hover:translate-x-[-2px] group-hover:opacity-70">
            {summary.claimedCount > 0 ? summary.claimedCount : ""}
          </span>
          <span className="max-w-0 shrink-0 whitespace-nowrap pl-0 text-[11px] text-muted-foreground opacity-0 transition-all duration-300 group-hover:max-w-[120px] group-hover:pl-1.5 group-hover:opacity-100">
            {hoverSummary}
          </span>
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={12}
        className="w-[min(calc(100vw-2rem),380px)] max-h-[min(85vh,calc(100dvh-1.5rem))] gap-0 overflow-y-auto rounded-[28px] border border-border bg-background p-4 shadow-2xl ring-0 sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <PopoverHeader className="gap-1">
            <PopoverTitle className="text-base font-semibold">
              {summary.rewardMode === "JACKPOT" ? "聚宝盆" : "帖子红包"}
            </PopoverTitle>
            <p className="text-sm text-muted-foreground">条件：{summary.triggerLabel ?? "互动后领取"}</p>
          </PopoverHeader>
          <div className="rounded-full bg-rose-50 px-3 py-1 text-xs text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
            {summary.rewardMode === "JACKPOT" ? `已中 ${summary.claimedCount} 次` : `已领 ${summary.claimedCount}/${summary.packetCount}`}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-[20px] bg-secondary/40 px-4 py-3">
            <p className="text-xs text-muted-foreground">{summary.rewardMode === "JACKPOT" ? "初始积分" : "红包总额"}</p>
            <p className="mt-1 font-semibold">{formatNumber(summary.totalPoints)} {pointName}</p>
          </div>
          <div className="rounded-[20px] bg-secondary/40 px-4 py-3">
            <p className="text-xs text-muted-foreground">{summary.rewardMode === "JACKPOT" ? "当前积分池" : "剩余数量"}</p>
            <p className="mt-1 font-semibold">{summary.rewardMode === "JACKPOT" ? `${formatNumber(summary.remainingPoints)} ${pointName}` : `${summary.remainingCount} / ${formatNumber(summary.remainingPoints)} ${pointName}`}</p>
          </div>
          {summary.rewardMode === "JACKPOT" ? (
            <div className="col-span-2 rounded-[20px] bg-secondary/40 px-4 py-3">
              <p className="text-xs text-muted-foreground">递增规则</p>
              <p className="mt-1 font-semibold">首回 +{formatNumber(summary.jackpotReplyIncrementPoints ?? 0)}，复回随机小额追加</p>
            </div>
          ) : (
            <div className="col-span-2 rounded-[20px] bg-secondary/40 px-4 py-3">
              <p className="text-xs text-muted-foreground">金额模式</p>
              <p className="mt-1 font-semibold">{summary.grantMode ? getPostRedPacketGrantModeLabel(summary.grantMode) : "固定红包"}</p>
            </div>
          )}
        </div>

        <div className="mt-5 space-y-3">
          {summary.records.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              暂无领取记录
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {latestRecords.map((record) => (
                <Tooltip key={record.id} content={`${record.nickname ?? record.username} · ${record.createdAt}`}>
                  <div className="relative">
                    <UserAvatar name={record.nickname ?? record.username} avatarPath={record.avatarPath} size="sm" />
                    <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold leading-4 text-white shadow-xs">
                      +{formatNumber(record.amount)}
                    </span>
                  </div>
                </Tooltip>
              ))}
              {summary.records.length > 10 ? (
                <Tooltip content="默认只显示最新 10 个领取记录">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-border bg-secondary/30 text-muted-foreground">
                    <CircleHelp className="h-3.5 w-3.5" />
                  </div>
                </Tooltip>
              ) : null}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {summary.currentUserPoints <= 0 ? (
              <Link href="/topup" className="text-sm text-primary hover:opacity-80">去充值 / 兑换</Link>
            ) : <span className="text-xs text-muted-foreground">{summary.rewardMode === "JACKPOT" ? `${pointName}会随着回复数量动态增加，首次回复有概率获得${pointName}池中的部分${pointName}奖励。` : "系统会在互动成功后自动判断并发放红包。"}</span>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/settings?tab=profile&profileTab=browsing"
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-background px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Settings2 className="h-3 w-3" />
              动画设置
            </Link>
            <Button type="button" variant="ghost" className="h-7 rounded-lg px-2.5 text-[11px]" onClick={() => setOpen(false)}>
              关闭
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
