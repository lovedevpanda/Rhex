"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/formatters"

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
    <div className="rounded-[24px] border border-violet-200  p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-violet-900">抽奖帖</p>
          <p className="mt-1 text-sm text-violet-800">当前共有 {lottery.participantCount} 人参与，{lottery.joined ? "你已加入抽奖池" : "满足条件后会自动加入抽奖池"}。</p>
          <div className="mt-2 space-y-1 text-xs text-violet-700">
            <p>{lottery.triggerMode === "AUTO_PARTICIPANT_COUNT" ? `自动开奖：人数达到 ${lottery.participantGoal ?? 0} 人后自动开奖` : `手动开奖：${lottery.endsAt ? `结束时间 ${formatDateTime(lottery.endsAt)}` : "等待楼主手动开奖"}`}</p>
            <p>{lottery.startsAt ? `开始时间：${formatDateTime(lottery.startsAt)}` : "开始时间：审核通过后立即开始"}</p>
            {lottery.currentProbability !== null ? <p>当前理论中奖率：{lottery.currentProbability}%</p> : null}
            {lottery.ineligibleReason ? <p>当前状态：{lottery.ineligibleReason}</p> : null}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground">{lottery.drawnAt ? "已开奖" : lottery.lockedAt ? "名单已锁定" : lottery.joined ? "已参与" : "待参与"}</span>
          {isOwnerOrAdmin && !lottery.drawnAt ? (
            <Button type="button" variant="outline" onClick={drawNow} disabled={loading}>
              {loading ? "开奖中..." : "立即开奖"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {lottery.prizes.map((prize) => (
          <div key={prize.id} className="rounded-[20px] border border-white/70 bg-background/80 p-4">
            <p className="text-sm font-semibold">{prize.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">共 {prize.quantity} 名 · 已开奖 {prize.winnerCount} 名</p>
            <p className="mt-2 text-sm text-muted-foreground">{prize.description}</p>
            {prize.winners.length > 0 ? (
              <p className="mt-3 text-xs text-violet-700">
                中奖用户：
                {prize.winners.map((winner, index) => (
                  <span key={`${winner.userId}-${winner.username}`}>
                    {index > 0 ? "、" : ""}
                    <Link href={`/users/${winner.username}`} className="font-medium underline-offset-2 hover:underline">
                      {winner.nickname ?? winner.username}
                    </Link>
                  </span>
                ))}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {lottery.conditionGroups.map((group) => (
          <div key={group.key} className="rounded-[20px] border border-white/70 bg-background/80 p-4">
            <p className="text-sm font-medium">{group.label}</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {group.conditions.map((condition) => (
                <li key={condition.id} className="flex items-center justify-between gap-3">
                  <span>- {condition.description ?? "未命名条件"}</span>
        
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {lottery.announcement ? <pre className="mt-4 whitespace-pre-wrap rounded-[20px] border border-white/70 bg-background/90 p-4 text-sm text-foreground">{lottery.announcement}</pre> : null}
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
