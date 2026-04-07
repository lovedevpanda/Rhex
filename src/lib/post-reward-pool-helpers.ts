import { randomInt } from "crypto"

import { PostRedPacketClaimOrderMode, PostRedPacketGrantMode, PostRedPacketStatus, PostRedPacketTriggerType } from "@/db/types"
import { getPostContentMeta } from "@/lib/post-content"
import type { PostRewardPoolEffectFeedback } from "@/lib/post-reward-effect-feedback"
import { parseStoredPostRewardPoolConfig, toPositiveInteger, type PostRewardPoolMode } from "@/lib/post-reward-pool-config"
import { getSiteSettings } from "@/lib/site-settings"
import { addSafeIntegers, clampSafeInteger, dividePositiveSafeIntegers, floorSafeInteger, multiplyPositiveSafeIntegers, subtractSafeIntegers } from "@/lib/shared/safe-integer"

export interface NormalizedJackpotConfig {
  enabled: true
  mode: "JACKPOT"
  triggerType: "REPLY"
  initialPoints: number
  replyIncrementPoints: number
  hitProbability: number
}

export interface NormalizedStandardRedPacketConfig {
  enabled: true
  mode: "RED_PACKET"
  grantMode: PostRedPacketGrantMode
  claimOrderMode: PostRedPacketClaimOrderMode
  triggerType: PostRedPacketTriggerType
  totalPoints: number
  packetCount: number
  unitPoints: number
}

export type NormalizedPostRedPacketConfig =
  | NormalizedJackpotConfig
  | NormalizedStandardRedPacketConfig

export interface PostRewardPoolClaimResult {
  claimed: boolean
  amount?: number
  pointName?: string
  rewardMode?: PostRewardPoolMode
  reason?: string
  effectFeedback?: PostRewardPoolEffectFeedback | null
}

interface RewardPoolStoredState {
  totalPoints: number
  packetCount: number
  remainingPoints: number
  remainingCount: number
  grantMode: PostRedPacketGrantMode
  claimOrderMode: PostRedPacketClaimOrderMode
}

interface JackpotReplyOutcome {
  depositedPoints: number
  hitProbability: number
}

interface PostRedPacketAllocationSnapshot {
  remainingPoints: number
  remainingCount: number
  totalPoints: number
  packetCount: number
}

const JACKPOT_REPEAT_REPLY_PROBABILITY_FACTOR = 0.35
const JACKPOT_REPEAT_WINNER_PROBABILITY_FACTOR = 0.5

const RED_PACKET_TRIGGER_LABELS: Record<PostRedPacketTriggerType, string> = {
  REPLY: "回复帖子",
  LIKE: "点赞帖子",
  FAVORITE: "收藏帖子",
}

const RED_PACKET_GRANT_MODE_LABELS: Record<PostRedPacketGrantMode, string> = {
  FIXED: "固定红包",
  RANDOM: "拼手气红包",
}

const RED_PACKET_CLAIM_ORDER_MODE_LABELS: Record<PostRedPacketClaimOrderMode, string> = {
  FIRST_COME_FIRST_SERVED: "先到先得",
  RANDOM: "随机机会",
}

function parseRewardPoolConfigFromMeta(value: unknown) {
  return parseStoredPostRewardPoolConfig(value)
}

function allocateRandomAmount(remainingPoints: number, remainingCount: number) {
  if (remainingCount <= 1) {
    return remainingPoints
  }

  const guaranteedReserve = subtractSafeIntegers(remainingCount, 1)
  const distributionLimit = guaranteedReserve === null ? null : subtractSafeIntegers(remainingPoints, guaranteedReserve)
  if (distributionLimit === null || distributionLimit <= 0) {
    return 1
  }

  const doubledRemainingPoints = multiplyPositiveSafeIntegers(remainingPoints, 2)
  const averagedTwice = doubledRemainingPoints === null ? null : dividePositiveSafeIntegers(doubledRemainingPoints, remainingCount)
  const doubledMeanLimitRaw = averagedTwice === null ? null : subtractSafeIntegers(averagedTwice, 1)
  const doubledMeanLimit = doubledMeanLimitRaw === null || doubledMeanLimitRaw < 1 ? 1 : doubledMeanLimitRaw
  const safeMax = distributionLimit < doubledMeanLimit ? distributionLimit : doubledMeanLimit
  const exclusiveMax = addSafeIntegers(safeMax, 1)
  return randomInt(1, exclusiveMax ?? 2)
}

function clampJackpotProbability(value: number) {
  const normalized = floorSafeInteger(value)
  if (normalized === null) {
    return 1
  }

  return clampSafeInteger(normalized, 1, 100) ?? 1
}

export function parsePostRewardPoolConfigFromContent(rawContent: string) {
  return parseRewardPoolConfigFromMeta(getPostContentMeta(rawContent)?.rewardPool)
}

export function getPostRedPacketTriggerLabel(triggerType: PostRedPacketTriggerType) {
  return RED_PACKET_TRIGGER_LABELS[triggerType]
}

export function getPostRedPacketGrantModeLabel(grantMode: PostRedPacketGrantMode) {
  return RED_PACKET_GRANT_MODE_LABELS[grantMode]
}

export function getPostRedPacketClaimOrderModeLabel(claimOrderMode: PostRedPacketClaimOrderMode) {
  return RED_PACKET_CLAIM_ORDER_MODE_LABELS[claimOrderMode]
}

export async function normalizePostRedPacketConfig(input: unknown): Promise<{
  success: boolean
  message?: string
  data: NormalizedPostRedPacketConfig | null
}> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { success: true, data: null }
  }

  const settings = await getSiteSettings()
  const config = input as Record<string, unknown>
  const enabled = Boolean(config.enabled)
  const mode = config.mode === "JACKPOT" ? "JACKPOT" : "RED_PACKET"

  if (!enabled) {
    return { success: true, data: null }
  }

  if (mode === "JACKPOT") {
    if (!settings.postJackpotEnabled) {
      return { success: false, message: "当前站点未开启聚宝盆功能", data: null }
    }

    const initialPoints = toPositiveInteger(config.initialPoints)
    if (!initialPoints) {
      return { success: false, message: "聚宝盆初始积分必须是正整数", data: null }
    }

    if (initialPoints < settings.postJackpotMinInitialPoints) {
      return { success: false, message: `聚宝盆初始${settings.pointName}不能低于 ${settings.postJackpotMinInitialPoints}`, data: null }
    }

    if (initialPoints > settings.postJackpotMaxInitialPoints) {
      return { success: false, message: `聚宝盆初始${settings.pointName}不能高于 ${settings.postJackpotMaxInitialPoints}`, data: null }
    }

    return {
      success: true,
      data: {
        enabled: true,
        mode: "JACKPOT",
        triggerType: "REPLY",
        initialPoints,
        replyIncrementPoints: settings.postJackpotReplyIncrementPoints,
        hitProbability: settings.postJackpotHitProbability,
      },
    }
  }

  if (!settings.postRedPacketEnabled) {
    return { success: false, message: "当前站点未开启帖子红包功能", data: null }
  }

  const grantMode = String(config.grantMode ?? "FIXED").trim().toUpperCase()
  const claimOrderMode = String(config.claimOrderMode ?? "FIRST_COME_FIRST_SERVED").trim().toUpperCase()
  const triggerType = String(config.triggerType ?? "REPLY").trim().toUpperCase()
  const packetCount = toPositiveInteger(config.packetCount)
  const configuredTotalPoints = toPositiveInteger(config.totalPoints)
  const unitPoints = toPositiveInteger(config.unitPoints ?? config.totalPoints)
  const totalPoints = grantMode === "FIXED"
    ? multiplyPositiveSafeIntegers(unitPoints, packetCount)
    : configuredTotalPoints

  if (!(grantMode in RED_PACKET_GRANT_MODE_LABELS)) {
    return { success: false, message: "红包发放方式不合法", data: null }
  }

  if (!(claimOrderMode in RED_PACKET_CLAIM_ORDER_MODE_LABELS)) {
    return { success: false, message: "红包领取规则不合法", data: null }
  }

  if (!(triggerType in RED_PACKET_TRIGGER_LABELS)) {
    return { success: false, message: "红包领取条件不合法", data: null }
  }

  if (!totalPoints || !packetCount) {
    return { success: false, message: "红包总积分和份数必须为正整数", data: null }
  }

  if (grantMode === "FIXED" && (!unitPoints || unitPoints > settings.postRedPacketMaxPoints)) {
    return { success: false, message: `固定红包单个${settings.pointName}不能超过 ${settings.postRedPacketMaxPoints}`, data: null }
  }

  if (grantMode === "RANDOM" && totalPoints > settings.postRedPacketMaxPoints) {
    return { success: false, message: `拼手气红包总${settings.pointName}不能超过 ${settings.postRedPacketMaxPoints}`, data: null }
  }

  if (packetCount > totalPoints) {
    return { success: false, message: `红包份数不能超过总${settings.pointName}，必须保证每人至少获得 1 ${settings.pointName}`, data: null }
  }

  const normalizedUnitPoints = unitPoints ?? totalPoints

  return {
    success: true,
    data: {
      enabled: true,
      mode: "RED_PACKET",
      grantMode: grantMode as PostRedPacketGrantMode,
      claimOrderMode: claimOrderMode as PostRedPacketClaimOrderMode,
      triggerType: triggerType as PostRedPacketTriggerType,
      totalPoints,
      packetCount,
      unitPoints: normalizedUnitPoints,
    },
  }
}

export function allocateRedPacketAmount(packet: { grantMode: PostRedPacketGrantMode } & PostRedPacketAllocationSnapshot) {
  if (packet.remainingCount <= 0 || packet.remainingPoints <= 0) {
    throw new Error("红包已领完")
  }

  if (packet.grantMode === "FIXED") {
    const fixedAmount = dividePositiveSafeIntegers(packet.totalPoints, packet.packetCount)
    if (!fixedAmount) {
      throw new Error("固定红包金额配置不合法")
    }

    return fixedAmount
  }

  return allocateRandomAmount(packet.remainingPoints, packet.remainingCount)
}

export function buildRedPacketClaimReason(params: { amount: number; pointName: string; postId: string; triggerType: PostRedPacketTriggerType }) {
  return `领取帖子红包(${getPostRedPacketTriggerLabel(params.triggerType)}，${params.amount}${params.pointName})`
}

export function buildRedPacketSendReason(params: { amount: number; pointName: string; postId: string }) {
  return `发布帖子红包(${params.amount}${params.pointName})`
}

export function buildJackpotSendReason(params: { amount: number; pointName: string; postId: string }) {
  return `发布聚宝盆（初始 ${params.amount}${params.pointName})`
}

export function buildJackpotClaimReason(params: { amount: number; pointName: string; postId: string }) {
  return `命中聚宝盆(${params.amount}${params.pointName})`
}

export function shouldHitJackpot(probability: number) {
  return randomInt(1, 101) <= probability
}

export function allocateJackpotAmount(poolPoints: number) {
  if (poolPoints <= 1) {
    return poolPoints
  }

  const exclusiveMax = addSafeIntegers(poolPoints, 1)
  return randomInt(1, exclusiveMax ?? 2)
}

export function settleJackpotStatus(remainingPoints: number): PostRedPacketStatus {
  return remainingPoints <= 0 ? "COMPLETED" : "ACTIVE"
}

export function resolveJackpotReplyOutcome(params: {
  replyCount: number
  priorWinCount: number
  baseIncrementPoints: number
  baseHitProbability: number
}): JackpotReplyOutcome {
  const isFirstReply = params.replyCount <= 1
  const depositedPoints = isFirstReply
    ? params.baseIncrementPoints
    : params.baseIncrementPoints > 1
      ? randomInt(1, params.baseIncrementPoints)
      : 0

  let hitProbability = isFirstReply
    ? params.baseHitProbability
    : params.baseHitProbability * JACKPOT_REPEAT_REPLY_PROBABILITY_FACTOR

  if (params.priorWinCount > 0) {
    hitProbability *= JACKPOT_REPEAT_WINNER_PROBABILITY_FACTOR ** params.priorWinCount
  }

  return {
    depositedPoints,
    hitProbability: clampJackpotProbability(hitProbability),
  }
}

export function buildRewardPoolStoredState(config: NormalizedPostRedPacketConfig): RewardPoolStoredState {
  if (config.mode === "JACKPOT") {
    return {
      totalPoints: config.initialPoints,
      packetCount: 0,
      remainingPoints: config.initialPoints,
      remainingCount: 0,
      grantMode: "RANDOM",
      claimOrderMode: "RANDOM",
    }
  }

  return {
    totalPoints: config.totalPoints,
    packetCount: config.packetCount,
    remainingPoints: config.totalPoints,
    remainingCount: config.packetCount,
    grantMode: config.grantMode,
    claimOrderMode: config.claimOrderMode,
  }
}
