"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Clock3, Gavel, Info, Lock, Trophy } from "lucide-react"
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"

import { UserAvatar } from "@/components/user/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/rbutton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { formatDateTime, formatNumber } from "@/lib/formatters"
import type { SitePostItem } from "@/lib/posts"
import { cn } from "@/lib/utils"

type AuctionSummary = NonNullable<SitePostItem["auction"]>
type AuctionTimingState = {
  hasStarted: boolean
  hasEnded: boolean
  countdown: string
}

function subscribeToHydration() {
  return () => {}
}

export function PostAuctionPanel({
  postId,
  auction,
  pointName,
  currentUserId,
}: {
  postId: string
  auction: AuctionSummary
  pointName: string
  currentUserId?: number
}) {
  const router = useRouter()
  const [showBidModal, setShowBidModal] = useState(false)
  const [showParticipantsModal, setShowParticipantsModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [participantsLoading, setParticipantsLoading] = useState(false)
  const [participantsPage, setParticipantsPage] = useState(1)
  const [participantsPageCount, setParticipantsPageCount] = useState(1)
  const [participantsTotal, setParticipantsTotal] = useState(auction.participantCount)
  const [participantItems, setParticipantItems] = useState<Array<{
    id: string
    userId: number
    userName: string
    createdAt: string
    amount: number | null
  }>>([])
  const [bidValue, setBidValue] = useState<number>(auction.minNextBidAmount)
  const timing = useAuctionTiming(auction, router)

  useEffect(() => {
    setBidValue(auction.minNextBidAmount)
  }, [auction.minNextBidAmount])

  const sliderMin = auction.minNextBidAmount
  const sliderStep = Math.max(1, auction.incrementStep)
  const sliderMax = useMemo(
    () => Math.max(1000, sliderMin + sliderStep * 20, auction.startPrice * 3, (auction.viewerBidAmount ?? 0) + sliderStep * 10),
    [auction.startPrice, auction.viewerBidAmount, sliderMin, sliderStep],
  )
  const sliderValue = Math.min(Math.max(bidValue, sliderMin), sliderMax)
  const isSealedBid = auction.mode === "SEALED_BID"
  const showBidAmounts = !isSealedBid || timing.hasEnded
  const isLeadingOpenAuctionBidder = auction.mode === "OPEN_ASCENDING" && auction.viewerHasJoined && auction.viewerIsLeader
  const phaseLabel = resolveAuctionPhaseLabel(auction, timing)
  const timelineLabel = resolveAuctionTimelineLabel(auction, timing)
  const timelineValue = resolveAuctionTimelineValue(auction, timing)
  const viewerCanBid = auction.viewerCanBid && timing.hasStarted && !timing.hasEnded
  const headlineLabel = timing.hasEnded && auction.finalPrice ? "成交价" : "当前价"
  const headlineAmount = timing.hasEnded
    ? auction.finalPrice ?? auction.leaderBidAmount ?? auction.startPrice
    : auction.leaderBidAmount ?? auction.startPrice
  const showWinnerSummary = timing.hasEnded && Boolean(auction.winnerUserId && auction.winnerUserName)
  const viewerStateLabel = currentUserId
    ? resolveViewerStateLabel(auction, pointName, isSealedBid, timing.hasEnded)
    : null
  const readonlyActionLabel = resolveAuctionReadonlyActionLabel({
    auction,
    currentUserId,
    isSealedBid,
    timing,
  })

  async function loadParticipantPage(page: number) {
    setParticipantsLoading(true)

    try {
      const response = await fetch(`/api/posts/auction/participants?postId=${encodeURIComponent(postId)}&page=${page}&pageSize=10`, {
        method: "GET",
      })
      const result = await response.json()
      if (!response.ok || result?.code !== 0) {
        toast.error(result?.message ?? "参与记录加载失败", "加载失败")
        return
      }

      setParticipantItems(result.data.items ?? [])
      setParticipantsPage(result.data.page ?? 1)
      setParticipantsPageCount(result.data.pageCount ?? 1)
      setParticipantsTotal(result.data.total ?? 0)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "参与记录加载失败", "加载失败")
    } finally {
      setParticipantsLoading(false)
    }
  }

  async function handleBidConfirm() {
    if (!Number.isFinite(bidValue) || bidValue <= 0) {
      toast.error("请输入有效出价金额", "出价失败")
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch("/api/posts/auction/bid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId,
          amount: bidValue,
        }),
      })

      const result = await response.json()
      if (!response.ok || result?.code !== 0) {
        toast.error(result?.message ?? "出价失败", "出价失败")
        return
      }

      toast.success(result?.message ?? "出价成功", "出价成功")
      setShowBidModal(false)
      window.setTimeout(() => {
        window.location.reload()
      }, 120)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "出价失败，请稍后重试", "出价失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Card className="overflow-hidden rounded-[24px]">
        <CardHeader className="sr-only">
          <CardTitle>拍卖面板</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-b bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.35)_1px,transparent_0)] [background-size:16px_16px] px-4 py-5 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-col items-start gap-2 text-foreground sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="flex min-w-0 items-center gap-2">
                    <Gavel className="h-4 w-4 shrink-0" />
                    <p className="truncate text-base font-semibold leading-none sm:text-lg">{resolveAuctionStatusTitle(auction, timing)}</p>
                  </div>
                  <Badge variant={timing.hasEnded ? "outline" : timing.hasStarted ? "secondary" : "outline"} className="shrink-0 rounded-full bg-background/80">
                    {phaseLabel}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
                  <div className="flex min-w-0 items-center gap-1.5 text-foreground sm:gap-2">
                    <Clock3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4" />
                    <span className={cn(
                      "shrink-0 whitespace-nowrap font-semibold leading-none tracking-tight",
                      timing.hasEnded ? "text-[0.95rem] sm:text-base" : "text-[1.35rem] sm:text-[1.9rem]",
                    )}
                    >
                      {timelineValue}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground sm:text-sm">{timelineLabel}</span>
                  </div>
                  {!isSealedBid ? (
                    <Badge variant="outline" className="shrink-0 rounded-full bg-background/80">
                      {headlineLabel} {formatNumber(headlineAmount)} {pointName}
                    </Badge>
                  ) : null}
                  {!isSealedBid && !timing.hasEnded ? (
                    <Badge variant="outline" className="shrink-0 rounded-full bg-background/80">
                      最低下一口 {formatNumber(auction.minNextBidAmount)} {pointName}
                    </Badge>
                  ) : null}
                  {viewerStateLabel ? (
                    <Badge variant="secondary" className="shrink-0 rounded-full">
                      {viewerStateLabel}
                    </Badge>
                  ) : null}
                </div>
                {showWinnerSummary ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[20px] border border-amber-200 bg-amber-50/90 px-3 py-3 text-sm text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-50">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <UserAvatar
                        name={auction.winnerUserName ?? "最终赢家"}
                        avatarPath={auction.winnerAvatarPath}
                        size="sm"
                        isVip={auction.winnerIsVip}
                        vipLevel={auction.winnerVipLevel}
                      />
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-amber-700/80 dark:text-amber-200/80">最终赢家</p>
                        <p className="truncate text-sm font-semibold text-foreground dark:text-amber-50">{auction.winnerUserName}</p>
                      </div>
                    </div>
                    {auction.finalPrice ? (
                      <Badge variant="outline" className="rounded-full border-amber-300/80 bg-background/70 text-amber-950 dark:border-amber-300/25 dark:bg-white/8 dark:text-amber-50">
                        成交价 {formatNumber(auction.finalPrice)} {pointName}
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {viewerCanBid ? (
                <Button type="button" className="h-11 w-full rounded-[16px] px-4 text-sm sm:h-12 sm:w-auto sm:px-5 sm:text-base" onClick={() => setShowBidModal(true)}>
                  <Gavel data-icon="inline-start" />
                  {isLeadingOpenAuctionBidder ? "加价" : "出价"}
                </Button>
              ) : !currentUserId && !timing.hasEnded ? (
                <Link href="/login">
                  <Button type="button" className="h-11 w-full rounded-[16px] px-4 text-sm sm:h-12 sm:w-auto sm:px-5 sm:text-base">
                    <Gavel data-icon="inline-start" />
                    出价
                  </Button>
                </Link>
              ) : readonlyActionLabel ? (
                <Badge variant="outline" className="rounded-full px-3 py-1.5 text-sm">
                  {readonlyActionLabel}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>已有 {formatNumber(auction.participantCount)} 人参与{isSealedBid ? "竞拍" : "拍卖"}</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {auction.participantPreviews.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {auction.participantPreviews.map((participant) => (
                  <div
                    key={participant.userId}
                    className={cn(
                      "inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background pl-1 pr-1 py-1",
                      participant.isLeader
                        ? "border-foreground/20 shadow-[0_4px_16px_rgba(15,23,42,0.08)]"
                        : "border-border",
                    )}
                  >
                    <UserAvatar
                      name={participant.userName}
                      avatarPath={participant.avatarPath}
                      size="xs"
                      isVip={participant.isVip}
                      vipLevel={participant.vipLevel}
                    />
                    <span className="max-w-28 truncate text-[11px] font-medium text-foreground sm:max-w-32">{participant.userName}</span>
                    {showBidAmounts && participant.amount !== null ? (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                          participant.isLeader
                            ? "bg-foreground text-background"
                            : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {formatNumber(participant.amount)}
                      </span>
                    ) : null}
                  </div>
                ))}
                {auction.participantCount > auction.participantPreviews.length ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto rounded-full px-2.5 py-1 text-[11px]"
                    onClick={() => {
                      setShowParticipantsModal(true)
                      void loadParticipantPage(1)
                    }}
                  >
                    查看更多
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">当前还没有人参与，欢迎第一个出价。</p>
            )}

            <div className="mt-5 flex flex-col gap-3 border-t border-border/80 pt-4 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  {isSealedBid && timing.hasEnded
                    ? `竞拍已结束，当前已公开全部出价；本场按${auction.pricingRuleLabel}确定最终成交。`
                    : isSealedBid
                    ? `${auction.pricingRuleLabel}，同价按出价时间先后决定优先顺序。`
                    : `新出价至少需达到 ${formatNumber(auction.minNextBidAmount)} ${pointName}，同价按时间先后决定优先顺序。`}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Modal
        open={showBidModal}
        onClose={() => !submitting && setShowBidModal(false)}
        title={isSealedBid ? "参与竞拍" : isLeadingOpenAuctionBidder ? "继续加价" : "参与拍卖"}
        description={
          isSealedBid
            ? `当前为${auction.pricingRuleLabel}，每位用户只能出价一次，请谨慎填写。`
            : isLeadingOpenAuctionBidder
              ? `你当前处于领先位置，如需继续拉开差距，请输入新的加价金额。当前最低有效出价为 ${formatNumber(auction.minNextBidAmount)} ${pointName}。`
              : `请输入你的出价金额。当前最低有效出价为 ${formatNumber(auction.minNextBidAmount)} ${pointName}。`
        }
        size="md"
        closeDisabled={submitting}
        footer={(
          <div className="flex w-full items-center justify-end gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setShowBidModal(false)}>
              取消
            </Button>
            <Button type="button" disabled={submitting} onClick={handleBidConfirm}>
              {submitting ? "提交中..." : isLeadingOpenAuctionBidder ? "确认加价" : "确认出价"}
            </Button>
          </div>
        )}
      >
        <div className="space-y-5">
          <div className="text-center">
            <p className="text-[2.2rem] font-semibold tracking-tight text-foreground">
              {formatNumber(bidValue)}
              <span className="ml-2 text-base font-medium text-muted-foreground">{pointName}</span>
            </p>
          </div>

          <div className="space-y-3">
            <Slider
              min={sliderMin}
              max={sliderMax}
              step={sliderStep}
              value={[sliderValue]}
              className="px-1 [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:bg-foreground/10 dark:[&_[data-slot=slider-track]]:bg-white/12 [&_[data-slot=slider-range]]:bg-foreground dark:[&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-background [&_[data-slot=slider-thumb]]:bg-background [&_[data-slot=slider-thumb]]:shadow-[0_0_0_4px_rgba(15,23,42,0.08)] dark:[&_[data-slot=slider-thumb]]:shadow-[0_0_0_4px_rgba(255,255,255,0.12)]"
              onValueChange={(value) => {
                const nextValue = Array.isArray(value) ? value[0] : value
                setBidValue(typeof nextValue === "number" ? nextValue : sliderMin)
              }}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium tabular-nums">{formatNumber(sliderMin)}</span>
              <span className="font-medium tabular-nums">{formatNumber(sliderMax)}</span>
            </div>
            <Input
              type="number"
              min={sliderMin}
              step={sliderStep}
              value={String(bidValue)}
              onChange={(event) => {
                const nextValue = Number(event.target.value)
                if (!Number.isFinite(nextValue)) {
                  return
                }
                setBidValue(Math.max(sliderMin, Math.trunc(nextValue)))
              }}
              className="h-11 rounded-full px-4"
            />
            <p className="text-xs leading-6 text-muted-foreground">
              滑杆用于快速调整金额；如果你想出更高的价格，也可以直接在输入框中填写。
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        open={showParticipantsModal}
        onClose={() => setShowParticipantsModal(false)}
        title={isSealedBid && timing.hasEnded ? "全部竞拍记录" : isSealedBid ? "全部参与用户" : "全部参与记录"}
        description={isSealedBid
          ? timing.hasEnded
            ? `竞拍已结束，按参与时间排序，共 ${formatNumber(participantsTotal)} 人，出价已公开。`
            : `按最新参与时间排序，共 ${formatNumber(participantsTotal)} 人。`
          : `按最新出价时间排序，共 ${formatNumber(participantsTotal)} 条。`}
        size="lg"
        footer={(
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={participantsLoading || participantsPage <= 1}
                onClick={() => void loadParticipantPage(participantsPage - 1)}
              >
                上一页
              </Button>
              <span className="text-sm text-muted-foreground">
                第 {participantsPage} / {participantsPageCount} 页
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={participantsLoading || participantsPage >= participantsPageCount}
                onClick={() => void loadParticipantPage(participantsPage + 1)}
              >
                下一页
              </Button>
            </div>
            <Button type="button" variant="outline" onClick={() => setShowParticipantsModal(false)}>
              关闭
            </Button>
          </div>
        )}
      >
        <div className="rounded-[18px] border border-border bg-card/60 p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>用户</TableHead>
                {showBidAmounts ? <TableHead className="text-right">出价</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {participantItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                  <TableCell>{item.userName}</TableCell>
                  {showBidAmounts ? <TableCell className="text-right">{item.amount !== null ? `${formatNumber(item.amount)} ${pointName}` : "-"}</TableCell> : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Modal>
    </>
  )
}

export function PostAuctionWinnerContent({
  auction,
  pointName,
}: {
  auction: AuctionSummary
  pointName: string
}) {
  const canViewContent = auction.viewerCanViewWinnerContent && Boolean(auction.winnerOnlyContent)

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">赢家专属内容</CardTitle>
          </div>
          {auction.finalPrice ? (
            <Badge variant="secondary" className="rounded-full">成交价 {formatNumber(auction.finalPrice)} {pointName}</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {canViewContent ? (
          <div className="space-y-3">
            <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100">
              当前内容仅卖家、站点管理员和最终赢家可见。你已具备查看权限。
            </div>
            <div className="rounded-[20px] border border-border bg-background px-4 py-4 text-sm leading-7 whitespace-pre-wrap text-foreground">
              {auction.winnerOnlyContent}
            </div>
          </div>
        ) : (
          <div className="rounded-[20px] border border-dashed border-border bg-card/70 px-4 py-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 font-medium text-foreground/85">
              <Lock className="h-4 w-4" />
              <span>该内容仅成交赢家可见</span>
            </div>
            {auction.winnerOnlyContentPreview ? <p className="mt-2">预告：{auction.winnerOnlyContentPreview}</p> : null}
            {auction.finalPrice ? <Separator className="my-3" /> : null}
            {auction.finalPrice ? <p>当前成交价：{formatNumber(auction.finalPrice)} {pointName}</p> : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function resolveAuctionStatusTitle(auction: AuctionSummary, timing: Pick<AuctionTimingState, "hasStarted" | "hasEnded">) {
  if (timing.hasEnded) {
    if (auction.status === "FAILED") {
      return auction.mode === "SEALED_BID" ? "竞拍已流拍" : "拍卖已流拍"
    }

    if (auction.status === "CANCELLED") {
      return auction.mode === "SEALED_BID" ? "竞拍已取消" : "拍卖已取消"
    }

    if (auction.status === "SETTLING") {
      return auction.mode === "SEALED_BID" ? "竞拍结算中" : "拍卖结算中"
    }

    return auction.mode === "SEALED_BID" ? "竞拍已结束" : "拍卖已结束"
  }

  if (!timing.hasStarted) {
    return auction.mode === "SEALED_BID" ? "竞拍未开始" : "拍卖未开始"
  }

  return auction.mode === "SEALED_BID" ? "竞拍进行中" : "拍卖进行中"
}

function resolveAuctionPhaseLabel(auction: AuctionSummary, timing: Pick<AuctionTimingState, "hasStarted" | "hasEnded">) {
  if (timing.hasEnded) {
    if (auction.status === "FAILED") {
      return "流拍"
    }

    if (auction.status === "CANCELLED") {
      return "已取消"
    }

    if (auction.status === "SETTLING") {
      return "结算中"
    }

    return "已结束"
  }

  return timing.hasStarted ? "进行中" : "未开始"
}

function resolveAuctionTimelineLabel(auction: AuctionSummary, timing: Pick<AuctionTimingState, "hasStarted" | "hasEnded">) {
  if (timing.hasEnded) {
    return auction.status === "SETTLING" ? "结算状态" : "结束时间"
  }

  return timing.hasStarted ? "距结束" : "距开始"
}

function resolveAuctionTimelineValue(auction: AuctionSummary, timing: Pick<AuctionTimingState, "hasStarted" | "hasEnded" | "countdown">) {
  if (timing.hasEnded) {
    return formatDateTime(auction.endsAt)
  }

  return timing.countdown
}

function resolveAuctionReadonlyActionLabel({
  auction,
  currentUserId,
  isSealedBid,
  timing,
}: {
  auction: AuctionSummary
  currentUserId?: number
  isSealedBid: boolean
  timing: Pick<AuctionTimingState, "hasStarted" | "hasEnded">
}) {
  if (!currentUserId || timing.hasEnded) {
    return null
  }

  if (!timing.hasStarted) {
    return "未开始"
  }

  if (auction.viewerIsSeller || (isSealedBid && auction.viewerHasJoined)) {
    return null
  }

  return "暂不可出价"
}

function resolveViewerStateLabel(auction: AuctionSummary, pointName: string, isSealedBid: boolean, hasEnded: boolean) {
  if (auction.viewerIsSeller) {
    return "发起人"
  }

  if (hasEnded) {
    if (auction.status === "SETTLING" && auction.viewerHasJoined && auction.viewerStatus === "ACTIVE") {
      return "等待结算"
    }

    switch (auction.viewerStatus) {
      case "WON":
        return "已中标"
      case "LOST":
      case "OUTBID":
        return "未中标"
      case "ACTIVE":
        return auction.viewerIsLeader ? "等待结算" : "已参与"
      default:
        return auction.viewerHasJoined ? "已参与" : "未出价"
    }
  }

  if (auction.viewerIsLeader) {
    return "当前领先"
  }

  if (isSealedBid) {
    if (!auction.viewerStatus) {
      return "未出价"
    }

    switch (auction.viewerStatus) {
      case "WON":
        return "已中标"
      case "LOST":
        return "未中标"
      default:
        return "已出价"
    }
  }

  if (auction.viewerFrozenAmount && auction.viewerFrozenAmount > 0) {
    return `已冻结 ${formatNumber(auction.viewerFrozenAmount)} ${pointName}`
  }

  if (!auction.viewerStatus) {
    return "未出价"
  }

  switch (auction.viewerStatus) {
    case "OUTBID":
      return "已被超越"
    case "LOST":
      return "未中标"
    case "WON":
      return "已中标"
    case "ACTIVE":
    default:
      return "已出价"
  }
}

function resolveAuctionCountdownLabel(auction: AuctionSummary) {
  if (auction.status === "FAILED") {
    return "流拍"
  }

  if (auction.status === "CANCELLED") {
    return "已取消"
  }

  if (auction.status === "SETTLING") {
    return "等待结算"
  }

  return "已结束"
}

function useAuctionTiming(auction: AuctionSummary, router: ReturnType<typeof useRouter>): AuctionTimingState {
  const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false)
  const refreshKeyRef = useRef<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const startsAtMs = auction.startsAt ? new Date(auction.startsAt).getTime() : null
  const endsAtMs = new Date(auction.endsAt).getTime()
  const hasStarted = mounted ? startsAtMs === null || now >= startsAtMs : auction.hasStarted
  const hasEnded = mounted ? auction.hasEnded || now >= endsAtMs : auction.hasEnded

  useEffect(() => {
    if (!mounted || hasEnded) {
      return
    }

    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [hasEnded, mounted])

  useEffect(() => {
    if (!mounted) {
      return
    }

    const refreshKey = hasEnded && !auction.hasEnded
      ? "end"
      : hasStarted && !auction.hasStarted
        ? "start"
        : null

    if (!refreshKey || refreshKeyRef.current === refreshKey) {
      return
    }

    refreshKeyRef.current = refreshKey
    router.refresh()
  }, [auction.hasEnded, auction.hasStarted, hasEnded, hasStarted, mounted, router])

  if (!mounted) {
    return {
      hasStarted: auction.hasStarted,
      hasEnded: auction.hasEnded,
      countdown: auction.hasEnded ? resolveAuctionCountdownLabel(auction) : auction.hasStarted ? "进行中" : "未开始",
    }
  }

  const targetTime = hasStarted ? endsAtMs : (startsAtMs ?? now)
  const remainingMs = Math.max(0, targetTime - now)

  if (hasEnded || remainingMs <= 0) {
    return {
      hasStarted,
      hasEnded: true,
      countdown: resolveAuctionCountdownLabel(auction),
    }
  }

  const totalSeconds = Math.floor(remainingMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return {
    hasStarted,
    hasEnded,
    countdown: `${String(days).padStart(2, "0")}天${String(hours).padStart(2, "0")}小时${String(minutes).padStart(2, "0")}分${String(seconds).padStart(2, "0")}秒`,
  }
}
