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

export interface SelfServeAdPurchaseValidationResult {
  success: boolean
  normalized: SelfServeAdPurchaseDraft
  errors: Partial<Record<"title" | "linkUrl" | "imageUrl" | "textColor" | "backgroundColor", string>>
  firstError?: string
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

import { normalizeNonNegativeInteger, normalizeTrimmedText } from "@/lib/shared/normalizers"

const SELF_SERVE_AD_TITLE_MAX_LENGTH = 30
const SELF_SERVE_AD_IMAGE_URL_MAX_LENGTH = 500
const SELF_SERVE_AD_LINK_URL_MAX_LENGTH = 500
const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/

function normalizeSelfServeAdUrl(value: unknown, fieldLabel: string) {
  const url = String(value ?? "").trim()
  if (!url) {
    return { value: "", error: `请填写${fieldLabel}` }
  }
  if (url.length > SELF_SERVE_AD_LINK_URL_MAX_LENGTH) {
    return { value: url.slice(0, SELF_SERVE_AD_LINK_URL_MAX_LENGTH), error: `${fieldLabel}不能超过 ${SELF_SERVE_AD_LINK_URL_MAX_LENGTH} 个字符` }
  }
  if (!/^https?:\/\//i.test(url)) {
    return { value: url, error: `${fieldLabel}必须以 http:// 或 https:// 开头` }
  }

  try {
    return { value: new URL(url).toString() }
  } catch {
    return { value: url, error: `请输入有效的${fieldLabel}` }
  }
}

function normalizeSelfServeAdColor(value: unknown, fallback: string) {
  const color = String(value ?? "").trim()
  return HEX_COLOR_PATTERN.test(color) ? color : fallback
}

export function validateSelfServeAdPurchaseDraft(input: SelfServeAdPurchaseDraft): SelfServeAdPurchaseValidationResult {
  const slotType = input.slotType === "IMAGE" ? "IMAGE" : "TEXT"
  const title = normalizeTrimmedText(input.title, SELF_SERVE_AD_TITLE_MAX_LENGTH)
  const linkResult = normalizeSelfServeAdUrl(input.linkUrl, "广告链接")
  const imageResult = slotType === "IMAGE"
    ? normalizeSelfServeAdUrl(normalizeTrimmedText(input.imageUrl, SELF_SERVE_AD_IMAGE_URL_MAX_LENGTH), "广告图片地址")
    : { value: "" }
  const textColor = slotType === "TEXT" ? normalizeSelfServeAdColor(input.textColor, "#0f172a") : "#0f172a"
  const backgroundColor = slotType === "TEXT" ? normalizeSelfServeAdColor(input.backgroundColor, "#f8fafc") : "#f8fafc"
  const durationMonths = input.durationMonths === 1 || input.durationMonths === 3 || input.durationMonths === 6 || input.durationMonths === 12 ? input.durationMonths : 1

  const errors: SelfServeAdPurchaseValidationResult["errors"] = {}
  if (slotType === "TEXT" && !title) {
    errors.title = "请填写广告标题"
  }
  if (slotType === "TEXT" && title.length > 12) {
    errors.title = "文字广告标题建议控制在 12 个字以内"
  }
  if (linkResult.error) {
    errors.linkUrl = linkResult.error
  }
  if (slotType === "IMAGE") {
    if (!input.imageUrl?.trim()) {
      errors.imageUrl = "请填写广告图片地址"
    } else if (String(input.imageUrl).trim().length > SELF_SERVE_AD_IMAGE_URL_MAX_LENGTH) {
      errors.imageUrl = `广告图片地址不能超过 ${SELF_SERVE_AD_IMAGE_URL_MAX_LENGTH} 个字符`
    } else if (imageResult.error) {
      errors.imageUrl = imageResult.error
    }
  }

  const normalized: SelfServeAdPurchaseDraft = {
    slotType,
    slotIndex: Math.max(0, Number(input.slotIndex) || 0),
    title,
    linkUrl: linkResult.value,
    imageUrl: slotType === "IMAGE" ? imageResult.value : "",
    textColor,
    backgroundColor,
    durationMonths,
  }

  const firstError = errors.title ?? errors.linkUrl ?? errors.imageUrl ?? errors.textColor ?? errors.backgroundColor
  return {
    success: !firstError,
    normalized,
    errors,
    firstError,
  }
}


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
