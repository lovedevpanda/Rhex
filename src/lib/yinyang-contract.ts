import BigNumber from "bignumber.js"

import type { Prisma } from "@prisma/client"

export { YinYangContractPage } from "@/components/yinyang-contract-page"

export { YinYangContractAdminPage } from "@/components/admin/yinyang-contract-admin-page"
import { createSystemNotification } from "@/lib/notification-writes"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import {
  countUserAcceptedChallengesInRange,
  countUserCreatedChallengesInRange,
  createYinYangChallengeAttempt,
  createYinYangChallengeRecord,
  findYinYangUserPointSnapshot,
  getYinYangUserSummaryStats,
  listOpenYinYangChallenges,
  listRecentYinYangChallengesByUser,
  getTopKingByDateKey,
  listTopTodayKings,
  listTopYinYangEarners,
  listTopYinYangWinners,

  lockOpenChallenge,
  runYinYangTransaction,
  settleChallengeRecord,
  type YinYangChallengeDetailRow,
} from "@/db/yinyang-contract-queries"
import { getBusinessDayRange } from "@/lib/formatters"
import { getSiteSettings } from "@/lib/site-settings"
import { getYinYangContractAppConfig } from "@/lib/app-config"
import { enforceSensitiveText } from "@/lib/content-safety"
import { PublicRouteError } from "@/lib/public-route-error"
import { parsePositiveSafeInteger } from "@/lib/shared/safe-integer"
import { getUserDisplayName } from "@/lib/user-display"
import { formatYinYangChallengeTime, type YinYangChallengeCard, type YinYangLeaderboardUser, type YinYangLobbyData, type YinYangMyStats, type YinYangOption, type YinYangChallengeStatus } from "@/lib/yinyang-contract-shared"


type CurrentUser = {
  id: number
  username: string
  nickname?: string | null
  points?: number | null
}

type CreateChallengeInput = {
  question: string
  optionA: string
  optionB: string
  correctOption: YinYangOption
  stakePoints: number
}

type AcceptChallengeInput = {
  challengeId: string
  selectedOption: YinYangOption
}

type AppConfig = Awaited<ReturnType<typeof getYinYangContractAppConfig>>



function createUuid() {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }

  return `yyq-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

function businessRuleError(message: string, statusCode = 400): never {
  throw new PublicRouteError(message, statusCode)
}

function normalizeTrimmedText(value: string, label: string, maxLength: number) {


  const normalized = value.trim()
  if (!normalized) {
    businessRuleError(`${label}不能为空`)
  }
  if (normalized.length > maxLength) {
    businessRuleError(`${label}不能超过${maxLength}个字符`)
  }

  return normalized
}

function toSafePositiveInteger(value: unknown, label: string) {
  const parsed = parsePositiveSafeInteger(value)
  if (parsed === null) {
    businessRuleError(`${label}必须为正整数`)
  }

  return parsed
}


function calculateRewardPoints(stakePoints: number, taxRateBps: number) {
  const stake = new BigNumber(stakePoints)
  const bps = new BigNumber(taxRateBps)
  const taxPoints = stake.multipliedBy(bps).dividedToIntegerBy(10_000)
  const rewardPoints = stake.minus(taxPoints)
  if (!taxPoints.isInteger() || !rewardPoints.isInteger()) {
    businessRuleError("奖励计算失败")
  }

  const reward = rewardPoints.toNumber()
  const tax = taxPoints.toNumber()
  if (reward <= 0) {
    businessRuleError("奖励积分必须大于0")
  }

  return { rewardPoints: reward, taxPoints: tax }
}

function mapChallengeRow(row: YinYangChallengeDetailRow): YinYangChallengeCard {
  return {
    id: row.id,
    creatorId: row.creatorId,
    creatorName: getUserDisplayName(row.creator),
    challengerId: row.challengerId,
    challengerName: row.challenger ? getUserDisplayName(row.challenger) : null,
    status: row.status,
    question: row.question,
    optionA: row.optionA,
    optionB: row.optionB,
    correctOption: row.status === "SETTLED" ? row.correctOption : null,
    selectedOption: row.attempt?.selectedOption ?? null,
    isCorrect: row.attempt?.isCorrect ?? null,
    stakePoints: row.stakePoints,
    rewardPoints: row.rewardPoints,
    taxPoints: row.taxPoints,
    winnerId: row.winnerId,
    loserId: row.loserId,
    createdAt: row.createdAt.toISOString(),
    settledAt: row.settledAt ? row.settledAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
  }
}

async function getConfigAndSettings() {
  const [config, settings] = await Promise.all([
    getYinYangContractAppConfig(),
    getSiteSettings(),
  ])
  return {
    config,
    settings,
    pointName: settings.pointName,
  }
}

async function acquireYinYangTransactionLock(tx: Prisma.TransactionClient, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
}

async function ensureCreateAllowance(userId: number, config: AppConfig, tx?: Prisma.TransactionClient) {
  const { start, end } = getBusinessDayRange()
  const createdToday = tx
    ? await tx.yinYangChallenge.count({
        where: {
          creatorId: userId,
          createdAt: { gte: start, lt: end },
        },
      })
    : await countUserCreatedChallengesInRange(userId, start, end)
  if (createdToday >= Number(config.dailyCreateLimit ?? 5)) {
    businessRuleError("今日发起挑战次数已达上限")
  }

  return createdToday
}

async function ensureAcceptAllowance(userId: number, config: AppConfig, tx?: Prisma.TransactionClient) {
  const { start, end } = getBusinessDayRange()
  const acceptedToday = tx
    ? await tx.yinYangChallengeAttempt.count({
        where: {
          challengerId: userId,
          createdAt: { gte: start, lt: end },
        },
      })
    : await countUserAcceptedChallengesInRange(userId, start, end)
  if (acceptedToday >= Number(config.dailyAcceptLimit ?? 10)) {
    businessRuleError("今日应战次数已达上限")
  }

  return acceptedToday
}

async function bumpDailyStats(
  tx: Prisma.TransactionClient,
  patches: Array<{ userId: number; winCount?: number; loseCount?: number; todayProfitPoints?: number; todayLossPoints?: number }>,
) {
  const { dayKey: dateKey } = getBusinessDayRange()

  for (const patch of [...patches].sort((left, right) => left.userId - right.userId)) {
    await tx.yinYangChallengeDailyStat.upsert({
      where: {
        userId_dateKey: {
          userId: patch.userId,
          dateKey,
        },
      },
      create: {
        userId: patch.userId,
        dateKey,
        winCount: patch.winCount ?? 0,
        loseCount: patch.loseCount ?? 0,
        todayProfitPoints: patch.todayProfitPoints ?? 0,
        todayLossPoints: patch.todayLossPoints ?? 0,
      },
      update: {
        winCount: { increment: patch.winCount ?? 0 },
        loseCount: { increment: patch.loseCount ?? 0 },
        todayProfitPoints: { increment: patch.todayProfitPoints ?? 0 },
        todayLossPoints: { increment: patch.todayLossPoints ?? 0 },
      },
    })
  }
}

async function buildSummary(user: CurrentUser): Promise<YinYangMyStats> {
  const todayRange = getBusinessDayRange()
  const [{ pointName, config }, createdToday, acceptedToday, summaryStats] = await Promise.all([
    getConfigAndSettings(),
    countUserCreatedChallengesInRange(user.id, todayRange.start, todayRange.end),
    countUserAcceptedChallengesInRange(user.id, todayRange.start, todayRange.end),
    getYinYangUserSummaryStats(user.id, todayRange.dayKey),
  ])

  return {
    userId: user.id,
    pointName,
    points: user.points ?? 0,
    winCount: summaryStats.winCount,
    loseCount: summaryStats.loseCount,

    todayProfitPoints: summaryStats.todayProfitPoints,
    todayLossPoints: summaryStats.todayLossPoints,
    totalProfitPoints: summaryStats.totalProfitPoints,
    totalLossPoints: summaryStats.totalLossPoints,
    dailyCreateLimit: Number(config.dailyCreateLimit ?? 5),
    dailyAcceptLimit: Number(config.dailyAcceptLimit ?? 10),
    createdToday,
    acceptedToday,
  }
}

async function buildLeaderboards() {
  const todayRange = getBusinessDayRange()
  const yesterdayRange = getBusinessDayRange(new Date(todayRange.start.getTime() - 24 * 60 * 60 * 1000))

  const [winnerRows, earnerRows, todayKings, previousKing] = await Promise.all([
    listTopYinYangWinners(todayRange.dayKey, 10),
    listTopYinYangEarners(todayRange.dayKey, 10),
    listTopTodayKings(todayRange.dayKey, 1),
    getTopKingByDateKey(yesterdayRange.dayKey),
  ])

  const kingUserId = todayKings[0]?.userId ?? null


  const normalize = (row: { userId: number; nickname: string | null; username: string; winCount: number; loseCount: number; todayProfitPoints: number; todayLossPoints: number; totalProfitPoints: number; totalLossPoints: number }) => ({
    userId: row.userId,
    userName: getUserDisplayName(row),
    winCount: row.winCount,
    loseCount: row.loseCount,
    todayProfitPoints: row.todayProfitPoints,
    todayLossPoints: row.todayLossPoints,
    totalProfitPoints: row.totalProfitPoints,
    totalLossPoints: row.totalLossPoints,
    winRate: row.winCount + row.loseCount > 0 ? Number((row.winCount / (row.winCount + row.loseCount)).toFixed(4)) : 0,
    badge: row.userId === kingUserId && row.todayProfitPoints > 0 ? "阴阳王" : null,
  } satisfies YinYangLeaderboardUser)

  return {
    winnerLeaderboard: winnerRows.map(normalize),
    earnerLeaderboard: earnerRows.map(normalize),
    previousKing: previousKing ? getUserDisplayName(previousKing.user) : null,
    currentKing: todayKings[0] ? getUserDisplayName(todayKings[0].user) : null,
  }
}


export async function getYinYangLobbyData(user: CurrentUser | null): Promise<YinYangLobbyData> {
  const [{ config, pointName }, openRows, summary, recentRows, leaderboards] = await Promise.all([
    getConfigAndSettings(),
    listOpenYinYangChallenges(20),
    user ? buildSummary(user) : Promise.resolve({
      userId: null,
      pointName: "积分",
      points: 0,
      winCount: 0,

      loseCount: 0,
      todayProfitPoints: 0,
      todayLossPoints: 0,
      totalProfitPoints: 0,
      totalLossPoints: 0,
      dailyCreateLimit: 0,
      dailyAcceptLimit: 0,
      createdToday: 0,
      acceptedToday: 0,
    }),
    user ? listRecentYinYangChallengesByUser(user.id, 20) : Promise.resolve([]),
    buildLeaderboards(),
  ])

  return {
    summary: user ? summary : {
      ...summary,
      pointName,
      dailyCreateLimit: Number(config.dailyCreateLimit ?? 5),
      dailyAcceptLimit: Number(config.dailyAcceptLimit ?? 10),
    },
    openChallenges: openRows.map(mapChallengeRow),
    recentChallenges: recentRows.map(mapChallengeRow),
    winnerLeaderboard: leaderboards.winnerLeaderboard,
    earnerLeaderboard: leaderboards.earnerLeaderboard,
    kings: {
      previousKing: leaderboards.previousKing,
      currentKing: leaderboards.currentKing,
    },
    config: {

      entryLabel: String(config.entryLabel ?? "阴阳契"),
      pointName,
      minStakePoints: Number(config.minStakePoints ?? 10),
      maxStakePoints: Number(config.maxStakePoints ?? 500),
      taxRateBps: Number(config.taxRateBps ?? 1000),
      dailyCreateLimit: Number(config.dailyCreateLimit ?? 5),
      dailyAcceptLimit: Number(config.dailyAcceptLimit ?? 10),
    },
  }
}

export async function createYinYangChallenge(user: CurrentUser, input: CreateChallengeInput) {
  const { config, pointName } = await getConfigAndSettings()
  if (!Boolean(config.enabled)) {
    businessRuleError("阴阳契应用暂未开启")
  }

  const question = normalizeTrimmedText(input.question, "问题", 120)
  const optionA = normalizeTrimmedText(input.optionA, "答案A", 40)
  const optionB = normalizeTrimmedText(input.optionB, "答案B", 40)
  const [questionSafety, optionASafety, optionBSafety] = await Promise.all([
    enforceSensitiveText({ scene: "yinyang.question", text: question }),
    enforceSensitiveText({ scene: "yinyang.answer", text: optionA }),
    enforceSensitiveText({ scene: "yinyang.answer", text: optionB }),
  ])
  const sanitizedQuestion = questionSafety.sanitizedText
  const sanitizedOptionA = optionASafety.sanitizedText
  const sanitizedOptionB = optionBSafety.sanitizedText
  if (sanitizedOptionA === sanitizedOptionB) {
    businessRuleError("两个答案不能相同")
  }

  if (input.correctOption !== "A" && input.correctOption !== "B") {
    businessRuleError("正确答案不合法")
  }

  const stakePoints = toSafePositiveInteger(input.stakePoints, "积分彩头")
  const minStakePoints = Number(config.minStakePoints ?? 10)
  const maxStakePoints = Number(config.maxStakePoints ?? 500)
  if (stakePoints < minStakePoints || stakePoints > maxStakePoints) {
    businessRuleError(`积分彩头必须在${minStakePoints}-${maxStakePoints}之间`)
  }

  const { rewardPoints, taxPoints } = calculateRewardPoints(stakePoints, Number(config.taxRateBps ?? 1000))
  const challengeId = createUuid()
  const preparedStakeDelta = await prepareScopedPointDelta({
    scopeKey: "YINYANG_STAKE_OUTGOING",
    baseDelta: -stakePoints,
    userId: user.id,
  })

  await runYinYangTransaction(async (tx) => {
    // Serialize daily quota evaluation and the escrow debit for one creator.
    await acquireYinYangTransactionLock(tx, `yinyang:user:${user.id}`)
    await ensureCreateAllowance(user.id, config, tx)

    const latestUser = await findYinYangUserPointSnapshot(user.id, tx)
    if (!latestUser) {
      businessRuleError("用户不存在")
    }

    await createYinYangChallengeRecord({
      tx,
      id: challengeId,
      creatorId: user.id,
      status: "OPEN",
      question: sanitizedQuestion,
      optionA: sanitizedOptionA,
      optionB: sanitizedOptionB,
      correctOption: input.correctOption,
      stakePoints,
      rewardPoints,
      taxRateBps: Number(config.taxRateBps ?? 1000),
      taxPoints,
    })

    await applyPointDelta({
      tx,
      userId: user.id,
      beforeBalance: latestUser.points,
      prepared: preparedStakeDelta,
      pointName,
      insufficientMessage: "积分不足，无法发起挑战",
      reason: "[app:阴阳契] 发起挑战扣除托管本金",
      relatedType: "YINYANG_CHALLENGE",
      relatedId: challengeId,
    })
  })

  return getYinYangLobbyData(user)
}

export async function acceptYinYangChallenge(user: CurrentUser, input: AcceptChallengeInput) {
  const { config, pointName: rewardPointName } = await getConfigAndSettings()
  if (!Boolean(config.enabled)) {
    businessRuleError("阴阳契应用暂未开启")
  }

  const settlement = await runYinYangTransaction(async (tx) => {
    // Lock users before challenges so quota checks and concurrent accepts remain serialized.
    await acquireYinYangTransactionLock(tx, `yinyang:user:${user.id}`)
    await acquireYinYangTransactionLock(tx, `yinyang:challenge:${input.challengeId}`)

    const challenge = await tx.yinYangChallenge.findUnique({
      where: { id: input.challengeId },
      select: {
        id: true,
        creatorId: true,
        status: true,
        question: true,
        correctOption: true,
        stakePoints: true,
        rewardPoints: true,
        taxPoints: true,
      },
    })
    if (!challenge) {
      businessRuleError("挑战不存在")
    }
    if (challenge.creatorId === user.id) {
      businessRuleError("不能应战自己的挑战")
    }
    if (challenge.status !== "OPEN") {
      businessRuleError("该挑战已不可应战")
    }

    await ensureAcceptAllowance(user.id, config, tx)
    const locked = await lockOpenChallenge(tx, challenge.id, user.id)
    if (!locked) {
      businessRuleError("该挑战已被其他用户抢先应战")
    }

    const [challenger, preparedStakeDelta] = await Promise.all([
      findYinYangUserPointSnapshot(user.id, tx),
      prepareScopedPointDelta({
        scopeKey: "YINYANG_STAKE_OUTGOING",
        baseDelta: -challenge.stakePoints,
        userId: user.id,
      }),
    ])
    if (!challenger) {
      businessRuleError("用户不存在")
    }

    await applyPointDelta({
      tx,
      userId: user.id,
      beforeBalance: challenger.points,
      prepared: preparedStakeDelta,
      pointName: rewardPointName,
      insufficientMessage: "积分不足，无法应战",
      reason: "[app:阴阳契] 应战扣除托管本金",
      relatedType: "YINYANG_CHALLENGE",
      relatedId: challenge.id,
    })

    const isCorrect = input.selectedOption === challenge.correctOption
    const winnerId = isCorrect ? user.id : challenge.creatorId
    const loserId = isCorrect ? challenge.creatorId : user.id
    const winnerSettlement = challenge.stakePoints + challenge.rewardPoints
    const preparedWinnerSettlement = await prepareScopedPointDelta({
      scopeKey: "YINYANG_SETTLEMENT_INCOMING",
      baseDelta: winnerSettlement,
      userId: winnerId,
    })
    const winner = winnerId === challenger.id
      ? challenger
      : await findYinYangUserPointSnapshot(winnerId, tx)
    if (!winner) {
      businessRuleError("用户不存在")
    }

    await applyPointDelta({
      tx,
      userId: winnerId,
      beforeBalance: winner.points,
      prepared: preparedWinnerSettlement,
      pointName: rewardPointName,
      insufficientMessage: "积分不足，无法完成阴阳契结算",
      reason: isCorrect ? "[app:阴阳契] 挑战胜利返还本金并发放奖励" : "[app:阴阳契] 守擂成功返还本金并发放奖励",
      relatedType: "YINYANG_CHALLENGE",
      relatedId: challenge.id,
    })

    await createYinYangChallengeAttempt({
      tx,
      id: createUuid(),
      challengeId: challenge.id,
      challengerId: user.id,
      selectedOption: input.selectedOption,
      isCorrect,
      stakePoints: challenge.stakePoints,
      rewardPoints: challenge.rewardPoints,
      taxPoints: challenge.taxPoints,
    })
    await settleChallengeRecord({
      tx,
      challengeId: challenge.id,
      winnerId,
      loserId,
    })
    await bumpDailyStats(tx, isCorrect
      ? [
          { userId: user.id, winCount: 1, todayProfitPoints: challenge.rewardPoints },
          { userId: challenge.creatorId, loseCount: 1, todayLossPoints: challenge.stakePoints },
        ]
      : [
          { userId: challenge.creatorId, winCount: 1, todayProfitPoints: challenge.rewardPoints },
          { userId: user.id, loseCount: 1, todayLossPoints: challenge.stakePoints },
        ])

    return { challenge, isCorrect }
  })

  const challengerName = getUserDisplayName(user)
  const creatorWon = !settlement.isCorrect
  const resultTitle = creatorWon ? "你发起的阴阳契获胜了" : "你发起的阴阳契被破解了"
  const resultContent = creatorWon
    ? `${challengerName} 应战了你的问题“${settlement.challenge.question}”，结果答错。你已守擂成功，获得 ${settlement.challenge.rewardPoints} ${rewardPointName}。`
    : `${challengerName} 应战了你的问题“${settlement.challenge.question}”，结果答对。你的本局彩头 ${settlement.challenge.stakePoints} ${rewardPointName} 已结算。`

  await createSystemNotification({
    userId: settlement.challenge.creatorId,
    senderId: user.id,
    relatedType: "YINYANG_CHALLENGE",
    relatedId: settlement.challenge.id,
    title: resultTitle,
    content: resultContent,
  })
  const refreshedUser = await findYinYangUserPointSnapshot(user.id)
  if (!refreshedUser) {
    businessRuleError("用户状态已失效")
  }

  return getYinYangLobbyData(refreshedUser)
}
export { formatYinYangChallengeTime }
export type { YinYangChallengeCard, YinYangLeaderboardUser, YinYangLobbyData, YinYangMyStats, YinYangOption, YinYangChallengeStatus }
