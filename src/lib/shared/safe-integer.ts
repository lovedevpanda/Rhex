import BigNumber from "bignumber.js"

const MAX_SAFE_INTEGER = new BigNumber(Number.MAX_SAFE_INTEGER)

function toBigNumber(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim()
    return normalized ? new BigNumber(normalized) : new BigNumber(NaN)
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? new BigNumber(value) : new BigNumber(NaN)
  }

  if (typeof value === "bigint") {
    return new BigNumber(value.toString())
  }

  return new BigNumber(NaN)
}

export function parseSafeInteger(value: unknown) {
  const parsed = toBigNumber(value)
  if (!parsed.isFinite() || !parsed.isInteger() || parsed.gt(MAX_SAFE_INTEGER) || parsed.lt(MAX_SAFE_INTEGER.negated())) {
    return null
  }

  return parsed.toNumber()
}

export function parseNonNegativeSafeInteger(value: unknown) {
  const parsed = parseSafeInteger(value)
  if (parsed === null || parsed < 0) {
    return null
  }

  return parsed
}

export function parsePositiveSafeInteger(value: unknown) {
  const parsed = parseSafeInteger(value)
  if (parsed === null || parsed <= 0) {
    return null
  }

  return parsed
}

export function multiplyPositiveSafeIntegers(left: unknown, right: unknown) {

  const normalizedLeft = parsePositiveSafeInteger(left)
  const normalizedRight = parsePositiveSafeInteger(right)

  if (!normalizedLeft || !normalizedRight) {
    return null
  }

  const result = new BigNumber(normalizedLeft).multipliedBy(normalizedRight)
  if (!result.isInteger() || result.lte(0) || result.gt(MAX_SAFE_INTEGER)) {
    return null
  }

  return result.toNumber()
}
