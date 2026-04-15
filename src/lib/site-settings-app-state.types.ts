import { parseNonNegativeSafeInteger } from "@/lib/shared/safe-integer"
import type { RegistrationEmailTemplateSettings } from "@/lib/email-template-settings"
import type { PostListLoadMode } from "@/lib/post-list-load-mode"
import type { VipNameColors } from "@/lib/vip-name-colors"
import type { VipLevelIcons } from "@/lib/vip-level-icons"
import type { SiteTippingGiftItem } from "@/lib/tipping-gifts"
import type { VipTierPricing } from "@/lib/vip-tier-pricing"

export const SITE_SETTINGS_STATE_KEY = "__siteSettings"

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function parseAppStateRoot(raw: string | null | undefined): Record<string, unknown> {
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

export function readSiteSettingsState(raw: string | null | undefined) {
  const root = parseAppStateRoot(raw)
  const siteSettingsState = root[SITE_SETTINGS_STATE_KEY]
  return isRecord(siteSettingsState) ? siteSettingsState : {}
}

export function writeSiteSettingsState(
  appStateJson: string | null | undefined,
  nextState: Record<string, unknown>,
) {
  const root = parseAppStateRoot(appStateJson)
  root[SITE_SETTINGS_STATE_KEY] = nextState
  return JSON.stringify(root)
}

export function normalizeNonNegativeInteger(value: unknown, fallback: number) {
  return parseNonNegativeSafeInteger(value) ?? fallback
}

export function normalizeFileExtensionList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback
  }

  const normalized = Array.from(new Set(
    value
      .map((item) => (typeof item === "string" ? item.trim().toLowerCase().replace(/^\./, "") : ""))
      .filter(Boolean),
  ))

  return normalized.length > 0 ? normalized : fallback
}

export function normalizeHexColor(value: unknown, fallback: string) {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : ""
  return /^#(?:[0-9A-F]{3}|[0-9A-F]{6})$/.test(normalized) ? normalized : fallback
}

export type LeftSidebarDisplayMode = "DEFAULT" | "HIDDEN" | "DOCKED"

export function normalizeLeftSidebarDisplayMode(
  value: unknown,
  fallback: LeftSidebarDisplayMode = "DEFAULT",
): LeftSidebarDisplayMode {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : ""

  switch (normalized) {
    case "DEFAULT":
    case "HIDDEN":
    case "DOCKED":
      return normalized
    default:
      return fallback
  }
}

export type ImageWatermarkPosition = "TOP_LEFT" | "TOP_RIGHT" | "BOTTOM_LEFT" | "BOTTOM_RIGHT" | "CENTER"

export function normalizeImageWatermarkPosition(
  value: unknown,
  fallback: ImageWatermarkPosition,
): ImageWatermarkPosition {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : ""

  switch (normalized) {
    case "TOP_LEFT":
    case "TOP_RIGHT":
    case "BOTTOM_LEFT":
    case "BOTTOM_RIGHT":
    case "CENTER":
      return normalized as ImageWatermarkPosition
    default:
      return fallback
  }
}

export type CheckInMakeUpPriceSettings = VipTierPricing
export type CheckInRewardSettings = VipTierPricing
export type NicknameChangePointCostSettings = VipTierPricing
export type IntroductionChangePointCostSettings = VipTierPricing
export type AvatarChangePointCostSettings = VipTierPricing
export type InviteCodePurchasePriceSettings = VipTierPricing

export interface MarkdownImageUploadSettings {
  enabled: boolean
}

export interface UploadObjectStorageSettings {
  forcePathStyle: boolean
}

export interface ImageWatermarkSettings {
  enabled: boolean
  text: string
  position: ImageWatermarkPosition
  tiled: boolean
  opacity: number
  fontSize: number
  fontFamily: string
  margin: number
  color: string
  logoPath: string
  logoScalePercent: number
}

export interface AttachmentFeatureSettings {
  uploadEnabled: boolean
  downloadEnabled: boolean
  minUploadLevel: number
  minUploadVipLevel: number
  allowedExtensions: string[]
  maxFileSizeMb: number
}

export interface HomeSidebarAnnouncementSettings {
  enabled: boolean
}

export interface LeftSidebarDisplaySettings {
  mode: LeftSidebarDisplayMode
}

export interface FooterCopyrightSettings {
  text: string
  brandingVisible: boolean
}

export interface SiteBrandingSettings {
  iconPath: string
}

export interface RegisterNicknameLengthSettings {
  minLength: number
  maxLength: number
}

export interface RegisterEmailWhitelistSettings {
  enabled: boolean
  domains: string[]
}

export interface SiteSecuritySettings {
  loginIpChangeEmailAlertEnabled: boolean
  passwordChangeRequireEmailVerification: boolean
}

export type PostSlugGenerationMode = "TITLE_TIMESTAMP" | "TIME36" | "PINYIN_TIME36" | "TITLE_TIME36"

export function normalizePostSlugGenerationMode(
  value: unknown,
  fallback: PostSlugGenerationMode = "TITLE_TIMESTAMP",
): PostSlugGenerationMode {
  return value === "TIME36" || value === "PINYIN_TIME36" || value === "TITLE_TIME36"
    ? value
    : fallback
}

export interface PostSlugGenerationSettings {
  mode: PostSlugGenerationMode
}

export interface HomeFeedPostListLoadSettings {
  loadMode: PostListLoadMode
}

export interface HomeHotFeedSettings {
  recentWindowHours: number
}

export interface PostPageSizeSettings {
  homeFeed: number
  zonePosts: number
  boardPosts: number
  comments: number
  hotTopics: number
  postRelatedTopics: number
}

export interface CommentAccessSettings {
  guestCanView: boolean
  initialVisibleReplies: number
}

export interface PostContentLengthSettings {
  postTitleMinLength: number
  postTitleMaxLength: number
  postContentMinLength: number
  postContentMaxLength: number
  commentContentMinLength: number
  commentContentMaxLength: number
}

export type InteractionGateAction = "POST_CREATE" | "COMMENT_CREATE"

export type InteractionGateCondition =
  | {
      type: "EMAIL_VERIFIED"
      enabled: true
    }
  | {
      type: "REGISTERED_MINUTES"
      value: number
    }

export interface InteractionGateRule {
  enabled: boolean
  conditions: InteractionGateCondition[]
}

export interface InteractionGateSettings {
  version: 1
  actions: Record<InteractionGateAction, InteractionGateRule>
}

export interface AuthProviderSettings {
  githubEnabled: boolean
  googleEnabled: boolean
  passkeyEnabled: boolean
}

export interface AuthPageShowcaseSettings {
  enabled: boolean
}

export type VipLevelIconSettings = VipLevelIcons
export type VipNameColorSettings = VipNameColors

export interface RegistrationRewardSettings {
  initialPoints: number
}

export interface RegisterInviteCodeHelpSettings {
  enabled: boolean
  title: string
  url: string
}

export interface RedeemCodeHelpSettings {
  enabled: boolean
  title: string
  url: string
}

export interface CheckInStreakSettings {
  makeUpCountsTowardStreak: boolean
}

export interface PostJackpotSettings {
  enabled: boolean
  minInitialPoints: number
  maxInitialPoints: number
  replyIncrementPoints: number
  hitProbability: number
}

export interface PostRedPacketSettings {
  randomClaimProbability: number
}

export interface AnonymousPostSettings {
  enabled: boolean
  price: number
  dailyLimit: number
  maskUserId: number | null
  allowReplySwitch: boolean
  defaultReplyAnonymous: boolean
}

export interface BoardTreasurySettings {
  tipGiftTaxEnabled: boolean
  tipGiftTaxRateBps: number
}

export interface BoardApplicationSettings {
  enabled: boolean
}

export type { RegistrationEmailTemplateSettings, SiteTippingGiftItem, VipTierPricing }
