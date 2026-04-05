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

const lotterySurfaceCardClassName =
  "rounded-[20px] bg-white p-3.5 sm:rounded-[22px] sm:p-4 dark:bg-slate-900"

const lotteryInnerItemClassName =
  "rounded-[18px] bg-slate-100 px-3 py-2.5 dark:bg-slate-800/80"


export function BountyPanel({ points, pointName = "积分", isResolved, acceptedAnswerAuthor }: BountyPanelProps) {
  return (
    <div className="rounded-[24px] bg-amber-50/75 p-4 sm:p-5 dark:bg-amber-500/[0.08]">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">悬赏帖</p>
          <p className="mt-1 text-sm leading-6 text-amber-900/90 dark:text-amber-100/85">当前悬赏 {points} {pointName}，发帖人可在回复中选择一个答案进行采纳。</p>
        </div>

        <span className={isResolved ? "w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "w-fit rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"}>
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
  const [now] = useState(() => Date.now())

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
        badgeClassName: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950",
        iconWrapClassName: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
        emphasisClassName: "text-emerald-700 dark:text-emerald-200",
      }
    : hasNotStarted
      ? {
          label: "即将开始",
          title: "抽奖尚未开始，请锁定开场时间",
          description: lottery.startsAt ? `预计开始时间：${formatDateTime(lottery.startsAt)}` : "等待抽奖开始时间确认。",
          chip: "倒计时阶段",
          icon: Clock3,
        badgeClassName: "bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-950",
        iconWrapClassName: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
          emphasisClassName: "text-amber-700 dark:text-amber-200",
        }
      : isEndedWithoutDraw
        ? {
            label: "报名截止",
            title: "抽奖报名已结束，等待楼主完成开奖",
            description: lottery.endsAt ? `截止时间：${formatDateTime(lottery.endsAt)}` : "抽奖报名阶段已经结束。",
            chip: "不可继续参与",
            icon: Clock3,
            badgeClassName: "bg-rose-600 text-white dark:bg-rose-400 dark:text-rose-950",
            iconWrapClassName: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
            emphasisClassName: "text-rose-700 dark:text-rose-200",
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
            badgeClassName: "bg-violet-600 text-white dark:bg-violet-400 dark:text-violet-950",
            iconWrapClassName: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
            emphasisClassName: "text-violet-700 dark:text-violet-200",
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
    <div className="overflow-hidden rounded-[24px] bg-slate-50 p-3.5 sm:rounded-[28px] sm:p-6 dark:bg-slate-950">
      <div className="flex flex-col gap-3.5 sm:gap-4">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl sm:h-14 sm:w-14", statusConfig.iconWrapClassName)}>
            <StatusIcon className="h-5 w-5 sm:h-7 sm:w-7" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] sm:px-3 sm:text-[11px]", statusConfig.badgeClassName)}>
                {statusConfig.label}
              </span>
              <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-medium text-slate-600 sm:px-3 sm:text-[11px] dark:bg-slate-800 dark:text-slate-300">
                抽奖帖
              </span>
              <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-medium text-slate-600 sm:ml-auto sm:px-3 sm:text-xs dark:bg-slate-800 dark:text-slate-300">
                {statusConfig.chip}
              </span>
            </div>
            <div>
              <p className="text-base font-semibold leading-6 text-slate-950 sm:text-xl sm:leading-7 dark:text-slate-50">{statusConfig.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{statusConfig.description}</p>
            </div>
            <p className={cn("text-sm font-medium leading-6", statusConfig.emphasisClassName)}>{nextActionText}</p>
          </div>
        </div>

        {isOwnerOrAdmin && !isDrawn && !isAutoParticipantDraw ? (
          <div className="flex w-full sm:justify-end">
            <Button type="button" variant={isLocked ? "default" : "outline"} onClick={drawNow} disabled={loading} className="h-10 w-full sm:w-auto">
              {loading ? "开奖中..." : isLocked ? "立即公布结果" : "立即开奖"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:gap-3 lg:grid-cols-4">
        <div className={lotterySurfaceCardClassName}>
          <p className="text-xs text-slate-500 dark:text-slate-400">参与人数</p>
          <p className="mt-1.5 text-xl font-semibold text-slate-950 sm:mt-2 sm:text-2xl dark:text-slate-100">{lottery.participantCount}</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500 sm:text-xs dark:text-slate-300">{lottery.joined ? "你已成功入池" : lottery.ineligibleReason ? "你当前尚未入池" : "互动后将自动校验资格"}</p>
        </div>
        <div className={lotterySurfaceCardClassName}>
          <p className="text-xs text-slate-500 dark:text-slate-400">奖品名额</p>
          <p className="mt-1.5 text-xl font-semibold text-slate-950 sm:mt-2 sm:text-2xl dark:text-slate-100">{totalPrizeQuantity}</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500 sm:text-xs dark:text-slate-300">共 {lottery.prizes.length} 个奖项，已开出 {winnerCount} 名</p>
        </div>
        <div className={lotterySurfaceCardClassName}>
          <p className="text-xs text-slate-500 dark:text-slate-400">理论中奖率</p>
          <p className="mt-1.5 text-xl font-semibold text-slate-950 sm:mt-2 sm:text-2xl dark:text-slate-100">{lottery.currentProbability !== null ? `${lottery.currentProbability}%` : "--"}</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500 sm:text-xs dark:text-slate-300">基于当前有效参与人数动态计算</p>
        </div>
        <div className={lotterySurfaceCardClassName}>
          <p className="text-xs text-slate-500 dark:text-slate-400">开奖方式</p>
          <p className="mt-1.5 text-sm font-semibold leading-5 text-slate-950 sm:mt-2 sm:text-base dark:text-slate-100">{lottery.triggerMode === "AUTO_PARTICIPANT_COUNT" ? "人数达标自动开奖" : "楼主手动开奖"}</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500 sm:text-xs dark:text-slate-300">
            {lottery.triggerMode === "AUTO_PARTICIPANT_COUNT"
              ? `目标人数 ${lottery.participantGoal ?? 0} 人`
              : lottery.endsAt
                ? `结束于 ${formatRelativeTime(lottery.endsAt)}`
                : "未设置固定结束时间"}
          </p>
        </div>
      </div>

      {goalProgress !== null ? (
        <div className={cn("mt-4", lotterySurfaceCardClassName)}>
          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div>
              <p className="font-medium text-slate-950 dark:text-slate-100">自动开奖进度</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500 sm:text-xs dark:text-slate-300">还差 {Math.max((lottery.participantGoal ?? 0) - lottery.participantCount, 0)} 人达到开奖门槛</p>
            </div>
            <span className="w-fit rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">{goalProgress}%</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full rounded-full bg-violet-500 transition-all dark:bg-violet-400" style={{ width: `${Math.max(goalProgress, lottery.participantCount > 0 ? 6 : 0)}%` }} />
          </div>
        </div>
      ) : null}

      {lottery.ineligibleReason ? (
        <div className="mt-4 rounded-[20px] bg-amber-50 px-3.5 py-3 text-sm text-amber-900 sm:rounded-[22px] sm:px-4 dark:bg-slate-900 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">当前还未满足入池条件</p>
              <p className="mt-1 text-amber-800/90 dark:text-amber-100/90">{lottery.ineligibleReason}</p>
            </div>
          </div>
        </div>
      ) : lottery.joined ? (
        <div className="mt-4 rounded-[20px] bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900 sm:rounded-[22px] sm:px-4 dark:bg-slate-900 dark:text-emerald-200">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">你已进入抽奖池</p>
              <p className="mt-1 text-emerald-800/90 dark:text-emerald-100/90">保持当前资格即可参与开奖，无需额外操作。</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2.5 sm:mt-5 sm:gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {lottery.prizes.map((prize) => (
          <div key={prize.id} className={lotterySurfaceCardClassName}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">{prize.title}</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500 sm:text-xs dark:text-slate-300">共 {prize.quantity} 名 · 已开奖 {prize.winnerCount} 名</p>
              </div>
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:h-9 sm:w-9", isDrawn ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/14 dark:text-emerald-300" : "bg-violet-100 text-violet-700 dark:bg-violet-500/14 dark:text-violet-300")}>
                <Gift className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-200">{prize.description}</p>
            {prize.winners.length > 0 ? (
              <div className="mt-3 rounded-[16px] bg-emerald-50 p-3 sm:rounded-[18px] dark:bg-slate-800">
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
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">{isDrawn ? "该奖项暂无中奖者。" : "开奖后将在这里展示中奖名单。"}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
        {lottery.conditionGroups.map((group) => (
          <div key={group.key} className={lotterySurfaceCardClassName}>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <p className="text-sm font-medium text-slate-950 dark:text-slate-100">{group.label}</p>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-200">
              {group.conditions.map((condition) => (
                <li key={condition.id} className={cn(lotteryInnerItemClassName, "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3")}>
                  <span className="min-w-0 flex-1 leading-6">{condition.description ?? "未命名条件"}</span>
                  {condition.matched === true ? (
                    <span className="w-fit rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">已满足</span>
                  ) : condition.matched === false ? (
                    <span className="w-fit rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">未满足</span>
                  ) : (
                    <span className="w-fit rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-200">待校验</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {lottery.announcement ? (
        <div className="mt-4 rounded-[22px] bg-white p-3.5 sm:mt-5 sm:rounded-[24px] sm:p-4 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <Trophy className="h-4 w-4" />
            <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">开奖公告</p>
          </div>
          <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 sm:leading-7 dark:text-slate-100">{lottery.announcement}</pre>
        </div>
      ) : null}
      {message ? <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">{message}</p> : null}
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
    <div >
      <div className="flex flex-col gap-3">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold tracking-[0.06em] text-slate-950 dark:text-slate-200/95">投票</p>
            <span aria-hidden="true" className="h-px flex-1 bg-slate-300/90 dark:bg-border/80" />
            <span className="w-fit rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-600 dark:bg-secondary/70 dark:text-slate-300">{hasVoted ? "已投票" : "未投票"}</span>
          </div>
          <p className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">共 {totalVotes} 人参与投票，每个账号只能选择一次。{expiresAt ? `截止时间：${formatDateTime(expiresAt)}` : "未设置截止时间，投票将长期开放。"}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5 sm:space-y-3">
        {options.map((option) => (
          <div
            key={option.id}
            className={option.isVoted
              ? "rounded-[20px] border border-sky-200/80 bg-sky-50 p-3.5 shadow-sm sm:p-4 dark:border-sky-500/20 dark:bg-slate-950/90 dark:shadow-none"
              : "rounded-[20px] border border-slate-200/80 bg-white p-3.5 shadow-sm sm:p-4 dark:border-white/10 dark:bg-slate-900/75 dark:shadow-none"}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-950 dark:text-slate-100">{option.content}</p>
                  {option.isVoted ? <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] text-sky-700 dark:bg-sky-500/10 dark:text-sky-200">我的选择</span> : null}
                  {leadingOption?.id === option.id && totalVotes > 0 ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">当前领先</span> : null}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{option.voteCount} 票 · 占比 {option.percentage}%</p>
              </div>
              <Button type="button" variant={option.isVoted ? "default" : "outline"} disabled={hasVoted || Boolean(loadingId)} onClick={() => submitVote(option.id)} className="h-10 w-full sm:w-auto">
                {loadingId === option.id ? "提交中..." : option.isVoted ? "已选择" : hasVoted ? "已投票" : "投票"}
              </Button>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-sky-100 dark:bg-slate-800/80">
              <div className={option.isVoted ? "h-full rounded-full bg-sky-600 dark:bg-sky-400" : "h-full rounded-full bg-sky-500 dark:bg-sky-500/70"} style={{ width: `${Math.max(option.percentage, totalVotes > 0 ? 6 : 0)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {totalVotes === 0 ? <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">还没有人参与投票，快来投出第一票。</p> : null}
      {message ? <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">{message}</p> : null}
    </div>
  )
}
