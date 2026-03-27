"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatBusinessMonthDayTime } from "@/lib/formatters"
import type { GobangMatch, GobangPlayerSummary } from "@/lib/gobang"
import { cn } from "@/lib/utils"



import "@/styles/gobang.css"


interface GobangPageProps {
  config: Record<string, boolean | number | string>
  initialMatches: GobangMatch[]
  initialSummary: PlayerSummary
}

type ChallengePolicy = { mode: "FREE" | "PAID"; remainingFree: number; remainingPaid: number }
type CreateMatchResult = { matches: GobangMatch[]; policy: ChallengePolicy }
type PlayerSummary = GobangPlayerSummary
type ApiResponse<T> = { code: number; message?: string; data?: T }

type Point = { r: number; c: number }
type GobangViewState = {
  freeCount: number
  freeTotal: number
  freeUsed: number
  paidRemain: number
  paidTotal: number
  paidUsed: number
  challengeStatus: "not_started" | "in_progress" | "completed" | "failed"
  pointName: string
  points: number
  message: string
  isLoadingAI: boolean
}

const BOARD_SIZE = 15
const NO_REGRET_TEXT = "人生如棋，落子无悔。"
const NO_REGRET_DURATION = 4000
const emptyBoard = Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => 0))
const initialGameState: GobangViewState = {
  freeCount: 0,
  freeTotal: 0,
  freeUsed: 0,
  paidRemain: 0,
  paidTotal: 0,
  paidUsed: 0,
  challengeStatus: "not_started",
  pointName: "积分",
  points: 0,
  message: "点击“开始游戏”进行对战",
  isLoadingAI: false,
}

function formatMatchTime(value: string | undefined) {
  if (!value) {
    return "时间未知"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "时间未知"
  }

  return formatBusinessMonthDayTime(date)
}



function resolveWinningLine(board: number[][], winnerId: number | null): Point[] | null {
  if (winnerId === null) return null
  const marker = winnerId === 0 ? 2 : 1
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]] as const
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (board[r]?.[c] !== marker) continue
      for (const [dr, dc] of directions) {
        const line: Point[] = [{ r, c }]
        for (let step = 1; step < 5; step += 1) {
          const nr = r + dr * step
          const nc = c + dc * step
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break
          if (board[nr]?.[nc] !== marker) break
          line.push({ r: nr, c: nc })
        }
        if (line.length >= 5) return line
      }
    }
  }
  return null
}

function ChessBoard({ board, disabled, onDropChess, lastMove, winningLine, showNoRegretOverlay }: { board: number[][]; disabled: boolean; onDropChess: (r: number, c: number) => void; lastMove: Point | null; winningLine: Point[] | null; showNoRegretOverlay: boolean }) {
  const starPoints = useMemo(() => [{ r: 3, c: 3 }, { r: 3, c: 11 }, { r: 11, c: 3 }, { r: 11, c: 11 }, { r: 7, c: 7 }], [])
  return (
    <div className="chessboard-shell">
      <div className="chessboard">
        <div className="board-surface">
          <svg className="board-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {Array.from({ length: BOARD_SIZE }).map((_, index) => {
              const position = (index / (BOARD_SIZE - 1)) * 100
              return (
                <React.Fragment key={`line-${index}`}>
                  <line x1={0} y1={position} x2={100} y2={position} className="board-svg-line" />
                  <line x1={position} y1={0} x2={position} y2={100} className="board-svg-line" />
                </React.Fragment>
              )
            })}
            {starPoints.map((point, index) => <circle key={`star-${index}`} cx={(point.c / (BOARD_SIZE - 1)) * 100} cy={(point.r / (BOARD_SIZE - 1)) * 100} r="1" className="board-svg-star" />)}
          </svg>
          {Array.from({ length: BOARD_SIZE }).map((_, r) => Array.from({ length: BOARD_SIZE }).map((__, c) => {
            const value = board[r]?.[c] ?? 0
            const isWinningPiece = winningLine ? winningLine.some((p) => p.r === r && p.c === c) : false
            const isLastMove = lastMove?.r === r && lastMove?.c === c
            const stoneClass = value === 1 ? "black" : value === 2 ? "white" : ""
            return (
              <button key={`${r}-${c}`} type="button" className="board-point" style={{ top: `${(r / (BOARD_SIZE - 1)) * 100}%`, left: `${(c / (BOARD_SIZE - 1)) * 100}%` }} onClick={() => onDropChess(r, c)} disabled={disabled || value !== 0 || showNoRegretOverlay} aria-label={`在 ${r + 1}, ${c + 1} 落子`}>
                <span className="board-point-hit" />
                {value !== 0 ? <span className={cn("chess-piece", stoneClass, isLastMove && "last-move-dot", isWinningPiece && "winning-piece")} /> : null}
              </button>
            )
          }))}
        </div>
      </div>
      {showNoRegretOverlay ? <div className="no-regret-overlay" aria-hidden="true"><div className="no-regret-text">{NO_REGRET_TEXT}</div></div> : null}
    </div>
  )
}

function GameControls({ gameState, canViewPreviousResult, onStartGame, onViewPreviousResult }: { gameState: GobangViewState; canViewPreviousResult: boolean; onStartGame: () => void; onViewPreviousResult: () => void }) {
  const { freeCount, freeTotal, freeUsed, paidRemain, paidTotal, paidUsed, challengeStatus, pointName, points, message } = gameState
  const shouldShowModal = challengeStatus === "not_started" || challengeStatus === "completed" || challengeStatus === "failed"
  const canShowPreviousResultButton = canViewPreviousResult

  return shouldShowModal ? (
    <div className="gobang-modal-overlay">
      <Card className="gobang-modal-card border-border/70 bg-background/95 shadow-[0_18px_48px_hsl(var(--foreground)/0.16)] backdrop-blur-md">
        <CardHeader className="pb-2 pt-5"><CardTitle className="text-base font-semibold tracking-tight text-foreground">游戏状态</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 pt-0">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-muted p-2 text-sm"><div className="flex items-center justify-between gap-2"><span>免费次数</span><span className={cn(freeCount > 0 ? "text-green-500" : "text-red-500", "font-bold")}>{freeUsed}/{freeTotal}</span></div><p className="mt-1 text-xs text-muted-foreground">剩余 {freeCount} 次</p></div>
            <div className="rounded-md bg-muted p-2 text-sm"><div className="flex items-center justify-between gap-2"><span>付费次数</span><span className={cn(paidRemain > 0 ? "text-green-500" : "text-red-500", "font-bold")}>{paidUsed}/{paidTotal}</span></div><p className="mt-1 text-xs text-muted-foreground">剩余 {paidRemain} 次</p></div>
            <div className="col-span-2 flex items-center justify-between rounded-md bg-muted p-2 text-sm"><span>{pointName}</span><span className="font-bold text-primary">{points}</span></div>
          </div>
          {message ? <div className={cn("rounded-md p-3 font-bold", message.includes("赢") ? "bg-green-100 text-green-700" : message.includes("平局") || message.includes("请") ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700")}>{message}</div> : null}
          {canShowPreviousResultButton ? <button type="button" className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground" onClick={onViewPreviousResult}>查看上一局结果</button> : null}
          <button className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50" onClick={onStartGame} disabled={freeCount <= 0 && paidRemain <= 0}>{challengeStatus === "not_started" ? "开始游戏" : "再来一局"}</button>
        </CardContent>
      </Card>
    </div>
  ) : null
}

function PreviousResultModal({ open, match, message, winningLine, canSelectPrevious, canSelectNext, onClose, onSwitch }: { open: boolean; match: GobangMatch | null; message: string; winningLine: Point[] | null; canSelectPrevious: boolean; canSelectNext: boolean; onClose: () => void; onSwitch: (direction: "prev" | "next") => void }) {
  if (!open) return null

  return (
    <div className="gobang-modal-overlay z-30">
      <Card className="gobang-modal-card w-full max-w-[min(92vw,680px)] border-border/70 bg-background/95 shadow-[0_18px_48px_hsl(var(--foreground)/0.16)] backdrop-blur-md">
        <CardHeader className="pb-2 pt-5">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base font-semibold tracking-tight text-foreground">上一局结果</CardTitle>
            <button type="button" className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground" onClick={onClose}>关闭</button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-0">
          {match ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                <span>{formatMatchTime(match.finishedAt || match.updatedAt || match.moves.at(-1)?.createdAt || match.createdAt)}</span>

                <span>{match.challengeMode === "FREE" ? "免费挑战" : `付费挑战 · ${match.ticketCost} 积分`}</span>
                <span>{match.firstHand === "PLAYER" ? "你先手" : "AI 先手"}</span>
              </div>
              <div className={cn("rounded-md p-3 font-bold", message.includes("你赢") ? "bg-green-100 text-green-700" : message.includes("平局") ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700")}>{message}</div>
              <div className="mx-auto w-full max-w-[360px]">
                <ChessBoard board={match.board} disabled onDropChess={() => undefined} lastMove={match.moves.at(-1) ? { r: match.moves.at(-1)!.y, c: match.moves.at(-1)!.x } : null} winningLine={winningLine} showNoRegretOverlay={false} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <button type="button" className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50" onClick={() => onSwitch("prev")} disabled={!canSelectPrevious}>上一局</button>
                <button type="button" className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50" onClick={() => onSwitch("next")} disabled={!canSelectNext}>下一局</button>
              </div>
            </>
          ) : (
            <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">暂无可查看的历史对局。</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


export function GobangPage({ config, initialMatches, initialSummary }: GobangPageProps) {
  const assetBaseUrl = "/apps/gobang"

  const userMoveAudioUrl = useMemo(() => `${assetBaseUrl}/userxiaqi.mp3`, [assetBaseUrl])
  const aiMoveAudioUrl = useMemo(() => `${assetBaseUrl}/aixiaqi.mp3`, [assetBaseUrl])
  const noRegretAudioUrl = useMemo(() => `${assetBaseUrl}/wuhui.mp3`, [assetBaseUrl])
  const [gameState, setGameState] = useState<GobangViewState>(() => ({
    ...initialGameState,
    freeCount: initialSummary.freeRemaining,
    freeTotal: initialSummary.freeTotal,
    freeUsed: initialSummary.freeUsed,
    paidRemain: initialSummary.paidRemaining,
    paidTotal: initialSummary.paidTotal,
    paidUsed: initialSummary.paidUsed,
    challengeStatus: initialMatches.some((item) => item.status === "ONGOING")
      ? "in_progress"
      : initialMatches[0]?.status === "FINISHED"
        ? (initialMatches[0]?.winnerId === 0 ? "failed" : "completed")
        : "not_started",
    pointName: initialSummary.pointName,
    points: initialSummary.points,
    message: initialMatches.some((item) => item.status === "ONGOING")
      ? ((initialMatches.find((item) => item.status === "ONGOING")?.currentSide === "PLAYER") ? "轮到你落子" : "对局进行中")
      : initialMatches[0]?.status === "FINISHED"
        ? (initialMatches[0]?.winnerId === 0 ? "AI 获胜，再接再厉" : "你赢了，奖励已到账")
        : initialGameState.message,
  }))
  const [matches, setMatches] = useState<GobangMatch[]>(initialMatches)

  const [activeMatchId, setActiveMatchId] = useState<string | null>(null)
  const [rulesCollapsed, setRulesCollapsed] = useState(false)
  const [showNoRegret, setShowNoRegret] = useState(false)
  const [showPreviousResult, setShowPreviousResult] = useState(false)
  const [selectedHistoryMatchId, setSelectedHistoryMatchId] = useState<string | null>(null)
  const [historyFilter] = useState<"all" | "win" | "lose">("all")
  const [isPending, startTransition] = useTransition()

  const userMoveAudioRef = useRef<HTMLAudioElement | null>(null)
  const aiMoveAudioRef = useRef<HTMLAudioElement | null>(null)
  const noRegretAudioRef = useRef<HTMLAudioElement | null>(null)
  const noRegretTimerRef = useRef<number | null>(null)

  const activeMatch = useMemo(() => matches.find((item) => item.id === activeMatchId) ?? matches.find((item) => item.status === "ONGOING") ?? matches[0] ?? null, [activeMatchId, matches])
  const latestMove = activeMatch?.moves.at(-1) ? { r: activeMatch.moves.at(-1)!.y, c: activeMatch.moves.at(-1)!.x } : null
  const winningLine = useMemo(() => activeMatch ? resolveWinningLine(activeMatch.board, activeMatch.winnerId) : null, [activeMatch])
  const historyMatches = useMemo(() => matches
    .filter((item) => item.status === "FINISHED")
    .sort((left, right) => new Date(right.finishedAt || right.updatedAt || right.createdAt).getTime() - new Date(left.finishedAt || left.updatedAt || left.createdAt).getTime()), [matches])
  const filteredHistoryMatches = useMemo(() => historyFilter === "all" ? historyMatches : historyFilter === "win" ? historyMatches.filter((item) => item.winnerId !== 0) : historyMatches.filter((item) => item.winnerId === 0), [historyFilter, historyMatches])
  const selectedHistoryMatch = useMemo(() => filteredHistoryMatches.find((item) => item.id === selectedHistoryMatchId) ?? filteredHistoryMatches[0] ?? null, [filteredHistoryMatches, selectedHistoryMatchId])
  const selectedHistoryWinningLine = useMemo(() => selectedHistoryMatch ? resolveWinningLine(selectedHistoryMatch.board, selectedHistoryMatch.winnerId) : null, [selectedHistoryMatch])
  const selectedHistoryMessage = useMemo(() => !selectedHistoryMatch ? "" : selectedHistoryMatch.winnerId === 0 ? "本局结果：AI 获胜" : selectedHistoryMatch.winnerId === null ? "本局结果：本局平局" : "本局结果：你赢了", [selectedHistoryMatch])
  const selectedHistoryIndex = useMemo(() => selectedHistoryMatch ? historyMatches.findIndex((item) => item.id === selectedHistoryMatch.id) : -1, [historyMatches, selectedHistoryMatch])
  const canSelectPreviousHistory = selectedHistoryIndex > 0
  const canSelectNextHistory = selectedHistoryIndex >= 0 && selectedHistoryIndex < historyMatches.length - 1

  useEffect(() => {
    userMoveAudioRef.current = new Audio(userMoveAudioUrl)
    aiMoveAudioRef.current = new Audio(aiMoveAudioUrl)
    noRegretAudioRef.current = new Audio(noRegretAudioUrl)
    return () => {
      userMoveAudioRef.current = null
      aiMoveAudioRef.current = null
      noRegretAudioRef.current = null
      if (noRegretTimerRef.current !== null) window.clearTimeout(noRegretTimerRef.current)
    }
  }, [aiMoveAudioUrl, noRegretAudioUrl, userMoveAudioUrl])

  const playMoveSound = useCallback((type: "user" | "ai" | "noregret") => {
    const target = type === "user" ? userMoveAudioRef.current : type === "ai" ? aiMoveAudioRef.current : noRegretAudioRef.current
    if (!target) return
    target.currentTime = 0
    void target.play().catch(() => undefined)
  }, [])

  const triggerNoRegretEasterEgg = useCallback(() => {
    if (noRegretTimerRef.current !== null) window.clearTimeout(noRegretTimerRef.current)
    setShowNoRegret(true)
    playMoveSound("noregret")
    noRegretTimerRef.current = window.setTimeout(() => {
      setShowNoRegret(false)
      noRegretTimerRef.current = null
    }, NO_REGRET_DURATION)
  }, [playMoveSound])

  useEffect(() => {
    if (!filteredHistoryMatches.length) {
      setSelectedHistoryMatchId(null)
      return
    }
    setSelectedHistoryMatchId((current) => current && filteredHistoryMatches.some((item) => item.id === current) ? current : filteredHistoryMatches[0]!.id)
  }, [filteredHistoryMatches])

  const currentBoard = activeMatch?.board ?? emptyBoard
  const boardDisabled = showNoRegret || !activeMatch || activeMatch.status === "FINISHED" || activeMatch.currentSide !== "PLAYER" || isPending || gameState.isLoadingAI
  const ruleItems = useMemo(() => {
    const freeGames = Number(config.dailyFreeGames ?? 1)
    const vipFreeGames = Number(config.dailyVipFreeGames ?? 2)
    const normalGameLimit = Number(config.dailyNormalGameLimit ?? 3)
    const vipGameLimit = Number(config.dailyVipGameLimit ?? 5)
    const ticketCost = Number(config.ticketCost ?? 50)
    const winReward = Number(config.winReward ?? 50)
    const paidWinTotal = ticketCost + winReward
    const pointLabel = gameState.pointName || "积分"
    return [
      `普通用户每日免费挑战 ${freeGames} 次，VIP 用户额外增加 ${vipFreeGames} 次免费次数。`,
      `普通用户每日总对局上限 ${normalGameLimit} 次，VIP 用户每日总对局上限 ${vipGameLimit} 次。`,
      `免费次数用完后，每次花费 ${ticketCost} ${pointLabel}；付费挑战胜利返还本金 + 奖金，共 ${paidWinTotal} ${pointLabel}，失败不退${pointLabel}。`,
      `免费挑战胜利获得 ${winReward} ${pointLabel}，玩家 / AI 随机执黑先手，平局判玩家胜，本对弈无禁手规则。`,
    ]
  }, [config.dailyFreeGames, config.dailyVipFreeGames, config.dailyNormalGameLimit, config.dailyVipGameLimit, config.ticketCost, config.winReward, gameState.pointName])

  const syncFromMatches = useCallback((nextMatches: GobangMatch[], summary?: PlayerSummary, message?: string) => {
    const safeMatches = Array.isArray(nextMatches) ? nextMatches : []
    const ongoing = safeMatches.find((item) => item.status === "ONGOING") ?? null
    const latest = ongoing ?? safeMatches[0] ?? null
    setMatches(safeMatches)
    setActiveMatchId(ongoing?.id ?? latest?.id ?? null)
    setGameState((prev: GobangViewState) => ({
      ...prev,
      freeCount: summary?.freeRemaining ?? prev.freeCount,
      freeTotal: summary?.freeTotal ?? prev.freeTotal,
      freeUsed: summary?.freeUsed ?? prev.freeUsed,
      paidRemain: summary?.paidRemaining ?? prev.paidRemain,
      paidTotal: summary?.paidTotal ?? prev.paidTotal,
      paidUsed: summary?.paidUsed ?? prev.paidUsed,
      pointName: summary?.pointName ?? prev.pointName,
      points: summary?.points ?? prev.points,
      challengeStatus: ongoing ? "in_progress" : latest?.status === "FINISHED" ? (latest.winnerId === 0 ? "failed" : "completed") : "not_started",
      message: message ?? (ongoing ? (ongoing.currentSide === "PLAYER" ? "轮到你落子" : "对局进行中") : latest?.status === "FINISHED" ? (latest.winnerId === 0 ? "AI 获胜，再接再厉" : "你赢了，奖励已到账") : prev.message),
      isLoadingAI: false,
    }))
  }, [])

  const refreshMatches = useCallback(async () => {
    const response = await fetch("/api/gobang", { cache: "no-store" })
    const result = await response.json() as ApiResponse<{ matches: GobangMatch[]; summary: PlayerSummary }>
    if (!response.ok || !result.data) {
      setGameState((prev: GobangViewState) => ({ ...prev, message: result.message ?? "加载对局失败" }))
      return
    }
    syncFromMatches(result.data.matches, result.data.summary)
  }, [syncFromMatches])

  useEffect(() => { void refreshMatches() }, [refreshMatches])

  const handleStartGame = useCallback(() => {
    startTransition(async () => {
      const response = await fetch("/api/gobang", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create" }) })
      const result = await response.json() as ApiResponse<CreateMatchResult>
      if (!response.ok || !result.data) {
        await refreshMatches()
        setGameState((prev: GobangViewState) => ({ ...prev, message: result.message ?? "开始游戏失败", isLoadingAI: false }))
        return
      }
      const createdMatch = result.data.matches.find((item) => item.status === "ONGOING") ?? result.data.matches[0] ?? null
      if (createdMatch?.moves.at(-1)?.playerId === 0) playMoveSound("ai")
      syncFromMatches(result.data.matches, { freeRemaining: result.data.policy.remainingFree, freeTotal: gameState.freeTotal, freeUsed: Math.max(0, gameState.freeTotal - result.data.policy.remainingFree), paidRemaining: result.data.policy.remainingPaid, paidTotal: gameState.paidTotal, paidUsed: Math.max(0, gameState.paidTotal - result.data.policy.remainingPaid), pointName: gameState.pointName, points: gameState.points, challengeStatus: "in_progress" }, result.message)
    })
  }, [gameState.freeTotal, gameState.paidTotal, gameState.pointName, gameState.points, playMoveSound, refreshMatches, startTransition, syncFromMatches])

  const handleDropChess = useCallback((r: number, c: number) => {
    if (!activeMatch || boardDisabled) return
    setGameState((prev: GobangViewState) => ({ ...prev, isLoadingAI: false }))
    startTransition(async () => {
      const response = await fetch("/api/gobang", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "move", matchId: activeMatch.id, x: c, y: r }) })
      const result = await response.json() as ApiResponse<{ match: GobangMatch; winnerId: number | null }>
      if (!response.ok || !result.data) {
        setGameState((prev: GobangViewState) => ({ ...prev, message: result.message ?? "落子失败", isLoadingAI: false }))
        return
      }
      const nextMatch = result.data.match
      const nextMatches = matches.map((item) => item.id === activeMatch.id ? nextMatch : item)
      const previousMoveCount = activeMatch.moves.length
      const latestAfterMove = nextMatch.moves.at(-1) ?? null
      const playerMove = nextMatch.moves.find((move) => move.step === previousMoveCount + 1 && move.playerId !== 0) ?? null
      const aiMove = nextMatch.moves.find((move) => move.step === previousMoveCount + 2 && move.playerId === 0) ?? null
      if (playerMove) playMoveSound("user")
      if (aiMove && latestAfterMove?.id === aiMove.id) window.setTimeout(() => playMoveSound("ai"), 400)
      syncFromMatches(nextMatches, { freeRemaining: gameState.freeCount, freeTotal: gameState.freeTotal, freeUsed: gameState.freeUsed, paidRemaining: gameState.paidRemain, paidTotal: gameState.paidTotal, paidUsed: gameState.paidUsed, pointName: gameState.pointName, points: gameState.points, challengeStatus: "in_progress" }, result.message)
    })
  }, [activeMatch, boardDisabled, gameState.freeCount, gameState.freeTotal, gameState.freeUsed, gameState.paidRemain, gameState.paidTotal, gameState.paidUsed, gameState.pointName, gameState.points, matches, playMoveSound, startTransition, syncFromMatches])

  const handleSwitchHistory = useCallback((direction: "prev" | "next") => {
    if (!historyMatches.length || selectedHistoryIndex < 0) return
    const targetIndex = direction === "prev" ? selectedHistoryIndex - 1 : selectedHistoryIndex + 1
    const targetMatch = historyMatches[targetIndex]
    if (!targetMatch) return
    setSelectedHistoryMatchId(targetMatch.id)
  }, [historyMatches, selectedHistoryIndex])

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 pt-2 pb-6">
      <div className="gobang-layout">
        <div className="gobang-rules">
          <div className="gobang-rules-header"><p className="gobang-rules-title">规则说明</p><button type="button" className="gobang-rules-toggle" onClick={() => setRulesCollapsed((value) => !value)} aria-expanded={!rulesCollapsed}>{rulesCollapsed ? "展开" : "收起"}</button></div>
          {!rulesCollapsed ? <div className="gobang-rules-list">{ruleItems.map((rule) => <p key={rule} className="gobang-rule-item">{rule}</p>)}</div> : null}
        </div>
        <div className="gobang-stage rounded-[28px] bg-gradient-to-br from-card via-card to-secondary/20 shadow-[0_18px_48px_hsl(var(--foreground)/0.08)] backdrop-blur-sm md:p-4">
          <ChessBoard board={currentBoard} disabled={boardDisabled} onDropChess={handleDropChess} lastMove={latestMove} winningLine={winningLine} showNoRegretOverlay={showNoRegret} />
          <div className="gobang-actions mt-3 flex items-center justify-center"><button type="button" className="gobang-easter-egg-button" onClick={triggerNoRegretEasterEgg}>悔棋</button></div>
          <GameControls gameState={gameState} canViewPreviousResult={historyMatches.length > 0} onStartGame={handleStartGame} onViewPreviousResult={() => setShowPreviousResult(true)} />
          <PreviousResultModal open={showPreviousResult} match={selectedHistoryMatch} message={selectedHistoryMessage} winningLine={selectedHistoryWinningLine} canSelectPrevious={canSelectPreviousHistory} canSelectNext={canSelectNextHistory} onClose={() => setShowPreviousResult(false)} onSwitch={handleSwitchHistory} />
        </div>
      </div>
    </div>
  )
}

