import { parseNonNegativeSafeInteger } from "@/lib/shared/safe-integer"
import { getDefaultTippingGiftItemsFromAmounts, normalizeTippingGiftItems, type SiteTippingGiftItem } from "@/lib/tipping-gifts"
import { normalizeVipLevelIcons, type VipLevelIcons } from "@/lib/vip-level-icons"

const SITE_SETTINGS_STATE_KEY = "__siteSettings"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function parseAppStateRoot(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function readSiteSettingsState(raw: string | null | undefined) {
  const root = parseAppStateRoot(raw)
  const siteSettingsState = root[SITE_SETTINGS_STATE_KEY]
  return isRecord(siteSettingsState) ? siteSettingsState : {}
}

function normalizeNonNegativeInteger(value: unknown, fallback: number) {
  return parseNonNegativeSafeInteger(value) ?? fallback
}

export interface CheckInMakeUpPriceSettings {
  normal: number
  vip1: number
  vip2: number
  vip3: number
}

export interface CheckInRewardSettings {
  normal: number
  vip1: number
  vip2: number
  vip3: number
}

export interface NicknameChangePointCostSettings {
  normal: number
  vip1: number
  vip2: number
  vip3: number
}

export interface InviteCodePurchasePriceSettings {
  normal: number
  vip1: number
  vip2: number
  vip3: number
}

export interface MarkdownImageUploadSettings {
  enabled: boolean
}

export interface HomeSidebarAnnouncementSettings {
  enabled: boolean
}

export type VipLevelIconSettings = VipLevelIcons

export function resolveTippingGiftSettings(options: {
  appStateJson?: string | null
  fallbackAmounts: number[]
}) {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const fallbackItems = getDefaultTippingGiftItemsFromAmounts(options.fallbackAmounts)

  return normalizeTippingGiftItems(siteSettingsState.tippingGifts, fallbackItems)
}

export function mergeTippingGiftSettings(
  appStateJson: string | null | undefined,
  input: SiteTippingGiftItem[],
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    tippingGifts: normalizeTippingGiftItems(input),
  }

  return JSON.stringify(root)
}

export function getTippingGiftPriceOptions(gifts: SiteTippingGiftItem[]) {
  return Array.from(new Set(gifts.map((item) => normalizeNonNegativeInteger(item.price, 0)).filter((item) => item > 0)))
}

export function resolveCheckInRewardSettings(options: {
  appStateJson?: string | null
  normalReward: number
}): CheckInRewardSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const checkInRewards = isRecord(siteSettingsState.checkInRewards)
    ? siteSettingsState.checkInRewards
    : {}

  const normal = normalizeNonNegativeInteger(options.normalReward, 0)

  return {
    normal,
    vip1: normalizeNonNegativeInteger(checkInRewards.vip1, normal),
    vip2: normalizeNonNegativeInteger(checkInRewards.vip2, normal),
    vip3: normalizeNonNegativeInteger(checkInRewards.vip3, normal),
  }
}

export function mergeCheckInRewardSettings(
  appStateJson: string | null | undefined,
  input: Pick<CheckInRewardSettings, "vip1" | "vip2" | "vip3">,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    checkInRewards: {
      vip1: normalizeNonNegativeInteger(input.vip1, 0),
      vip2: normalizeNonNegativeInteger(input.vip2, 0),
      vip3: normalizeNonNegativeInteger(input.vip3, 0),
    },
  }

  return JSON.stringify(root)
}

export function resolveCheckInMakeUpPriceSettings(options: {
  appStateJson?: string | null
  normalPrice: number
  vipFallbackPrice: number
}): CheckInMakeUpPriceSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const checkInMakeUpPrices = isRecord(siteSettingsState.checkInMakeUpPrices)
    ? siteSettingsState.checkInMakeUpPrices
    : {}

  const normal = normalizeNonNegativeInteger(options.normalPrice, 0)
  const vipFallbackPrice = normalizeNonNegativeInteger(options.vipFallbackPrice, 0)

  return {
    normal,
    vip1: normalizeNonNegativeInteger(checkInMakeUpPrices.vip1, vipFallbackPrice),
    vip2: normalizeNonNegativeInteger(checkInMakeUpPrices.vip2, vipFallbackPrice),
    vip3: normalizeNonNegativeInteger(checkInMakeUpPrices.vip3, vipFallbackPrice),
  }
}

export function mergeCheckInMakeUpPriceSettings(
  appStateJson: string | null | undefined,
  input: Pick<CheckInMakeUpPriceSettings, "vip1" | "vip2" | "vip3">,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    checkInMakeUpPrices: {
      vip1: normalizeNonNegativeInteger(input.vip1, 0),
      vip2: normalizeNonNegativeInteger(input.vip2, 0),
      vip3: normalizeNonNegativeInteger(input.vip3, 0),
    },
  }

  return JSON.stringify(root)
}

export function resolveNicknameChangePointCostSettings(options: {
  appStateJson?: string | null
  normalPrice: number
}): NicknameChangePointCostSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const nicknameChangePointCosts = isRecord(siteSettingsState.nicknameChangePointCosts)
    ? siteSettingsState.nicknameChangePointCosts
    : {}

  const normal = normalizeNonNegativeInteger(options.normalPrice, 0)

  return {
    normal,
    vip1: normalizeNonNegativeInteger(nicknameChangePointCosts.vip1, normal),
    vip2: normalizeNonNegativeInteger(nicknameChangePointCosts.vip2, normal),
    vip3: normalizeNonNegativeInteger(nicknameChangePointCosts.vip3, normal),
  }
}

export function mergeNicknameChangePointCostSettings(
  appStateJson: string | null | undefined,
  input: Pick<NicknameChangePointCostSettings, "vip1" | "vip2" | "vip3">,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    nicknameChangePointCosts: {
      vip1: normalizeNonNegativeInteger(input.vip1, 0),
      vip2: normalizeNonNegativeInteger(input.vip2, 0),
      vip3: normalizeNonNegativeInteger(input.vip3, 0),
    },
  }

  return JSON.stringify(root)
}

export function resolveInviteCodePurchasePriceSettings(options: {
  appStateJson?: string | null
  normalPrice: number
}): InviteCodePurchasePriceSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const inviteCodePurchasePrices = isRecord(siteSettingsState.inviteCodePurchasePrices)
    ? siteSettingsState.inviteCodePurchasePrices
    : {}

  const normal = normalizeNonNegativeInteger(options.normalPrice, 0)

  return {
    normal,
    vip1: normalizeNonNegativeInteger(inviteCodePurchasePrices.vip1, normal),
    vip2: normalizeNonNegativeInteger(inviteCodePurchasePrices.vip2, normal),
    vip3: normalizeNonNegativeInteger(inviteCodePurchasePrices.vip3, normal),
  }
}

export function mergeInviteCodePurchasePriceSettings(
  appStateJson: string | null | undefined,
  input: Pick<InviteCodePurchasePriceSettings, "vip1" | "vip2" | "vip3">,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    inviteCodePurchasePrices: {
      vip1: normalizeNonNegativeInteger(input.vip1, 0),
      vip2: normalizeNonNegativeInteger(input.vip2, 0),
      vip3: normalizeNonNegativeInteger(input.vip3, 0),
    },
  }

  return JSON.stringify(root)
}

export function resolveMarkdownImageUploadSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
} = {}): MarkdownImageUploadSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const markdownImageUpload = isRecord(siteSettingsState.markdownImageUpload)
    ? siteSettingsState.markdownImageUpload
    : {}

  return {
    enabled: typeof markdownImageUpload.enabled === "boolean"
      ? markdownImageUpload.enabled
      : options.enabledFallback ?? true,
  }
}

export function mergeMarkdownImageUploadSettings(
  appStateJson: string | null | undefined,
  input: MarkdownImageUploadSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    markdownImageUpload: {
      enabled: input.enabled,
    },
  }

  return JSON.stringify(root)
}

export function resolveHomeSidebarAnnouncementSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
} = {}): HomeSidebarAnnouncementSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const homeSidebarAnnouncement = isRecord(siteSettingsState.homeSidebarAnnouncement)
    ? siteSettingsState.homeSidebarAnnouncement
    : {}

  return {
    enabled: typeof homeSidebarAnnouncement.enabled === "boolean"
      ? homeSidebarAnnouncement.enabled
      : options.enabledFallback ?? true,
  }
}

export function mergeHomeSidebarAnnouncementSettings(
  appStateJson: string | null | undefined,
  input: HomeSidebarAnnouncementSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    homeSidebarAnnouncement: {
      enabled: input.enabled,
    },
  }

  return JSON.stringify(root)
}

export function resolveVipLevelIconSettings(options: {
  appStateJson?: string | null
} = {}): VipLevelIconSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const vipLevelIcons = isRecord(siteSettingsState.vipLevelIcons)
    ? siteSettingsState.vipLevelIcons
    : {}

  return normalizeVipLevelIcons({
    vip1: typeof vipLevelIcons.vip1 === "string" ? vipLevelIcons.vip1 : undefined,
    vip2: typeof vipLevelIcons.vip2 === "string" ? vipLevelIcons.vip2 : undefined,
    vip3: typeof vipLevelIcons.vip3 === "string" ? vipLevelIcons.vip3 : undefined,
  })
}

export function mergeVipLevelIconSettings(
  appStateJson: string | null | undefined,
  input: VipLevelIconSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    vipLevelIcons: normalizeVipLevelIcons(input),
  }

  return JSON.stringify(root)
}
