"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronUp, Clock3, Gift, Sparkles, Trophy } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { UserAvatar } from "@/components/user/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/rbutton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Modal } from "@/components/ui/modal"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateTime, formatNumber, formatRelativeTime } from "@/lib/formatters"
import { addPostBountyResolvedListener } from "@/lib/post-discussion-events"
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
    renderedAt: string
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
    participantPreviews: Array<{
      userId: number
      username: string
      nickname: string | null
      avatarPath: string | null
      joinedAt: string
    }>
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
        avatarPath: string | null
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

export function BountyPanel({ postId, points, pointName = "积分", isResolved, acceptedAnswerAuthor }: BountyPanelProps) {
  const [resolved, setResolved] = useState(isResolved)
  const [resolvedAuthor, setResolvedAuthor] = useState(acceptedAnswerAuthor ?? null)

  useEffect(() => {
    return addPostBountyResolvedListener((detail) => {
      if (detail.postId !== postId) {
        return
      }

      setResolved(true)
      setResolvedAuthor(detail.acceptedAnswerAuthor ?? null)
    })
  }, [postId])

  return (
    <div className="rounded-xl bg-amber-50/75 p-4 sm:p-5 dark:bg-amber-500/8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">悬赏帖</p>
          <p className="mt-1 text-sm leading-6 text-amber-900/90 dark:text-amber-100/85">当前悬赏 {formatNumber(points)} {pointName}，发帖人可在回复中选择一个答案进行采纳。</p>
        </div>

        <span className={resolved ? "w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "w-fit rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"}>
          {resolved ? "已结贴" : "进行中"}
        </span>
      </div>
      {resolvedAuthor ? <p className="mt-3 text-sm text-muted-foreground">当前已采纳：{resolvedAuthor}</p> : null}
    </div>
  )
}

export function LotteryPanel({ postId, isOwnerOrAdmin, lottery }: LotteryPanelProps) {
  const router = useRouter()
  const participantPageSize = 10
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [conditionsOpen, setConditionsOpen] = useState(false)
  const [participantModalOpen, setParticipantModalOpen] = useState(false)
  const [participantLoading, setParticipantLoading] = useState(false)
  const [participantPage, setParticipantPage] = useState(1)
  const [participantPageCount, setParticipantPageCount] = useState(Math.max(1, Math.ceil(lottery.participantCount / participantPageSize)))
  const [participantTotal, setParticipantTotal] = useState(lottery.participantCount)
  const [participantItems, setParticipantItems] = useState<Array<{
    id: string
    userId: number
    username: string
    nickname: string | null
    avatarPath: string | null
    joinedAt: string
  }>>(lottery.participantPreviews.map((participant) => ({
    id: `${participant.userId}:${participant.joinedAt}`,
    userId: participant.userId,
    username: participant.username,
    nickname: participant.nickname,
    avatarPath: participant.avatarPath,
    joinedAt: participant.joinedAt,
  })))
  const [now, setNow] = useState(() => {
    const renderedAtTime = new Date(lottery.renderedAt).getTime()
    return Number.isFinite(renderedAtTime) ? renderedAtTime : Date.now()
  })
  const startsAtTime = lottery.startsAt ? new Date(lottery.startsAt).getTime() : null
  const endsAtTime = lottery.endsAt ? new Date(lottery.endsAt).getTime() : null
  const hasNotStarted = startsAtTime !== null && startsAtTime > now
  const hasReachedEndTime = endsAtTime !== null && endsAtTime <= now
  const isDrawn = Boolean(lottery.drawnAt)
  const isAutoParticipantDraw = lottery.triggerMode === "AUTO_PARTICIPANT_COUNT"
  const isLocked = (Boolean(lottery.lockedAt) || hasReachedEndTime) && !isDrawn
  const isEndedWithoutDraw = hasReachedEndTime && !isDrawn
  const totalPrizeQuantity = lottery.prizes.reduce((sum, prize) => sum + prize.quantity, 0)
  const conditionCount = lottery.conditionGroups.reduce((sum, group) => sum + group.conditions.length, 0)
  const goalProgress = lottery.participantGoal && lottery.participantGoal > 0
    ? Math.min(100, Math.round((lottery.participantCount / lottery.participantGoal) * 100))
    : null
  const relativeStartsAt = lottery.startsAt ? formatRelativeTime(lottery.startsAt, "zh-CN", now) : null
  const countdown = useLotteryCountdown({
    mounted,
    now,
    startsAt: lottery.startsAt,
    endsAt: lottery.endsAt,
    isDrawn,
    hasNotStarted,
    isLocked,
    triggerMode: lottery.triggerMode,
  })
  const showCountdownStageLabel = (!isDrawn && hasNotStarted && Boolean(lottery.startsAt))
    || (!isDrawn && !isLocked && Boolean(lottery.endsAt))

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isDrawn) {
      return
    }

    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [isDrawn])
  const nextActionText = isDrawn
    ? "中奖名单已经公布，快看结果。"
    : hasNotStarted
      ? `抽奖将在 ${relativeStartsAt ?? "-"} 正式开始。`
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
  const showParticipationMeta = !isDrawn
  const participationBadgeText = lottery.joined
    ? "你已入池"
    : lottery.ineligibleReason
      ? "未入池"
      : "待入池"
  const currentStageText = isDrawn
    ? "已开奖"
    : hasNotStarted
      ? "距开始"
      : isLocked
        ? "等待开奖"
        : lottery.endsAt
          ? "距结束"
          : lottery.triggerMode === "AUTO_PARTICIPANT_COUNT"
          ? "人数开奖"
            : "进行中"
  const announcementLines = lottery.announcement?.split("\n") ?? []
  const announcementPrizeLineOffset = Math.max(0, announcementLines.length - lottery.prizes.length)
  const announcementHeaderLines = announcementLines.slice(0, announcementPrizeLineOffset)

  async function loadParticipantPage(page: number) {
    setParticipantLoading(true)

    try {
      const response = await fetch(`/api/posts/lottery/participants?postId=${encodeURIComponent(postId)}&page=${page}&pageSize=${participantPageSize}`, {
        method: "GET",
      })
      const result = await response.json()
      if (!response.ok || result?.code !== 0) {
        setMessage(result?.message ?? "加载参与记录失败")
        return
      }

      setParticipantItems(result.data.items ?? [])
      setParticipantPage(result.data.page ?? 1)
      setParticipantPageCount(result.data.pageCount ?? 1)
      setParticipantTotal(result.data.total ?? 0)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载参与记录失败")
    } finally {
      setParticipantLoading(false)
    }
  }

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
    <>
      <Card className="overflow-hidden rounded-xl">
        <CardHeader className="sr-only">
          <CardTitle>抽奖面板</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-b bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.35)_1px,transparent_0)] [background-size:16px_16px] px-4 py-5 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-col items-start gap-2 text-foreground sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="flex min-w-0 items-center gap-2">
                    <StatusIcon className="h-4 w-4 shrink-0" />
                    <p className="truncate text-base font-semibold leading-none sm:text-lg">{statusConfig.title}</p>
                  </div>
                  <Badge variant={isDrawn ? "outline" : hasNotStarted ? "outline" : "secondary"} className="shrink-0 rounded-full bg-background/80">
                    {statusConfig.label}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
                  <div className="flex min-w-0 items-center gap-1.5 text-foreground sm:gap-2">
                    <Clock3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4" />
                    <span className="shrink-0 whitespace-nowrap text-[1.35rem] font-semibold leading-none tracking-tight sm:text-[1.9rem]">{countdown}</span>
                    {showCountdownStageLabel ? <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground sm:text-sm">{currentStageText}</span> : null}
                  </div>
                  <Badge variant="outline" className="shrink-0 rounded-full bg-background/80">
                    {participationBadgeText}
                  </Badge>
                </div>
              </div>

              {isOwnerOrAdmin && !isDrawn && !isAutoParticipantDraw ? (
                <Button type="button" variant={isLocked ? "default" : "outline"} className="h-11 w-full rounded-[16px] px-4 text-sm sm:h-12 sm:w-auto sm:px-5 sm:text-base" onClick={drawNow} disabled={loading}>
                  <Trophy data-icon="inline-start" />
                  {loading ? "开奖中..." : isLocked ? "立即开奖" : "手动开奖"}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>已有 {formatNumber(participantTotal)} 人参与抽奖</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {lottery.participantPreviews.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {lottery.participantPreviews.map((participant) => (
                  <div
                    key={`${participant.userId}:${participant.joinedAt}`}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background py-1 pl-1 pr-1"
                  >
                    <UserAvatar
                      name={participant.nickname ?? participant.username}
                      avatarPath={participant.avatarPath}
                      size="xs"
                    />
                    <span className="max-w-28 truncate text-[11px] font-medium text-foreground sm:max-w-32">
                      {participant.nickname ?? participant.username}
                    </span>
                  </div>
                ))}
                {participantTotal > lottery.participantPreviews.length ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto rounded-full px-2.5 py-1 text-[11px]"
                    onClick={() => {
                      setParticipantModalOpen(true)
                      void loadParticipantPage(1)
                    }}
                  >
                    查看更多
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">当前还没有人参与，欢迎第一个参与抽奖。</p>
            )}

            {!showParticipationMeta ? null : lottery.ineligibleReason ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                当前还未满足入池条件：{lottery.ineligibleReason}
              </div>
            ) : lottery.joined ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100">
                你已进入抽奖池，保持当前资格即可参与开奖。
              </div>
            ) : null}

            {!isDrawn && goalProgress !== null ? (
              <div className="mt-4 rounded-xl border border-border bg-card/70 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">自动开奖进度</p>
                    <p className="mt-1 text-xs text-muted-foreground">还差 {Math.max((lottery.participantGoal ?? 0) - lottery.participantCount, 0)} 人达到开奖门槛</p>
                  </div>
                  <Badge variant="secondary" className="rounded-full">{goalProgress}%</Badge>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${Math.max(goalProgress, lottery.participantCount > 0 ? 6 : 0)}%` }} />
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-3">
              <div className="bg-card/65 p-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                      <Gift className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-xs font-medium text-foreground">奖项</p>
                  </div>
                  <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">{formatNumber(totalPrizeQuantity)} 份</Badge>
                </div>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                  {lottery.prizes.map((prize) => (
                    <div key={prize.id} className="rounded-[14px] border border-border bg-linear-to-br from-background to-muted/40 px-2.5 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground">{prize.title}</p>
                          <p className="mt-0.5 text-[10px] leading-5 text-muted-foreground">
                            共 {prize.quantity} 名{isDrawn ? ` · 已开奖 ${prize.winnerCount} 名` : ""}
                          </p>
                        </div>
                        <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[10px]">{formatNumber(prize.quantity)}</Badge>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{prize.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Collapsible open={conditionsOpen} onOpenChange={setConditionsOpen}>
                <div className="rounded-[18px] border border-border bg-card/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">参与条件</p>
                      <Badge variant="outline" className="rounded-full">{conditionCount}</Badge>
                    </div>
                    <CollapsibleTrigger
                      render={(
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="rounded-full"
                          aria-label={conditionsOpen ? "收起参与条件" : "展开参与条件"}
                          title={conditionsOpen ? "收起参与条件" : "展开参与条件"}
                        />
                      )}
                    >
                      {conditionsOpen ? <ChevronUp /> : <ChevronDown />}
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent>
                    <div className="mt-3 flex flex-col gap-2">
                      {lottery.conditionGroups.map((group) => (
                        <div key={group.key} className=" bg-background ">
                          <ul className="mt-2 flex flex-col gap-2">
                            {group.conditions.map((condition) => (
                              <li key={condition.id} className="flex flex-col gap-2 rounded-[14px] border border-border px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
                                <span className="min-w-0 flex-1 text-xs leading-6 text-foreground">{condition.description ?? "未命名条件"}</span>
                                {condition.matched === true ? (
                                  <Badge variant="secondary" className="rounded-full">已满足</Badge>
                                ) : condition.matched === false ? (
                                  <Badge variant="outline" className="rounded-full">未满足</Badge>
                                ) : (
                                  <Badge variant="outline" className="rounded-full">待校验</Badge>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {isDrawn && lottery.announcement ? (
                <div className="rounded-[18px] border border-border bg-card/70 p-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">开奖公告</p>
                  </div>
                  <div className="mt-2 text-xs leading-6 text-muted-foreground">
                    {announcementHeaderLines.map((line, index) => (
                      <p key={`lottery-announcement-header-${index}`} className="whitespace-pre-wrap">{line}</p>
                    ))}
                    {lottery.prizes.map((prize, index) => {
                      const sourceLine = announcementLines[announcementPrizeLineOffset + index] ?? ""
                      const prizePrefix = sourceLine.includes("：")
                        ? sourceLine.slice(0, sourceLine.indexOf("：") + 1)
                        : `${prize.title}（${prize.quantity} 名）：`

                      return (
                        <p key={prize.id} className="whitespace-pre-wrap">
                          <span>{prizePrefix}</span>
                          {prize.winners.length > 0 ? prize.winners.map((winner, winnerIndex) => (
                            <span key={`${prize.id}-${winner.userId}`}>
                              {winnerIndex > 0 ? "、" : null}
                              <Link
                                href={`/users/${winner.username}`}
                                className="font-medium text-foreground underline-offset-4 hover:underline"
                              >
                                {winner.nickname ?? winner.username}
                              </Link>
                            </span>
                          )) : "无人中奖"}
                        </p>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <p className={cn("mt-4 text-sm font-medium leading-6", statusConfig.emphasisClassName)}>{nextActionText}</p>
            {message ? <p className="mt-2 text-sm text-muted-foreground">{message}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Modal
        open={participantModalOpen}
        onClose={() => setParticipantModalOpen(false)}
        title="抽奖参与用户"
        description={`按最新参与时间排序，共 ${formatNumber(participantTotal)} 人。`}
        size="lg"
        footer={(
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={participantLoading || participantPage <= 1}
                onClick={() => void loadParticipantPage(participantPage - 1)}
              >
                上一页
              </Button>
              <span className="text-sm text-muted-foreground">
                第 {participantPage} / {participantPageCount} 页
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={participantLoading || participantPage >= participantPageCount}
                onClick={() => void loadParticipantPage(participantPage + 1)}
              >
                下一页
              </Button>
            </div>
            <Button type="button" variant="outline" onClick={() => setParticipantModalOpen(false)}>
              关闭
            </Button>
          </div>
        )}
      >
        <div className="rounded-[18px] border border-border bg-card/60 p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>参与时间</TableHead>
                <TableHead>用户</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participantItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatDateTime(item.joinedAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserAvatar name={item.nickname ?? item.username} avatarPath={item.avatarPath} size="xs" />
                      <span>{item.nickname ?? item.username}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Modal>

    </>
  )
}

function useLotteryCountdown(input: {
  mounted: boolean
  now: number
  startsAt: string | null
  endsAt: string | null
  isDrawn: boolean
  hasNotStarted: boolean
  isLocked: boolean
  triggerMode: string
}) {
  if (!input.mounted) {
    return input.isDrawn ? "已开奖" : input.hasNotStarted ? "未开始" : "进行中"
  }

  if (input.isDrawn) {
    return "已开奖"
  }

  if (input.hasNotStarted && input.startsAt) {
    return formatDurationText(Math.max(0, new Date(input.startsAt).getTime() - input.now))
  }

  if (!input.isLocked && input.endsAt) {
    return formatDurationText(Math.max(0, new Date(input.endsAt).getTime() - input.now))
  }

  return input.triggerMode === "AUTO_PARTICIPANT_COUNT" ? "人数达标开奖" : "等待开奖"
}

function formatDurationText(remainingMs: number) {
  const totalSeconds = Math.floor(remainingMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${String(days).padStart(2, "0")}天${String(hours).padStart(2, "0")}小时${String(minutes).padStart(2, "0")}分${String(seconds).padStart(2, "0")}秒`
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
              ? "rounded-xl border border-sky-200/80 bg-sky-50 p-3.5 shadow-xs sm:p-4 dark:border-sky-500/20 dark:bg-slate-950/90 dark:shadow-none"
              : "rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs sm:p-4 dark:border-white/10 dark:bg-slate-900/75 dark:shadow-none"}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm font-medium text-slate-950 dark:text-slate-100">{option.content}</p>
                  {option.isVoted ? <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] text-sky-700 dark:bg-sky-500/10 dark:text-sky-200">我的选择</span> : null}
                  {leadingOption?.id === option.id && totalVotes > 0 ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">当前领先</span> : null}
                  <span className="text-xs text-slate-500 dark:text-slate-300">{option.voteCount} 票 · 占比 {option.percentage}%</span>
                </div>
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
