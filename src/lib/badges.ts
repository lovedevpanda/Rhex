import { BadgeRuleOperator, BadgeRuleType, BadgeGrantSource } from "@/db/types"

import { prisma } from "@/db/client"

export interface BadgeRuleItem {
  id: string
  badgeId: string
  ruleType: BadgeRuleType
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
  status: boolean
  isHidden: boolean
  createdAt: string
  updatedAt: string
  rules: BadgeRuleItem[]
  grantedUserCount?: number
}

export interface BadgeEligibilitySnapshot {
  userId: number
  registerDays: number
  createdAt: Date
  postCount: number
  commentCount: number
  receivedLikeCount: number
  inviteCount: number
  acceptedAnswerCount: number
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
  USER_ID: "UID",
  LEVEL: "等级",
  CHECK_IN_DAYS: "签到天数",
  VIP_LEVEL: "VIP 等级",
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
  const [user, progress] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
        postCount: true,
        commentCount: true,
        likeReceivedCount: true,
        inviteCount: true,
        acceptedAnswerCount: true,
        level: true,
        vipLevel: true,
      },

    }),
    prisma.userLevelProgress.findUnique({
      where: { userId },
      select: { checkInDays: true },
    }),
  ])

  if (!user) {
    return null
  }

  const now = Date.now()
  const registerDays = Math.max(0, Math.floor((now - user.createdAt.getTime()) / 86400000))

  return {
    userId: user.id,
    registerDays,
    createdAt: user.createdAt,
    postCount: user.postCount,
    commentCount: user.commentCount,
    receivedLikeCount: user.likeReceivedCount,
    inviteCount: user.inviteCount,
    acceptedAnswerCount: user.acceptedAnswerCount,
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
    prisma.userBadge.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId: badge.id,
        },
      },
      select: { id: true },
    }),
  ])

  if (!snapshot) {
    return {
      badgeId: badge.id,
      eligible: false,
      alreadyGranted: false,
      progressText: "未登录",
      failedRules: ["未登录"],
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
    progressText: alreadyGranted ? "已领取" : eligible ? "可领取" : failedRules[0] ?? "暂未达成",
    failedRules,
  }
}

export async function getAllBadges(): Promise<BadgeItem[]> {
  const badges = await prisma.badge.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      rules: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      _count: {
        select: {
          users: true,
        },
      },
    },
  })

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
    grantedUserCount: badge._count.users,
  }))
}

export async function getGrantedBadgesForUser(userId: number): Promise<BadgeItem[]> {
  const records = await prisma.userBadge.findMany({
    where: { userId },
    orderBy: [{ grantedAt: "desc" }],
    include: {
      badge: {
        include: {
          rules: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
          _count: {
            select: {
              users: true,
            },
          },
        },
      },
    },
  })

  return records
    .map((record) => record.badge)
    .filter((badge) => badge.status)
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
    prisma.userBadge.findMany({
      where: { userId },
      select: {
        badgeId: true,
        isDisplayed: true,
        displayOrder: true,
      },
    }),
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
    throw new Error("勋章不存在")
  }

  const eligibility = await getBadgeEligibilityResult(userId, badge)

  if (eligibility.alreadyGranted) {
    throw new Error("你已经领取过这个勋章")
  }

  if (!eligibility.eligible) {
    throw new Error(eligibility.failedRules[0] ?? "当前还不满足领取条件")
  }

  const snapshot = await getBadgeEligibilitySnapshot(userId)

  await prisma.userBadge.create({
    data: {
      userId,
      badgeId,
      grantSource: BadgeGrantSource.SELF_CLAIM,
      grantSnapshot: snapshot ? JSON.stringify(snapshot) : null,
    },
  })

  return badge
}

export async function toggleDisplayedBadge(userId: number, badgeId: string) {
  const userBadge = await prisma.userBadge.findUnique({
    where: {
      userId_badgeId: {
        userId,
        badgeId,
      },
    },
    include: {
      badge: true,
    },
  })

  if (!userBadge || !userBadge.badge.status) {
    throw new Error("请先领取勋章后再设置展示")
  }

  if (userBadge.isDisplayed) {
    await prisma.userBadge.update({
      where: { id: userBadge.id },
      data: {
        isDisplayed: false,
        displayOrder: 0,
      },
    })

    return {
      badgeId,
      isDisplayed: false,
      message: `已取消展示勋章：${userBadge.badge.name}`,
    }
  }

  const displayedBadges = await prisma.userBadge.findMany({
    where: {
      userId,
      isDisplayed: true,
    },
    orderBy: [{ displayOrder: "asc" }, { grantedAt: "desc" }],
    select: {
      id: true,
      displayOrder: true,
    },
  })

  if (displayedBadges.length >= MAX_DISPLAYED_BADGES) {
    throw new Error(`最多只能展示 ${MAX_DISPLAYED_BADGES} 个勋章，请先取消其他已展示勋章`)
  }

  const nextOrder = displayedBadges.length === 0 ? 1 : Math.max(...displayedBadges.map((item) => item.displayOrder), 0) + 1

  await prisma.userBadge.update({
    where: { id: userBadge.id },
    data: {
      isDisplayed: true,
      displayOrder: nextOrder,
    },
  })

  return {
    badgeId,
    isDisplayed: true,
    displayOrder: nextOrder,
    message: `已设置展示勋章：${userBadge.badge.name}`,
  }
}
