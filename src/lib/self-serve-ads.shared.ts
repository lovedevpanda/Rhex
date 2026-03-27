export type SelfServeAdSlotType = "IMAGE" | "TEXT"
export type SelfServeAdOrderStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "CANCELLED"

export interface SelfServeAdDurationOption {
  months: 1 | 3 | 6 | 12
  label: string
}

export interface SelfServeAdConfig {
  enabled: boolean
  visibleOnHome: boolean
  cardTitle: string
  sidebarSlot: "home-right-top" | "home-right-middle" | "home-right-bottom"

  sidebarOrder: number
  imageSlotCount: number
  textSlotCount: number
  imagePriceMonthly: number
  imagePriceQuarterly: number
  imagePriceSemiAnnual: number
  imagePriceYearly: number
  textPriceMonthly: number
  textPriceQuarterly: number
  textPriceSemiAnnual: number
  textPriceYearly: number
  placeholderLabel: string
}

export interface SelfServeAdPurchaseDraft {
  slotType: SelfServeAdSlotType
  slotIndex: number
  title: string
  linkUrl: string
  imageUrl: string
  textColor: string
  backgroundColor: string
  durationMonths: 1 | 3 | 6 | 12
}

export interface SelfServeAdItem {
  id: string
  slotType: SelfServeAdSlotType
  slotIndex: number
  title: string | null
  linkUrl: string | null
  imageUrl: string | null
  textColor: string | null
  backgroundColor: string | null
  durationMonths: number | null
  pricePoints: number | null
  status: SelfServeAdOrderStatus | "EMPTY"
  reviewNote: string | null
  startsAt: string | null
  endsAt: string | null
  createdAt: string | null
  isPlaceholder: boolean
}

export interface SelfServeAdsPanelData {
  appCode: string
  enabled: boolean
  title: string
  placeholderLabel: string
  pointName: string
  imageSlots: SelfServeAdItem[]
  textSlots: SelfServeAdItem[]
  prices: {
    IMAGE: Record<1 | 3 | 6 | 12, number>
    TEXT: Record<1 | 3 | 6 | 12, number>
  }
}

export const SELF_SERVE_AD_DURATION_OPTIONS: SelfServeAdDurationOption[] = [
  { months: 1, label: "1 个月" },
  { months: 3, label: "3 个月" },
  { months: 6, label: "6 个月" },
  { months: 12, label: "12 个月" },
]

export const SELF_SERVE_AD_TEXT_COLORS = ["#0f172a", "#1d4ed8", "#0f766e", "#be123c", "#854d0e", "#ffffff"] as const
export const SELF_SERVE_AD_BACKGROUND_COLORS = ["#f8fafc", "#dbeafe", "#dcfce7", "#fce7f3", "#fef3c7", "#111827"] as const

import { normalizeNonNegativeInteger } from "@/lib/shared/normalizers"

export function toSelfServeAdConfig(config: Record<string, boolean | number | string>): SelfServeAdConfig {
  return {
    enabled: Boolean(config.enabled ?? true),
    visibleOnHome: Boolean(config.visibleOnHome ?? true),
    cardTitle: String(config.cardTitle ?? "推广广告位"),

    sidebarSlot: config.sidebarSlot === "home-right-top" || config.sidebarSlot === "home-right-bottom" ? config.sidebarSlot : "home-right-middle",
    sidebarOrder: normalizeNonNegativeInteger(config.sidebarOrder, 40),
    imageSlotCount: normalizeNonNegativeInteger(config.imageSlotCount, 0),
    textSlotCount: normalizeNonNegativeInteger(config.textSlotCount, 0),
    imagePriceMonthly: normalizeNonNegativeInteger(config.imagePriceMonthly, 0),
    imagePriceQuarterly: normalizeNonNegativeInteger(config.imagePriceQuarterly, 0),
    imagePriceSemiAnnual: normalizeNonNegativeInteger(config.imagePriceSemiAnnual, 0),
    imagePriceYearly: normalizeNonNegativeInteger(config.imagePriceYearly, 0),
    textPriceMonthly: normalizeNonNegativeInteger(config.textPriceMonthly, 0),
    textPriceQuarterly: normalizeNonNegativeInteger(config.textPriceQuarterly, 0),
    textPriceSemiAnnual: normalizeNonNegativeInteger(config.textPriceSemiAnnual, 0),
    textPriceYearly: normalizeNonNegativeInteger(config.textPriceYearly, 0),
    placeholderLabel: String(config.placeholderLabel ?? "点击购买"),
  }
}


export function getSelfServeAdPrice(config: SelfServeAdConfig, slotType: SelfServeAdSlotType, durationMonths: 1 | 3 | 6 | 12) {
  if (slotType === "IMAGE") {
    return durationMonths === 1 ? config.imagePriceMonthly : durationMonths === 3 ? config.imagePriceQuarterly : durationMonths === 6 ? config.imagePriceSemiAnnual : config.imagePriceYearly
  }

  return durationMonths === 1 ? config.textPriceMonthly : durationMonths === 3 ? config.textPriceQuarterly : durationMonths === 6 ? config.textPriceSemiAnnual : config.textPriceYearly
}

export function buildSelfServeAdPriceMap(config: SelfServeAdConfig) {
  return {
    IMAGE: { 1: config.imagePriceMonthly, 3: config.imagePriceQuarterly, 6: config.imagePriceSemiAnnual, 12: config.imagePriceYearly },
    TEXT: { 1: config.textPriceMonthly, 3: config.textPriceQuarterly, 6: config.textPriceSemiAnnual, 12: config.textPriceYearly },
  } as const
}
