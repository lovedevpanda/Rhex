import { upsertCommentEffectFeedback } from "@/db/comment-effect-feedback-queries"
import { PostRedPacketClaimOrderMode, PostRedPacketGrantMode, PostRedPacketStatus, PostRedPacketTriggerType } from "@/db/types"

import type { Prisma } from "@/db/types"
import type { PostRewardPoolEffectFeedback } from "@/lib/post-reward-effect-feedback"
import {
  createJackpotRewardClaim,
  claimPostRedPacketInTransaction,
  createPostRewardPoolRecord,
  depositJackpotPool,
  findCurrentUserPostRedPacketClaim,
  findJackpotClaimContext,
  findJackpotParticipantStats,
  findPostRedPacketSummaryData,
  findPostRewardPoolContentByPostId,
  rollbackJackpotClaimSettlement,
  runSerializablePostRewardPoolTransaction,
  settleJackpotClaim,
  sumTodayPostRedPacketPoints,
  updateJackpotStatus,
} from "@/db/post-red-packet-queries"
import { applyPointDelta, prepareScopedPointDelta, prepareScopedProbability } from "@/lib/point-center"
import { apiError } from "@/lib/api-route"
import { getBusinessDayRange, formatRelativeTime } from "@/lib/formatters"
import { buildJackpotEffectFeedback } from "@/lib/post-reward-effect-feedback-builders"
import {
  getPostRedPacketClaimOrderModeLabel,
  getPostRedPacketGrantModeLabel,
  getPostRedPacketTriggerLabel,
} from "@/lib/post-reward-pool-labels"
import {
  allocateJackpotAmount,
  allocateRedPacketAmount,
  buildJackpotClaimReason,
  buildJackpotSendReason,
  buildRedPacketClaimReason,
  buildRedPacketSendReason,
  buildRewardPoolStoredState,
  normalizePostRedPacketConfig,
  parsePostRewardPoolConfigFromContent,
  resolveJackpotReplyOutcome,
  settleJackpotStatus,
  shouldHitJackpot,
  type NormalizedPostRedPacketConfig,
  type PostRewardPoolClaimResult,
} from "@/lib/post-reward-pool-helpers"
import { getPostRewardPoolModeLabel, toPositiveInteger, type PostRewardPoolMode } from "@/lib/post-reward-pool-config"
import { getSiteSettings } from "@/lib/site-settings"
import { addSafeIntegers, clampSafeInteger, dividePositiveSafeIntegers, subtractSafeIntegers } from "@/lib/shared/safe-integer"

export {
  getPostRedPacketClaimOrderModeLabel,
  getPostRedPacketGrantModeLabel,
  getPostRedPacketTriggerLabel,
  normalizePostRedPacketConfig,
  parsePostRewardPoolConfigFromContent,
}
export type { NormalizedPostRedPacketConfig, PostRewardPoolClaimResult }

function attachJackpotDepositFeedback(
  feedback: PostRewardPoolEffectFeedback | null,
  jackpotDepositPoints: number,
): PostRewardPoolEffectFeedback {
  return {
    badgeName: feedback?.badgeName ?? null,
    badgeIconText: feedback?.badgeIconText ?? null,
    badgeColor: feedback?.badgeColor ?? null,
    badges: feedback?.badges ?? [],
    events: feedback?.events ?? [],
    jackpotDepositPoints,
  }
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
  rewardMode?: PostRewardPoolMode
  rewardModeLabel?: string
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
  jackpotInitialPoints?: number
  jackpotReplyIncrementPoints?: number
  jackpotHitProbability?: number
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

export async function assertPostRedPacketDailyLimit(params: { senderId: number; totalPoints: number }) {
  const settings = await getSiteSettings()
  const { start, end } = getBusinessDayRange()
  const aggregate = await sumTodayPostRedPacketPoints(params.senderId, start, end)
  const usedPoints = aggregate._sum.totalPoints ?? 0
  const totalUsedPoints = addSafeIntegers(usedPoints, params.totalPoints)
  if (totalUsedPoints === null || totalUsedPoints > settings.postRedPacketDailyLimit) {
    apiError(400, `今日发红包累计${settings.pointName}已超上限（${settings.postRedPacketDailyLimit}）`)
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

  const rewardPoolState = buildRewardPoolStoredState(params.config)

  await assertPostRedPacketDailyLimit({ senderId: params.senderId, totalPoints: rewardPoolState.totalPoints })

  return {
    postId: params.postId,
    senderId: params.senderId,
    grantMode: rewardPoolState.grantMode,
    claimOrderMode: rewardPoolState.claimOrderMode,
    triggerType: params.config.triggerType,
    totalPoints: rewardPoolState.totalPoints,
    packetCount: rewardPoolState.packetCount,
    remainingPoints: rewardPoolState.remainingPoints,
    remainingCount: rewardPoolState.remainingCount,
    status: "ACTIVE",
  }
}

export async function tryClaimPostRedPacket(input: {
  postId: string
  userId: number
  triggerType: PostRedPacketTriggerType
  triggerCommentId?: string
}): Promise<PostRewardPoolClaimResult> {
  const settings = await getSiteSettings()

  return claimPostRedPacketInTransaction({
    postId: input.postId,
    userId: input.userId,
    triggerType: input.triggerType,
    triggerCommentId: input.triggerCommentId,
    pointName: settings.pointName,
    randomClaimProbability: settings.postRedPacketRandomClaimProbability,
    buildClaimReason: buildRedPacketClaimReason,
    allocateAmount: (packet) => allocateRedPacketAmount({
      grantMode: packet.grantMode as PostRedPacketGrantMode,
      remainingPoints: packet.remainingPoints,
      remainingCount: packet.remainingCount,
      totalPoints: packet.totalPoints,
      packetCount: packet.packetCount,
    }),
  })
}

async function tryClaimPostJackpot(input: {
  postId: string
  userId: number
  triggerCommentId?: string
}): Promise<PostRewardPoolClaimResult> {
  const settings = await getSiteSettings()

  return runSerializablePostRewardPoolTransaction(async (tx) => {
    const [user, post] = await findJackpotClaimContext(tx, input.postId, input.userId)

    if (!user || !post || post.status !== "NORMAL") {
      return { claimed: false as const, reason: "帖子不存在或暂不可抽奖" }
    }

    if (user.status === "MUTED" || user.status === "BANNED") {
      return { claimed: false as const, reason: "当前账号状态不可参与聚宝盆" }
    }

    const rewardConfig = parsePostRewardPoolConfigFromContent(post.content)
    if (!rewardConfig || rewardConfig.mode !== "JACKPOT" || !post.redPacket || post.redPacket.status !== "ACTIVE") {
      return { claimed: false as const, reason: "当前帖子没有可参与的聚宝盆" }
    }

    const packet = post.redPacket
    if (packet.remainingPoints <= 0) {
      await updateJackpotStatus(tx, packet.id, "COMPLETED")
      return { claimed: false as const, reason: "聚宝盆已结束" }
    }

    if (post.authorId === user.id) {
      return { claimed: false as const, reason: "楼主回复不会触发聚宝盆" }
    }

    const { replyCount, priorWinCount } = await findJackpotParticipantStats(tx, post.id, user.id, packet.id)

    const replyOutcome = resolveJackpotReplyOutcome({
      replyCount,
      priorWinCount,
      baseIncrementPoints: rewardConfig.replyIncrementPoints,
      baseHitProbability: rewardConfig.hitProbability,
    })
    const preparedIncrement = await prepareScopedPointDelta({
      scopeKey: "JACKPOT_REPLY_INCREMENT",
      baseDelta: replyOutcome.depositedPoints,
      userId: user.id,
    })
    const preparedProbability = await prepareScopedProbability({
      scopeKey: "JACKPOT_HIT_PROBABILITY",
      baseProbability: replyOutcome.hitProbability,
      userId: user.id,
    })
    const depositedPoolPoints = packet.remainingPoints + preparedIncrement.finalDelta
    if (!Number.isFinite(depositedPoolPoints) || depositedPoolPoints < 0) {
      return { claimed: false as const, reason: "聚宝盆积分池计算失败" }
    }

    const deposited = await depositJackpotPool(tx, packet.id, packet.remainingPoints, depositedPoolPoints)

    if (deposited.count === 0) {
      return { claimed: false as const, reason: "聚宝盆正在更新中，请稍后重试" }
    }

    const missEffectFeedback = buildJackpotEffectFeedback({
      preparedProbability,
      claimed: false,
      pointName: settings.pointName,
    })
    const storedMissFeedback = attachJackpotDepositFeedback(missEffectFeedback, preparedIncrement.finalDelta)

    if (!shouldHitJackpot(preparedProbability.finalProbability)) {
      if (input.triggerCommentId) {
        await upsertCommentEffectFeedback({
          tx,
          postId: post.id,
          commentId: input.triggerCommentId,
          userId: user.id,
          scene: "JACKPOT_REPLY",
          feedback: storedMissFeedback,
        })
      }

      return {
        claimed: false as const,
        reason: "本次未命中聚宝盆",
        effectFeedback: storedMissFeedback,
      }
    }

    const amount = allocateJackpotAmount(depositedPoolPoints)
    const preparedReward = await prepareScopedPointDelta({
      scopeKey: "JACKPOT_CLAIM",
      baseDelta: amount,
      userId: user.id,
    })
    const successEffectFeedback = buildJackpotEffectFeedback({
      preparedProbability,
      preparedReward,
      claimed: true,
      pointName: settings.pointName,
    })
    const storedSuccessFeedback = attachJackpotDepositFeedback(successEffectFeedback, preparedIncrement.finalDelta)
    const nextRemainingPoints = subtractSafeIntegers(depositedPoolPoints, amount)
    if (nextRemainingPoints === null) {
      return { claimed: false as const, reason: "聚宝盆结算失败" }
    }
    const nextStatus = settleJackpotStatus(nextRemainingPoints)

    const updatedPacket = await settleJackpotClaim(tx, packet.id, depositedPoolPoints, nextRemainingPoints, amount, nextStatus)

    if (updatedPacket.count === 0) {
      return { claimed: false as const, reason: "聚宝盆正在结算中，请稍后重试" }
    }

    try {
      const rewardClaim = await createJackpotRewardClaim(tx, {
        redPacketId: packet.id,
        postId: post.id,
        userId: user.id,
        triggerCommentId: input.triggerCommentId,
        amount,
      })

      if (input.triggerCommentId) {
        await upsertCommentEffectFeedback({
          tx,
          postId: post.id,
          commentId: input.triggerCommentId,
          userId: user.id,
          scene: "JACKPOT_REPLY",
          rewardClaimId: rewardClaim.id,
          feedback: storedSuccessFeedback,
        })
      }
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") {
        await rollbackJackpotClaimSettlement(tx, packet.id, depositedPoolPoints, amount, settleJackpotStatus(depositedPoolPoints))

        return { claimed: false as const, reason: "本次聚宝盆奖励已结算，请稍后重试" }
      }

      throw error
    }

    await applyPointDelta({
      tx,
      userId: user.id,
      beforeBalance: user.points,
      prepared: preparedReward,
      pointName: settings.pointName,
      insufficientMessage: `${settings.pointName}不足，无法完成聚宝盆结算`,
      reason: buildJackpotClaimReason({ amount, pointName: settings.pointName, postId: post.id }),
      relatedType: "POST",
      relatedId: post.id,
    })

    return {
      claimed: true as const,
      amount: Math.abs(preparedReward.finalDelta),
      pointName: settings.pointName,
      rewardMode: "JACKPOT" as const,
      effectFeedback: storedSuccessFeedback,
    }
  }, {
    postId: input.postId,
  })
}

export async function tryTriggerPostRewardPool(input: {
  postId: string
  userId: number
  triggerType: PostRedPacketTriggerType
  triggerCommentId?: string
}): Promise<PostRewardPoolClaimResult | null> {
  const post = await findPostRewardPoolContentByPostId(input.postId)

  const rewardConfig = post ? parsePostRewardPoolConfigFromContent(post.content) : null
  if (!rewardConfig) {
    return null
  }

  if (rewardConfig.mode === "JACKPOT") {
    if (input.triggerType !== "REPLY") {
      return null
    }

    return tryClaimPostJackpot({
      postId: input.postId,
      userId: input.userId,
      triggerCommentId: input.triggerCommentId,
    })
  }

  return tryClaimPostRedPacket(input)
}


export async function getPostRedPacketSummary(postId: string, currentUserId?: number, page = 1, pageSize = 20): Promise<PostRedPacketSummary | undefined> {
  const settings = await getSiteSettings()
  const normalizedPageSize = clampSafeInteger(toPositiveInteger(pageSize) ?? 20, 10, 100) ?? 20
  const normalizedPage = clampSafeInteger(toPositiveInteger(page) ?? 1, 1) ?? 1

  const [packet, currentUser] = await findPostRedPacketSummaryData(postId, currentUserId)
  if (!packet) {
    return undefined
  }

  const rewardConfig = parsePostRewardPoolConfigFromContent(packet.post.content)
  if (!rewardConfig) {
    return undefined
  }

  const totalRecords = packet.claimedCount
  const totalPages = dividePositiveSafeIntegers(totalRecords, normalizedPageSize, "ceil") ?? 1
  const safePage = normalizedPage > totalPages ? totalPages : normalizedPage
  const currentUserClaim = currentUserId
    ? await findCurrentUserPostRedPacketClaim(packet.id, currentUserId)
    : undefined


  return {

    enabled: true,
    pointName: settings.pointName,
    rewardMode: rewardConfig.mode,
    rewardModeLabel: getPostRewardPoolModeLabel(rewardConfig.mode),
    senderId: packet.sender.id,
    senderName: packet.sender.nickname ?? packet.sender.username,
    grantMode: rewardConfig.mode === "RED_PACKET" ? packet.grantMode : undefined,
    claimOrderMode: rewardConfig.mode === "RED_PACKET" ? packet.claimOrderMode : undefined,
    claimOrderLabel: rewardConfig.mode === "RED_PACKET" ? getPostRedPacketClaimOrderModeLabel(packet.claimOrderMode) : undefined,
    triggerType: packet.triggerType,
    triggerLabel: rewardConfig.mode === "JACKPOT" ? "回复帖子后概率中奖" : getPostRedPacketTriggerLabel(packet.triggerType),
    totalPoints: rewardConfig.mode === "JACKPOT" ? (rewardConfig.initialPoints ?? packet.totalPoints) : packet.totalPoints,
    packetCount: rewardConfig.mode === "JACKPOT" ? packet.claimedCount : packet.packetCount,
    remainingPoints: packet.remainingPoints,
    remainingCount: rewardConfig.mode === "JACKPOT" ? 0 : packet.remainingCount,
    claimedCount: packet.claimedCount,
    claimedPoints: packet.claimedPoints,
    status: packet.status,
    jackpotInitialPoints: rewardConfig.mode === "JACKPOT" ? rewardConfig.initialPoints : undefined,
    jackpotReplyIncrementPoints: rewardConfig.mode === "JACKPOT" ? rewardConfig.replyIncrementPoints : undefined,
    jackpotHitProbability: rewardConfig.mode === "JACKPOT" ? rewardConfig.hitProbability : undefined,
    currentUserPoints: currentUser?.points ?? 0,
    currentUserClaimed: Boolean(currentUserClaim?._count._all),
    currentUserClaimAmount: currentUserClaim?._sum.amount ?? undefined,
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
  senderBalanceBeforeChange: number
  config: NormalizedPostRedPacketConfig | null
  pointName: string
}) {
  if (!params.config?.enabled) {
    return 0
  }

  const rewardPoolState = buildRewardPoolStoredState(params.config)
  const preparedPublish = await prepareScopedPointDelta({
    scopeKey: params.config.mode === "JACKPOT" ? "JACKPOT_PUBLISH" : "RED_PACKET_PUBLISH",
    baseDelta: -rewardPoolState.totalPoints,
    userId: params.senderId,
  })
  const totalPoolPoints = Math.abs(preparedPublish.finalDelta)

  await assertPostRedPacketDailyLimit({ senderId: params.senderId, totalPoints: totalPoolPoints })

  await createPostRewardPoolRecord(params.tx, {
    postId: params.postId,
    senderId: params.senderId,
    grantMode: rewardPoolState.grantMode,
    claimOrderMode: rewardPoolState.claimOrderMode,
    triggerType: params.config.triggerType,
    totalPoints: totalPoolPoints,
    packetCount: params.config.mode === "JACKPOT" ? 0 : rewardPoolState.packetCount,
    remainingPoints: totalPoolPoints,
    remainingCount: rewardPoolState.remainingCount,
    status: "ACTIVE",
  })

  await applyPointDelta({
    tx: params.tx,
    userId: params.senderId,
    beforeBalance: params.senderBalanceBeforeChange,
    prepared: preparedPublish,
    pointName: params.pointName,
    insufficientMessage: `${params.pointName}不足，无法发布当前奖励池`,
    reason: params.config.mode === "JACKPOT"
      ? buildJackpotSendReason({ amount: rewardPoolState.totalPoints, pointName: params.pointName, postId: params.postId })
      : buildRedPacketSendReason({ amount: rewardPoolState.totalPoints, pointName: params.pointName, postId: params.postId }),
    relatedType: "POST",
    relatedId: params.postId,
  })

  return totalPoolPoints
}
