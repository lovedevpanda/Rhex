import { createPointLogWithAudit } from "@/db/point-log-audit-queries"
import { listAllPointEffectRuleRows, listGlobalActivePointEffectRuleRows } from "@/db/point-effect-rule-queries"
import { ChangeType, PointEffectDirection, PointEffectRuleKind, PointEffectTargetType, Prisma, type RelatedType } from "@/db/types"
import { apiError } from "@/lib/api-route"
import { findDisplayedBadgeEffectRules } from "@/db/badge-queries"
import { getBusinessMinuteOfDay } from "@/lib/formatters"
import { getPointEffectAllScopeKeyByTargetType, isPointEffectScopeMatchableForBadgeEffects, type PointEffectScopeKey } from "@/lib/point-effect-definitions"

type PointEffectClient = Prisma.TransactionClient
const POINT_EFFECT_RULE_CACHE_TTL_MS = 5_000

let activePointEffectRulesCache: {
  expiresAt: number
  rules: PointEffectRuleItem[]
} | null = null

let activePointEffectRulesPromise: Promise<PointEffectRuleItem[]> | null = null
const displayedBadgeEffectRulesCache = new Map<number, { expiresAt: number; rules: PointEffectRuleItem[] }>()
const displayedBadgeEffectRulesPromises = new Map<number, Promise<PointEffectRuleItem[]>>()

export interface PointEffectRuleItem {
  id: string
  badgeId: string | null
  badgeName: string | null
  badgeIconText: string | null
  badgeColor: string | null
  name: string
  description: string | null
  targetType: PointEffectTargetType
  scopeKeys: string[]
  ruleKind: PointEffectRuleKind
  direction: PointEffectDirection
  value: number
  extraValue: number | null
  startMinuteOfDay: number | null
  endMinuteOfDay: number | null
  sortOrder: number
  status: boolean
  createdAt: string
  updatedAt: string
}

export interface AppliedPointEffectTrace {
  ruleId: string
  ruleName: string
  badgeName: string | null
  badgeIconText: string | null
  badgeColor: string | null
  beforeValue: number
  afterValue: number
  adjustmentValue: number
}

export interface PreparedPointDelta {
  scopeKey: PointEffectScopeKey
  baseDelta: number
  finalDelta: number
  appliedRules: AppliedPointEffectTrace[]
}

export interface PreparedProbabilityValue {
  scopeKey: PointEffectScopeKey
  baseProbability: number
  finalProbability: number
  appliedRules: AppliedPointEffectTrace[]
}

const POINT_EFFECT_TRAIL_PATTERN = /\s*\[(?:勋章特效|积分特效):[^\]]+\]\s*$/

function getCurrentMinuteOfDay(date = new Date()) {
  return getBusinessMinuteOfDay(date)
}

function formatSignedNumber(value: number) {
  if (value > 0) {
    return `+${value}`
  }

  return String(value)
}

function sanitizeEffectTrailToken(value: string) {
  return value.replace(/[:\[\]\|]/g, "_").trim()
}

function stripPointEffectTrail(reason: string) {
  return reason.replace(POINT_EFFECT_TRAIL_PATTERN, "").trimEnd()
}

function appendPointEffectTrail(reason: string, prepared: PreparedPointDelta) {
  if (prepared.appliedRules.length === 0 || prepared.finalDelta === prepared.baseDelta) {
    return stripPointEffectTrail(reason)
  }

  const ruleSummary = prepared.appliedRules
    .map((rule) => {
      const effectName = rule.badgeName
        ? `${sanitizeEffectTrailToken(rule.badgeName)}.${sanitizeEffectTrailToken(rule.ruleName)}`
        : sanitizeEffectTrailToken(rule.ruleName)
      return `${effectName}${formatSignedNumber(rule.adjustmentValue)}`
    })
    .join("|")
  const deltaValue = prepared.finalDelta - prepared.baseDelta

  return `${stripPointEffectTrail(reason)} [勋章特效:${prepared.baseDelta}:${ruleSummary}:${formatSignedNumber(deltaValue)}]`
}

function clampProbability(value: number) {
  return Math.min(100, Math.max(0, Number(value.toFixed(2))))
}

function normalizePointAdjustment(rawValue: number) {
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return 0
  }

  return Math.max(1, Math.round(rawValue))
}

function randomBetween(minValue: number, maxValue: number) {
  const min = Math.min(minValue, maxValue)
  const max = Math.max(minValue, maxValue)
  if (min === max) {
    return min
  }

  return min + Math.random() * (max - min)
}

function isRuleActiveAtMinute(rule: PointEffectRuleItem, minuteOfDay: number) {
  if (rule.startMinuteOfDay === null && rule.endMinuteOfDay === null) {
    return true
  }

  const start = rule.startMinuteOfDay ?? 0
  const end = rule.endMinuteOfDay ?? 1439
  if (start <= end) {
    return minuteOfDay >= start && minuteOfDay <= end
  }

  return minuteOfDay >= start || minuteOfDay <= end
}

function matchesPointEffectRule(params: {
  rule: PointEffectRuleItem
  targetType: PointEffectTargetType
  scopeKey: PointEffectScopeKey
  minuteOfDay: number
}) {
  const { rule, targetType, scopeKey, minuteOfDay } = params
  if (!rule.status || rule.targetType !== targetType) {
    return false
  }

  if (!isRuleActiveAtMinute(rule, minuteOfDay)) {
    return false
  }

  if (!isPointEffectScopeMatchableForBadgeEffects(scopeKey)) {
    return false
  }

  if (rule.scopeKeys.includes(scopeKey)) {
    return true
  }

  return rule.scopeKeys.includes(getPointEffectAllScopeKeyByTargetType(targetType))
}

function resolveRuleRawAdjustment(rule: PointEffectRuleItem, currentValue: number) {
  const absCurrentValue = Math.abs(currentValue)

  switch (rule.ruleKind) {
    case PointEffectRuleKind.FIXED:
      return Math.abs(rule.value)
    case PointEffectRuleKind.PERCENTAGE:
      return absCurrentValue * Math.abs(rule.value) / 100
    case PointEffectRuleKind.RANDOM_FIXED:
      return Math.abs(randomBetween(rule.value, rule.extraValue ?? rule.value))
    case PointEffectRuleKind.RANDOM_PERCENTAGE:
      return absCurrentValue * Math.abs(randomBetween(rule.value, rule.extraValue ?? rule.value)) / 100
    case PointEffectRuleKind.RANDOM_SIGNED_MULTIPLIER:
      return absCurrentValue * Math.abs(randomBetween(rule.value, rule.extraValue ?? rule.value))
    default:
      return 0
  }
}

function applyRuleToPointValue(currentValue: number, rule: PointEffectRuleItem) {
  const rawAdjustment = resolveRuleRawAdjustment(rule, currentValue)

  if (rule.ruleKind === PointEffectRuleKind.RANDOM_SIGNED_MULTIPLIER || rule.direction === PointEffectDirection.RANDOM_SIGNED) {
    const signedAdjustment = Math.random() >= 0.5 ? rawAdjustment : -rawAdjustment
    const normalizedAdjustment = signedAdjustment >= 0
      ? normalizePointAdjustment(signedAdjustment)
      : -normalizePointAdjustment(Math.abs(signedAdjustment))

    return {
      adjustmentValue: normalizedAdjustment,
      afterValue: currentValue + normalizedAdjustment,
    }
  }

  const normalizedAdjustment = normalizePointAdjustment(rawAdjustment)
  const signedAdjustment = rule.direction === PointEffectDirection.BUFF
    ? normalizedAdjustment
    : -normalizedAdjustment

  return {
    adjustmentValue: signedAdjustment,
    afterValue: currentValue + signedAdjustment,
  }
}

function applyRuleToProbabilityValue(currentValue: number, rule: PointEffectRuleItem) {
  const rawAdjustment = resolveRuleRawAdjustment(rule, currentValue)

  if (rule.ruleKind === PointEffectRuleKind.RANDOM_SIGNED_MULTIPLIER || rule.direction === PointEffectDirection.RANDOM_SIGNED) {
    const signedAdjustment = Math.random() >= 0.5 ? rawAdjustment : -rawAdjustment
    return {
      adjustmentValue: Number(signedAdjustment.toFixed(2)),
      afterValue: clampProbability(currentValue + signedAdjustment),
    }
  }

  const signedAdjustment = rule.direction === PointEffectDirection.BUFF
    ? rawAdjustment
    : -rawAdjustment

  return {
    adjustmentValue: Number(signedAdjustment.toFixed(2)),
    afterValue: clampProbability(currentValue + signedAdjustment),
  }
}

function sortPointEffectRules(rules: PointEffectRuleItem[]) {
  return rules
    .slice()
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder
      }

      return left.createdAt.localeCompare(right.createdAt)
    })
}

function mapPointEffectRule(rule: {
  id: string
  badgeId: string | null
  badgeName: string | null
  badgeIconText: string | null
  badgeColor: string | null
  name: string
  description: string | null
  targetType: PointEffectTargetType
  scopeKeys: string[]
  ruleKind: PointEffectRuleKind
  direction: PointEffectDirection
  value: number
  extraValue: number | null
  startMinuteOfDay: number | null
  endMinuteOfDay: number | null
  sortOrder: number
  status: boolean
  createdAt: Date
  updatedAt: Date
}): PointEffectRuleItem {
  return {
    ...rule,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  }
}

export async function getAllPointEffectRules(): Promise<PointEffectRuleItem[]> {
  const rules = await listAllPointEffectRuleRows()

  return rules.map((rule) => mapPointEffectRule(rule))
}

async function getGlobalActivePointEffectRules() {
  const now = Date.now()
  if (activePointEffectRulesCache && activePointEffectRulesCache.expiresAt > now) {
    return activePointEffectRulesCache.rules
  }

  if (activePointEffectRulesPromise) {
    return activePointEffectRulesPromise
  }

  activePointEffectRulesPromise = listGlobalActivePointEffectRuleRows().then((rules) => {
    const mappedRules = rules.map((rule) => mapPointEffectRule(rule))

    activePointEffectRulesCache = {
      expiresAt: Date.now() + POINT_EFFECT_RULE_CACHE_TTL_MS,
      rules: mappedRules,
    }

    return mappedRules
  }).finally(() => {
    activePointEffectRulesPromise = null
  })

  return activePointEffectRulesPromise
}

async function getDisplayedBadgePointEffectRules(userId: number) {
  const now = Date.now()
  const cached = displayedBadgeEffectRulesCache.get(userId)
  if (cached && cached.expiresAt > now) {
    return cached.rules
  }

  const existingPromise = displayedBadgeEffectRulesPromises.get(userId)
  if (existingPromise) {
    return existingPromise
  }

  const promise = findDisplayedBadgeEffectRules(userId)
    .then((rules) => {
      const mappedRules = rules.map((rule) => mapPointEffectRule(rule))
      displayedBadgeEffectRulesCache.set(userId, {
        expiresAt: Date.now() + POINT_EFFECT_RULE_CACHE_TTL_MS,
        rules: mappedRules,
      })
      return mappedRules
    })
    .finally(() => {
      displayedBadgeEffectRulesPromises.delete(userId)
    })

  displayedBadgeEffectRulesPromises.set(userId, promise)
  return promise
}

async function getApplicablePointEffectRules(userId?: number) {
  const globalRules = await getGlobalActivePointEffectRules()
  if (!userId) {
    return globalRules
  }

  const badgeRules = await getDisplayedBadgePointEffectRules(userId)
  return sortPointEffectRules([...globalRules, ...badgeRules])
}

export async function prepareScopedPointDelta(params: {
  scopeKey: PointEffectScopeKey
  baseDelta: number
  userId?: number
  now?: Date
}): Promise<PreparedPointDelta> {
  const rules = await getApplicablePointEffectRules(params.userId)
  const minuteOfDay = getCurrentMinuteOfDay(params.now)
  let currentValue = params.baseDelta
  const appliedRules: AppliedPointEffectTrace[] = []

  rules
    .filter((rule) => matchesPointEffectRule({
      rule,
      targetType: PointEffectTargetType.POINTS,
      scopeKey: params.scopeKey,
      minuteOfDay,
    }))
    .forEach((rule) => {
      const beforeValue = currentValue
      const result = applyRuleToPointValue(currentValue, rule)
      currentValue = result.afterValue
      appliedRules.push({
        ruleId: rule.id,
        ruleName: rule.name,
        badgeName: rule.badgeName,
        badgeIconText: rule.badgeIconText,
        badgeColor: rule.badgeColor,
        beforeValue,
        afterValue: result.afterValue,
        adjustmentValue: result.adjustmentValue,
      })
    })

  return {
    scopeKey: params.scopeKey,
    baseDelta: params.baseDelta,
    finalDelta: currentValue,
    appliedRules,
  }
}

export async function prepareScopedProbability(params: {
  scopeKey: PointEffectScopeKey
  baseProbability: number
  userId?: number
  now?: Date
}): Promise<PreparedProbabilityValue> {
  const rules = await getApplicablePointEffectRules(params.userId)
  const minuteOfDay = getCurrentMinuteOfDay(params.now)
  let currentValue = clampProbability(params.baseProbability)
  const appliedRules: AppliedPointEffectTrace[] = []

  rules
    .filter((rule) => matchesPointEffectRule({
      rule,
      targetType: PointEffectTargetType.PROBABILITY,
      scopeKey: params.scopeKey,
      minuteOfDay,
    }))
    .forEach((rule) => {
      const beforeValue = currentValue
      const result = applyRuleToProbabilityValue(currentValue, rule)
      currentValue = result.afterValue
      appliedRules.push({
        ruleId: rule.id,
        ruleName: rule.name,
        badgeName: rule.badgeName,
        badgeIconText: rule.badgeIconText,
        badgeColor: rule.badgeColor,
        beforeValue,
        afterValue: result.afterValue,
        adjustmentValue: result.adjustmentValue,
      })
    })

  return {
    scopeKey: params.scopeKey,
    baseProbability: clampProbability(params.baseProbability),
    finalProbability: currentValue,
    appliedRules,
  }
}

export async function applyPointDelta(params: {
  tx: PointEffectClient
  userId: number
  beforeBalance: number
  prepared: PreparedPointDelta
  reason: string
  pointName: string
  relatedType?: RelatedType | null
  relatedId?: string | null
  insufficientMessage?: string
}) {
  const { prepared, beforeBalance } = params
  const finalDelta = prepared.finalDelta

  if (finalDelta < 0 && beforeBalance < Math.abs(finalDelta)) {
    apiError(409, params.insufficientMessage ?? `${params.pointName}不足，无法完成当前操作`)
  }

  if (finalDelta !== 0) {
    await params.tx.user.update({
      where: { id: params.userId },
      data: finalDelta > 0
        ? {
            points: {
              increment: finalDelta,
            },
          }
        : {
            points: {
              decrement: Math.abs(finalDelta),
            },
          },
    })

    await createPointLogWithAudit(params.tx, {
      userId: params.userId,
      changeType: finalDelta > 0 ? ChangeType.INCREASE : ChangeType.DECREASE,
      changeValue: Math.abs(finalDelta),
      reason: appendPointEffectTrail(params.reason, prepared),
      beforeBalance,
      relatedType: params.relatedType ?? null,
      relatedId: params.relatedId ?? null,
    })
  }

  return {
    finalDelta,
    afterBalance: beforeBalance + finalDelta,
  }
}
