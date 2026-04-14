import { parseNonNegativeSafeInteger } from "@/lib/shared/safe-integer"
import { buildDefaultRegistrationEmailTemplateSettings, normalizeRegistrationEmailTemplateSettings } from "@/lib/email-template-settings"
import { parseEmailWhitelistDomains } from "@/lib/email"
import { getDefaultTippingGiftItemsFromAmounts, normalizeTippingGiftItems } from "@/lib/tipping-gifts"
import { normalizeVipNameColors } from "@/lib/vip-name-colors"
import { normalizeVipLevelIcons } from "@/lib/vip-level-icons"
import { normalizePostListLoadMode } from "@/lib/post-list-load-mode"
import type { PostListLoadMode } from "@/lib/post-list-load-mode"
import {
  SITE_SETTINGS_STATE_KEY,
  isRecord,
  normalizeFileExtensionList,
  normalizeHexColor,
  normalizeImageWatermarkPosition,
  normalizeLeftSidebarDisplayMode,
  normalizeNonNegativeInteger,
  normalizePostSlugGenerationMode,
  parseAppStateRoot,
  readSiteSettingsState,
} from "@/lib/site-settings-app-state.types"
import type {
  AnonymousPostSettings,
  AttachmentFeatureSettings,
  AuthPageShowcaseSettings,
  AuthProviderSettings,
  AvatarChangePointCostSettings,
  BoardApplicationSettings,
  BoardTreasurySettings,
  CheckInMakeUpPriceSettings,
  CheckInRewardSettings,
  CheckInStreakSettings,
  CommentAccessSettings,
  FooterCopyrightSettings,
  HomeFeedPostListLoadSettings,
  HomeHotFeedSettings,
  HomeSidebarAnnouncementSettings,
  ImageWatermarkPosition,
  ImageWatermarkSettings,
  InteractionGateCondition,
  InteractionGateRule,
  InteractionGateSettings,
  InviteCodePurchasePriceSettings,
  LeftSidebarDisplayMode,
  LeftSidebarDisplaySettings,
  MarkdownImageUploadSettings,
  NicknameChangePointCostSettings,
  PostContentLengthSettings,
  PostJackpotSettings,
  PostPageSizeSettings,
  PostRedPacketSettings,
  PostSlugGenerationMode,
  PostSlugGenerationSettings,
  RedeemCodeHelpSettings,
  RegisterEmailWhitelistSettings,
  RegisterInviteCodeHelpSettings,
  RegisterNicknameLengthSettings,
  RegistrationEmailTemplateSettings,
  RegistrationRewardSettings,
  SiteBrandingSettings,
  SiteTippingGiftItem,
  UploadObjectStorageSettings,
  VipLevelIconSettings,
  VipNameColorSettings,
  IntroductionChangePointCostSettings,
} from "@/lib/site-settings-app-state.types"

export * from "@/lib/site-settings-app-state.types"

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

export function resolveIntroductionChangePointCostSettings(options: {
  appStateJson?: string | null
  normalPrice: number
}): IntroductionChangePointCostSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const introductionChangePointCosts = isRecord(siteSettingsState.introductionChangePointCosts)
    ? siteSettingsState.introductionChangePointCosts
    : {}

  const normal = normalizeNonNegativeInteger(introductionChangePointCosts.normal, normalizeNonNegativeInteger(options.normalPrice, 0))

  return {
    normal,
    vip1: normalizeNonNegativeInteger(introductionChangePointCosts.vip1, normal),
    vip2: normalizeNonNegativeInteger(introductionChangePointCosts.vip2, normal),
    vip3: normalizeNonNegativeInteger(introductionChangePointCosts.vip3, normal),
  }
}

export function mergeIntroductionChangePointCostSettings(
  appStateJson: string | null | undefined,
  input: IntroductionChangePointCostSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    introductionChangePointCosts: {
      normal: normalizeNonNegativeInteger(input.normal, 0),
      vip1: normalizeNonNegativeInteger(input.vip1, 0),
      vip2: normalizeNonNegativeInteger(input.vip2, 0),
      vip3: normalizeNonNegativeInteger(input.vip3, 0),
    },
  }

  return JSON.stringify(root)
}

export function resolveAvatarChangePointCostSettings(options: {
  appStateJson?: string | null
  normalPrice: number
}): AvatarChangePointCostSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const avatarChangePointCosts = isRecord(siteSettingsState.avatarChangePointCosts)
    ? siteSettingsState.avatarChangePointCosts
    : {}

  const normal = normalizeNonNegativeInteger(avatarChangePointCosts.normal, normalizeNonNegativeInteger(options.normalPrice, 0))

  return {
    normal,
    vip1: normalizeNonNegativeInteger(avatarChangePointCosts.vip1, normal),
    vip2: normalizeNonNegativeInteger(avatarChangePointCosts.vip2, normal),
    vip3: normalizeNonNegativeInteger(avatarChangePointCosts.vip3, normal),
  }
}

export function mergeAvatarChangePointCostSettings(
  appStateJson: string | null | undefined,
  input: AvatarChangePointCostSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    avatarChangePointCosts: {
      normal: normalizeNonNegativeInteger(input.normal, 0),
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

export function resolveImageWatermarkSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
  textFallback?: string
  positionFallback?: ImageWatermarkPosition
  opacityFallback?: number
  fontSizeFallback?: number
  marginFallback?: number
  colorFallback?: string
  logoPathFallback?: string
  logoScalePercentFallback?: number
} = {}): ImageWatermarkSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const imageWatermark = isRecord(siteSettingsState.imageWatermark)
    ? siteSettingsState.imageWatermark
    : {}

  return {
    enabled: typeof imageWatermark.enabled === "boolean"
      ? imageWatermark.enabled
      : options.enabledFallback ?? false,
    text: typeof imageWatermark.text === "string"
      ? imageWatermark.text.trim().slice(0, 120)
      : (options.textFallback ?? "").trim().slice(0, 120),
    position: normalizeImageWatermarkPosition(imageWatermark.position, options.positionFallback ?? "BOTTOM_RIGHT"),
    opacity: Math.min(100, Math.max(0, normalizeNonNegativeInteger(imageWatermark.opacity, normalizeNonNegativeInteger(options.opacityFallback, 22)))),
    fontSize: Math.min(160, Math.max(8, normalizeNonNegativeInteger(imageWatermark.fontSize, normalizeNonNegativeInteger(options.fontSizeFallback, 24)))),
    margin: Math.min(200, Math.max(0, normalizeNonNegativeInteger(imageWatermark.margin, normalizeNonNegativeInteger(options.marginFallback, 24)))),
    color: normalizeHexColor(imageWatermark.color, normalizeHexColor(options.colorFallback, "#FFFFFF")),
    logoPath: typeof imageWatermark.logoPath === "string"
      ? imageWatermark.logoPath.trim().slice(0, 1000)
      : (options.logoPathFallback ?? "").trim().slice(0, 1000),
    logoScalePercent: Math.min(60, Math.max(1, normalizeNonNegativeInteger(imageWatermark.logoScalePercent, normalizeNonNegativeInteger(options.logoScalePercentFallback, 16)))),
  }
}

export function mergeImageWatermarkSettings(
  appStateJson: string | null | undefined,
  input: ImageWatermarkSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    imageWatermark: {
      enabled: Boolean(input.enabled),
      text: String(input.text ?? "").trim().slice(0, 120),
      position: normalizeImageWatermarkPosition(input.position, "BOTTOM_RIGHT"),
      opacity: Math.min(100, Math.max(0, normalizeNonNegativeInteger(input.opacity, 22))),
      fontSize: Math.min(160, Math.max(8, normalizeNonNegativeInteger(input.fontSize, 24))),
      margin: Math.min(200, Math.max(0, normalizeNonNegativeInteger(input.margin, 24))),
      color: normalizeHexColor(input.color, "#FFFFFF"),
      logoPath: String(input.logoPath ?? "").trim().slice(0, 1000),
      logoScalePercent: Math.min(60, Math.max(1, normalizeNonNegativeInteger(input.logoScalePercent, 16))),
    },
  }

  return JSON.stringify(root)
}

export function resolveRegistrationEmailTemplateSettings(options: {
  appStateJson?: string | null
  siteNameFallback?: string
} = {}): RegistrationEmailTemplateSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const defaults = buildDefaultRegistrationEmailTemplateSettings(options.siteNameFallback ?? "社区站点")

  return normalizeRegistrationEmailTemplateSettings(siteSettingsState.registrationEmailTemplates, defaults)
}

export function mergeRegistrationEmailTemplateSettings(
  appStateJson: string | null | undefined,
  input: RegistrationEmailTemplateSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)
  const defaults = buildDefaultRegistrationEmailTemplateSettings("社区站点")
  const normalized = normalizeRegistrationEmailTemplateSettings(input, defaults)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    registrationEmailTemplates: normalized,
  }

  return JSON.stringify(root)
}

export function resolveAttachmentFeatureSettings(options: {
  appStateJson?: string | null
  uploadEnabledFallback?: boolean
  downloadEnabledFallback?: boolean
  minUploadLevelFallback?: number
  minUploadVipLevelFallback?: number
  allowedExtensionsFallback?: string[]
  maxFileSizeMbFallback?: number
} = {}): AttachmentFeatureSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const attachments = isRecord(siteSettingsState.attachments)
    ? siteSettingsState.attachments
    : {}
  const fallbackAllowedExtensions = Array.from(new Set(
    (options.allowedExtensionsFallback ?? ["zip", "rar", "7z", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"])
      .map((item) => item.trim().toLowerCase().replace(/^\./, ""))
      .filter(Boolean),
  ))

  return {
    uploadEnabled: typeof attachments.uploadEnabled === "boolean"
      ? attachments.uploadEnabled
      : (typeof attachments.enabled === "boolean" ? attachments.enabled : options.uploadEnabledFallback ?? false),
    downloadEnabled: typeof attachments.downloadEnabled === "boolean"
      ? attachments.downloadEnabled
      : (typeof attachments.enabled === "boolean" ? attachments.enabled : options.downloadEnabledFallback ?? false),
    minUploadLevel: normalizeNonNegativeInteger(attachments.minUploadLevel, normalizeNonNegativeInteger(options.minUploadLevelFallback, 0)),
    minUploadVipLevel: normalizeNonNegativeInteger(attachments.minUploadVipLevel, normalizeNonNegativeInteger(options.minUploadVipLevelFallback, 0)),
    allowedExtensions: normalizeFileExtensionList(attachments.allowedExtensions, fallbackAllowedExtensions),
    maxFileSizeMb: Math.max(1, normalizeNonNegativeInteger(attachments.maxFileSizeMb, normalizeNonNegativeInteger(options.maxFileSizeMbFallback, 20))),
  }
}

export function mergeAttachmentFeatureSettings(
  appStateJson: string | null | undefined,
  input: AttachmentFeatureSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)
  const allowedExtensions = Array.from(new Set(
    input.allowedExtensions
      .map((item) => item.trim().toLowerCase().replace(/^\./, ""))
      .filter(Boolean),
  ))

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    attachments: {
      uploadEnabled: Boolean(input.uploadEnabled),
      downloadEnabled: Boolean(input.downloadEnabled),
      minUploadLevel: normalizeNonNegativeInteger(input.minUploadLevel, 0),
      minUploadVipLevel: normalizeNonNegativeInteger(input.minUploadVipLevel, 0),
      allowedExtensions: allowedExtensions.length > 0 ? allowedExtensions : ["zip", "rar", "7z", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"],
      maxFileSizeMb: Math.max(1, normalizeNonNegativeInteger(input.maxFileSizeMb, 20)),
    },
  }

  return JSON.stringify(root)
}

export function resolveRegisterNicknameLengthSettings(options: {
  appStateJson?: string | null
  minLengthFallback?: number
  maxLengthFallback?: number
} = {}): RegisterNicknameLengthSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const registerNicknameLengths = isRecord(siteSettingsState.registerNicknameLengths)
    ? siteSettingsState.registerNicknameLengths
    : {}
  const minLength = Math.min(
    50,
    Math.max(
      1,
      normalizeNonNegativeInteger(
        registerNicknameLengths.minLength,
        normalizeNonNegativeInteger(options.minLengthFallback, 1),
      ),
    ),
  )

  return {
    minLength,
    maxLength: Math.min(
      50,
      Math.max(
        minLength,
        normalizeNonNegativeInteger(
          registerNicknameLengths.maxLength,
          normalizeNonNegativeInteger(options.maxLengthFallback, 20),
        ),
      ),
    ),
  }
}

export function mergeRegisterNicknameLengthSettings(
  appStateJson: string | null | undefined,
  input: RegisterNicknameLengthSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)
  const minLength = Math.min(50, Math.max(1, normalizeNonNegativeInteger(input.minLength, 1)))

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    registerNicknameLengths: {
      minLength,
      maxLength: Math.min(50, Math.max(minLength, normalizeNonNegativeInteger(input.maxLength, 20))),
    },
  }

  return JSON.stringify(root)
}

export function resolveRegisterEmailWhitelistSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
  domainsFallback?: string[]
} = {}): RegisterEmailWhitelistSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const registerEmailWhitelist = isRecord(siteSettingsState.registerEmailWhitelist)
    ? siteSettingsState.registerEmailWhitelist
    : {}
  const { domains } = parseEmailWhitelistDomains(
    Array.isArray(registerEmailWhitelist.domains)
      ? registerEmailWhitelist.domains
      : options.domainsFallback ?? [],
  )

  return {
    enabled: typeof registerEmailWhitelist.enabled === "boolean"
      ? registerEmailWhitelist.enabled
      : options.enabledFallback ?? false,
    domains,
  }
}

export function mergeRegisterEmailWhitelistSettings(
  appStateJson: string | null | undefined,
  input: RegisterEmailWhitelistSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)
  const { domains } = parseEmailWhitelistDomains(input.domains)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    registerEmailWhitelist: {
      enabled: Boolean(input.enabled),
      domains,
    },
  }

  return JSON.stringify(root)
}

export function resolveSiteBrandingSettings(options: {
  appStateJson?: string | null
  iconPathFallback?: string
} = {}): SiteBrandingSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const siteBranding = isRecord(siteSettingsState.siteBranding)
    ? siteSettingsState.siteBranding
    : {}
  const resolvedIconPath = typeof siteBranding.iconPath === "string"
    ? siteBranding.iconPath.trim().slice(0, 1000)
    : ""
  const fallbackIconPath = typeof options.iconPathFallback === "string"
    ? options.iconPathFallback.trim().slice(0, 1000)
    : ""

  return {
    iconPath: resolvedIconPath || fallbackIconPath,
  }
}

export function mergeSiteBrandingSettings(
  appStateJson: string | null | undefined,
  input: SiteBrandingSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    siteBranding: {
      iconPath: typeof input.iconPath === "string" ? input.iconPath.trim().slice(0, 1000) : "",
    },
  }

  return JSON.stringify(root)
}

export function resolveFooterCopyrightSettings(options: {
  appStateJson?: string | null
  textFallback?: string
  brandingVisibleFallback?: boolean
} = {}): FooterCopyrightSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const footerCopyright = isRecord(siteSettingsState.footerCopyright)
    ? siteSettingsState.footerCopyright
    : {}
  const resolvedText = typeof footerCopyright.text === "string"
    ? footerCopyright.text.trim()
    : ""
  const fallbackText = (options.textFallback ?? "").trim()

  return {
    text: resolvedText || fallbackText,
    brandingVisible: typeof footerCopyright.brandingVisible === "boolean"
      ? footerCopyright.brandingVisible
      : options.brandingVisibleFallback ?? true,
  }
}

export function mergeFooterCopyrightSettings(
  appStateJson: string | null | undefined,
  input: FooterCopyrightSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    footerCopyright: {
      text: typeof input.text === "string" ? input.text.trim() : "",
      brandingVisible: Boolean(input.brandingVisible),
    },
  }

  return JSON.stringify(root)
}

export function resolvePostSlugGenerationSettings(options: {
  appStateJson?: string | null
  modeFallback?: PostSlugGenerationMode
} = {}): PostSlugGenerationSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const postSlugGeneration = isRecord(siteSettingsState.postSlugGeneration)
    ? siteSettingsState.postSlugGeneration
    : {}

  return {
    mode: normalizePostSlugGenerationMode(postSlugGeneration.mode, options.modeFallback),
  }
}

export function mergePostSlugGenerationSettings(
  appStateJson: string | null | undefined,
  input: PostSlugGenerationSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    postSlugGeneration: {
      mode: normalizePostSlugGenerationMode(input.mode),
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

export function resolveLeftSidebarDisplaySettings(options: {
  appStateJson?: string | null
  modeFallback?: LeftSidebarDisplayMode
} = {}): LeftSidebarDisplaySettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const leftSidebarDisplay = isRecord(siteSettingsState.leftSidebarDisplay)
    ? siteSettingsState.leftSidebarDisplay
    : {}

  return {
    mode: normalizeLeftSidebarDisplayMode(leftSidebarDisplay.mode, options.modeFallback),
  }
}

export function mergeLeftSidebarDisplaySettings(
  appStateJson: string | null | undefined,
  input: LeftSidebarDisplaySettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    leftSidebarDisplay: {
      mode: normalizeLeftSidebarDisplayMode(input.mode),
    },
  }

  return JSON.stringify(root)
}

export function resolveHomeFeedPostListLoadSettings(options: {
  appStateJson?: string | null
  loadModeFallback?: PostListLoadMode
} = {}): HomeFeedPostListLoadSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const homeFeedPostList = isRecord(siteSettingsState.homeFeedPostList)
    ? siteSettingsState.homeFeedPostList
    : {}

  return {
    loadMode: normalizePostListLoadMode(homeFeedPostList.loadMode, options.loadModeFallback),
  }
}

export function mergeHomeFeedPostListLoadSettings(
  appStateJson: string | null | undefined,
  input: HomeFeedPostListLoadSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    homeFeedPostList: {
      loadMode: normalizePostListLoadMode(input.loadMode),
    },
  }

  return JSON.stringify(root)
}

export function resolveHomeHotFeedSettings(options: {
  appStateJson?: string | null
  recentWindowHoursFallback?: number
} = {}): HomeHotFeedSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const homeHotFeed = isRecord(siteSettingsState.homeHotFeed)
    ? siteSettingsState.homeHotFeed
    : {}

  return {
    recentWindowHours: Math.min(
      720,
      Math.max(1, normalizeNonNegativeInteger(homeHotFeed.recentWindowHours, normalizeNonNegativeInteger(options.recentWindowHoursFallback, 72))),
    ),
  }
}

export function mergeHomeHotFeedSettings(
  appStateJson: string | null | undefined,
  input: HomeHotFeedSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    homeHotFeed: {
      recentWindowHours: Math.min(720, Math.max(1, normalizeNonNegativeInteger(input.recentWindowHours, 72))),
    },
  }

  return JSON.stringify(root)
}

export function resolvePostPageSizeSettings(options: {
  appStateJson?: string | null
  homeFeedFallback?: number
  zonePostsFallback?: number
  boardPostsFallback?: number
  commentsFallback?: number
  hotTopicsFallback?: number
  postRelatedTopicsFallback?: number
} = {}): PostPageSizeSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const postPageSizes = isRecord(siteSettingsState.postPageSizes)
    ? siteSettingsState.postPageSizes
    : {}

  return {
    homeFeed: Math.min(100, Math.max(1, normalizeNonNegativeInteger(postPageSizes.homeFeed, normalizeNonNegativeInteger(options.homeFeedFallback, 35)))),
    zonePosts: Math.min(100, Math.max(1, normalizeNonNegativeInteger(postPageSizes.zonePosts, normalizeNonNegativeInteger(options.zonePostsFallback, 20)))),
    boardPosts: Math.min(100, Math.max(1, normalizeNonNegativeInteger(postPageSizes.boardPosts, normalizeNonNegativeInteger(options.boardPostsFallback, 20)))),
    comments: Math.min(100, Math.max(1, normalizeNonNegativeInteger(postPageSizes.comments, normalizeNonNegativeInteger(options.commentsFallback, 15)))),
    hotTopics: Math.min(30, Math.max(1, normalizeNonNegativeInteger(postPageSizes.hotTopics, normalizeNonNegativeInteger(options.hotTopicsFallback, 5)))),
    postRelatedTopics: Math.min(30, Math.max(1, normalizeNonNegativeInteger(postPageSizes.postRelatedTopics, normalizeNonNegativeInteger(options.postRelatedTopicsFallback, 5)))),
  }
}

export function mergePostPageSizeSettings(
  appStateJson: string | null | undefined,
  input: PostPageSizeSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    postPageSizes: {
      homeFeed: Math.min(100, Math.max(1, normalizeNonNegativeInteger(input.homeFeed, 35))),
      zonePosts: Math.min(100, Math.max(1, normalizeNonNegativeInteger(input.zonePosts, 20))),
      boardPosts: Math.min(100, Math.max(1, normalizeNonNegativeInteger(input.boardPosts, 20))),
      comments: Math.min(100, Math.max(1, normalizeNonNegativeInteger(input.comments, 15))),
      hotTopics: Math.min(30, Math.max(1, normalizeNonNegativeInteger(input.hotTopics, 5))),
      postRelatedTopics: Math.min(30, Math.max(1, normalizeNonNegativeInteger(input.postRelatedTopics, 5))),
    },
  }

  return JSON.stringify(root)
}

export function resolveCommentAccessSettings(options: {
  appStateJson?: string | null
  guestCanViewFallback?: boolean
  initialVisibleRepliesFallback?: number
} = {}): CommentAccessSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const commentAccess = isRecord(siteSettingsState.commentAccess)
    ? siteSettingsState.commentAccess
    : {}

  return {
    guestCanView: typeof commentAccess.guestCanView === "boolean"
      ? commentAccess.guestCanView
      : options.guestCanViewFallback ?? true,
    initialVisibleReplies: Math.min(
      100,
      Math.max(
        1,
        normalizeNonNegativeInteger(
          commentAccess.initialVisibleReplies,
          normalizeNonNegativeInteger(options.initialVisibleRepliesFallback, 10),
        ),
      ),
    ),
  }
}

export function mergeCommentAccessSettings(
  appStateJson: string | null | undefined,
  input: CommentAccessSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    commentAccess: {
      guestCanView: input.guestCanView,
      initialVisibleReplies: Math.min(100, Math.max(1, normalizeNonNegativeInteger(input.initialVisibleReplies, 10))),
    },
  }

  return JSON.stringify(root)
}

function createEmptyInteractionGateRule(): InteractionGateRule {
  return {
    enabled: false,
    conditions: [],
  }
}

function normalizeInteractionGateCondition(value: unknown): InteractionGateCondition | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null
  }

  if (value.type === "EMAIL_VERIFIED") {
    return value.enabled === false ? null : { type: "EMAIL_VERIFIED", enabled: true }
  }

  if (value.type === "REGISTERED_MINUTES") {
    const minutes = normalizeNonNegativeInteger(value.value, 0)
    return minutes > 0 ? { type: "REGISTERED_MINUTES", value: minutes } : null
  }

  return null
}

function normalizeInteractionGateRule(value: unknown): InteractionGateRule {
  if (!isRecord(value)) {
    return createEmptyInteractionGateRule()
  }

  const conditions = Array.isArray(value.conditions)
    ? value.conditions.map(normalizeInteractionGateCondition).filter(Boolean) as InteractionGateCondition[]
    : []

  const dedupedConditions = Array.from(new Map(conditions.map((condition) => [condition.type, condition])).values())

  return {
    enabled: dedupedConditions.length > 0,
    conditions: dedupedConditions,
  }
}

function normalizeInteractionGateSettings(value: unknown): InteractionGateSettings {
  const actions = isRecord(value) && isRecord(value.actions) ? value.actions : {}

  return {
    version: 1,
    actions: {
      POST_CREATE: normalizeInteractionGateRule(actions.POST_CREATE),
      COMMENT_CREATE: normalizeInteractionGateRule(actions.COMMENT_CREATE),
    },
  }
}

export function resolveInteractionGateSettings(options: {
  appStateJson?: string | null
} = {}): InteractionGateSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  return normalizeInteractionGateSettings(siteSettingsState.interactionGates)
}

export function mergeInteractionGateSettings(
  appStateJson: string | null | undefined,
  input: InteractionGateSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)
  const normalized = normalizeInteractionGateSettings(input)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    interactionGates: normalized,
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

export function resolveVipNameColorSettings(options: {
  appStateJson?: string | null
} = {}): VipNameColorSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const vipNameColors = isRecord(siteSettingsState.vipNameColors)
    ? siteSettingsState.vipNameColors
    : {}

  return normalizeVipNameColors({
    normal: typeof vipNameColors.normal === "string" ? vipNameColors.normal : undefined,
    vip1: typeof vipNameColors.vip1 === "string" ? vipNameColors.vip1 : undefined,
    vip2: typeof vipNameColors.vip2 === "string" ? vipNameColors.vip2 : undefined,
    vip3: typeof vipNameColors.vip3 === "string" ? vipNameColors.vip3 : undefined,
  })
}

export function mergeVipNameColorSettings(
  appStateJson: string | null | undefined,
  input: VipNameColorSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    vipNameColors: normalizeVipNameColors(input),
  }

  return JSON.stringify(root)
}

export function resolveAuthProviderSettings(options: {
  appStateJson?: string | null
  githubEnabledFallback?: boolean
  googleEnabledFallback?: boolean
  passkeyEnabledFallback?: boolean
} = {}): AuthProviderSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const authProviders = isRecord(siteSettingsState.authProviders)
    ? siteSettingsState.authProviders
    : {}

  return {
    githubEnabled: typeof authProviders.githubEnabled === "boolean"
      ? authProviders.githubEnabled
      : options.githubEnabledFallback ?? false,
    googleEnabled: typeof authProviders.googleEnabled === "boolean"
      ? authProviders.googleEnabled
      : options.googleEnabledFallback ?? false,
    passkeyEnabled: typeof authProviders.passkeyEnabled === "boolean"
      ? authProviders.passkeyEnabled
      : options.passkeyEnabledFallback ?? false,
  }
}

export function mergeAuthProviderSettings(
  appStateJson: string | null | undefined,
  input: AuthProviderSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    authProviders: {
      githubEnabled: input.githubEnabled,
      googleEnabled: input.googleEnabled,
      passkeyEnabled: input.passkeyEnabled,
    },
  }

  return JSON.stringify(root)
}

export function resolvePostJackpotSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
  minInitialPointsFallback?: number
  maxInitialPointsFallback?: number
  replyIncrementPointsFallback?: number
  hitProbabilityFallback?: number
} = {}): PostJackpotSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const postJackpot = isRecord(siteSettingsState.postJackpot)
    ? siteSettingsState.postJackpot
    : {}

  const minInitialPoints = normalizeNonNegativeInteger(postJackpot.minInitialPoints, normalizeNonNegativeInteger(options.minInitialPointsFallback, 100))
  const maxInitialPoints = Math.max(
    minInitialPoints,
    normalizeNonNegativeInteger(postJackpot.maxInitialPoints, normalizeNonNegativeInteger(options.maxInitialPointsFallback, 1000)),
  )

  return {
    enabled: typeof postJackpot.enabled === "boolean"
      ? postJackpot.enabled
      : options.enabledFallback ?? false,
    minInitialPoints,
    maxInitialPoints,
    replyIncrementPoints: normalizeNonNegativeInteger(postJackpot.replyIncrementPoints, normalizeNonNegativeInteger(options.replyIncrementPointsFallback, 25)),
    hitProbability: Math.max(1, Math.min(100, normalizeNonNegativeInteger(postJackpot.hitProbability, normalizeNonNegativeInteger(options.hitProbabilityFallback, 15)))),
  }
}

export function mergePostJackpotSettings(
  appStateJson: string | null | undefined,
  input: PostJackpotSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    postJackpot: {
      enabled: input.enabled,
      minInitialPoints: normalizeNonNegativeInteger(input.minInitialPoints, 100),
      maxInitialPoints: Math.max(
        normalizeNonNegativeInteger(input.minInitialPoints, 100),
        normalizeNonNegativeInteger(input.maxInitialPoints, 1000),
      ),
      replyIncrementPoints: normalizeNonNegativeInteger(input.replyIncrementPoints, 25),
      hitProbability: Math.max(1, Math.min(100, normalizeNonNegativeInteger(input.hitProbability, 15))),
    },
  }

  return JSON.stringify(root)
}

export function resolvePostRedPacketSettings(options: {
  appStateJson?: string | null
  randomClaimProbabilityFallback?: number
} = {}): PostRedPacketSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const postRedPacket = isRecord(siteSettingsState.postRedPacket)
    ? siteSettingsState.postRedPacket
    : {}

  return {
    randomClaimProbability: Math.max(
      0,
      Math.min(
        100,
        normalizeNonNegativeInteger(
          postRedPacket.randomClaimProbability,
          normalizeNonNegativeInteger(options.randomClaimProbabilityFallback, 0),
        ),
      ),
    ),
  }
}

export function mergePostRedPacketSettings(
  appStateJson: string | null | undefined,
  input: PostRedPacketSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    postRedPacket: {
      randomClaimProbability: Math.max(0, Math.min(100, normalizeNonNegativeInteger(input.randomClaimProbability, 0))),
    },
  }

  return JSON.stringify(root)
}

export function resolveAuthPageShowcaseSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
} = {}): AuthPageShowcaseSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const authPageShowcase = isRecord(siteSettingsState.authPageShowcase)
    ? siteSettingsState.authPageShowcase
    : {}

  return {
    enabled: typeof authPageShowcase.enabled === "boolean"
      ? authPageShowcase.enabled
      : options.enabledFallback ?? true,
  }
}

export function mergeAuthPageShowcaseSettings(
  appStateJson: string | null | undefined,
  input: AuthPageShowcaseSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    authPageShowcase: {
      enabled: Boolean(input.enabled),
    },
  }

  return JSON.stringify(root)
}

export function resolveUploadObjectStorageSettings(options: {
  appStateJson?: string | null
  forcePathStyleFallback?: boolean
} = {}): UploadObjectStorageSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const uploadObjectStorage = isRecord(siteSettingsState.uploadObjectStorage)
    ? siteSettingsState.uploadObjectStorage
    : {}

  return {
    forcePathStyle: typeof uploadObjectStorage.forcePathStyle === "boolean"
      ? uploadObjectStorage.forcePathStyle
      : options.forcePathStyleFallback ?? true,
  }
}

export function mergeUploadObjectStorageSettings(
  appStateJson: string | null | undefined,
  input: UploadObjectStorageSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    uploadObjectStorage: {
      forcePathStyle: input.forcePathStyle,
    },
  }

  return JSON.stringify(root)
}

export function resolvePostContentLengthSettings(options: {
  appStateJson?: string | null
  postTitleMinLengthFallback?: number
  postTitleMaxLengthFallback?: number
  postContentMinLengthFallback?: number
  postContentMaxLengthFallback?: number
  commentContentMinLengthFallback?: number
  commentContentMaxLengthFallback?: number
} = {}): PostContentLengthSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const postContentLengths = isRecord(siteSettingsState.postContentLengths)
    ? siteSettingsState.postContentLengths
    : {}
  const postTitleMinLength = Math.min(
    100,
    Math.max(
      1,
      normalizeNonNegativeInteger(
        postContentLengths.postTitleMinLength,
        normalizeNonNegativeInteger(options.postTitleMinLengthFallback, 5),
      ),
    ),
  )
  const postContentMinLength = Math.min(
    1000,
    Math.max(
      1,
      normalizeNonNegativeInteger(
        postContentLengths.postContentMinLength,
        normalizeNonNegativeInteger(options.postContentMinLengthFallback, 10),
      ),
    ),
  )
  const commentContentMinLength = Math.min(
    500,
    Math.max(
      1,
      normalizeNonNegativeInteger(
        postContentLengths.commentContentMinLength,
        normalizeNonNegativeInteger(options.commentContentMinLengthFallback, 2),
      ),
    ),
  )

  return {
    postTitleMinLength,
    postTitleMaxLength: Math.min(
      500,
      Math.max(
        postTitleMinLength,
        normalizeNonNegativeInteger(
          postContentLengths.postTitleMaxLength,
          normalizeNonNegativeInteger(options.postTitleMaxLengthFallback, 100),
        ),
      ),
    ),
    postContentMinLength,
    postContentMaxLength: Math.min(
      100000,
      Math.max(
        postContentMinLength,
        normalizeNonNegativeInteger(
          postContentLengths.postContentMaxLength,
          normalizeNonNegativeInteger(options.postContentMaxLengthFallback, 50000),
        ),
      ),
    ),
    commentContentMinLength,
    commentContentMaxLength: Math.min(
      20000,
      Math.max(
        commentContentMinLength,
        normalizeNonNegativeInteger(
          postContentLengths.commentContentMaxLength,
          normalizeNonNegativeInteger(options.commentContentMaxLengthFallback, 2000),
        ),
      ),
    ),
  }
}

export function mergePostContentLengthSettings(
  appStateJson: string | null | undefined,
  input: PostContentLengthSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)
  const postTitleMinLength = Math.min(100, Math.max(1, normalizeNonNegativeInteger(input.postTitleMinLength, 5)))
  const postContentMinLength = Math.min(1000, Math.max(1, normalizeNonNegativeInteger(input.postContentMinLength, 10)))
  const commentContentMinLength = Math.min(500, Math.max(1, normalizeNonNegativeInteger(input.commentContentMinLength, 2)))

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    postContentLengths: {
      postTitleMinLength,
      postTitleMaxLength: Math.min(500, Math.max(postTitleMinLength, normalizeNonNegativeInteger(input.postTitleMaxLength, 100))),
      postContentMinLength,
      postContentMaxLength: Math.min(100000, Math.max(postContentMinLength, normalizeNonNegativeInteger(input.postContentMaxLength, 50000))),
      commentContentMinLength,
      commentContentMaxLength: Math.min(20000, Math.max(commentContentMinLength, normalizeNonNegativeInteger(input.commentContentMaxLength, 2000))),
    },
  }

  return JSON.stringify(root)
}

export function resolveBoardTreasurySettings(options: {
  appStateJson?: string | null
  tipGiftTaxEnabledFallback?: boolean
  tipGiftTaxRateBpsFallback?: number
} = {}): BoardTreasurySettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const boardTreasury = isRecord(siteSettingsState.boardTreasury)
    ? siteSettingsState.boardTreasury
    : {}

  return {
    tipGiftTaxEnabled: typeof boardTreasury.tipGiftTaxEnabled === "boolean"
      ? boardTreasury.tipGiftTaxEnabled
      : options.tipGiftTaxEnabledFallback ?? false,
    tipGiftTaxRateBps: Math.min(
      10000,
      normalizeNonNegativeInteger(
        boardTreasury.tipGiftTaxRateBps,
        normalizeNonNegativeInteger(options.tipGiftTaxRateBpsFallback, 0),
      ),
    ),
  }
}

export function mergeBoardTreasurySettings(
  appStateJson: string | null | undefined,
  input: BoardTreasurySettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    boardTreasury: {
      tipGiftTaxEnabled: Boolean(input.tipGiftTaxEnabled),
      tipGiftTaxRateBps: Math.min(10000, normalizeNonNegativeInteger(input.tipGiftTaxRateBps, 0)),
    },
  }

  return JSON.stringify(root)
}

export function resolveBoardApplicationSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
} = {}): BoardApplicationSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const boardApplications = isRecord(siteSettingsState.boardApplications)
    ? siteSettingsState.boardApplications
    : {}

  return {
    enabled: typeof boardApplications.enabled === "boolean"
      ? boardApplications.enabled
      : options.enabledFallback ?? true,
  }
}

export function mergeBoardApplicationSettings(
  appStateJson: string | null | undefined,
  input: BoardApplicationSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    boardApplications: {
      enabled: Boolean(input.enabled),
    },
  }

  return JSON.stringify(root)
}

export function resolveAnonymousPostSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
  priceFallback?: number
  dailyLimitFallback?: number
  maskUserIdFallback?: number | null
  allowReplySwitchFallback?: boolean
  defaultReplyAnonymousFallback?: boolean
} = {}): AnonymousPostSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const anonymousPost = isRecord(siteSettingsState.anonymousPost)
    ? siteSettingsState.anonymousPost
    : {}
  const rawMaskUserId = parseNonNegativeSafeInteger(anonymousPost.maskUserId)

  return {
    enabled: typeof anonymousPost.enabled === "boolean"
      ? anonymousPost.enabled
      : options.enabledFallback ?? false,
    price: normalizeNonNegativeInteger(anonymousPost.price, normalizeNonNegativeInteger(options.priceFallback, 0)),
    dailyLimit: normalizeNonNegativeInteger(anonymousPost.dailyLimit, normalizeNonNegativeInteger(options.dailyLimitFallback, 0)),
    maskUserId: typeof rawMaskUserId === "number" && rawMaskUserId > 0
      ? rawMaskUserId
      : (typeof options.maskUserIdFallback === "number" && options.maskUserIdFallback > 0 ? options.maskUserIdFallback : null),
    allowReplySwitch: typeof anonymousPost.allowReplySwitch === "boolean"
      ? anonymousPost.allowReplySwitch
      : options.allowReplySwitchFallback ?? true,
    defaultReplyAnonymous: typeof anonymousPost.defaultReplyAnonymous === "boolean"
      ? anonymousPost.defaultReplyAnonymous
      : options.defaultReplyAnonymousFallback ?? true,
  }
}

export function mergeAnonymousPostSettings(
  appStateJson: string | null | undefined,
  input: AnonymousPostSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)
  const maskUserId = parseNonNegativeSafeInteger(input.maskUserId)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    anonymousPost: {
      enabled: Boolean(input.enabled),
      price: normalizeNonNegativeInteger(input.price, 0),
      dailyLimit: normalizeNonNegativeInteger(input.dailyLimit, 0),
      maskUserId: typeof maskUserId === "number" && maskUserId > 0 ? maskUserId : null,
      allowReplySwitch: Boolean(input.allowReplySwitch),
      defaultReplyAnonymous: Boolean(input.defaultReplyAnonymous),
    },
  }

  return JSON.stringify(root)
}

export function resolveRegistrationRewardSettings(options: {
  appStateJson?: string | null
  initialPointsFallback?: number
} = {}): RegistrationRewardSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const registrationRewards = isRecord(siteSettingsState.registrationRewards)
    ? siteSettingsState.registrationRewards
    : {}

  return {
    initialPoints: normalizeNonNegativeInteger(
      registrationRewards.initialPoints,
      normalizeNonNegativeInteger(options.initialPointsFallback, 0),
    ),
  }
}

export function mergeRegistrationRewardSettings(
  appStateJson: string | null | undefined,
  input: RegistrationRewardSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    registrationRewards: {
      initialPoints: normalizeNonNegativeInteger(input.initialPoints, 0),
    },
  }

  return JSON.stringify(root)
}

export function resolveRegisterInviteCodeHelpSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
  titleFallback?: string
  urlFallback?: string
} = {}): RegisterInviteCodeHelpSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const registerInviteCodeHelp = isRecord(siteSettingsState.registerInviteCodeHelp)
    ? siteSettingsState.registerInviteCodeHelp
    : {}

  return {
    enabled: typeof registerInviteCodeHelp.enabled === "boolean"
      ? registerInviteCodeHelp.enabled
      : options.enabledFallback ?? false,
    title: typeof registerInviteCodeHelp.title === "string"
      ? registerInviteCodeHelp.title.trim()
      : options.titleFallback ?? "",
    url: typeof registerInviteCodeHelp.url === "string"
      ? registerInviteCodeHelp.url.trim()
      : options.urlFallback ?? "",
  }
}

export function mergeRegisterInviteCodeHelpSettings(
  appStateJson: string | null | undefined,
  input: RegisterInviteCodeHelpSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    registerInviteCodeHelp: {
      enabled: Boolean(input.enabled),
      title: input.title.trim(),
      url: input.url.trim(),
    },
  }

  return JSON.stringify(root)
}

export function resolveRedeemCodeHelpSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
  titleFallback?: string
  urlFallback?: string
} = {}): RedeemCodeHelpSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const redeemCodeHelp = isRecord(siteSettingsState.redeemCodeHelp)
    ? siteSettingsState.redeemCodeHelp
    : {}

  return {
    enabled: typeof redeemCodeHelp.enabled === "boolean"
      ? redeemCodeHelp.enabled
      : options.enabledFallback ?? false,
    title: typeof redeemCodeHelp.title === "string"
      ? redeemCodeHelp.title.trim()
      : options.titleFallback ?? "",
    url: typeof redeemCodeHelp.url === "string"
      ? redeemCodeHelp.url.trim()
      : options.urlFallback ?? "",
  }
}

export function mergeRedeemCodeHelpSettings(
  appStateJson: string | null | undefined,
  input: RedeemCodeHelpSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    redeemCodeHelp: {
      enabled: Boolean(input.enabled),
      title: input.title.trim(),
      url: input.url.trim(),
    },
  }

  return JSON.stringify(root)
}

export function resolveCheckInStreakSettings(options: {
  appStateJson?: string | null
  makeUpCountsTowardStreakFallback?: boolean
} = {}): CheckInStreakSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const checkInStreak = isRecord(siteSettingsState.checkInStreak)
    ? siteSettingsState.checkInStreak
    : {}

  return {
    makeUpCountsTowardStreak: typeof checkInStreak.makeUpCountsTowardStreak === "boolean"
      ? checkInStreak.makeUpCountsTowardStreak
      : options.makeUpCountsTowardStreakFallback ?? true,
  }
}

export function mergeCheckInStreakSettings(
  appStateJson: string | null | undefined,
  input: CheckInStreakSettings,
) {
  const root = parseAppStateRoot(appStateJson)
  const siteSettingsState = readSiteSettingsState(appStateJson)

  root[SITE_SETTINGS_STATE_KEY] = {
    ...siteSettingsState,
    checkInStreak: {
      makeUpCountsTowardStreak: input.makeUpCountsTowardStreak,
    },
  }

  return JSON.stringify(root)
}
