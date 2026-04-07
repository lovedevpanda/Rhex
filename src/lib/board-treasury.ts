import type { PreparedPointDelta } from "@/lib/point-center"
import {
  clampSafeInteger,
  dividePositiveSafeIntegers,
  multiplyPositiveSafeIntegers,
  parsePositiveSafeInteger,
  parseSafeInteger,
  subtractSafeIntegers,
} from "@/lib/shared/safe-integer"

export interface BoardTreasuryTaxSplit {
  gross: number
  net: number
  tax: number
}

export function getBoardTreasuryCreditFromConfiguredCharge(configuredDelta: unknown, appliedFinalDelta: unknown) {
  const normalizedConfiguredDelta = parseSafeInteger(configuredDelta)
  const normalizedFinalDelta = parseSafeInteger(appliedFinalDelta)

  if (
    normalizedConfiguredDelta === null
    || normalizedConfiguredDelta >= 0
    || normalizedFinalDelta === null
    || normalizedFinalDelta >= 0
  ) {
    return 0
  }

  return Math.min(
    Math.abs(normalizedConfiguredDelta),
    Math.abs(normalizedFinalDelta),
  )
}

export function splitBoardTreasuryTaxFromGross(
  gross: number,
  rateBps: unknown,
): BoardTreasuryTaxSplit {
  const normalizedGross = parsePositiveSafeInteger(gross)
  const normalizedRateBps = clampSafeInteger(rateBps, 0, 10000) ?? 0

  if (!normalizedGross || normalizedRateBps <= 0) {
    return {
      gross,
      net: gross,
      tax: 0,
    }
  }

  const multiplied = multiplyPositiveSafeIntegers(normalizedGross, normalizedRateBps)
  const tax = multiplied
    ? (dividePositiveSafeIntegers(multiplied, 10000, "floor") ?? 0)
    : 0
  const net = tax > 0
    ? subtractSafeIntegers(normalizedGross, tax)
    : normalizedGross

  if (!tax || tax <= 0 || net === null || net <= 0) {
    return {
      gross: normalizedGross,
      net: normalizedGross,
      tax: 0,
    }
  }

  return {
    gross: normalizedGross,
    net,
    tax,
  }
}

export function buildPreparedPointDeltaFromFinalInteger(
  source: PreparedPointDelta,
  finalDelta: number,
): PreparedPointDelta {
  const normalizedFinalDelta = parsePositiveSafeInteger(finalDelta)

  if (!normalizedFinalDelta) {
    return source
  }

  return {
    scopeKey: source.scopeKey,
    baseDelta: normalizedFinalDelta,
    finalDelta: normalizedFinalDelta,
    appliedRules: [],
  }
}
