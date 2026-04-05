import type {  RelatedType } from "@/db/types"

export type PointLogChangeType = "INCREASE" | "DECREASE"

const POINT_LOG_AUDIT_SUFFIX_PATTERN = /\s*\[a:(-?\d+)\|b:(-?\d+)\]\s*$/
const POINT_LOG_EFFECT_SUFFIX_PATTERN = /\s*\[(?:勋章特效|积分特效):([^:\]]+):([^:\]]*):([^\]]+)\]\s*$/

export interface PointLogAuditEntry {
  userId: number
  changeType: PointLogChangeType
  changeValue: number
  reason: string
  beforeBalance: number
  afterBalance?: number
  relatedType?: RelatedType | null
  relatedId?: string | null
}

export function stripPointLogAuditTrail(reason: string) {
  return reason.replace(POINT_LOG_AUDIT_SUFFIX_PATTERN, "").trimEnd()
}

export function stripPointLogEffectTrail(reason: string) {
  return reason.replace(POINT_LOG_EFFECT_SUFFIX_PATTERN, "").trimEnd()
}

export function parsePointLogAuditTrail(reason: string) {
  const match = reason.match(POINT_LOG_AUDIT_SUFFIX_PATTERN)
  const withoutAuditTrail = stripPointLogAuditTrail(reason)
  const effectMatch = withoutAuditTrail.match(POINT_LOG_EFFECT_SUFFIX_PATTERN)

  return {
    displayReason: stripPointLogEffectTrail(withoutAuditTrail),
    beforeBalance: match ? Number(match[1]) : null,
    afterBalance: match ? Number(match[2]) : null,
    pointEffect: effectMatch ? {
      baseValue: effectMatch[1],
      ruleSummary: effectMatch[2],
      deltaValue: effectMatch[3],
    } : null,
  }
}

export function resolvePointLogAfterBalance(beforeBalance: number, changeType: PointLogChangeType, changeValue: number) {
  return changeType === "INCREASE" ? beforeBalance + changeValue : beforeBalance - changeValue
}

export function appendPointLogAuditTrail(reason: string, beforeBalance: number, afterBalance: number) {
  return `${stripPointLogAuditTrail(reason)} [a:${beforeBalance}|b:${afterBalance}]`
}

export function normalizeAuditedPointLogEntry(entry: PointLogAuditEntry) {
  const afterBalance = typeof entry.afterBalance === "number"
    ? entry.afterBalance
    : resolvePointLogAfterBalance(entry.beforeBalance, entry.changeType, entry.changeValue)

  return {
    userId: entry.userId,
    changeType: entry.changeType,
    changeValue: entry.changeValue,
    reason: appendPointLogAuditTrail(entry.reason, entry.beforeBalance, afterBalance),
    relatedType: entry.relatedType ?? null,
    relatedId: entry.relatedId ?? null,
  }
}
