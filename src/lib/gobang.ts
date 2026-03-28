import { randomUUID } from "node:crypto"

export { GobangPage } from "@/components/gobang-page"
export { GobangAdminPage } from "@/components/gobang-admin-page"

import { prisma } from "@/db/client"

import { countGobangMatchesInRange, createGobangMatchRecord, finishGobangMatch, finishGobangMatchNow, getGobangMatchRow, getGobangMoves, insertGobangMove, insertGobangMoveNow, listGobangMatchRows, listGobangMovesByMatchIds, type GobangMatchRow, type GobangMoveRow, updateGobangMatchTimestamp } from "@/db/gobang-queries"


import { getGobangAppConfig } from "@/lib/app-config"
import { getBusinessDayRange } from "@/lib/formatters"
import { getSiteSettings } from "@/lib/site-settings"
import { isVipActive } from "@/lib/vip-status"
import { createPointLog, decrementUserPoints } from "@/db/point-log-queries"



const BOARD_SIZE = 15
const PLAYER_MARKER = 1
const AI_MARKER = 2
const AI_PLAYER_ID = 0
const DEFAULT_DAILY_FREE_GAMES = 1
const DEFAULT_DAILY_VIP_FREE_GAMES = 2
const DEFAULT_DAILY_NORMAL_GAME_LIMIT = 3
const DEFAULT_DAILY_VIP_GAME_LIMIT = 5
const DEFAULT_TICKET_COST = 50
const DEFAULT_WIN_REWARD = 50
const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const

type GobangStatus = "ONGOING" | "FINISHED"
export type ChallengeMode = "FREE" | "PAID"
export type FirstHand = "PLAYER" | "AI"

export type GobangMatch = {
  id: string
  creatorId: number
  status: GobangStatus
  winnerId: number | null
  ticketCost: number
  winReward: number
  challengeMode: ChallengeMode
  firstHand: FirstHand
  currentSide: FirstHand | null
  createdAt: string
  updatedAt: string
  finishedAt: string
  board: number[][]
  moves: Array<{ id: string; playerId: number; step: number; x: number; y: number; createdAt: string }>
}


export type GobangPlayerSummary = {
  pointName: string
  points: number
  freeTotal: number
  freeUsed: number
  freeRemaining: number
  paidTotal: number
  paidUsed: number
  paidRemaining: number
  challengeStatus: "not_started" | "in_progress"
}

type CurrentUser = {
  id: number
  points?: number | null
  vipLevel?: number | null
  vipExpiresAt?: Date | null
}

function normalizePluginNumber(value: boolean | number | string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function buildBoard(moves: GobangMoveRow[]) {
  const board = Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => 0))
  moves.forEach((move) => {
    const marker = move.playerId === AI_PLAYER_ID ? AI_MARKER : PLAYER_MARKER
    if (move.y >= 0 && move.y < BOARD_SIZE && move.x >= 0 && move.x < BOARD_SIZE) {
      board[move.y][move.x] = marker
    }
  })
  return board
}

function countDirection(board: number[][], x: number, y: number, dx: number, dy: number, marker: number) {
  let total = 0
  let cursorX = x + dx
  let cursorY = y + dy

  while (cursorX >= 0 && cursorX < BOARD_SIZE && cursorY >= 0 && cursorY < BOARD_SIZE && board[cursorY][cursorX] === marker) {
    total += 1
    cursorX += dx
    cursorY += dy
  }

  return total
}

function countOpenEnds(board: number[][], x: number, y: number, dx: number, dy: number, marker: number) {
  let openEnds = 0

  const forward = countDirection(board, x, y, dx, dy, marker)
  const backward = countDirection(board, x, y, -dx, -dy, marker)

  const nextForwardX = x + (forward + 1) * dx
  const nextForwardY = y + (forward + 1) * dy
  if (nextForwardX >= 0 && nextForwardX < BOARD_SIZE && nextForwardY >= 0 && nextForwardY < BOARD_SIZE && board[nextForwardY][nextForwardX] === 0) {
    openEnds += 1
  }

  const nextBackwardX = x - (backward + 1) * dx
  const nextBackwardY = y - (backward + 1) * dy
  if (nextBackwardX >= 0 && nextBackwardX < BOARD_SIZE && nextBackwardY >= 0 && nextBackwardY < BOARD_SIZE && board[nextBackwardY][nextBackwardX] === 0) {
    openEnds += 1
  }

  return openEnds
}

function evaluatePattern(board: number[][], x: number, y: number, marker: number) {
  let score = 0

  DIRECTIONS.forEach(([dx, dy]) => {
    const line = 1 + countDirection(board, x, y, dx, dy, marker) + countDirection(board, x, y, -dx, -dy, marker)
    const openEnds = countOpenEnds(board, x, y, dx, dy, marker)

    if (line >= 5) {
      score += 100000
      return
    }

    if (line === 4 && openEnds >= 1) {
      score += 12000
      return
    }

    if (line === 3 && openEnds === 2) {
      score += 4000
      return
    }

    if (line === 3 && openEnds === 1) {
      score += 1200
      return
    }

    if (line === 2 && openEnds === 2) {
      score += 500
      return
    }

    score += line * line * 10
  })

  return score
}

function isWinningMove(board: number[][], x: number, y: number, marker: number) {
  return DIRECTIONS.some(([dx, dy]) => {
    const total = 1 + countDirection(board, x, y, dx, dy, marker) + countDirection(board, x, y, -dx, -dy, marker)
    return total >= 5
  })
}

function scoreCell(board: number[][], x: number, y: number, aiLevel: number) {
  if (board[y][x] !== 0) {
    return -1
  }

  board[y][x] = AI_MARKER
  const aiPatternScore = evaluatePattern(board, x, y, AI_MARKER)
  const aiWinning = isWinningMove(board, x, y, AI_MARKER)
  board[y][x] = PLAYER_MARKER
  const playerPatternScore = evaluatePattern(board, x, y, PLAYER_MARKER)
  const mustBlock = isWinningMove(board, x, y, PLAYER_MARKER)
  board[y][x] = 0

  const centerBias = BOARD_SIZE - (Math.abs(7 - x) + Math.abs(7 - y))
  const difficultyMultiplier = aiLevel === 1 ? 0.75 : aiLevel === 2 ? 1 : 1.25

  if (aiWinning) {
    return 1_000_000 + centerBias
  }

  if (mustBlock) {
    return 900_000 + centerBias
  }

  return Math.round((aiPatternScore * 1.2 + playerPatternScore * (aiLevel >= 2 ? 1.1 : 0.8) + centerBias * difficultyMultiplier) * 10)
}

function chooseAiMove(board: number[][], aiLevel: number) {
  let best = { x: 7, y: 7, score: -1 }

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const score = scoreCell(board, x, y, aiLevel)
      if (score > best.score) {
        best = { x, y, score }
      }
    }
  }

  return { x: best.x, y: best.y }
}

function resolveFirstHandFromMoves(moves: GobangMoveRow[]): FirstHand {
  const firstMove = moves[0]
  return firstMove?.playerId === AI_PLAYER_ID ? "AI" : "PLAYER"
}

function resolveChallengeMode(match: GobangMatchRow): ChallengeMode {
  return match.ticketCost > 0 ? "PAID" : "FREE"
}

function mapMatch(match: GobangMatchRow, moves: GobangMoveRow[]): GobangMatch {
  const challengeMode = resolveChallengeMode(match)
  const firstHand = resolveFirstHandFromMoves(moves)
  const currentSide: FirstHand | null = match.status === "FINISHED"
    ? null
    : firstHand === "PLAYER"
      ? (moves.length % 2 === 0 ? "PLAYER" : "AI")
      : (moves.length % 2 === 0 ? "AI" : "PLAYER")

  return {

    id: match.id,
    creatorId: match.creatorId,
    status: match.status,
    winnerId: match.winnerId,
    ticketCost: match.ticketCost,
    winReward: match.winReward,
    challengeMode,
    firstHand,
    createdAt: match.createdAt.toISOString(),
    updatedAt: match.updatedAt.toISOString(),
    finishedAt: match.finishedAt ? match.finishedAt.toISOString() : "",
    currentSide,

    moves: moves.map((move) => ({
      id: move.id,
      playerId: move.playerId,
      step: move.step,
      x: move.x,
      y: move.y,
      createdAt: move.createdAt.toISOString(),
    })),
    board: buildBoard(moves),
  }
}

async function getGobangPluginConfig() {
  const config = await getGobangAppConfig()

  return {
    aiLevel: normalizePluginNumber(config.aiLevel, 2),
    matchLabel: String(config.matchLabel ?? "五子棋人机对战"),
    dailyFreeGames: normalizePluginNumber(config.dailyFreeGames, DEFAULT_DAILY_FREE_GAMES),
    dailyVipFreeGames: normalizePluginNumber(config.dailyVipFreeGames, DEFAULT_DAILY_VIP_FREE_GAMES),
    dailyNormalGameLimit: normalizePluginNumber(config.dailyNormalGameLimit, DEFAULT_DAILY_NORMAL_GAME_LIMIT),
    dailyVipGameLimit: normalizePluginNumber(config.dailyVipGameLimit, DEFAULT_DAILY_VIP_GAME_LIMIT),
    ticketCost: normalizePluginNumber(config.ticketCost, DEFAULT_TICKET_COST),
    winReward: normalizePluginNumber(config.winReward, DEFAULT_WIN_REWARD),
  }
}

async function countTodayMatches(userId: number) {
  const { start, end } = getBusinessDayRange()
  return countGobangMatchesInRange(userId, start, end)
}


function resolveChallengePolicy(
  user: CurrentUser,
  todayCounts: { total: number; paid: number },
  config: {
    dailyFreeGames: number
    dailyVipFreeGames: number
    dailyNormalGameLimit: number
    dailyVipGameLimit: number
    ticketCost: number
    winReward: number
  },
) {
  const isVip = (user.vipLevel ?? 0) > 0
  const freeLimit = config.dailyFreeGames + (isVip ? config.dailyVipFreeGames : 0)
  const totalLimit = isVip ? config.dailyVipGameLimit : config.dailyNormalGameLimit
  const remainingTotal = Math.max(0, totalLimit - todayCounts.total)
  const remainingFree = Math.max(0, Math.min(freeLimit - todayCounts.total, remainingTotal))
  const remainingPaid = Math.max(0, remainingTotal - remainingFree)

  if (remainingFree > 0) {
    return {
      mode: "FREE" as ChallengeMode,
      ticketCost: 0,
      winReward: config.winReward,
      remainingFree,
      remainingPaid,
    }
  }

  if (remainingPaid > 0) {
    return {
      mode: "PAID" as ChallengeMode,
      ticketCost: config.ticketCost,
      winReward: config.ticketCost + config.winReward,
      remainingFree,
      remainingPaid,
    }
  }

  throw new Error("今日挑战次数已用完")
}

export async function getGobangPlayerSummary(user: CurrentUser): Promise<GobangPlayerSummary> {

  const [config, todayCounts, settings] = await Promise.all([
    getGobangPluginConfig(),
    countTodayMatches(user.id),
    getSiteSettings(),
  ])

  const isVip = isVipActive(user)

  const freeTotal = config.dailyFreeGames + (isVip ? config.dailyVipFreeGames : 0)
  const totalLimit = isVip ? config.dailyVipGameLimit : config.dailyNormalGameLimit
  const paidTotal = Math.max(0, totalLimit - freeTotal)
  const policy = resolveChallengePolicy(user, todayCounts, config)

  return {
    pointName: settings.pointName,
    points: user.points ?? 0,

    freeTotal,
    freeUsed: Math.min(todayCounts.total, freeTotal),
    freeRemaining: policy.remainingFree,
    paidTotal,
    paidUsed: Math.min(todayCounts.paid, paidTotal),
    paidRemaining: policy.remainingPaid,
    challengeStatus: todayCounts.total > 0 ? "in_progress" : "not_started",
  }
}

async function creditUserPoints(userId: number, amount: number, reason: string) {
  if (amount <= 0) {
    return
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      points: {
        increment: amount,
      },
    },
  })

  await prisma.pointLog.create({
    data: {
      userId,
      changeType: "INCREASE",
      changeValue: amount,
      reason,
    },
  })
}

export async function createGobangMatch(user: CurrentUser) {
  const config = await getGobangPluginConfig()
  const todayCounts = await countTodayMatches(user.id)
  const policy = resolveChallengePolicy(user, todayCounts, config)

  if (policy.ticketCost > 0) {
    await decrementUserPoints(user.id, policy.ticketCost)

    await createPointLog({
      userId: user.id,
      changeType: "DECREASE",
      changeValue: policy.ticketCost,
      reason: "[app:五子棋] 付费挑战扣除门票",
    })

  }

  const id = randomUUID()
  const playerFirst = Math.random() >= 0.5

  await createGobangMatchRecord({
    id,
    creatorId: user.id,
    ticketCost: policy.ticketCost,
    winReward: policy.winReward,
  })

  if (!playerFirst) {
    const center = chooseAiMove(Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => 0)), config.aiLevel)
    await insertGobangMoveNow({
      id: randomUUID(),
      matchId: id,
      playerId: AI_PLAYER_ID,
      step: 1,
      x: center.x,
      y: center.y,
    })
  }


  return {
    matches: await listGobangMatches(user.id),
    policy,
  }
}

export async function listGobangMatches(userId: number): Promise<GobangMatch[]> {
  const matches = await listGobangMatchRows(userId)
  if (matches.length === 0) {
    return []
  }


  const moves = await listGobangMovesByMatchIds(matches.map((match) => match.id))
  const moveMap = new Map<string, GobangMoveRow[]>()

  moves.forEach((move) => {
    const current = moveMap.get(move.matchId) ?? []
    current.push(move)
    moveMap.set(move.matchId, current)
  })

  return matches.map((match) => mapMatch(match, moveMap.get(match.id) ?? []))
}

export async function getGobangMatch(matchId: string) {
  const [match, moves] = await Promise.all([
    getGobangMatchRow(matchId),
    getGobangMoves(matchId),
  ])

  if (!match) {
    throw new Error("对局不存在")
  }

  return mapMatch(match, moves)

}

export async function makeGobangMove(input: { matchId: string; user: CurrentUser; x: number; y: number }) {
  if (input.x < 0 || input.x >= BOARD_SIZE || input.y < 0 || input.y >= BOARD_SIZE) {
    throw new Error("落子坐标超出棋盘范围")
  }

  const config = await getGobangPluginConfig()
  const [match, moves] = await Promise.all([
    getGobangMatchRow(input.matchId),
    getGobangMoves(input.matchId),
  ])

  if (!match) {
    throw new Error("对局不存在")
  }

  if (match.creatorId !== input.user.id) {
    throw new Error("这不是你的对局")
  }

  if (match.status === "FINISHED") {
    throw new Error("对局已结束")
  }

  const duplicated = moves.some((move) => move.x === input.x && move.y === input.y)
  if (duplicated) {
    throw new Error("该位置已经有棋子")
  }

  const firstHand = resolveFirstHandFromMoves(moves)
  const playerTurn = firstHand === "PLAYER"
    ? moves.length % 2 === 0
    : moves.length % 2 !== 0

  if (!playerTurn) {
    throw new Error("当前轮到 AI 落子")
  }

  const board = buildBoard(moves)
  board[input.y][input.x] = PLAYER_MARKER

  await insertGobangMoveNow({
    id: randomUUID(),
    matchId: input.matchId,
    playerId: input.user.id,
    step: moves.length + 1,
    x: input.x,
    y: input.y,
  })


  const challengeMode = resolveChallengeMode(match)

  if (isWinningMove(board, input.x, input.y, PLAYER_MARKER)) {
    await finishGobangMatchNow({
      matchId: input.matchId,
      winnerId: input.user.id,
      updatedAt: new Date(),
    })



    if (challengeMode === "FREE") {
      await creditUserPoints(input.user.id, config.winReward, "[app:五子棋] 免费挑战获胜奖励")
    } else {
      await creditUserPoints(input.user.id, config.ticketCost + config.winReward, "[app:五子棋] 付费挑战胜利返本含奖金")
    }

    return {
      match: await getGobangMatch(input.matchId),
      winnerId: input.user.id,
    }
  }

  const aiMove = chooseAiMove(board, config.aiLevel)
  board[aiMove.y][aiMove.x] = AI_MARKER

  const aiMoveTime = new Date()

  await insertGobangMove({
    id: randomUUID(),
    matchId: input.matchId,
    playerId: AI_PLAYER_ID,
    step: moves.length + 2,
    x: aiMove.x,
    y: aiMove.y,
    createdAt: aiMoveTime,
  })

  let winnerId: number | null = null
  const filledCells = board.flat().filter((cell) => cell !== 0).length

  if (isWinningMove(board, aiMove.x, aiMove.y, AI_MARKER)) {
    winnerId = AI_PLAYER_ID
    await finishGobangMatch({
      matchId: input.matchId,
      winnerId: AI_PLAYER_ID,
      updatedAt: new Date(),
    })
  } else if (filledCells >= BOARD_SIZE * BOARD_SIZE) {
    winnerId = input.user.id
    await finishGobangMatch({
      matchId: input.matchId,
      winnerId: input.user.id,
      updatedAt: new Date(),
    })

    if (challengeMode === "FREE") {
      await creditUserPoints(input.user.id, config.winReward, "[app:五子棋] 免费挑战平局按玩家胜奖励")
    } else {
      await creditUserPoints(input.user.id, config.ticketCost + config.winReward, "[app:五子棋] 付费挑战平局按玩家胜返本与奖励")
    }
  } else {
    await updateGobangMatchTimestamp(input.matchId, new Date())
  }

  return {
    match: await getGobangMatch(input.matchId),
    winnerId,
  }
}
