import { BadgeGrantSource, PointEffectDirection, PointEffectRuleKind, PointEffectTargetType } from "@/db/types"

import { createSelfClaimUserBadge, findAllBadgesWithRules, findBadgeEffectRulesByBadgeIds, findBadgeEligibilityUserSnapshot, findBadgeUserPoints, findDisplayedUserBadges, findGrantedBadgeIdsForUser, findGrantedBadgesForUserRecord, findGrantedUserBadgeWithTx, findUserBadgeDisplayStates, findUserBadgeWithBadge, lockUserBadgeDisplayState, runBadgeTransaction, updateUserBadgeDisplayById } from "@/db/badge-queries"
import { apiError } from "./api-route"
import {
  describeBadgeRule,
  describeBadgeRules,
  evaluateBadgeRuleForSnapshot,
  type BadgeEligibilitySnapshot,
  type BadgeRuleItem,
} from "@/lib/badge-rule-evaluation"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { getSiteSettings } from "@/lib/site-settings"

export { describeBadgeRule, describeBadgeRules, evaluateBadgeRuleForSnapshot }
export type { BadgeEligibilitySnapshot, BadgeRuleItem }

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

export interface DisplayedUserBadgeItem {
  id: string
  code: string
  name: string
  description?: string | null
  color: string
  iconText?: string | null
  displayOrder: number
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

interface BadgeEligibilityLookup {
  snapshot: BadgeEligibilitySnapshot | null
  grantedBadgeIds: Set<string>
}

const MAX_DISPLAYED_BADGES = 3

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
    godCommentCount: user.godCommentCount,
    inviteCount: user.inviteCount,
    acceptedAnswerCount: user.acceptedAnswerCount,
    sentTipCount: tipStats.sentTipCount,
    receivedTipCount: tipStats.receivedTipCount,
    followerCount: user._count.followedByUsers,
    level: user.level,
    checkInDays: progress?.checkInDays ?? 0,
    currentCheckInStreak: progress?.currentCheckInStreak ?? 0,
    maxCheckInStreak: progress?.maxCheckInStreak ?? 0,
    vipLevel: user.vipLevel,
    approvedVerificationTypeIds: user.verificationApplications.map((item) => item.typeId),
  }
}

async function createBadgeEligibilityLookup(userId: number): Promise<BadgeEligibilityLookup> {
  const [snapshot, grantedBadges] = await Promise.all([
    getBadgeEligibilitySnapshot(userId),
    findGrantedBadgeIdsForUser(userId),
  ])

  return {
    snapshot,
    grantedBadgeIds: new Set(grantedBadges.map((item) => item.badgeId)),
  }
}

export async function getBadgeEligibilityResult(userId: number, badge: BadgeItem): Promise<BadgeEligibilityResult> {
  const lookup = await createBadgeEligibilityLookup(userId)
  return buildBadgeEligibilityResult(badge, lookup)
}

function buildBadgeEligibilityResult(badge: BadgeItem, lookup: BadgeEligibilityLookup): BadgeEligibilityResult {
  if (!lookup.snapshot) {
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

  const snapshot = lookup.snapshot
  const failedRules = badge.rules
    .filter((rule) => !evaluateBadgeRuleForSnapshot(snapshot, rule))
    .map((rule) => describeBadgeRule(rule))

  const eligible = failedRules.length === 0
  const alreadyGranted = lookup.grantedBadgeIds.has(badge.id)

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

export async function getDisplayedBadgesForUser(userId: number): Promise<DisplayedUserBadgeItem[]> {
  const records = await findGrantedBadgesForUserRecord(userId)

  return records
    .filter((record) => record.isDisplayed && record.badge.status)
    .sort((left, right) => {
      const orderDifference = left.displayOrder - right.displayOrder

      if (orderDifference !== 0) {
        return orderDifference
      }

      return right.grantedAt.getTime() - left.grantedAt.getTime()
    })
    .map((record) => ({
      id: record.badge.id,
      code: record.badge.code,
      name: record.badge.name,
      description: record.badge.description,
      color: record.badge.color,
      iconText: record.badge.iconText,
      displayOrder: record.displayOrder,
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

  const [lookup, userBadgeStates] = await Promise.all([
    createBadgeEligibilityLookup(userId),
    findUserBadgeDisplayStates(userId),
  ])
  const results = badges.map((badge) => ({
    ...badge,
    eligibility: buildBadgeEligibilityResult(badge, lookup),
  }))


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
  return runBadgeTransaction(async (tx) => {
    // Counting and setting the display state must share one per-user lock;
    // otherwise two concurrent toggles can both observe one remaining slot.
    await lockUserBadgeDisplayState(tx, userId)

    const userBadge = await findUserBadgeWithBadge(userId, badgeId, tx)

    if (!userBadge || !userBadge.badge.status) {
      apiError(400, "请先领取勋章后再设置展示")
    }

    if (userBadge.isDisplayed) {
      await updateUserBadgeDisplayById(userBadge.id, {
        isDisplayed: false,
        displayOrder: 0,
      }, tx)

      return {
        badgeId,
        isDisplayed: false,
        message: `已取消佩戴勋章：${userBadge.badge.name}`,
      }
    }

    const displayedBadges = await findDisplayedUserBadges(userId, tx)

    if (displayedBadges.length >= MAX_DISPLAYED_BADGES) {
      apiError(409, `最多只能展示 ${MAX_DISPLAYED_BADGES} 个勋章，请先取消其他已佩戴勋章`)
    }

    const nextOrder = displayedBadges.length === 0 ? 1 : Math.max(...displayedBadges.map((item) => item.displayOrder), 0) + 1

    await updateUserBadgeDisplayById(userBadge.id, {
      isDisplayed: true,
      displayOrder: nextOrder,
    }, tx)

    return {
      badgeId,
      isDisplayed: true,
      displayOrder: nextOrder,
      message: `已设置展示勋章：${userBadge.badge.name}`,
    }
  })
}
