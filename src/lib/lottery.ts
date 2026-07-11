import { type Comment, type Favorite, type Like, LotteryStatus, LotteryTriggerMode, type Post, type Prisma, type User } from "@/db/types"
import crypto from "node:crypto"

import { prisma } from "@/db/client"
import {
  countLotteryParticipants,
  executeLotteryDrawTransaction,
  LotteryDrawClaimConflictError,
  findLotteryAutoDrawStatus,
  findLotteryDrawContext,
  findLotteryEnrollmentContext,
  findLotteryInteractionState,
  findLotteryParticipantPage,
  upsertLotteryParticipantEligibility,
} from "@/db/lottery-queries"
import { apiError } from "@/lib/api-route"
import { canSendBusinessEmail, sendUserNotificationEmail } from "@/lib/mailer"
import { isPublicReadablePostStatus } from "@/lib/post-types"


import { formatDateTime, parseBusinessDateTime } from "@/lib/formatters"
import {
  buildLotteryPrizeDefaultDescription,
  buildLotteryPrizeDefaultTitle,
  hasDuplicateLotteryRedemptionCodes,
  LOTTERY_REDEMPTION_CODE_LIMIT,
  LOTTERY_REDEMPTION_CODE_MAX_LENGTH,
  normalizeLotteryRedemptionCodes,
  normalizeLotteryPrizeType,
  normalizeLotteryVipPlan,
  type LotteryPrizeTypeValue,
  type LotteryVipPlanValue,
} from "@/lib/lottery-prizes"
import { getConfiguredSiteOrigin } from "@/lib/site-origin-config"
import { getServerSiteSettings } from "@/lib/site-settings"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"





export type LotteryConditionTypeValue = "REPLY_CONTENT_LENGTH" | "REPLY_KEYWORD" | "LIKE_POST" | "FAVORITE_POST" | "REGISTER_DAYS" | "USER_LEVEL" | "VIP_LEVEL" | "USER_POINTS"
export type LotteryConditionOperatorValue = "GTE" | "EQ"

const SUPPORTED_LOTTERY_CONDITION_TYPES = new Set<LotteryConditionTypeValue>(["REPLY_CONTENT_LENGTH", "REPLY_KEYWORD", "LIKE_POST", "FAVORITE_POST", "REGISTER_DAYS", "USER_LEVEL", "VIP_LEVEL", "USER_POINTS"])
const SUPPORTED_LOTTERY_CONDITION_OPERATORS = new Set<LotteryConditionOperatorValue>(["GTE", "EQ"])

export interface LotteryConditionInput {
  type: LotteryConditionTypeValue
  operator?: LotteryConditionOperatorValue
  value: string
  description?: string
  groupKey?: string
}

export interface LotteryPrizeInput {
  title: string
  description: string
  quantity: number
  type: LotteryPrizeTypeValue
  pointsAmount: number | null
  vipPlan: LotteryVipPlanValue | null
  redemptionCodes: string[]
}

export interface LotteryConfigInput {
  prizes: LotteryPrizeInput[]
  conditions: LotteryConditionInput[]
  startsAt?: Date | null
  endsAt?: Date | null
  participantGoal?: number | null
}

export interface LotteryConditionGroupSummary {
  key: string
  label: string
  conditions: Array<{
    id: string
    type: LotteryConditionTypeValue
    operator: LotteryConditionOperatorValue
    value: string
    description: string | null
    matched: boolean | null
  }>
}


export interface LotteryViewModel {
  status: LotteryStatus
  triggerMode: LotteryTriggerMode
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
    type: LotteryPrizeTypeValue
    pointsAmount: number | null
    vipPlan: LotteryVipPlanValue | null
    hasRedemptionCodes: boolean
    winnerCount: number
    winners: Array<{
      userId: number
      username: string
      nickname: string | null
      avatarPath: string | null
      redemptionCode: string | null
      drawnAt: string
    }>
  }>
  conditionGroups: LotteryConditionGroupSummary[]
}

export interface LotteryParticipantListItem {
  id: string
  userId: number
  username: string
  nickname: string | null
  avatarPath: string | null
  joinedAt: string
}

export interface LotteryParticipantListResult {
  items: LotteryParticipantListItem[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

interface LotteryPostRelations extends Post {
  lotteryPrizes: Array<{
    id: string
    title: string
    description: string
    quantity: number
    type: LotteryPrizeTypeValue
    pointsAmount: number | null
    vipPlan: LotteryVipPlanValue | null
    codesJson?: unknown
    unitCostPoints: number
    sortOrder: number
    winners: Array<{
      userId: number
      redemptionCode: string | null
      drawnAt: Date
      user: {
        username: string
        nickname: string | null
        avatarPath: string | null
      }
    }>
  }>
  lotteryConditions: Array<{
    id: string
    type: LotteryConditionTypeValue
    operator: LotteryConditionOperatorValue
    value: string
    description: string | null
    groupKey: string
    sortOrder: number
  }>
  lotteryParticipants?: Array<{
    userId: number
    joinedAt: Date
    isEligible: boolean
    ineligibleReason: string | null
    user: {
      username: string
      nickname: string | null
      avatarPath: string | null
      status: User["status"]
    }
  }>
  lotteryWinners?: Array<{ id: string }>
}

import { parseNonNegativeSafeInteger } from "@/lib/shared/safe-integer"

function normalizeInteger(value: unknown, fallback = 0) {
  return parseNonNegativeSafeInteger(value) ?? fallback
}


function buildConditionDescription(type: LotteryConditionTypeValue, operator: LotteryConditionOperatorValue, value: string) {
  switch (type) {
    case "REPLY_CONTENT_LENGTH":
      return `回帖内容至少 ${value} 字`
    case "REPLY_KEYWORD":
      return `回帖内容需包含：${value}`
    case "LIKE_POST":
      return "需点赞本帖"
    case "FAVORITE_POST":
      return "需收藏本帖"
    case "REGISTER_DAYS":
      return `注册时间至少 ${value} 天`
    case "USER_LEVEL":
      return `用户等级至少 Lv.${value}`
    case "VIP_LEVEL":
      return `VIP 等级至少 ${value}`
    case "USER_POINTS":
      return `积分至少 ${value}`
    default:
      return `${type} ${operator} ${value}`
  }
}

function buildConditionGroupLabel(index: number, total: number) {
  if (total <= 1) {
    return "参与条件"
  }
  return `参与方案 ${index + 1}`
}

export function determineLotteryTriggerMode(input: { endsAt?: Date | null; participantGoal?: number | null }) {
  if (input.endsAt) {
    return LotteryTriggerMode.MANUAL
  }

  if (input.participantGoal && input.participantGoal > 0) {
    return LotteryTriggerMode.AUTO_PARTICIPANT_COUNT
  }

  return LotteryTriggerMode.MANUAL
}

export function normalizeLotteryConfig(raw: unknown): { success: boolean; message?: string; data?: LotteryConfigInput } {
  const payload = (raw ?? {}) as Record<string, unknown>
  const prizes = Array.isArray(payload.prizes)
    ? payload.prizes
        .map((item) => {
          const rawItem = item as Record<string, unknown> | null
          const type = normalizeLotteryPrizeType(rawItem?.type)
          const pointsAmount = type === "POINTS"
            ? normalizeInteger(rawItem?.pointsAmount ?? rawItem?.amount ?? 0)
            : null
          const vipPlan = type === "VIP" ? normalizeLotteryVipPlan(rawItem?.vipPlan) : null
          const redemptionCodes = type === "REDEEM_CODE"
            ? normalizeLotteryRedemptionCodes(rawItem?.redemptionCodes ?? rawItem?.codes)
            : []
          const prize = {
            title: String(rawItem?.title ?? "").trim(),
            description: String(rawItem?.description ?? "").trim(),
            quantity: type === "REDEEM_CODE" ? redemptionCodes.length : normalizeInteger(rawItem?.quantity ?? 0),
            type,
            pointsAmount,
            vipPlan,
            redemptionCodes,
          }

          return {
            ...prize,
            title: prize.title || buildLotteryPrizeDefaultTitle(prize),
            description: prize.description || buildLotteryPrizeDefaultDescription(prize),
          }
        })
        .filter((item) => item.title || item.description || item.quantity > 0 || item.type !== "MANUAL" || item.redemptionCodes.length > 0)
    : []

  const conditions = Array.isArray(payload.conditions)
    ? payload.conditions
        .map((item) => ({
          type: String((item as Record<string, unknown> | null)?.type ?? "").trim().toUpperCase() as LotteryConditionTypeValue,
          operator: String((item as Record<string, unknown> | null)?.operator ?? "GTE").trim().toUpperCase() as LotteryConditionOperatorValue,
          value: String((item as Record<string, unknown> | null)?.value ?? "").trim(),
          description: String((item as Record<string, unknown> | null)?.description ?? "").trim() || undefined,
          groupKey: String((item as Record<string, unknown> | null)?.groupKey ?? "default").trim() || "default",
        }))
        .filter((item) => item.type && item.value)
    : []

  const startsAt = typeof payload.startsAt === "string" && String(payload.startsAt).trim() ? parseBusinessDateTime(String(payload.startsAt)) : null
  const endsAt = typeof payload.endsAt === "string" && String(payload.endsAt).trim() ? parseBusinessDateTime(String(payload.endsAt)) : null

  const participantGoal = payload.participantGoal == null || payload.participantGoal === ""
    ? null
    : normalizeInteger(payload.participantGoal)

  if (prizes.length === 0) {
    return { success: false, message: "抽奖帖至少需要配置一个奖项" }
  }

  if (prizes.length > 20) {
    return { success: false, message: "奖项不能超过 20 个" }
  }

  if (prizes.some((item) => !item.title || item.title.length > 40 || !item.description || item.description.length > 200 || item.quantity < 1 || item.quantity > 1000)) {
    return { success: false, message: "奖项名称、描述或数量不合法" }
  }

  for (const prize of prizes) {
    if (prize.type === "POINTS") {
      if (!Number.isInteger(prize.pointsAmount) || (prize.pointsAmount ?? 0) < 1 || (prize.pointsAmount ?? 0) > 100000) {
        return { success: false, message: "积分奖品额度需为 1-100000 的整数" }
      }
      continue
    }

    if (prize.type === "VIP" && !prize.vipPlan) {
      return { success: false, message: "会员权益奖品配置不合法" }
    }

    if (prize.type === "REDEEM_CODE") {
      if (prize.redemptionCodes.length < 1 || prize.redemptionCodes.length > LOTTERY_REDEMPTION_CODE_LIMIT) {
        return { success: false, message: `兑换码奖品需提供 1-${LOTTERY_REDEMPTION_CODE_LIMIT} 个兑换码` }
      }

      if (prize.redemptionCodes.some((code) => code.length > LOTTERY_REDEMPTION_CODE_MAX_LENGTH)) {
        return { success: false, message: `单个兑换码长度不能超过 ${LOTTERY_REDEMPTION_CODE_MAX_LENGTH} 个字符` }
      }

      if (hasDuplicateLotteryRedemptionCodes(prize.redemptionCodes)) {
        return { success: false, message: "兑换码不能重复" }
      }
    }
  }

  if (conditions.length === 0) {
    return { success: false, message: "请至少配置一个参与条件" }
  }

  if (conditions.length > 20) {
    return { success: false, message: "参与条件不能超过 20 个" }
  }

  if (conditions.some((item) => !SUPPORTED_LOTTERY_CONDITION_TYPES.has(item.type) || !SUPPORTED_LOTTERY_CONDITION_OPERATORS.has(item.operator))) {
    return { success: false, message: "包含不支持的抽奖条件" }
  }

  for (const condition of conditions) {
    if (condition.type === "REPLY_KEYWORD") {
      if (!condition.value || condition.value.length > 100) {
        return { success: false, message: "指定回复内容条件长度需为 1-100 个字符" }
      }
      continue
    }

    const numericValue = Number(condition.value)
    if (!Number.isInteger(numericValue) || numericValue < 0) {
      return { success: false, message: "抽奖条件阈值必须是非负整数" }
    }
  }

  if (startsAt && Number.isNaN(startsAt.getTime())) {
    return { success: false, message: "抽奖开始时间不合法" }
  }

  if (endsAt && Number.isNaN(endsAt.getTime())) {
    return { success: false, message: "抽奖结束时间不合法" }
  }

  if (participantGoal !== null && (!Number.isInteger(participantGoal) || participantGoal < 1 || participantGoal > 100000)) {
    return { success: false, message: "自动开奖人数需为 1-100000 的整数" }
  }

  if (endsAt && startsAt && endsAt.getTime() <= startsAt.getTime()) {
    return { success: false, message: "抽奖结束时间必须晚于开始时间" }
  }

  if (!endsAt && !participantGoal) {
    return { success: false, message: "请设置结束时间或自动开奖人数" }
  }

  if (participantGoal && endsAt) {
    return { success: false, message: "结束时间与目标参与人数不能同时设置，请二选一" }
  }

  return {
    success: true,
    data: {
      prizes,
      conditions,
      startsAt,
      endsAt,
      participantGoal,
    },
  }
}

async function evaluateSingleCondition(input: {
  condition: {
    type: LotteryConditionTypeValue
    operator: LotteryConditionOperatorValue
    value: string
  }
  postId: string
  user: User
  replyComment?: Comment | null
  existingLike?: Like | null
  existingFavorite?: Favorite | null
}) {
  const { condition, user, replyComment, existingLike, existingFavorite } = input
  switch (condition.type) {
    case "REPLY_CONTENT_LENGTH": {
      const minLength = Number(condition.value)
      return Boolean(replyComment && replyComment.content.trim().length >= minLength)
    }
    case "REPLY_KEYWORD":
      return Boolean(replyComment && replyComment.content.includes(condition.value))
    case "LIKE_POST":
      return Boolean(existingLike)
    case "FAVORITE_POST":
      return Boolean(existingFavorite)
    case "REGISTER_DAYS": {
      const requiredDays = Number(condition.value)
      const diffDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (24 * 60 * 60 * 1000))
      return diffDays >= requiredDays
    }
    case "USER_LEVEL":
      return user.level >= Number(condition.value)
    case "VIP_LEVEL":
      return user.vipLevel >= Number(condition.value)
    case "USER_POINTS":
      return user.points >= Number(condition.value)
    default:
      return false
  }
}

async function checkLotteryEligibility(input: {
  post: {
    id: string
    authorId: number
    lotteryStatus: LotteryStatus | null
    lotteryStartsAt: Date | null
    lotteryEndsAt: Date | null
    lotteryLockedAt: Date | null
    lotteryConditions: Array<{
      type: LotteryConditionTypeValue
      operator: LotteryConditionOperatorValue
      value: string
      groupKey: string
    }>
  }
  user: User
  replyComment?: Comment | null
}): Promise<{ eligible: boolean; reason: string | null }> {

  const now = Date.now()
  if (input.user.status !== "ACTIVE") {
    return { eligible: false, reason: "账号状态异常，无法参与抽奖" }
  }

  if (input.post.authorId === input.user.id) {
    return { eligible: false, reason: "楼主不能参与自己的抽奖" }
  }

  if (!input.post.lotteryStatus || input.post.lotteryStatus === LotteryStatus.CANCELLED || input.post.lotteryStatus === LotteryStatus.DRAWN) {
    return { eligible: false, reason: "当前抽奖已结束" }
  }

  if (input.post.lotteryLockedAt) {
    return { eligible: false, reason: "开奖名单已锁定" }
  }

  if (input.post.lotteryStartsAt && input.post.lotteryStartsAt.getTime() > now) {
    return { eligible: false, reason: "抽奖尚未开始" }
  }

  if (input.post.lotteryEndsAt && input.post.lotteryEndsAt.getTime() <= now) {
    return { eligible: false, reason: "抽奖已截止" }
  }

  const [existingLike, existingFavorite] = await findLotteryInteractionState({
    postId: input.post.id,
    userId: input.user.id,
  })


  const grouped = new Map<string, typeof input.post.lotteryConditions>()
  for (const condition of input.post.lotteryConditions) {
    const list = grouped.get(condition.groupKey) ?? []
    list.push(condition)
    grouped.set(condition.groupKey, list)
  }

  let firstGroupReasons: string[] = []
  let hasAnyGroupPassed = false
  for (const [, conditions] of grouped) {
    const failedReasons: string[] = []
    for (const condition of conditions) {
      const passed = await evaluateSingleCondition({
        condition,
        postId: input.post.id,
        user: input.user,
        replyComment: input.replyComment,
        existingLike,
        existingFavorite,
      })
      if (!passed) {
        failedReasons.push(buildConditionDescription(condition.type, condition.operator, condition.value))
      }
    }

    if (failedReasons.length === 0) {
      hasAnyGroupPassed = true
      break
    }

    if (firstGroupReasons.length === 0) {
      firstGroupReasons = failedReasons
    }
  }

  if (!hasAnyGroupPassed) {
    return { eligible: false, reason: firstGroupReasons.length > 0 ? `未满足：${firstGroupReasons.join("；")}` : "当前未满足抽奖参与条件" }
  }


  return { eligible: true as const, reason: null }
}

export async function enrollUserInLotteryPool(input: { postId: string; userId: number; replyCommentId?: string | null }) {
  const [post, user, replyComment] = await findLotteryEnrollmentContext(input)

  if (!post || !user) {
    return { joined: false, reason: "帖子或用户不存在" }
  }

  const eligibility = await checkLotteryEligibility({ post, user, replyComment })
  if (!eligibility.eligible) {
    await upsertLotteryParticipantEligibility({
      postId: input.postId,
      userId: input.userId,
      replyCommentId: input.replyCommentId,
      isEligible: false,
      ineligibleReason: eligibility.reason,
    })

    return { joined: false, reason: eligibility.reason }
  }

  const participant = await upsertLotteryParticipantEligibility({
    postId: input.postId,
    userId: input.userId,
    replyCommentId: input.replyCommentId,
    isEligible: true,
    ineligibleReason: null,
    joinedAt: new Date(),
  })

  if (!participant) {
    return { joined: false, reason: "抽奖已结束或已开奖" }
  }

  await maybeAutoDrawLottery(input.postId)
  return { joined: true, reason: null }
}







function secureShuffle<T>(items: T[]) {
  const values = [...items]
  for (let index = values.length - 1; index > 0; index -= 1) {
    const random = crypto.randomInt(0, index + 1)
    ;[values[index], values[random]] = [values[random], values[index]]
  }
  return values
}

function buildLotteryAnnouncement(input: {
  postTitle: string
  participantCount: number
  prizes: Array<{
    title: string
    quantity: number
    winners: Array<{ nickname: string | null; username: string }>
  }>
  drawnAt: Date
}) {
  const lines = [
    `《${input.postTitle}》抽奖结果公示`,
    `开奖时间：${formatDateTime(input.drawnAt)}`,
    `参与总人数：${input.participantCount}`,
  ]

  for (const prize of input.prizes) {
    const probability = input.participantCount > 0 ? ((prize.quantity / input.participantCount) * 100).toFixed(2) : "0.00"
    const winnerNames = prize.winners.map((winner) => winner.nickname ?? winner.username).join("、") || "无人中奖"
    lines.push(`${prize.title}（${prize.quantity} 名，理论中奖率 ${probability}%）：${winnerNames}`)
  }

  return lines.join("\n")
}

function buildLotteryPostUrl(postSlug: string) {
  const path = `/posts/${postSlug}`
  const origin = getConfiguredSiteOrigin()
  return origin ? new URL(path, `${origin}/`).toString() : path
}

async function sendLotteryWinnerEmails(input: {
  postSlug: string
  postTitle: string
  winners: Array<{ email: string | null; nickname: string | null; username: string; prizeTitle: string }>
}) {
  const available = await canSendBusinessEmail("lotteryWinner").catch(() => false)
  if (!available) {
    return
  }

  const settings = await getServerSiteSettings()
  if (!settings.smtpEnabled || !settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPass || !settings.smtpFrom) {
    return
  }

  const postUrl = buildLotteryPostUrl(input.postSlug)

  await Promise.all(

    input.winners
      .filter((winner): winner is { email: string; nickname: string | null; username: string; prizeTitle: string } => Boolean(winner.email))
      .map((winner) => sendUserNotificationEmail({
        to: winner.email,
        subject: `${settings.siteName} 抽奖中奖通知`,
        text: `${winner.nickname ?? winner.username}，恭喜你在帖子《${input.postTitle}》中获得 ${winner.prizeTitle}。请尽快前往站内查看开奖结果：${postUrl}`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#111"><h2>恭喜中奖</h2><p>${winner.nickname ?? winner.username}，你在帖子《${input.postTitle}》中获得了 <strong>${winner.prizeTitle}</strong>。</p><p>请尽快登录站内查看开奖结果与领奖说明。</p><p>帖子地址：${postUrl}</p></div>`,
        businessKey: "lotteryWinner",
      })),
  )
}

type LotteryDrawContext = NonNullable<Awaited<ReturnType<typeof findLotteryDrawContext>>>

function assertLotteryDrawTriggerSatisfied(post: LotteryDrawContext) {
  if (post.lotteryTriggerMode === LotteryTriggerMode.MANUAL) {
    if (!post.lotteryEndsAt || post.lotteryEndsAt.getTime() > Date.now()) {
      apiError(409, "抽奖尚未到开奖时间")
    }
  }

  if (post.lotteryTriggerMode === LotteryTriggerMode.AUTO_PARTICIPANT_COUNT) {
    const goal = post.lotteryParticipantGoal ?? 0
    if (goal <= 0 || post.lotteryParticipants.length < goal) {
      apiError(409, "尚未达到参与人数目标")
    }
  }

  if (post.lotteryPrizes.length === 0) {
    apiError(400, "请至少设置一个奖项")
  }
}

function buildLotteryDraw(input: { post: LotteryDrawContext; lockedAt: Date }) {
  const pool = secureShuffle(input.post.lotteryParticipants)
  const winnersToCreate: Prisma.LotteryWinnerCreateManyInput[] = []
  let cursor = 0

  for (const prize of input.post.lotteryPrizes) {
    const redemptionCodes = prize.type === "REDEEM_CODE"
      ? normalizeLotteryRedemptionCodes(prize.codesJson)
      : []

    for (let count = 0; count < prize.quantity && cursor < pool.length; count += 1) {
      const participant = pool[cursor]
      cursor += 1
      winnersToCreate.push({
        postId: input.post.id,
        prizeId: prize.id,
        participantId: participant.id,
        userId: participant.userId,
        redemptionCode: redemptionCodes[count] ?? null,
        drawnAt: input.lockedAt,
        createdAt: input.lockedAt,
      })
    }
  }

  const prizeSummary = input.post.lotteryPrizes.map((prize) => ({
    title: prize.title,
    quantity: prize.quantity,
    winners: winnersToCreate
      .filter((winner) => winner.prizeId === prize.id)
      .map((winner) => {
        const matchedParticipant = input.post.lotteryParticipants.find((participant) => participant.id === winner.participantId)
        return {
          username: matchedParticipant?.user.username ?? "",
          nickname: matchedParticipant?.user.nickname ?? null,
        }
      }),
  }))

  return {
    winnersToCreate,
    announcement: buildLotteryAnnouncement({
      postTitle: input.post.title,
      participantCount: input.post.lotteryParticipants.length,
      prizes: prizeSummary,
      drawnAt: input.lockedAt,
    }),
  }
}

export async function drawLotteryWinners(postId: string, options?: { force?: boolean; actorId?: number | null }) {
  const post = await findLotteryDrawContext(postId)

  if (!post || post.type !== "LOTTERY" || !isPublicReadablePostStatus(post.status)) {
    apiError(404, "抽奖帖不存在")
  }

  if (post.lotteryStatus !== LotteryStatus.ACTIVE || post.lotteryLockedAt || post.lotteryDrawnAt) {
    apiError(409, post.lotteryStatus === LotteryStatus.DRAWN ? "抽奖已经开奖" : "抽奖正在开奖中")
  }

  assertLotteryDrawTriggerSatisfied(post)

  const lockedAt = new Date()
  const settings = await getServerSiteSettings()

  let updated: Awaited<ReturnType<typeof executeLotteryDrawTransaction>>
  try {
    updated = await executeLotteryDrawTransaction({
      postId,
      lockedAt,
      actorId: options?.actorId,
      prizeCostSettings: settings,
      buildDraw: (lockedPost) => {
        assertLotteryDrawTriggerSatisfied(lockedPost)
        return buildLotteryDraw({ post: lockedPost, lockedAt })
      },
    })
  } catch (error) {
    if (error instanceof LotteryDrawClaimConflictError) {
      apiError(409, "抽奖已由其他请求处理")
    }

    throw error
  }

  await sendLotteryWinnerEmails({
    postSlug: updated.post.slug,
    postTitle: updated.post.title,
    winners: updated.winners.map((winner) => ({
      email: winner.user.email,
      nickname: winner.user.nickname,
      username: winner.user.username,
      prizeTitle: winner.prize.title,
    })),
  })

  for (const userId of updated.affectedUserIds) {
    revalidateUserSurfaceCache(userId)
  }

  return {
    drawnAt: lockedAt,
    announcement: updated.announcement,
    winnerCount: updated.winners.length,
  }
}

export async function maybeAutoDrawLottery(postId: string) {
  const post = await findLotteryAutoDrawStatus(postId)

  if (!post || post.type !== "LOTTERY" || post.lotteryStatus === LotteryStatus.DRAWN || post.lotteryTriggerMode !== LotteryTriggerMode.AUTO_PARTICIPANT_COUNT) {
    return false
  }

  const goal = post.lotteryParticipantGoal ?? 0
  if (goal > 0 && post.lotteryParticipants.length >= goal) {
    await drawLotteryWinners(postId)
    return true
  }

  return false
}


export function mapLotteryView(post: LotteryPostRelations, currentUserId?: number): LotteryViewModel | undefined {
  if (post.type !== "LOTTERY") {
    return undefined
  }

  const participant = post.lotteryParticipants?.find((item) => item.userId === currentUserId)
  const eligibleParticipants = (post.lotteryParticipants ?? []).filter((item) => item.isEligible && item.user.status === "ACTIVE")
  const participantCount = eligibleParticipants.length
  const totalPrizeQuantity = post.lotteryPrizes.reduce((sum, prize) => sum + prize.quantity, 0)
  const canEvaluateCurrentUser = Boolean(currentUserId)
  const hasParticipantRecord = Boolean(participant)
  const matchedDescriptions = participant?.ineligibleReason && participant.ineligibleReason.startsWith("未满足：")
    ? new Set(participant.ineligibleReason.replace(/^未满足：/, "").split("；").map((item) => item.trim()).filter(Boolean))
    : null

  const grouped = Array.from(

    post.lotteryConditions.reduce((map, condition) => {
      const list = map.get(condition.groupKey) ?? []
      list.push(condition)
      map.set(condition.groupKey, list)
      return map
    }, new Map<string, LotteryPostRelations["lotteryConditions"]>()),
  )

  return {
    status: post.lotteryStatus ?? LotteryStatus.DRAFT,
    triggerMode: post.lotteryTriggerMode ?? LotteryTriggerMode.MANUAL,
    renderedAt: new Date().toISOString(),
    startsAt: post.lotteryStartsAt?.toISOString() ?? null,
    endsAt: post.lotteryEndsAt?.toISOString() ?? null,
    participantGoal: post.lotteryParticipantGoal ?? null,
    participantCount,
    lockedAt: post.lotteryLockedAt?.toISOString() ?? null,
    drawnAt: post.lotteryDrawnAt?.toISOString() ?? null,
    announcement: post.lotteryAnnouncement ?? null,
    joined: Boolean(participant?.isEligible),
    eligible: participant?.isEligible ?? false,
    ineligibleReason: participant?.ineligibleReason ?? null,
    currentProbability: participantCount > 0 ? Number(((Math.min(totalPrizeQuantity, participantCount) / participantCount) * 100).toFixed(2)) : null,
    participantPreviews: eligibleParticipants
      .sort((left, right) => right.joinedAt.getTime() - left.joinedAt.getTime())
      .slice(0, 10)
      .map((item) => ({
        userId: item.userId,
        username: item.user.username,
        nickname: item.user.nickname,
        avatarPath: item.user.avatarPath ?? null,
        joinedAt: item.joinedAt.toISOString(),
      })),
    prizes: post.lotteryPrizes
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((prize) => ({
        id: prize.id,
        title: prize.title,
        description: prize.description,
        quantity: prize.quantity,
        type: prize.type,
        pointsAmount: prize.pointsAmount,
        vipPlan: prize.vipPlan,
        hasRedemptionCodes: prize.type === "REDEEM_CODE",
        winnerCount: prize.winners.length,
        winners: prize.winners.map((winner) => ({
          userId: winner.userId,
          username: winner.user.username,
          nickname: winner.user.nickname,
          avatarPath: winner.user.avatarPath ?? null,
          redemptionCode: currentUserId && winner.userId === currentUserId ? (winner.redemptionCode ?? null) : null,
          drawnAt: winner.drawnAt.toISOString(),
        })),
      })),
    conditionGroups: grouped.map(([groupKey, conditions], index) => ({
      key: groupKey,
      label: buildConditionGroupLabel(index, grouped.length),
      conditions: conditions
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((condition) => {
          const description = buildConditionDescription(condition.type, condition.operator, condition.value)
          return {
            id: condition.id,
            type: condition.type,
            operator: condition.operator,
            value: condition.value,
            description,
            matched: canEvaluateCurrentUser ? (hasParticipantRecord ? !matchedDescriptions?.has(description) : null) : null,

          }
        }),


    })),
  }
}

export async function getLotteryParticipantList(
  postId: string,
  options?: {
    page?: number
    pageSize?: number
  },
): Promise<LotteryParticipantListResult | null> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      type: true,
      status: true,
    },
  })

  if (!post || post.type !== "LOTTERY" || !isPublicReadablePostStatus(post.status)) {
    return null
  }

  const pageSize = Math.min(20, Math.max(1, Math.trunc(options?.pageSize ?? 10)))
  const page = Math.max(1, Math.trunc(options?.page ?? 1))
  const total = await countLotteryParticipants(postId)
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount)
  const rows = await findLotteryParticipantPage(postId, (safePage - 1) * pageSize, pageSize)

  return {
    items: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      username: row.user.username,
      nickname: row.user.nickname,
      avatarPath: row.user.avatarPath ?? null,
      joinedAt: row.joinedAt.toISOString(),
    })),
    total,
    page: safePage,
    pageSize,
    pageCount,
  }
}
