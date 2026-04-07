import type { Prisma, RelatedType } from "@/db/types"

import { normalizePointLogEventType, POINT_LOG_EVENT_TYPES, type PointLogEventDataInput, type PointLogEventDataValue, type PointLogEventType } from "@/lib/point-log-events"

export type PointLogChangeType = "INCREASE" | "DECREASE"

const POINT_LOG_META_KEY = "pointLogMeta"

export interface PointLogEffectRuleMetadata {
  ruleId: string | null
  badgeName: string | null
  effectName: string
  adjustmentValue: number
}

export interface PointLogEffectMetadata {
  baseValue: number
  finalValue: number
  deltaValue: number
  rules: PointLogEffectRuleMetadata[]
}

export interface PointLogTaxMetadata {
  amount: number
}

export interface PointLogAuditMetadata {
  beforeBalance: number
  afterBalance: number
}

export interface PointLogMetadata {
  audit?: PointLogAuditMetadata
  effect?: PointLogEffectMetadata
  tax?: PointLogTaxMetadata
}

export interface PointLogEffectPreparedInput {
  baseDelta: number
  finalDelta: number
  appliedRules: Array<{
    ruleId?: string | null
    ruleName: string
    badgeName: string | null
    adjustmentValue: number
  }>
}

export interface PointLogAuditEntry {
  userId: number
  changeType: PointLogChangeType
  changeValue: number
  reason: string
  beforeBalance: number
  afterBalance?: number
  eventType?: PointLogEventType | null
  eventData?: PointLogEventDataInput
  relatedType?: RelatedType | null
  relatedId?: string | null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeFiniteNumber(value: unknown) {
  const resolved = typeof value === "number" ? value : Number(value)
  return Number.isFinite(resolved) ? resolved : null
}

function normalizeSafeInteger(value: unknown) {
  const resolved = normalizeFiniteNumber(value)
  return resolved !== null && Number.isSafeInteger(resolved) ? resolved : null
}

export function resolvePointLogAfterBalance(beforeBalance: number, changeType: PointLogChangeType, changeValue: number) {
  return changeType === "INCREASE" ? beforeBalance + changeValue : beforeBalance - changeValue
}

export function buildPointLogAuditMetadata(beforeBalance: number, afterBalance: number): PointLogAuditMetadata | null {
  if (!Number.isSafeInteger(beforeBalance) || !Number.isSafeInteger(afterBalance)) {
    return null
  }

  return {
    beforeBalance,
    afterBalance,
  }
}

export function buildPointLogTaxMetadata(taxAmount: number): PointLogTaxMetadata | null {
  if (!Number.isSafeInteger(taxAmount) || taxAmount <= 0) {
    return null
  }

  return {
    amount: taxAmount,
  }
}

export function buildPointLogEffectMetadata(prepared: PointLogEffectPreparedInput): PointLogEffectMetadata | null {
  if (
    !Number.isFinite(prepared.baseDelta)
    || !Number.isFinite(prepared.finalDelta)
    || !Array.isArray(prepared.appliedRules)
    || prepared.appliedRules.length === 0
    || prepared.baseDelta === prepared.finalDelta
  ) {
    return null
  }

  return {
    baseValue: prepared.baseDelta,
    finalValue: prepared.finalDelta,
    deltaValue: prepared.finalDelta - prepared.baseDelta,
    rules: prepared.appliedRules
      .map((rule) => ({
        ruleId: typeof rule.ruleId === "string" ? rule.ruleId : null,
        badgeName: typeof rule.badgeName === "string" && rule.badgeName.trim() ? rule.badgeName.trim() : null,
        effectName: String(rule.ruleName ?? "").trim(),
        adjustmentValue: Number(rule.adjustmentValue ?? 0),
      }))
      .filter((rule) => rule.effectName && Number.isFinite(rule.adjustmentValue)),
  }
}

function readPointLogMetadata(eventData?: PointLogEventDataValue | PointLogEventDataInput): PointLogMetadata | null {
  if (!isPlainObject(eventData)) {
    return null
  }

  const rawMeta = (eventData as Record<string, unknown>)[POINT_LOG_META_KEY]
  if (!isPlainObject(rawMeta)) {
    return null
  }

  const audit = isPlainObject(rawMeta.audit)
    ? (() => {
        const beforeBalance = normalizeSafeInteger(rawMeta.audit.beforeBalance)
        const afterBalance = normalizeSafeInteger(rawMeta.audit.afterBalance)
        return beforeBalance !== null && afterBalance !== null
          ? { beforeBalance, afterBalance }
          : null
      })()
    : null

  const effect = isPlainObject(rawMeta.effect)
    ? (() => {
        const baseValue = normalizeFiniteNumber(rawMeta.effect.baseValue)
        const finalValue = normalizeFiniteNumber(rawMeta.effect.finalValue)
        const deltaValue = normalizeFiniteNumber(rawMeta.effect.deltaValue)
        const rawRules = Array.isArray(rawMeta.effect.rules) ? rawMeta.effect.rules : []
        if (baseValue === null || finalValue === null || deltaValue === null) {
          return null
        }

        return {
          baseValue,
          finalValue,
          deltaValue,
          rules: rawRules.flatMap((rule) => {
            if (!isPlainObject(rule)) {
              return []
            }

            const effectName = String(rule.effectName ?? "").trim()
            const adjustmentValue = normalizeFiniteNumber(rule.adjustmentValue)
            if (!effectName || adjustmentValue === null) {
              return []
            }

            return [{
              ruleId: typeof rule.ruleId === "string" ? rule.ruleId : null,
              badgeName: typeof rule.badgeName === "string" && rule.badgeName.trim() ? rule.badgeName.trim() : null,
              effectName,
              adjustmentValue,
            }]
          }),
        } satisfies PointLogEffectMetadata
      })()
    : null

  const tax = isPlainObject(rawMeta.tax)
    ? (() => {
        const amount = normalizeSafeInteger(rawMeta.tax.amount)
        return amount !== null && amount > 0 ? { amount } : null
      })()
    : null

  if (!audit && !effect && !tax) {
    return null
  }

  return {
    ...(audit ? { audit } : {}),
    ...(effect ? { effect } : {}),
    ...(tax ? { tax } : {}),
  }
}

export function mergePointLogMetadataIntoEventData(
  eventData: PointLogEventDataInput | undefined,
  metadata: PointLogMetadata,
) {
  const nextMetadata = {
    ...(metadata.audit ? { audit: metadata.audit } : {}),
    ...(metadata.effect ? { effect: metadata.effect } : {}),
    ...(metadata.tax ? { tax: metadata.tax } : {}),
  }

  if (Object.keys(nextMetadata).length === 0) {
    return eventData
  }

  const baseEventData = isPlainObject(eventData) ? { ...eventData } : {}
  const existingMetadata = readPointLogMetadata(eventData)
  const pointLogMeta = {
    ...(existingMetadata?.audit ? {
      audit: {
        beforeBalance: existingMetadata.audit.beforeBalance,
        afterBalance: existingMetadata.audit.afterBalance,
      } as Prisma.InputJsonObject,
    } : {}),
    ...(existingMetadata?.effect ? {
      effect: {
        baseValue: existingMetadata.effect.baseValue,
        finalValue: existingMetadata.effect.finalValue,
        deltaValue: existingMetadata.effect.deltaValue,
        rules: existingMetadata.effect.rules.map((rule) => ({
          ruleId: rule.ruleId,
          badgeName: rule.badgeName,
          effectName: rule.effectName,
          adjustmentValue: rule.adjustmentValue,
        })) as Prisma.InputJsonArray,
      } as Prisma.InputJsonObject,
    } : {}),
    ...(existingMetadata?.tax ? {
      tax: {
        amount: existingMetadata.tax.amount,
      } as Prisma.InputJsonObject,
    } : {}),
    ...(metadata.audit ? {
      audit: {
        beforeBalance: metadata.audit.beforeBalance,
        afterBalance: metadata.audit.afterBalance,
      } as Prisma.InputJsonObject,
    } : {}),
    ...(metadata.effect ? {
      effect: {
        baseValue: metadata.effect.baseValue,
        finalValue: metadata.effect.finalValue,
        deltaValue: metadata.effect.deltaValue,
        rules: metadata.effect.rules.map((rule) => ({
          ruleId: rule.ruleId,
          badgeName: rule.badgeName,
          effectName: rule.effectName,
          adjustmentValue: rule.adjustmentValue,
        })) as Prisma.InputJsonArray,
      } as Prisma.InputJsonObject,
    } : {}),
    ...(metadata.tax ? {
      tax: {
        amount: metadata.tax.amount,
      } as Prisma.InputJsonObject,
    } : {}),
  } as Prisma.InputJsonObject

  return {
    ...baseEventData,
    [POINT_LOG_META_KEY]: pointLogMeta,
  } as Prisma.InputJsonValue
}

export function resolvePointLogAuditPresentation(reason: string, eventData?: PointLogEventDataValue | PointLogEventDataInput) {
  const metadata = readPointLogMetadata(eventData)

  return {
    displayReason: String(reason ?? "").trimEnd(),
    beforeBalance: metadata?.audit?.beforeBalance ?? null,
    afterBalance: metadata?.audit?.afterBalance ?? null,
    pointEffect: metadata?.effect ?? null,
    pointTax: metadata?.tax ?? null,
  }
}

export function normalizeAuditedPointLogEntry(entry: PointLogAuditEntry) {
  const afterBalance = typeof entry.afterBalance === "number"
    ? entry.afterBalance
    : resolvePointLogAfterBalance(entry.beforeBalance, entry.changeType, entry.changeValue)
  const normalized: {
    userId: number
    changeType: PointLogChangeType
    changeValue: number
    reason: string
    eventType: PointLogEventType
    eventData?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput
    relatedType: RelatedType | null
    relatedId: string | null
  } = {
    userId: entry.userId,
    changeType: entry.changeType,
    changeValue: entry.changeValue,
    reason: String(entry.reason ?? "").trimEnd(),
    eventType: normalizePointLogEventType(entry.eventType ?? POINT_LOG_EVENT_TYPES.GENERIC),
    relatedType: entry.relatedType ?? null,
    relatedId: entry.relatedId ?? null,
  }

  const eventData = mergePointLogMetadataIntoEventData(entry.eventData, {
    audit: buildPointLogAuditMetadata(entry.beforeBalance, afterBalance) ?? undefined,
  })
  if (eventData !== undefined) {
    normalized.eventData = eventData
  }

  return normalized
}
