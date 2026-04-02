import { randomInt } from "crypto"



import { ChangeType, PostRedPacketClaimOrderMode, PostRedPacketGrantMode, PostRedPacketStatus, PostRedPacketTriggerType, type Prisma } from "@/db/types"

import { claimPostRedPacketInTransaction, findCurrentUserPostRedPacketClaim, findPostRedPacketSummaryData } from "@/db/post-red-packet-queries"


import { getBusinessDayRange, formatRelativeTime } from "@/lib/formatters"

import { getSiteSettings } from "@/lib/site-settings"

import { multiplyPositiveSafeIntegers } from "@/lib/shared/safe-integer"



export interface NormalizedPostRedPacketConfig {
  enabled: boolean
  grantMode: PostRedPacketGrantMode
  claimOrderMode: PostRedPacketClaimOrderMode
  triggerType: PostRedPacketTriggerType
  totalPoints: number
  packetCount: number
  unitPoints: number
}


export interface PostRedPacketClaimRecord {
  id: string
  userId: number
  username: string
  nickname: string | null
  avatarPath: string | null
  amount: number
  triggerType: PostRedPacketTriggerType
  triggerLabel: string
  createdAt: string
}

export interface PostRedPacketSummary {
  enabled: boolean
  pointName: string
  senderId?: number
  senderName?: string
  grantMode?: PostRedPacketGrantMode
  claimOrderMode?: PostRedPacketClaimOrderMode
  claimOrderLabel?: string
  triggerType?: PostRedPacketTriggerType
  triggerLabel?: string
  totalPoints: number
  packetCount: number
  remainingPoints: number
  remainingCount: number
  claimedCount: number
  claimedPoints: number
  status?: PostRedPacketStatus
  currentUserPoints: number
  currentUserClaimed: boolean
  currentUserClaimAmount?: number
  page: number
  pageSize: number
  totalRecords: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
  records: PostRedPacketClaimRecord[]
}


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

interface PostRedPacketAllocationSnapshot {
  remainingPoints: number
  remainingCount: number
  totalPoints: number
  packetCount: number
}

interface PostRedPacketRecipientCandidate {
  userId: number
}

interface PostRedPacketClaimRecipient {
  userId: number
  triggerCommentId?: string
}

interface PostRedPacketClaimOrderContext {
  currentUserId: number
  currentTriggerCommentId?: string
  eligibleCandidates: PostRedPacketRecipientCandidate[]
}

function toPositiveInteger(value: unknown) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }
  return parsed
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

  if (!enabled) {
    return { success: true, data: null }
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
      grantMode: grantMode as PostRedPacketGrantMode,
      claimOrderMode: claimOrderMode as PostRedPacketClaimOrderMode,
      triggerType: triggerType as PostRedPacketTriggerType,
      totalPoints,
      packetCount,
      unitPoints: normalizedUnitPoints,
    },
  }


}

export async function assertPostRedPacketDailyLimit(params: { senderId: number; totalPoints: number }) {
  const settings = await getSiteSettings()
  const { start, end } = getBusinessDayRange()

  const aggregate = await import("@/db/post-red-packet-queries").then(({ sumTodayPostRedPacketPoints }) => sumTodayPostRedPacketPoints(params.senderId, start, end))


  const usedPoints = aggregate._sum.totalPoints ?? 0
  if (usedPoints + params.totalPoints > settings.postRedPacketDailyLimit) {
    throw new Error(`今日发红包累计${settings.pointName}已超上限（${settings.postRedPacketDailyLimit}）`)
  }
}

export async function buildPostRedPacketCreateInput(params: {
  postId: string
  senderId: number
  config: NormalizedPostRedPacketConfig | null
}): Promise<Prisma.PostRedPacketUncheckedCreateInput | undefined> {
  if (!params.config?.enabled) {
    return undefined
  }

  await assertPostRedPacketDailyLimit({ senderId: params.senderId, totalPoints: params.config.totalPoints })

  return {
    postId: params.postId,
    senderId: params.senderId,
    grantMode: params.config.grantMode,
    claimOrderMode: params.config.claimOrderMode,
    triggerType: params.config.triggerType,
    totalPoints: params.config.totalPoints,
    packetCount: params.config.packetCount,
    remainingPoints: params.config.totalPoints,
    remainingCount: params.config.packetCount,
    status: "ACTIVE",
  }
}

function allocateRandomAmount(remainingPoints: number, remainingCount: number) {
  if (remainingCount <= 1) {
    return remainingPoints
  }

  const guaranteedReserve = remainingCount - 1
  const distributionLimit = remainingPoints - guaranteedReserve
  if (distributionLimit <= 0) {
    return 1
  }

  const average = remainingPoints / remainingCount
  const doubledMeanLimit = Math.max(1, Math.floor(average * 2) - 1)
  const safeMax = Math.min(distributionLimit, doubledMeanLimit)
  return randomInt(1, safeMax + 1)
}



function allocateRedPacketAmount(packet: {
  grantMode: PostRedPacketGrantMode
} & PostRedPacketAllocationSnapshot) {
  if (packet.remainingCount <= 0 || packet.remainingPoints <= 0) {
    throw new Error("红包已领完")
  }

  return packet.grantMode === "FIXED"
    ? packet.totalPoints / packet.packetCount
    : allocateRandomAmount(packet.remainingPoints, packet.remainingCount)
}

function pickRandomCandidate<T>(candidates: readonly T[]) {
  if (candidates.length === 0) {
    return null
  }

  return candidates[randomInt(0, candidates.length)] ?? null
}

function resolveRandomClaimRecipient(context: PostRedPacketClaimOrderContext): PostRedPacketClaimRecipient | null {
  const selectedCandidate = pickRandomCandidate(context.eligibleCandidates)
  if (!selectedCandidate) {
    return null
  }

  return {
    userId: selectedCandidate.userId,
    triggerCommentId: selectedCandidate.userId === context.currentUserId ? context.currentTriggerCommentId : undefined,
  }
}

function resolveClaimRecipient(params: {
  claimOrderMode: PostRedPacketClaimOrderMode
  context: PostRedPacketClaimOrderContext
}) {
  if (params.claimOrderMode === "FIRST_COME_FIRST_SERVED") {
    return {
      userId: params.context.currentUserId,
      triggerCommentId: params.context.currentTriggerCommentId,
    }
  }

  return resolveRandomClaimRecipient(params.context)
}

function buildRedPacketClaimReason(params: {
  amount: number
  pointName: string
  postId: string
  triggerType: PostRedPacketTriggerType
}) {
  return `[post-red-packet] 领取帖子红包（${getPostRedPacketTriggerLabel(params.triggerType)}，${params.amount}${params.pointName}） post=${params.postId}`
}

function buildRedPacketSendReason(params: { amount: number; pointName: string; postId: string }) {
  return `[post-red-packet] 发布帖子红包（${params.amount}${params.pointName}） post=${params.postId}`
}

export async function tryClaimPostRedPacket(input: {
  postId: string
  userId: number
  triggerType: PostRedPacketTriggerType
  triggerCommentId?: string
}) {
  const settings = await getSiteSettings()

  return claimPostRedPacketInTransaction({
    postId: input.postId,
    userId: input.userId,
    triggerType: input.triggerType,
    triggerCommentId: input.triggerCommentId,
    pointName: settings.pointName,
    buildClaimReason: buildRedPacketClaimReason,
    resolveRecipient: ({ packet, eligibleCandidates }) => resolveClaimRecipient({
      claimOrderMode: packet.claimOrderMode as PostRedPacketClaimOrderMode,
      context: {
        currentUserId: input.userId,
        currentTriggerCommentId: input.triggerCommentId,
        eligibleCandidates,
      },
    }),
    allocateAmount: (packet) => allocateRedPacketAmount({
      grantMode: packet.grantMode as PostRedPacketGrantMode,
      remainingPoints: packet.remainingPoints,
      remainingCount: packet.remainingCount,
      totalPoints: packet.totalPoints,
      packetCount: packet.packetCount,
    }),
  })
}


export async function getPostRedPacketSummary(postId: string, currentUserId?: number, page = 1, pageSize = 20): Promise<PostRedPacketSummary | undefined> {
  const settings = await getSiteSettings()
  const normalizedPageSize = Math.min(100, Math.max(10, Number(pageSize) || 20))
  const normalizedPage = Math.max(1, Number(page) || 1)

  const [packet, currentUser] = await findPostRedPacketSummaryData(postId, currentUserId)


  if (!packet) {
    return undefined
  }

  const totalRecords = packet.claimedCount
  const totalPages = Math.max(1, Math.ceil(totalRecords / normalizedPageSize))
  const safePage = Math.min(normalizedPage, totalPages)
  const currentUserClaim = currentUserId
    ? await findCurrentUserPostRedPacketClaim(packet.id, currentUserId)
    : undefined


  return {

    enabled: settings.postRedPacketEnabled,
    pointName: settings.pointName,
    senderId: packet.sender.id,
    senderName: packet.sender.nickname ?? packet.sender.username,
    grantMode: packet.grantMode,
    claimOrderMode: packet.claimOrderMode,
    claimOrderLabel: getPostRedPacketClaimOrderModeLabel(packet.claimOrderMode),
    triggerType: packet.triggerType,
    triggerLabel: getPostRedPacketTriggerLabel(packet.triggerType),
    totalPoints: packet.totalPoints,
    packetCount: packet.packetCount,
    remainingPoints: packet.remainingPoints,
    remainingCount: packet.remainingCount,
    claimedCount: packet.claimedCount,
    claimedPoints: packet.claimedPoints,
    status: packet.status,
    currentUserPoints: currentUser?.points ?? 0,
    currentUserClaimed: Boolean(currentUserClaim),
    currentUserClaimAmount: currentUserClaim?.amount,
    page: safePage,
    pageSize: normalizedPageSize,
    totalRecords,
    totalPages,
    hasPrevPage: safePage > 1,
    hasNextPage: safePage < totalPages,
    records: packet.claims.map((item) => ({

      id: item.id,
      userId: item.user.id,
      username: item.user.username,
      nickname: item.user.nickname,
      avatarPath: item.user.avatarPath,
      amount: item.amount,
      triggerType: item.triggerType,
      triggerLabel: getPostRedPacketTriggerLabel(item.triggerType),
      createdAt: formatRelativeTime(item.createdAt),
    })),
  }
}

export async function createPostRedPacketAfterPostCreated(params: {
  tx: Prisma.TransactionClient
  postId: string
  senderId: number
  config: NormalizedPostRedPacketConfig | null
  pointName: string
}) {
  if (!params.config?.enabled) {
    return 0
  }

  await assertPostRedPacketDailyLimit({ senderId: params.senderId, totalPoints: params.config.totalPoints })

  await params.tx.postRedPacket.create({
    data: {
      postId: params.postId,
      senderId: params.senderId,
      grantMode: params.config.grantMode,
      claimOrderMode: params.config.claimOrderMode,
      triggerType: params.config.triggerType,
      totalPoints: params.config.totalPoints,
      packetCount: params.config.packetCount,
      remainingPoints: params.config.totalPoints,
      remainingCount: params.config.packetCount,
      status: "ACTIVE",
    },
  })

  await params.tx.pointLog.create({
    data: {
      userId: params.senderId,
      changeType: ChangeType.DECREASE,
      changeValue: params.config.totalPoints,
      reason: buildRedPacketSendReason({ amount: params.config.totalPoints, pointName: params.pointName, postId: params.postId }),
      relatedType: "POST",
      relatedId: params.postId,
    },
  })

  return params.config.totalPoints
}
