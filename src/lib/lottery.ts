import { NotificationType, type Comment, type Favorite, type Like, LotteryStatus, LotteryTriggerMode, type Post, type Prisma, type User } from "@/db/types"
import crypto from "node:crypto"

import { canSendEmail } from "@/lib/mailer"
import { prisma } from "@/db/client"

import { parseBusinessDateTime } from "@/lib/formatters"
import { getSiteSettings } from "@/lib/site-settings"




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
  conditionGroups: LotteryConditionGroupSummary[]
}

interface LotteryPostRelations extends Post {
  lotteryPrizes: Array<{
    id: string
    title: string
    description: string
    quantity: number
    sortOrder: number
    winners: Array<{
      userId: number
      drawnAt: Date
      user: {
        username: string
        nickname: string | null
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
    isEligible: boolean
    ineligibleReason: string | null
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
  if (input.participantGoal && input.participantGoal > 0) {
    return LotteryTriggerMode.AUTO_PARTICIPANT_COUNT
  }
  return LotteryTriggerMode.MANUAL
}

export function normalizeLotteryConfig(raw: unknown): { success: boolean; message?: string; data?: LotteryConfigInput } {
  const payload = (raw ?? {}) as Record<string, unknown>
  const prizes = Array.isArray(payload.prizes)
    ? payload.prizes
        .map((item) => ({
          title: String((item as Record<string, unknown> | null)?.title ?? "").trim(),
          description: String((item as Record<string, unknown> | null)?.description ?? "").trim(),
          quantity: normalizeInteger((item as Record<string, unknown> | null)?.quantity ?? 0),
        }))
        .filter((item) => item.title || item.description || item.quantity > 0)
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
    return { success: false, message: "自动开奖模式下请不要同时设置结束时间" }
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

  const [existingLike, existingFavorite] = await Promise.all([
    prisma.like.findUnique({
      where: {
        userId_targetType_targetId: {
          userId: input.user.id,
          targetType: "POST",
          targetId: input.post.id,
        },
      },
    }),
    prisma.favorite.findUnique({
      where: {
        userId_postId: {
          userId: input.user.id,
          postId: input.post.id,
        },
      },
    }),
  ])

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
  const [post, user, replyComment] = await Promise.all([
    prisma.post.findUnique({
      where: { id: input.postId },
      select: {
        id: true,
        authorId: true,
        lotteryStatus: true,
        lotteryStartsAt: true,
        lotteryEndsAt: true,
        lotteryLockedAt: true,
        lotteryConditions: {
          orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }],
          select: {
            type: true,
            operator: true,
            value: true,
            groupKey: true,
          },
        },
      },
    }),
    prisma.user.findUnique({ where: { id: input.userId } }),
    input.replyCommentId ? prisma.comment.findUnique({ where: { id: input.replyCommentId } }) : Promise.resolve(null),
  ])

  if (!post || !user) {
    return { joined: false, reason: "帖子或用户不存在" }
  }

  const eligibility = await checkLotteryEligibility({ post, user, replyComment })
  if (!eligibility.eligible) {
    await prisma.lotteryParticipant.upsert({
      where: {
        postId_userId: {
          postId: input.postId,
          userId: input.userId,
        },
      },
      update: {
        isEligible: false,
        ineligibleReason: eligibility.reason,
        sourceCommentId: input.replyCommentId ?? undefined,
      },
      create: {
        postId: input.postId,
        userId: input.userId,
        sourceCommentId: input.replyCommentId ?? undefined,
        isEligible: false,
        ineligibleReason: eligibility.reason,
      },
    })

    return { joined: false, reason: eligibility.reason }
  }

  await prisma.lotteryParticipant.upsert({
    where: {
      postId_userId: {
        postId: input.postId,
        userId: input.userId,
      },
    },
    update: {
      isEligible: true,
      ineligibleReason: null,
      sourceCommentId: input.replyCommentId ?? undefined,
      joinedAt: new Date(),
    },
    create: {
      postId: input.postId,
      userId: input.userId,
      sourceCommentId: input.replyCommentId ?? undefined,
      isEligible: true,
    },
  })

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
    `开奖时间：${input.drawnAt.toLocaleString("zh-CN")}`,
    `参与总人数：${input.participantCount}`,
  ]

  for (const prize of input.prizes) {
    const probability = input.participantCount > 0 ? ((prize.quantity / input.participantCount) * 100).toFixed(2) : "0.00"
    const winnerNames = prize.winners.map((winner) => winner.nickname ?? winner.username).join("、") || "无人中奖"
    lines.push(`${prize.title}（${prize.quantity} 名，理论中奖率 ${probability}%）：${winnerNames}`)
  }

  return lines.join("\n")
}

async function sendLotteryWinnerEmails(input: {
  postSlug: string
  postTitle: string
  winners: Array<{ email: string | null; nickname: string | null; username: string; prizeTitle: string }>
}) {
  const available = await canSendEmail().catch(() => false)
  if (!available) {
    return
  }

  const nodemailer = await import("nodemailer")
  const settings = await getSiteSettings()
  if (!settings.smtpEnabled || !settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPass || !settings.smtpFrom) {
    return
  }

  const { smtpFrom, smtpHost, smtpPass, smtpPort, smtpSecure, smtpUser } = settings
  const transporter = nodemailer.default.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })

  await Promise.all(

    input.winners
      .filter((winner): winner is { email: string; nickname: string | null; username: string; prizeTitle: string } => Boolean(winner.email))
      .map((winner) => transporter.sendMail({
        from: smtpFrom,

        to: winner.email,

        subject: `${settings.siteName} 抽奖中奖通知`,
        text: `${winner.nickname ?? winner.username}，恭喜你在帖子《${input.postTitle}》中获得 ${winner.prizeTitle}。请尽快前往站内查看开奖结果：/posts/${input.postSlug}`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#111"><h2>恭喜中奖</h2><p>${winner.nickname ?? winner.username}，你在帖子《${input.postTitle}》中获得了 <strong>${winner.prizeTitle}</strong>。</p><p>请尽快登录站内查看开奖结果与领奖说明。</p><p>帖子地址：/posts/${input.postSlug}</p></div>`,
      })),
  )
}

export async function drawLotteryWinners(postId: string, options?: { force?: boolean; actorId?: number | null }) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      author: true,
      lotteryPrizes: {
        orderBy: { sortOrder: "asc" },
      },
      lotteryConditions: {
        orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }],
      },
      lotteryParticipants: {
        where: {
          isEligible: true,
          user: {
            status: "ACTIVE",
          },
        },
        include: {
          user: true,
        },
        orderBy: { joinedAt: "asc" },
      },
      lotteryWinners: true,
    },
  })

  if (!post || post.type !== "LOTTERY") {
    throw new Error("抽奖帖不存在")
  }

  if (post.lotteryStatus === LotteryStatus.DRAWN && !options?.force) {
    throw new Error("该抽奖已开奖")
  }

  if (post.lotteryTriggerMode === LotteryTriggerMode.MANUAL && !options?.force) {
    if (!post.lotteryEndsAt || post.lotteryEndsAt.getTime() > Date.now()) {
      throw new Error("未到结束时间，暂不可开奖")
    }
  }

  if (post.lotteryTriggerMode === LotteryTriggerMode.AUTO_PARTICIPANT_COUNT && !options?.force) {
    const goal = post.lotteryParticipantGoal ?? 0
    if (goal <= 0 || post.lotteryParticipants.length < goal) {
      throw new Error("未达到自动开奖人数")
    }
  }

  if (post.lotteryPrizes.length === 0) {
    throw new Error("当前未配置奖项")
  }

  const lockedAt = new Date()
  const pool = secureShuffle(post.lotteryParticipants)
  const winnersToCreate: Prisma.LotteryWinnerCreateManyInput[] = []
  let cursor = 0

  for (const prize of post.lotteryPrizes) {
    for (let count = 0; count < prize.quantity && cursor < pool.length; count += 1) {
      const participant = pool[cursor]
      cursor += 1
      winnersToCreate.push({
        postId: post.id,
        prizeId: prize.id,
        participantId: participant.id,
        userId: participant.userId,
        drawnAt: lockedAt,
        createdAt: lockedAt,
      })
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: post.id },
      data: {
        lotteryStatus: LotteryStatus.LOCKED,
        lotteryLockedAt: lockedAt,
      },
    })

    await tx.lotteryParticipant.updateMany({
      where: {
        postId: post.id,
        isEligible: true,
      },
      data: {
        lockedAt,
        lockVersion: {
          increment: 1,
        },
      },
    })

    if (post.lotteryWinners.length > 0) {
      await tx.lotteryWinner.deleteMany({ where: { postId: post.id } })
    }

    if (winnersToCreate.length > 0) {
      await tx.lotteryWinner.createMany({ data: winnersToCreate })
    }

    const finalWinners = await tx.lotteryWinner.findMany({
      where: { postId: post.id },
      include: {
        prize: true,
        user: true,
      },
      orderBy: [{ prize: { sortOrder: "asc" } }, { createdAt: "asc" }],
    })

    const prizeSummary = post.lotteryPrizes.map((prize) => ({
      title: prize.title,
      quantity: prize.quantity,
      winners: finalWinners
        .filter((winner) => winner.prizeId === prize.id)
        .map((winner) => ({
          username: winner.user.username,
          nickname: winner.user.nickname,
        })),
    }))

    const announcement = buildLotteryAnnouncement({
      postTitle: post.title,
      participantCount: post.lotteryParticipants.length,
      prizes: prizeSummary,
      drawnAt: lockedAt,
    })

    await tx.post.update({
      where: { id: post.id },
      data: {
        lotteryStatus: LotteryStatus.DRAWN,
        lotteryAnnouncement: announcement,
        lotteryDrawnAt: lockedAt,
      },
    })

    const notifications = finalWinners.map((winner) => ({
      userId: winner.userId,
      type: NotificationType.SYSTEM,
      senderId: options?.actorId ?? null,
      relatedType: "POST" as const,
      relatedId: post.id,
      title: "你在抽奖帖中中奖了",
      content: `恭喜你在《${post.title}》中获得 ${winner.prize.title}，请前往帖子查看开奖结果。`,
    }))

    if (notifications.length > 0) {
      await tx.notification.createMany({ data: notifications })
    }

    return {
      announcement,
      winners: finalWinners,
    }
  })

  await sendLotteryWinnerEmails({
    postSlug: post.slug,
    postTitle: post.title,
    winners: updated.winners.map((winner) => ({
      email: winner.user.email,
      nickname: winner.user.nickname,
      username: winner.user.username,
      prizeTitle: winner.prize.title,
    })),
  })

  return {
    drawnAt: lockedAt,
    announcement: updated.announcement,
    winnerCount: updated.winners.length,
  }
}

export async function maybeAutoDrawLottery(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      type: true,
      lotteryStatus: true,
      lotteryTriggerMode: true,
      lotteryParticipantGoal: true,
      lotteryParticipants: {
        where: {
          isEligible: true,
          user: {
            status: "ACTIVE",
          },
        },
        select: { id: true },
      },
    },
  })

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
  const participantCount = post.lotteryParticipants?.filter((item) => item.isEligible).length ?? 0
  const totalPrizeQuantity = post.lotteryPrizes.reduce((sum, prize) => sum + prize.quantity, 0)
  const canEvaluateCurrentUser = Boolean(currentUserId)
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
    prizes: post.lotteryPrizes
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((prize) => ({
        id: prize.id,
        title: prize.title,
        description: prize.description,
        quantity: prize.quantity,
        winnerCount: prize.winners.length,
        winners: prize.winners.map((winner) => ({
          userId: winner.userId,
          username: winner.user.username,
          nickname: winner.user.nickname,
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
            matched: canEvaluateCurrentUser ? !matchedDescriptions?.has(description) : null,
          }
        }),


    })),
  }
}
