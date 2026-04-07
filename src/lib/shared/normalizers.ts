import { parseNonNegativeSafeInteger, parsePositiveSafeInteger } from "@/lib/shared/safe-integer"

export function normalizePositiveInteger(value: unknown, fallback: number) {
  const parsed = parsePositiveSafeInteger(value)
  return parsed ?? fallback
}

export function normalizeNonNegativeInteger(value: unknown, fallback: number) {
  const parsed = parseNonNegativeSafeInteger(value)
  return parsed ?? fallback
}

export function normalizePageSize(value: unknown, options: readonly number[] = [20, 50, 100], fallback = 20) {
  const parsed = normalizePositiveInteger(value, fallback)
  return options.includes(parsed) ? parsed : fallback
}

export function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "1", "on"].includes(normalized)) {
      return true
    }
    if (["false", "0", "off"].includes(normalized)) {
      return false
    }
  }

  return fallback
}

export function normalizeNumber(value: unknown, fallback: number, options?: { min?: number; max?: number }) {
  const parsed = Number(value)
  const safeNumber = Number.isFinite(parsed) ? parsed : fallback

  if (typeof options?.min === "number" && safeNumber < options.min) {
    return options.min
  }

  if (typeof options?.max === "number" && safeNumber > options.max) {
    return options.max
  }

  return safeNumber
}

export function normalizeText(value: unknown, fallback = "") {
  const resolved = String(value ?? fallback).trim()
  return resolved || fallback
}

export function normalizeTrimmedText(value: unknown, maxLength: number, fallback = "") {
  return String(value ?? fallback).trim().slice(0, maxLength)
}

export function normalizeTippingAmounts(value: unknown) {
  const values = String(value ?? "")
    .split(/[，,\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0)

  return Array.from(new Set(values)).sort((left, right) => left - right)
}

export function normalizeHeatThresholds(value: unknown) {
  const values = String(value ?? "")
    .split(/[，,\s]+/)
    .map((item) => parseNonNegativeSafeInteger(item.trim()))
    .filter((item): item is number => item !== null)

  return Array.from(new Set(values)).sort((left, right) => left - right)
}


export function normalizeHeatColors(value: unknown) {
  return String(value ?? "")
    .split(/[，,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}
