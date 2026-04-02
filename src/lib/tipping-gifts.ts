import { parseNonNegativeSafeInteger } from "@/lib/shared/safe-integer"

export interface SiteTippingGiftItem {
  id: string
  name: string
  icon: string
  price: number
}

const DEFAULT_TIPPING_GIFT_ICONS = ["🌹", "☕", "🍰", "🎁", "🚀", "👑", "💎", "🔥"] as const

function normalizeNonNegativeInteger(value: unknown, fallback: number) {
  return parseNonNegativeSafeInteger(value) ?? fallback
}

function normalizeTippingGiftId(value: unknown, index: number) {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "")
    if (normalized) {
      return normalized
    }
  }

  return `gift-${index + 1}`
}

function normalizeTippingGiftName(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function normalizeTippingGiftIcon(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

export function getDefaultTippingGiftItemsFromAmounts(amounts: number[]) {
  const normalizedAmounts = Array.from(new Set(amounts.map((item) => normalizeNonNegativeInteger(item, 0)).filter((item) => item > 0)))

  return normalizedAmounts.map((price, index) => ({
    id: `gift-${index + 1}`,
    name: `礼物 ${index + 1}`,
    icon: DEFAULT_TIPPING_GIFT_ICONS[index % DEFAULT_TIPPING_GIFT_ICONS.length] ?? "🎁",
    price,
  }))
}

export function normalizeTippingGiftItems(value: unknown, fallbackItems: SiteTippingGiftItem[] = []) {
  if (!Array.isArray(value)) {
    return fallbackItems.map((item) => ({ ...item }))
  }

  const normalized = value.flatMap((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return []
    }

    const fallback = fallbackItems[index]
    const price = normalizeNonNegativeInteger((item as Record<string, unknown>).price, fallback?.price ?? 0)

    if (price <= 0) {
      return []
    }

    return [{
      id: normalizeTippingGiftId((item as Record<string, unknown>).id, index),
      name: normalizeTippingGiftName((item as Record<string, unknown>).name, fallback?.name ?? `礼物 ${index + 1}`),
      icon: normalizeTippingGiftIcon((item as Record<string, unknown>).icon, fallback?.icon ?? DEFAULT_TIPPING_GIFT_ICONS[index % DEFAULT_TIPPING_GIFT_ICONS.length] ?? "🎁"),
      price,
    }]
  })

  return normalized.filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index)
}
