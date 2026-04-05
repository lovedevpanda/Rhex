import { BadgeRuleOperator, BadgeRuleType, BadgeGrantSource, PointEffectDirection, PointEffectRuleKind, PointEffectTargetType } from "@/db/types"

import { createSelfClaimUserBadge, findAllBadgesWithRules, findBadgeEffectRulesByBadgeIds, findBadgeEligibilityUserSnapshot, findBadgeUserPoints, findDisplayedUserBadges, findGrantedBadgesForUserRecord, findGrantedUserBadge, findGrantedUserBadgeWithTx, findUserBadgeDisplayStates, findUserBadgeWithBadge, runBadgeTransaction, updateUserBadgeDisplayById } from "@/db/badge-queries"
import { apiError } from "./api-route"
import type { BadgeRuleTypeValue } from "@/lib/badge-rule-definitions"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { getSiteSettings } from "@/lib/site-settings"

export interface BadgeRuleItem {
  id: string
  badgeId: string
  ruleType: BadgeRuleTypeValue
  operator: BadgeRuleOperator
  value: string
  extraValue?: string | null
  sortOrder: number
}

export interface BadgeItem {
  id: string
  name: string
  code: string
  description?: string | null
  iconPath?: string | null
  iconText?: string | null
  color: string
  imageUrl?: string | null
  category?: string | null
  sortOrder: number
  pointsCost: number
  status: boolean
  isHidden: boolean
  createdAt: string
  updatedAt: string
  rules: BadgeRuleItem[]
  effects: BadgeEffectRuleItem[]
  grantedUserCount?: number
}

export interface BadgeEffectRuleItem {
  id: string
  badgeId: string | null
  name: string
  description?: string | null
  targetType: PointEffectTargetType
  scopeKeys: string[]
  ruleKind: PointEffectRuleKind
  direction: PointEffectDirection
  value: number
  extraValue?: number | null
  startMinuteOfDay?: number | null
  endMinuteOfDay?: number | null
  sortOrder: number
  status: boolean
  createdAt: string
  updatedAt: string
}

export interface BadgeEligibilitySnapshot {
  userId: number
  points: number
  registerDays: number
  createdAt: Date
  postCount: number
  commentCount: number
  receivedLikeCount: number
  inviteCount: number
  acceptedAnswerCount: number
  sentTipCount: number
  receivedTipCount: number
  followerCount: number
  level: number
  checkInDays: number
  vipLevel: number
}


export interface BadgeEligibilityResult {
  badgeId: string
  eligible: boolean
  alreadyGranted: boolean
  progressText: string
  failedRules: string[]
  pointsCost: number
  purchaseRequired: boolean
  canAffordPurchase: boolean
}

const MAX_DISPLAYED_BADGES = 3

const RULE_LABELS: Record<string, string> = {

  REGISTER_DAYS: "注册天数",
  REGISTER_TIME_RANGE: "注册时间",
  POST_COUNT: "发帖数",
  COMMENT_COUNT: "回复数",
  RECEIVED_LIKE_COUNT: "获赞数",
  INVITE_COUNT: "邀请人数",
  ACCEPTED_ANSWER_COUNT: "被采纳数",
  SENT_TIP_COUNT: "打赏次数",
  RECEIVED_TIP_COUNT: "被打赏次数",
  FOLLOWER_COUNT: "粉丝数",
  USER_ID: "UID",
  LEVEL: "等级",
  CHECK_IN_DAYS: "签到天数",
  VIP_LEVEL: "VIP 等级",
}

function buildBadgeEffectMap(effectRows: Awaited<ReturnType<typeof findBadgeEffectRulesByBadgeIds>>) {
  const effectMap = new Map<string, BadgeEffectRuleItem[]>()

  effectRows.forEach((effect) => {
    if (!effect.badgeId) {
      return
    }

    const current = effectMap.get(effect.badgeId) ?? []
    current.push({
      id: effect.id,
      badgeId: effect.badgeId,
      name: effect.name,
      description: effect.description,
      targetType: effect.targetType,
      scopeKeys: effect.scopeKeys,
      ruleKind: effect.ruleKind,
      direction: effect.direction,
      value: effect.value,
      extraValue: effect.extraValue,
      startMinuteOfDay: effect.startMinuteOfDay,
      endMinuteOfDay: effect.endMinuteOfDay,
      sortOrder: effect.sortOrder,
      status: effect.status,
      createdAt: effect.createdAt.toISOString(),
      updatedAt: effect.updatedAt.toISOString(),
    })
    effectMap.set(effect.badgeId, current)
  })

  return effectMap
}


function toNonNegativeInt(value: string | number | null | undefined) {
  return Math.max(0, Number(value) || 0)
}

function normalizeDate(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function compareNumber(actual: number, operator: BadgeRuleOperator, expected: number) {
  switch (operator) {
    case BadgeRuleOperator.GT:
      return actual > expected
    case BadgeRuleOperator.GTE:
      return actual >= expected
    case BadgeRuleOperator.EQ:
      return actual === expected
    case BadgeRuleOperator.LT:
      return actual < expected
    case BadgeRuleOperator.LTE:
      return actual <= expected
    default:
      return false
  }
}

function describeNumberRule(rule: BadgeRuleItem) {
  const label = RULE_LABELS[rule.ruleType]
  const value = toNonNegativeInt(rule.value)

  const operatorLabel: Record<string, string> = {
    [BadgeRuleOperator.GT]: "大于",
    [BadgeRuleOperator.GTE]: "大于等于",
    [BadgeRuleOperator.EQ]: "等于",
    [BadgeRuleOperator.LT]: "小于",
    [BadgeRuleOperator.LTE]: "小于等于",
  }

  return `${label}${operatorLabel[rule.operator] ?? "达到"}${value}`
}

export function describeBadgeRule(rule: BadgeRuleItem) {
  if (rule.ruleType === BadgeRuleType.REGISTER_TIME_RANGE) {
    const start = normalizeDate(rule.value)
    const end = normalizeDate(rule.extraValue ?? null)

    if (rule.operator === BadgeRuleOperator.BETWEEN && start && end) {
      return `注册时间在 ${start.toLocaleDateString("zh-CN")} - ${end.toLocaleDateString("zh-CN")}`
    }

    if (rule.operator === BadgeRuleOperator.AFTER && start) {
      return `注册时间晚于 ${start.toLocaleDateString("zh-CN")}`
    }

    if (rule.operator === BadgeRuleOperator.BEFORE && start) {
      return `注册时间早于 ${start.toLocaleDateString("zh-CN")}`
    }

    return "注册时间符合指定范围"
  }

  return describeNumberRule(rule)
}

export function describeBadgeRules(rules: BadgeRuleItem[]) {
  if (rules.length === 0) {
    return "无领取门槛"
  }

  return rules
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => describeBadgeRule(item))
    .join(" · ")
}

export async function getBadgeEligibilitySnapshot(userId: number): Promise<BadgeEligibilitySnapshot | null> {
  const [user, progress, tipStats] = await findBadgeEligibilityUserSnapshot(userId)


  if (!user) {
    return null
  }

  const now = Date.now()
  const registerDays = Math.max(0, Math.floor((now - user.createdAt.getTime()) / 86400000))

  return {
    userId: user.id,
    points: user.points,
    registerDays,
    createdAt: user.createdAt,
    postCount: user.postCount,
    commentCount: user.commentCount,
    receivedLikeCount: user.likeReceivedCount,
    inviteCount: user.inviteCount,
    acceptedAnswerCount: user.acceptedAnswerCount,
    sentTipCount: tipStats.sentTipCount,
    receivedTipCount: tipStats.receivedTipCount,
    followerCount: user._count.followedByUsers,
    level: user.level,
    checkInDays: progress?.checkInDays ?? 0,

    vipLevel: user.vipLevel,
  }
}

function evaluateSingleRule(snapshot: BadgeEligibilitySnapshot, rule: BadgeRuleItem) {
  const numberMap: Partial<Record<string, number>> = {

    REGISTER_DAYS: snapshot.registerDays,
    POST_COUNT: snapshot.postCount,
    COMMENT_COUNT: snapshot.commentCount,
    RECEIVED_LIKE_COUNT: snapshot.receivedLikeCount,
    INVITE_COUNT: snapshot.inviteCount,
    ACCEPTED_ANSWER_COUNT: snapshot.acceptedAnswerCount,
    SENT_TIP_COUNT: snapshot.sentTipCount,
    RECEIVED_TIP_COUNT: snapshot.receivedTipCount,
    FOLLOWER_COUNT: snapshot.followerCount,
    USER_ID: snapshot.userId,

    LEVEL: snapshot.level,
    CHECK_IN_DAYS: snapshot.checkInDays,
    VIP_LEVEL: snapshot.vipLevel,
  }

  if (rule.ruleType === BadgeRuleType.REGISTER_TIME_RANGE) {
    const start = normalizeDate(rule.value)
    const end = normalizeDate(rule.extraValue ?? null)
    const actualTime = snapshot.createdAt.getTime()

    if (rule.operator === BadgeRuleOperator.AFTER && start) {
      return actualTime > start.getTime()
    }

    if (rule.operator === BadgeRuleOperator.BEFORE && start) {
      return actualTime < start.getTime()
    }

    if (rule.operator === BadgeRuleOperator.BETWEEN && start && end) {
      return actualTime >= start.getTime() && actualTime <= end.getTime()
    }

    return false
  }

  const actual = numberMap[rule.ruleType]
  if (typeof actual !== "number") {
    return false
  }

  return compareNumber(actual, rule.operator, toNonNegativeInt(rule.value))
}

export async function getBadgeEligibilityResult(userId: number, badge: BadgeItem): Promise<BadgeEligibilityResult> {
  const [snapshot, existing] = await Promise.all([
    getBadgeEligibilitySnapshot(userId),
    findGrantedUserBadge(userId, badge.id),
  ])


  if (!snapshot) {
    return {
      badgeId: badge.id,
      eligible: false,
      alreadyGranted: false,
      progressText: "未登录",
      failedRules: ["未登录"],
      pointsCost: badge.pointsCost,
      purchaseRequired: badge.pointsCost > 0,
      canAffordPurchase: false,
    }
  }

  const failedRules = badge.rules
    .filter((rule) => !evaluateSingleRule(snapshot, rule))
    .map((rule) => describeBadgeRule(rule))

  const eligible = failedRules.length === 0
  const alreadyGranted = Boolean(existing)

  return {
    badgeId: badge.id,
    eligible,
    alreadyGranted,
    progressText: alreadyGranted
      ? "已领取"
      : !eligible
        ? failedRules[0] ?? "暂未达成"
        : badge.pointsCost > 0
          ? `需支付 ${badge.pointsCost} 积分`
          : "可领取",
    failedRules,
    pointsCost: badge.pointsCost,
    purchaseRequired: badge.pointsCost > 0,
    canAffordPurchase: snapshot.points >= badge.pointsCost,
  }
}

export async function getAllBadges(): Promise<BadgeItem[]> {
  const badges = await findAllBadgesWithRules()
  const effectRows = await findBadgeEffectRulesByBadgeIds(badges.map((badge) => badge.id))
  const effectMap = buildBadgeEffectMap(effectRows)


  return badges.map((badge) => ({
    id: badge.id,
    name: badge.name,
    code: badge.code,
    description: badge.description,
    iconPath: badge.iconPath,
    iconText: badge.iconText,
    color: badge.color,
    imageUrl: badge.imageUrl,
    category: badge.category,
    sortOrder: badge.sortOrder,
    pointsCost: badge.pointsCost,
    status: badge.status,
    isHidden: badge.isHidden,
    createdAt: badge.createdAt.toISOString(),
    updatedAt: badge.updatedAt.toISOString(),
    rules: badge.rules.map((rule) => ({
      id: rule.id,
      badgeId: rule.badgeId,
      ruleType: rule.ruleType,
      operator: rule.operator,
      value: rule.value,
      extraValue: rule.extraValue,
      sortOrder: rule.sortOrder,
    })),
    effects: effectMap.get(badge.id) ?? [],
    grantedUserCount: badge._count.users,
  }))
}

export async function getGrantedBadgesForUser(userId: number): Promise<BadgeItem[]> {
  const records = await findGrantedBadgesForUserRecord(userId)
  const grantedBadges = records
    .map((record) => record.badge)
    .filter((badge) => badge.status)
  const effectRows = await findBadgeEffectRulesByBadgeIds(grantedBadges.map((badge) => badge.id))
  const effectMap = buildBadgeEffectMap(effectRows)

  return grantedBadges
    .map((badge) => ({
      id: badge.id,
      name: badge.name,
      code: badge.code,
      description: badge.description,
      iconPath: badge.iconPath,
      iconText: badge.iconText,
      color: badge.color,
      imageUrl: badge.imageUrl,
      category: badge.category,
      sortOrder: badge.sortOrder,
      pointsCost: badge.pointsCost,
      status: badge.status,
      isHidden: badge.isHidden,
      createdAt: badge.createdAt.toISOString(),
      updatedAt: badge.updatedAt.toISOString(),
      rules: badge.rules.map((rule) => ({
        id: rule.id,
        badgeId: rule.badgeId,
        ruleType: rule.ruleType,
        operator: rule.operator,
        value: rule.value,
        extraValue: rule.extraValue,
        sortOrder: rule.sortOrder,
      })),
      effects: effectMap.get(badge.id) ?? [],
      grantedUserCount: badge._count.users,
    }))
}

export async function getBadgeCenterData(userId: number | null) {
  const badges = (await getAllBadges()).filter((badge) => badge.status)

  if (!userId) {
    return badges.map((badge) => ({
      ...badge,
      eligibility: {
        badgeId: badge.id,
        eligible: false,
        alreadyGranted: false,
        progressText: "登录后可查看",
        failedRules: [],
        pointsCost: badge.pointsCost,
        purchaseRequired: badge.pointsCost > 0,
        canAffordPurchase: false,
      },
      display: {
        isDisplayed: false,
        displayOrder: 0,
        canDisplay: false,
      },
    }))
  }

  const [results, userBadgeStates] = await Promise.all([
    Promise.all(badges.map(async (badge) => ({
      ...badge,
      eligibility: await getBadgeEligibilityResult(userId, badge),
    }))),
    findUserBadgeDisplayStates(userId),
  ])


  const stateMap = new Map(userBadgeStates.map((item) => [item.badgeId, item]))

  return results.map((badge) => {
    const state = stateMap.get(badge.id)
    return {
      ...badge,
      display: {
        isDisplayed: state?.isDisplayed ?? false,
        displayOrder: state?.displayOrder ?? 0,
        canDisplay: badge.eligibility.alreadyGranted,
      },
    }
  })
}

export async function claimBadge(userId: number, badgeId: string) {
  const badges = await getAllBadges()
  const badge = badges.find((item) => item.id === badgeId && item.status)

  if (!badge) {
    apiError(404, "勋章不存在")
  }


  const eligibility = await getBadgeEligibilityResult(userId, badge)

  if (eligibility.alreadyGranted) {
    apiError(409, "你已经领取过这个勋章")
  }

  if (!eligibility.eligible) {
    apiError(400, eligibility.failedRules[0] ?? "当前还不满足领取条件")
  }

  const snapshot = await getBadgeEligibilitySnapshot(userId)
  const settings = await getSiteSettings()
  const preparedPurchase = badge.pointsCost > 0
    ? await prepareScopedPointDelta({
        scopeKey: "BADGE_PURCHASE",
        baseDelta: -badge.pointsCost,
        userId,
      })
    : null

  await runBadgeTransaction(async (tx) => {
    const latestUser = await findBadgeUserPoints(userId, tx)

    if (!latestUser) {
      apiError(404, "用户不存在")
    }

    const existingUserBadge = await findGrantedUserBadgeWithTx(tx, userId, badgeId)

    if (existingUserBadge) {
      apiError(409, "你已经领取过这个勋章")
    }

    if (preparedPurchase) {
      await applyPointDelta({
        tx,
        userId,
        beforeBalance: latestUser.points,
        prepared: preparedPurchase,
        pointName: settings.pointName,
        insufficientMessage: `${settings.pointName}不足，无法购买该勋章`,
        reason: `领取勋章 ${badge.name}`,
      })
    }

    await createSelfClaimUserBadge({
      userId,
      badgeId,
      grantSource: BadgeGrantSource.SELF_CLAIM,
      grantSnapshot: snapshot ? JSON.stringify(snapshot) : null,
      client: tx,
    })
  })


  return badge
}

export async function toggleDisplayedBadge(userId: number, badgeId: string) {
  const userBadge = await findUserBadgeWithBadge(userId, badgeId)

  if (!userBadge || !userBadge.badge.status) {
    apiError(400, "请先领取勋章后再设置展示")
  }

  if (userBadge.isDisplayed) {
    await updateUserBadgeDisplayById(userBadge.id, {
      isDisplayed: false,
      displayOrder: 0,
    })


    return {
      badgeId,
      isDisplayed: false,
      message: `已取消佩戴勋章：${userBadge.badge.name}`,
    }
  }

  const displayedBadges = await findDisplayedUserBadges(userId)

  if (displayedBadges.length >= MAX_DISPLAYED_BADGES) {
    apiError(409, `最多只能展示 ${MAX_DISPLAYED_BADGES} 个勋章，请先取消其他已佩戴勋章`)
  }


  const nextOrder = displayedBadges.length === 0 ? 1 : Math.max(...displayedBadges.map((item) => item.displayOrder), 0) + 1

  await updateUserBadgeDisplayById(userBadge.id, {
    isDisplayed: true,
    displayOrder: nextOrder,
  })


  return {
    badgeId,
    isDisplayed: true,
    displayOrder: nextOrder,
    message: `已设置展示勋章：${userBadge.badge.name}`,
  }
}
