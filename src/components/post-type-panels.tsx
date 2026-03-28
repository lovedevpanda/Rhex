"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, Clock3, Gift, Sparkles, Trophy } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { formatDateTime, formatRelativeTime } from "@/lib/formatters"
import { cn } from "@/lib/utils"

interface BountyPanelProps {
  postId: string
  points: number
  pointName?: string
  isResolved: boolean
  acceptedAnswerAuthor?: string | null
}


interface PollPanelProps {
  postId: string
  totalVotes: number
  hasVoted: boolean
  expiresAt?: string | null
  options: Array<{
    id: string
    content: string
    voteCount: number
    percentage: number
    isVoted: boolean
  }>
}

interface LotteryPanelProps {
  postId: string
  isOwnerOrAdmin: boolean
  lottery: {
    status: string
    triggerMode: string
    startsAt: string | null
    endsAt: string | null
    participantGoal: number | null
    participantCount: number
    lockedAt: string | null
    drawnAt: string | null
    announcement: string | null
    joined: boolean
    eligible: boolean
    ineligibleReason: string | null
    currentProbability: number | null
    prizes: Array<{
      id: string
      title: string
      description: string
      quantity: number
      winnerCount: number
      winners: Array<{
        userId: number
        username: string
        nickname: string | null
        drawnAt: string
      }>
    }>
    conditionGroups: Array<{
      key: string
      label: string
      conditions: Array<{
        id: string
        description: string | null
        matched: boolean | null
      }>
    }>
  }
}


export function BountyPanel({ points, pointName = "积分", isResolved, acceptedAnswerAuthor }: BountyPanelProps) {
  return (
    <div className="rounded-[24px] border border-amber-200 bg-amber-50/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-900">悬赏帖</p>
          <p className="mt-1 text-sm text-amber-800">当前悬赏 {points} {pointName}，发帖人可在回复中选择一个答案进行采纳。</p>
        </div>

        <span className={isResolved ? "rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700" : "rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700"}>
          {isResolved ? "已结贴" : "进行中"}
        </span>
      </div>
      {acceptedAnswerAuthor ? <p className="mt-3 text-sm text-muted-foreground">当前已采纳：{acceptedAnswerAuthor}</p> : null}
    </div>
  )
}

export function LotteryPanel({ postId, isOwnerOrAdmin, lottery }: LotteryPanelProps) {
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)

  const now = Date.now()
  const startsAtTime = lottery.startsAt ? new Date(lottery.startsAt).getTime() : null
  const endsAtTime = lottery.endsAt ? new Date(lottery.endsAt).getTime() : null
  const hasNotStarted = startsAtTime !== null && startsAtTime > now
  const hasReachedEndTime = endsAtTime !== null && endsAtTime <= now
  const isDrawn = Boolean(lottery.drawnAt)
  const isAutoParticipantDraw = lottery.triggerMode === "AUTO_PARTICIPANT_COUNT"
  const isLocked = (Boolean(lottery.lockedAt) || hasReachedEndTime) && !isDrawn
  const isEndedWithoutDraw = hasReachedEndTime && !isDrawn
  const totalPrizeQuantity = lottery.prizes.reduce((sum, prize) => sum + prize.quantity, 0)
  const goalProgress = lottery.participantGoal && lottery.participantGoal > 0
    ? Math.min(100, Math.round((lottery.participantCount / lottery.participantGoal) * 100))
    : null
  const winnerCount = lottery.prizes.reduce((sum, prize) => sum + prize.winnerCount, 0)
  const nextActionText = isDrawn
    ? "中奖名单已经公布，快看结果。"
    : hasNotStarted
      ? `抽奖将在 ${formatRelativeTime(lottery.startsAt ?? "")} 正式开始。`
      : isEndedWithoutDraw
        ? "报名时间已经截止，当前不再接受新的参与者。"
        : lottery.joined
          ? "你已在抽奖池中，继续关注开奖结果。"
          : lottery.ineligibleReason
            ? "你当前还未进入抽奖池，完成条件后会自动加入。"
            : "满足条件后会自动加入抽奖池。"

  const statusConfig = isDrawn
    ? {
        label: "开奖完成",
        title: "抽奖已经结束，结果已正式公布",
        description: lottery.drawnAt ? `开奖时间：${formatDateTime(lottery.drawnAt)}` : "开奖结果已生成，可查看中奖名单。",
        chip: "结果已发布",
        icon: Trophy,
        containerClassName: "border-emerald-300/80  from-emerald-50 via-white to-lime-50 shadow-[0_18px_45px_rgba(16,185,129,0.14)] dark:border-emerald-400/25 dark:from-emerald-950/45 dark:via-slate-950 dark:to-lime-950/30 dark:shadow-[0_24px_60px_rgba(0,0,0,0.45)]",
        badgeClassName: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950",
        iconWrapClassName: "bg-emerald-600 text-white shadow-emerald-200/70 dark:bg-emerald-400 dark:text-emerald-950 dark:shadow-[0_14px_30px_rgba(16,185,129,0.28)]",
        titleClassName: "text-emerald-950 dark:text-emerald-50",
        descClassName: "text-emerald-800/90 dark:text-emerald-100/90",
        emphasisClassName: "text-emerald-700 dark:text-emerald-300",
      }
    : hasNotStarted
      ? {
          label: "即将开始",
          title: "抽奖尚未开始，请锁定开场时间",
          description: lottery.startsAt ? `预计开始时间：${formatDateTime(lottery.startsAt)}` : "等待抽奖开始时间确认。",
          chip: "倒计时阶段",
          icon: Clock3,
        containerClassName: "border-amber-300/80  from-amber-50 via-white to-orange-50 shadow-[0_18px_45px_rgba(245,158,11,0.16)] dark:border-amber-400/25 dark:from-amber-950/45 dark:via-slate-950 dark:to-orange-950/30 dark:shadow-[0_24px_60px_rgba(0,0,0,0.45)]",
        badgeClassName: "bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-950",
        iconWrapClassName: "bg-amber-500 text-white shadow-amber-200/70 dark:bg-amber-400 dark:text-amber-950 dark:shadow-[0_14px_30px_rgba(245,158,11,0.26)]",

          titleClassName: "text-amber-950 dark:text-amber-50",
          descClassName: "text-amber-800/90 dark:text-amber-100/90",
          emphasisClassName: "text-amber-700 dark:text-amber-300",
        }
      : isEndedWithoutDraw
        ? {
            label: "报名截止",
            title: "抽奖报名已结束，等待楼主完成开奖",
            description: lottery.endsAt ? `截止时间：${formatDateTime(lottery.endsAt)}` : "抽奖报名阶段已经结束。",
            chip: "不可继续参与",
            icon: Clock3,
            containerClassName: "border-rose-300/80  from-rose-50 via-white to-orange-50 shadow-[0_18px_45px_rgba(244,63,94,0.15)] dark:border-rose-400/25 dark:from-rose-950/45 dark:via-slate-950 dark:to-orange-950/30 dark:shadow-[0_24px_60px_rgba(0,0,0,0.45)]",
            badgeClassName: "bg-rose-600 text-white dark:bg-rose-400 dark:text-rose-950",
            iconWrapClassName: "bg-rose-600 text-white shadow-rose-200/70 dark:bg-rose-400 dark:text-rose-950 dark:shadow-[0_14px_30px_rgba(244,63,94,0.26)]",
            titleClassName: "text-rose-950 dark:text-rose-50",
            descClassName: "text-rose-800/90 dark:text-rose-100/90",
            emphasisClassName: "text-rose-700 dark:text-rose-300",
          }
        : {
            label: isLocked ? "名单锁定中" : "火热进行中",
            title: isLocked ? "抽奖名单已锁定，正在等待开奖" : "抽奖正在进行，快确认自己是否已入池",
            description: isLocked
              ? `锁池时间：${formatDateTime(lottery.lockedAt ?? "")}`
              : lottery.triggerMode === "AUTO_PARTICIPANT_COUNT"
                ? `参与人数达到 ${lottery.participantGoal ?? 0} 人后会自动开奖。`
                : lottery.endsAt
                  ? `预计结束时间：${formatDateTime(lottery.endsAt)}`
                  : "当前由楼主手动控制开奖时间。",
            chip: isLocked ? "即将开奖" : "可继续参与",
            icon: Sparkles,
            containerClassName: "border-violet-300/80  from-violet-50 via-white to-fuchsia-50 shadow-[0_18px_45px_rgba(139,92,246,0.16)] dark:border-violet-400/25 dark:from-violet-950/45 dark:via-slate-950 dark:to-fuchsia-950/30 dark:shadow-[0_24px_60px_rgba(0,0,0,0.45)]",
            badgeClassName: "bg-violet-600 text-white dark:bg-violet-400 dark:text-violet-950",
            iconWrapClassName: "bg-violet-600 text-white shadow-violet-200/70 dark:bg-violet-400 dark:text-violet-950 dark:shadow-[0_14px_30px_rgba(139,92,246,0.28)]",
            titleClassName: "text-violet-950 dark:text-violet-50",
            descClassName: "text-violet-800/90 dark:text-violet-100/90",
            emphasisClassName: "text-violet-700 dark:text-violet-300",
          }

  const StatusIcon = statusConfig.icon

  async function drawNow() {
    setLoading(true)
    setMessage("")

    const response = await fetch("/api/posts/draw", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ postId }),
    })

    const result = await response.json()
    setLoading(false)
    setMessage(result.message ?? (response.ok ? "开奖成功" : "开奖失败"))

    if (response.ok) {
      router.refresh()
    }
  }

  return (
    <div className={cn("overflow-hidden rounded-[28px] border p-5 sm:p-6", statusConfig.containerClassName)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg", statusConfig.iconWrapClassName)}>
            <StatusIcon className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.12em]", statusConfig.badgeClassName)}>
                {statusConfig.label}
              </span>
              <span className="rounded-full bg-background/80 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur dark:border dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
                抽奖帖
              </span>
            </div>
            <div>
              <p className={cn("text-lg font-semibold leading-7 sm:text-xl", statusConfig.titleClassName)}>{statusConfig.title}</p>
              <p className={cn("mt-1 text-sm leading-6", statusConfig.descClassName)}>{statusConfig.description}</p>
            </div>
            <p className={cn("text-sm font-medium", statusConfig.emphasisClassName)}>{nextActionText}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="rounded-full border border-border/60 bg-background/85 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
            {statusConfig.chip}
          </span>
          {isOwnerOrAdmin && !isDrawn && !isAutoParticipantDraw ? (
            <Button type="button" variant={isLocked ? "default" : "outline"} onClick={drawNow} disabled={loading}>
              {loading ? "开奖中..." : isLocked ? "立即公布结果" : "立即开奖"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-[22px] border border-white/70 bg-background/85 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-[0_12px_32px_rgba(0,0,0,0.28)]">
          <p className="text-xs text-muted-foreground">参与人数</p>
          <p className="mt-2 text-2xl font-semibold">{lottery.participantCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">{lottery.joined ? "你已成功入池" : lottery.ineligibleReason ? "你当前尚未入池" : "互动后将自动校验资格"}</p>
        </div>
        <div className="rounded-[22px] border border-white/70 bg-background/85 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-[0_12px_32px_rgba(0,0,0,0.28)]">
          <p className="text-xs text-muted-foreground">奖品名额</p>
          <p className="mt-2 text-2xl font-semibold">{totalPrizeQuantity}</p>
          <p className="mt-1 text-xs text-muted-foreground">共 {lottery.prizes.length} 个奖项，已开出 {winnerCount} 名</p>
        </div>
        <div className="rounded-[22px] border border-white/70 bg-background/85 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-[0_12px_32px_rgba(0,0,0,0.28)]">
          <p className="text-xs text-muted-foreground">理论中奖率</p>
          <p className="mt-2 text-2xl font-semibold">{lottery.currentProbability !== null ? `${lottery.currentProbability}%` : "--"}</p>
          <p className="mt-1 text-xs text-muted-foreground">基于当前有效参与人数动态计算</p>
        </div>
        <div className="rounded-[22px] border border-white/70 bg-background/85 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-[0_12px_32px_rgba(0,0,0,0.28)]">
          <p className="text-xs text-muted-foreground">开奖方式</p>
          <p className="mt-2 text-base font-semibold">{lottery.triggerMode === "AUTO_PARTICIPANT_COUNT" ? "人数达标自动开奖" : "楼主手动开奖"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {lottery.triggerMode === "AUTO_PARTICIPANT_COUNT"
              ? `目标人数 ${lottery.participantGoal ?? 0} 人`
              : lottery.endsAt
                ? `结束于 ${formatRelativeTime(lottery.endsAt)}`
                : "未设置固定结束时间"}
          </p>
        </div>
      </div>

      {goalProgress !== null ? (
        <div className="mt-4 rounded-[22px] border border-white/70 bg-background/80 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-medium text-foreground">自动开奖进度</p>
              <p className="mt-1 text-xs text-muted-foreground">还差 {Math.max((lottery.participantGoal ?? 0) - lottery.participantCount, 0)} 人达到开奖门槛</p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">{goalProgress}%</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950/40">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all" style={{ width: `${Math.max(goalProgress, lottery.participantCount > 0 ? 6 : 0)}%` }} />
          </div>
        </div>
      ) : null}

      {lottery.ineligibleReason ? (
        <div className="mt-4 rounded-[22px] border border-amber-300/70 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <div className="flex items-start gap-2">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">当前还未满足入池条件</p>
              <p className="mt-1 text-amber-800/90 dark:text-amber-100/90">{lottery.ineligibleReason}</p>
            </div>
          </div>
        </div>
      ) : lottery.joined ? (
        <div className="mt-4 rounded-[22px] border border-emerald-300/70 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">你已进入抽奖池</p>
              <p className="mt-1 text-emerald-800/90 dark:text-emerald-100/90">保持当前资格即可参与开奖，无需额外操作。</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {lottery.prizes.map((prize) => (
          <div key={prize.id} className={cn("rounded-[22px] border bg-background/85 p-4 shadow-sm backdrop-blur", isDrawn ? "border-emerald-200 dark:border-emerald-500/20" : "border-white/70")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{prize.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">共 {prize.quantity} 名 · 已开奖 {prize.winnerCount} 名</p>
              </div>
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", isDrawn ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300")}>
                <Gift className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{prize.description}</p>
            {prize.winners.length > 0 ? (
              <div className="mt-3 rounded-[18px] border border-emerald-200/80 bg-emerald-50/80 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">中奖用户</p>
                <p className="mt-2 text-xs leading-6 text-emerald-700 dark:text-emerald-300">
                  {prize.winners.map((winner, index) => (
                    <span key={`${winner.userId}-${winner.username}`}>
                      {index > 0 ? "、" : ""}
                      <Link href={`/users/${winner.username}`} className="font-medium underline-offset-2 hover:underline">
                        {winner.nickname ?? winner.username}
                      </Link>
                    </span>
                  ))}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">{isDrawn ? "该奖项暂无中奖者。" : "开奖后将在这里展示中奖名单。"}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {lottery.conditionGroups.map((group) => (
          <div key={group.key} className="rounded-[22px] border border-white/70 bg-background/85 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-[0_12px_32px_rgba(0,0,0,0.28)]">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <p className="text-sm font-medium">{group.label}</p>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {group.conditions.map((condition) => (
                <li key={condition.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background/80 px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
                  <span className="min-w-0 flex-1 leading-6">{condition.description ?? "未命名条件"}</span>
                  {condition.matched === true ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">已满足</span>
                  ) : condition.matched === false ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">未满足</span>
                  ) : (
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">待校验</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {lottery.announcement ? (
        <div className="mt-5 rounded-[24px] border border-emerald-300/70 bg-background/90 p-4 shadow-sm backdrop-blur dark:border-emerald-500/20">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <Trophy className="h-4 w-4" />
            <p className="text-sm font-semibold">开奖公告</p>
          </div>
          <pre className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground">{lottery.announcement}</pre>
        </div>
      ) : null}
      {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
    </div>
  )
}

export function PollPanel({ postId, totalVotes, hasVoted, expiresAt, options }: PollPanelProps) {

  const router = useRouter()
  const [message, setMessage] = useState("")
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const leadingOption = useMemo(() => {
    if (options.length === 0) {
      return null
    }

    return [...options].sort((left, right) => right.voteCount - left.voteCount)[0]
  }, [options])

  async function submitVote(optionId: string) {
    setLoadingId(optionId)
    setMessage("")

    const response = await fetch("/api/posts/vote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ postId, optionId }),
    })

    const result = await response.json()
    setLoadingId(null)
    setMessage(result.message ?? (response.ok ? "投票成功" : "投票失败"))

    if (response.ok) {
      router.refresh()
    }
  }

  return (
    <div className="rounded-[24px] border border-sky-200 bg-sky-50/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-sky-900">投票帖</p>
          <p className="mt-1 text-sm text-sky-800">共 {totalVotes} 人参与投票，每个账号只能选择一次。</p>
          <p className="mt-1 text-xs text-sky-700">{expiresAt ? `截止时间：${formatDateTime(expiresAt)}` : "未设置截止时间，投票将长期开放。"}</p>
        </div>

        <span className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground">{hasVoted ? "已投票" : "未投票"}</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-[20px] border border-white/70 bg-background/80 p-4">
          <p className="text-xs text-muted-foreground">领先选项</p>
          <p className="mt-2 text-sm font-semibold">{leadingOption ? leadingOption.content : "暂无"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{leadingOption ? `${leadingOption.voteCount} 票 · ${leadingOption.percentage}%` : "还没有投票数据"}</p>
        </div>
        <div className="rounded-[20px] border border-white/70 bg-background/80 p-4">
          <p className="text-xs text-muted-foreground">我的选择</p>
          <p className="mt-2 text-sm font-semibold">{options.find((item) => item.isVoted)?.content ?? "暂未投票"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hasVoted ? "你的投票已记录" : "投票后将展示你的选择"}</p>
        </div>
        <div className="rounded-[20px] border border-white/70 bg-background/80 p-4">
          <p className="text-xs text-muted-foreground">参与情况</p>
          <p className="mt-2 text-sm font-semibold">{totalVotes === 0 ? "尚未开始" : `${totalVotes} 人已参与`}</p>
          <p className="mt-1 text-xs text-muted-foreground">结果会在投票后实时刷新。</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {options.map((option) => (
          <div key={option.id} className={option.isVoted ? "rounded-[20px] border border-sky-300 bg-background/90 p-4 shadow-sm" : "rounded-[20px] border border-white/70 bg-background/80 p-4"}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{option.content}</p>
                  {option.isVoted ? <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] text-sky-700">我的选择</span> : null}
                  {leadingOption?.id === option.id && totalVotes > 0 ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] text-amber-700">当前领先</span> : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{option.voteCount} 票 · 占比 {option.percentage}%</p>
              </div>
              <Button type="button" variant={option.isVoted ? "default" : "outline"} disabled={hasVoted || Boolean(loadingId)} onClick={() => submitVote(option.id)}>
                {loadingId === option.id ? "提交中..." : option.isVoted ? "已选择" : hasVoted ? "已投票" : "投票"}
              </Button>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-sky-100">
              <div className={option.isVoted ? "h-full rounded-full bg-sky-600" : "h-full rounded-full bg-sky-500"} style={{ width: `${Math.max(option.percentage, totalVotes > 0 ? 6 : 0)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {totalVotes === 0 ? <p className="mt-3 text-sm text-muted-foreground">还没有人参与投票，快来投出第一票。</p> : null}
      {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
    </div>
  )
}
