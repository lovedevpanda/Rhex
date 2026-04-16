import "server-only"

import { unstable_cache } from "next/cache"

import { listActiveGiftDefinitions } from "@/db/post-gift-queries"
import { createSiteSettingsRecord, findSensitiveWordsPage, findSiteSettingsRecord, getSensitiveWordStats } from "@/db/site-settings-queries"
import { mergeMarkdownEmojiItems } from "@/lib/addon-emoji-providers"
import { mergeAddonNavigationLinks } from "@/lib/addon-navigation-providers"
import { normalizeSensitiveActionType } from "@/lib/content-safety"
import {
  normalizeCaptchaMode,
  parseFooterLinks,
  parseHeatColors,
  parseHeatThresholds,
  parseTippingAmounts,
} from "@/lib/shared/config-parsers"
import { defaultSiteSettingsCreateInput } from "@/lib/site-settings-defaults"
import { parseMarkdownEmojiMapJson } from "@/lib/markdown-emoji"
import { normalizePostListLoadMode } from "@/lib/post-list-load-mode"
import { normalizePostListDisplayMode } from "@/lib/post-list-display"
import { resolveAnonymousPostSettings, resolveAttachmentFeatureSettings, resolveAuthProviderSettings, resolveAvatarChangePointCostSettings, resolveBoardApplicationSettings, resolveBoardTreasurySettings, resolveCheckInMakeUpPriceSettings, resolveCheckInRewardSettings, resolveCheckInStreakSettings, resolveCommentAccessSettings, resolveFooterCopyrightSettings, resolveHomeFeedPostListLoadSettings, resolveHomeHotFeedSettings, resolveHomeSidebarAnnouncementSettings, resolveImageWatermarkSettings, resolveInteractionGateSettings, resolveIntroductionChangePointCostSettings, resolveInviteCodePurchasePriceSettings, resolveLeftSidebarDisplaySettings, resolveMarkdownImageUploadSettings, resolveNicknameChangePointCostSettings, resolvePostContentLengthSettings, resolvePostJackpotSettings, resolvePostPageSizeSettings, resolvePostRedPacketSettings, resolvePostSlugGenerationSettings, resolveRegisterEmailWhitelistSettings, resolveRegisterInviteCodeHelpSettings, resolveRegisterNicknameLengthSettings, resolveRegistrationEmailTemplateSettings, resolveRegistrationRewardSettings, resolveSiteBrandingSettings, resolveSiteSecuritySettings, resolveUploadObjectStorageSettings, resolveVipLevelIconSettings, resolveVipNameColorSettings } from "@/lib/site-settings-app-state"
import { resolveAuthPageShowcaseSettings } from "@/lib/site-settings-app-state"
import { resolveAuthProviderSensitiveConfig, resolveCaptchaSensitiveConfig, resolveUploadStorageSensitiveConfig } from "@/lib/site-settings-sensitive-state"
import { resolveSiteSearchSettings } from "@/lib/site-search-settings"
import { normalizePositiveInteger } from "@/lib/shared/normalizers"
import type { SiteSettingsRecordData } from "@/lib/site-settings.record"
import { type SiteTippingGiftItem } from "@/lib/tipping-gifts"
import { normalizeUploadProvider } from "@/lib/upload-provider"
import type { ServerSiteSettingsData, SiteSettingsData } from "@/lib/site-settings.types"
import { normalizeHeaderAppIconName, parseSiteHeaderAppLinks } from "./site-header-app-links"

export type { FooterLinkItem } from "@/lib/shared/config-parsers"

export type { SiteSearchSettings } from "@/lib/site-search-settings"
export type { SiteTippingGiftItem } from "@/lib/tipping-gifts"
export type { VipNameColors } from "@/lib/vip-name-colors"
export type { InteractionGateAction, InteractionGateCondition, InteractionGateRule, InteractionGateSettings } from "@/lib/site-settings-app-state"
export type { LeftSidebarDisplayMode } from "@/lib/site-settings-app-state"
export type { PostSlugGenerationMode } from "@/lib/site-settings-app-state"
export type { RegistrationEmailTemplateSettings } from "@/lib/site-settings-app-state"
export type { PostLinkDisplayMode, ServerSiteSettingsData, SiteSettingsData } from "@/lib/site-settings.types"

function getDefaultServerSiteSettings(): ServerSiteSettingsData {
  return mapSiteSettings({
    ...defaultSiteSettingsCreateInput,
    checkInMakeUpCardPrice: 0,
    checkInVipMakeUpCardPrice: 0,
    postOfflinePrice: 0,
    postOfflineVip1Price: 0,
    postOfflineVip2Price: 0,
    postOfflineVip3Price: 0,
  })
}

function normalizeLegacyServerSiteSettings(data: ServerSiteSettingsData): ServerSiteSettingsData {
  const defaults = getDefaultServerSiteSettings()

  return {
    ...data,
    checkInMakeUpEnabled: typeof data.checkInMakeUpEnabled === "boolean"
      ? data.checkInMakeUpEnabled
      : defaults.checkInMakeUpEnabled,
    registerInviteCodeHelpEnabled: typeof data.registerInviteCodeHelpEnabled === "boolean"
      ? data.registerInviteCodeHelpEnabled
      : defaults.registerInviteCodeHelpEnabled,
    registerInviteCodeHelpTitle: typeof data.registerInviteCodeHelpTitle === "string"
      ? data.registerInviteCodeHelpTitle
      : defaults.registerInviteCodeHelpTitle,
    registerInviteCodeHelpUrl: typeof data.registerInviteCodeHelpUrl === "string"
      ? data.registerInviteCodeHelpUrl
      : defaults.registerInviteCodeHelpUrl,
    registerEmailWhitelistEnabled: typeof data.registerEmailWhitelistEnabled === "boolean"
      ? data.registerEmailWhitelistEnabled
      : defaults.registerEmailWhitelistEnabled,
    registerEmailWhitelistDomains: Array.isArray(data.registerEmailWhitelistDomains)
      ? data.registerEmailWhitelistDomains.filter((item): item is string => typeof item === "string")
      : defaults.registerEmailWhitelistDomains,
    sessionIpMismatchLogoutEnabled: typeof data.sessionIpMismatchLogoutEnabled === "boolean"
      ? data.sessionIpMismatchLogoutEnabled
      : defaults.sessionIpMismatchLogoutEnabled,
    loginIpChangeEmailAlertEnabled: typeof data.loginIpChangeEmailAlertEnabled === "boolean"
      ? data.loginIpChangeEmailAlertEnabled
      : defaults.loginIpChangeEmailAlertEnabled,
    passwordChangeRequireEmailVerification: typeof data.passwordChangeRequireEmailVerification === "boolean"
      ? data.passwordChangeRequireEmailVerification
      : defaults.passwordChangeRequireEmailVerification,
    redeemCodeHelpEnabled: typeof data.redeemCodeHelpEnabled === "boolean"
      ? data.redeemCodeHelpEnabled
      : defaults.redeemCodeHelpEnabled,
    redeemCodeHelpTitle: typeof data.redeemCodeHelpTitle === "string"
      ? data.redeemCodeHelpTitle
      : defaults.redeemCodeHelpTitle,
    redeemCodeHelpUrl: typeof data.redeemCodeHelpUrl === "string"
      ? data.redeemCodeHelpUrl
      : defaults.redeemCodeHelpUrl,
    checkInMakeUpOldestDayLimit: typeof data.checkInMakeUpOldestDayLimit === "number" && Number.isFinite(data.checkInMakeUpOldestDayLimit)
      ? Math.max(0, Math.floor(data.checkInMakeUpOldestDayLimit))
      : defaults.checkInMakeUpOldestDayLimit,
  }
}

function parseSiteSettingsAppState(raw: string | null | undefined) {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {}
    }

    const siteSettingsState = (parsed as Record<string, unknown>).__siteSettings
    return siteSettingsState && typeof siteSettingsState === "object" && !Array.isArray(siteSettingsState)
      ? siteSettingsState as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

function resolveRedeemCodeHelpSettingsFromAppState(appStateJson?: string | null) {
  const appState = parseSiteSettingsAppState(appStateJson)
  const redeemCodeHelp = appState.redeemCodeHelp
  const normalized = redeemCodeHelp && typeof redeemCodeHelp === "object" && !Array.isArray(redeemCodeHelp)
    ? redeemCodeHelp as Record<string, unknown>
    : {}

  return {
    enabled: typeof normalized.enabled === "boolean" ? normalized.enabled : false,
    title: typeof normalized.title === "string" ? normalized.title.trim() : "",
    url: typeof normalized.url === "string" ? normalized.url.trim() : "",
  }
}

async function readSiteSettingsFromDB(): Promise<ServerSiteSettingsData> {
  const record = await findSiteSettingsRecord()

  if (!record) {
    return getDefaultServerSiteSettings()
  }

  const databaseTippingGifts = await listActiveGiftDefinitions()

  return mapSiteSettings(record, databaseTippingGifts)
}

export const SITE_SETTINGS_CACHE_TAG = "site-settings"

function mapSiteSettings(record: SiteSettingsRecordData, tippingGifts: SiteTippingGiftItem[] = []): ServerSiteSettingsData {
  const checkInRewards = resolveCheckInRewardSettings({
    appStateJson: record.appStateJson,
    normalReward: record.checkInReward,
  })
  const inviteCodePurchasePrices = resolveInviteCodePurchasePriceSettings({
    appStateJson: record.appStateJson,
    normalPrice: record.inviteCodePrice,
  })
  const checkInMakeUpPrices = resolveCheckInMakeUpPriceSettings({
    appStateJson: record.appStateJson,
    normalPrice: record.checkInMakeUpCardPrice,
    vipFallbackPrice: record.checkInVipMakeUpCardPrice,
  })
  const checkInStreakSettings = resolveCheckInStreakSettings({
    appStateJson: record.appStateJson,
    enabledFallback: true,
    makeUpCountsTowardStreakFallback: true,
    oldestDayLimitFallback: 0,
  })
  const nicknameChangePointCosts = resolveNicknameChangePointCostSettings({
    appStateJson: record.appStateJson,
    normalPrice: record.nicknameChangePointCost,
  })
  const introductionChangePointCosts = resolveIntroductionChangePointCostSettings({
    appStateJson: record.appStateJson,
    normalPrice: 0,
  })
  const avatarChangePointCosts = resolveAvatarChangePointCostSettings({
    appStateJson: record.appStateJson,
    normalPrice: 0,
  })
  const tippingAmounts = parseTippingAmounts(record.tippingAmounts)
  const searchSettings = resolveSiteSearchSettings(record.appStateJson)
  const homeSidebarAnnouncementSettings = resolveHomeSidebarAnnouncementSettings({
    appStateJson: record.appStateJson,
    enabledFallback: true,
  })
  const leftSidebarDisplaySettings = resolveLeftSidebarDisplaySettings({
    appStateJson: record.appStateJson,
    modeFallback: "DEFAULT",
  })
  const postSlugGenerationSettings = resolvePostSlugGenerationSettings({
    appStateJson: record.appStateJson,
    modeFallback: "TITLE_TIMESTAMP",
  })
  const footerCopyrightSettings = resolveFooterCopyrightSettings({
    appStateJson: record.appStateJson,
    textFallback: `${record.siteName} @ ${new Date().getFullYear()}`,
    brandingVisibleFallback: true,
  })
  const siteBrandingSettings = resolveSiteBrandingSettings({
    appStateJson: record.appStateJson,
    iconPathFallback: "",
  })
  const homeFeedPostListLoadSettings = resolveHomeFeedPostListLoadSettings({
    appStateJson: record.appStateJson,
    loadModeFallback: normalizePostListLoadMode(undefined),
  })
  const homeHotFeedSettings = resolveHomeHotFeedSettings({
    appStateJson: record.appStateJson,
    recentWindowHoursFallback: 72,
  })
  const vipLevelIcons = resolveVipLevelIconSettings({
    appStateJson: record.appStateJson,
  })
  const vipNameColors = resolveVipNameColorSettings({
    appStateJson: record.appStateJson,
  })
  const markdownImageUploadSettings = resolveMarkdownImageUploadSettings({
    appStateJson: record.appStateJson,
    enabledFallback: true,
  })
  const uploadObjectStorageSettings = resolveUploadObjectStorageSettings({
    appStateJson: record.appStateJson,
    forcePathStyleFallback: true,
  })
  const imageWatermarkSettings = resolveImageWatermarkSettings({
    appStateJson: record.appStateJson,
    enabledFallback: false,
    textFallback: "",
    positionFallback: "BOTTOM_RIGHT",
    tiledFallback: false,
    opacityFallback: 22,
    fontSizeFallback: 24,
    fontFamilyFallback: "",
    marginFallback: 24,
    colorFallback: "#FFFFFF",
    logoPathFallback: "",
    logoScalePercentFallback: 16,
  })
  const attachmentFeatureSettings = resolveAttachmentFeatureSettings({
    appStateJson: record.appStateJson,
    uploadEnabledFallback: false,
    downloadEnabledFallback: false,
    minUploadLevelFallback: 0,
    minUploadVipLevelFallback: 0,
    allowedExtensionsFallback: ["zip", "rar", "7z", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"],
    maxFileSizeMbFallback: 20,
  })
  const commentAccessSettings = resolveCommentAccessSettings({
    appStateJson: record.appStateJson,
    guestCanViewFallback: true,
    initialVisibleRepliesFallback: 10,
  })
  const interactionGateSettings = resolveInteractionGateSettings({
    appStateJson: record.appStateJson,
  })
  const postContentLengthSettings = resolvePostContentLengthSettings({
    appStateJson: record.appStateJson,
    postTitleMinLengthFallback: 5,
    postTitleMaxLengthFallback: 100,
    postContentMinLengthFallback: 10,
    postContentMaxLengthFallback: 50000,
    commentContentMinLengthFallback: 2,
    commentContentMaxLengthFallback: 2000,
  })
  const authProviderSettings = resolveAuthProviderSettings({
    appStateJson: record.appStateJson,
  })
  const registrationRewardSettings = resolveRegistrationRewardSettings({
    appStateJson: record.appStateJson,
    initialPointsFallback: 0,
  })
  const registrationEmailTemplateSettings = resolveRegistrationEmailTemplateSettings({
    appStateJson: record.appStateJson,
    siteNameFallback: record.siteName,
  })
  const registerNicknameLengthSettings = resolveRegisterNicknameLengthSettings({
    appStateJson: record.appStateJson,
    minLengthFallback: 1,
    maxLengthFallback: 20,
  })
  const registerInviteCodeHelpSettings = resolveRegisterInviteCodeHelpSettings({
    appStateJson: record.appStateJson,
  })
  const registerEmailWhitelistSettings = resolveRegisterEmailWhitelistSettings({
    appStateJson: record.appStateJson,
  })
  const siteSecuritySettings = resolveSiteSecuritySettings({
    appStateJson: record.appStateJson,
  })
  const redeemCodeHelpSettings = resolveRedeemCodeHelpSettingsFromAppState(record.appStateJson)
  const authPageShowcaseSettings = resolveAuthPageShowcaseSettings({
    appStateJson: record.appStateJson,
    enabledFallback: true,
  })
  const postJackpotSettings = resolvePostJackpotSettings({
    appStateJson: record.appStateJson,
    enabledFallback: false,
    minInitialPointsFallback: 100,
    maxInitialPointsFallback: 1000,
    replyIncrementPointsFallback: 25,
    hitProbabilityFallback: 15,
  })
  const postRedPacketSettings = resolvePostRedPacketSettings({
    appStateJson: record.appStateJson,
    randomClaimProbabilityFallback: 0,
  })
  const anonymousPostSettings = resolveAnonymousPostSettings({
    appStateJson: record.appStateJson,
    enabledFallback: false,
    priceFallback: 0,
    dailyLimitFallback: 0,
    maskUserIdFallback: null,
    allowReplySwitchFallback: true,
    defaultReplyAnonymousFallback: true,
  })
  const postPageSizeSettings = resolvePostPageSizeSettings({
    appStateJson: record.appStateJson,
    homeFeedFallback: 35,
    zonePostsFallback: 20,
    boardPostsFallback: 20,
    commentsFallback: 15,
    hotTopicsFallback: 5,
    postRelatedTopicsFallback: 5,
  })
  const boardTreasurySettings = resolveBoardTreasurySettings({
    appStateJson: record.appStateJson,
    tipGiftTaxEnabledFallback: false,
    tipGiftTaxRateBpsFallback: 0,
  })
  const boardApplicationSettings = resolveBoardApplicationSettings({
    appStateJson: record.appStateJson,
    enabledFallback: true,
  })
  const authProviderSensitiveConfig = resolveAuthProviderSensitiveConfig(record.sensitiveStateJson)
  const captchaSensitiveConfig = resolveCaptchaSensitiveConfig(record.sensitiveStateJson)
  const uploadStorageSensitiveConfig = resolveUploadStorageSensitiveConfig(record.sensitiveStateJson)

  return {
    siteName: record.siteName,
    siteSlogan: record.siteSlogan,
    siteDescription: record.siteDescription,
    siteLogoText: record.siteLogoText,
    siteLogoPath: record.siteLogoPath,
    siteIconPath: siteBrandingSettings.iconPath || null,
    siteSeoKeywords: String(record.siteSeoKeywords || "").split(/[，,\n]+/).map((item) => item.trim()).filter(Boolean),
    pointName: record.pointName,
    redeemCodeHelpEnabled: redeemCodeHelpSettings.enabled,
    redeemCodeHelpTitle: redeemCodeHelpSettings.title,
    redeemCodeHelpUrl: redeemCodeHelpSettings.url,
    postLinkDisplayMode: record.postLinkDisplayMode === "ID" ? "ID" : "SLUG",
    homeFeedPostListDisplayMode: normalizePostListDisplayMode(record.homeFeedPostListDisplayMode),
    homeFeedPostListLoadMode: homeFeedPostListLoadSettings.loadMode,
    homeFeedPostPageSize: postPageSizeSettings.homeFeed,
    zonePostPageSize: postPageSizeSettings.zonePosts,
    boardPostPageSize: postPageSizeSettings.boardPosts,
    commentPageSize: postPageSizeSettings.comments,
    postTitleMinLength: postContentLengthSettings.postTitleMinLength,
    postTitleMaxLength: postContentLengthSettings.postTitleMaxLength,
    postContentMinLength: postContentLengthSettings.postContentMinLength,
    postContentMaxLength: postContentLengthSettings.postContentMaxLength,
    commentContentMinLength: postContentLengthSettings.commentContentMinLength,
    commentContentMaxLength: postContentLengthSettings.commentContentMaxLength,
    homeSidebarHotTopicsCount: postPageSizeSettings.hotTopics,
    postSidebarRelatedTopicsCount: postPageSizeSettings.postRelatedTopics,
    homeHotRecentWindowHours: homeHotFeedSettings.recentWindowHours,
    homeSidebarStatsCardEnabled: record.homeSidebarStatsCardEnabled,
    homeSidebarAnnouncementsEnabled: homeSidebarAnnouncementSettings.enabled,
    leftSidebarDisplayMode: leftSidebarDisplaySettings.mode,
    postSlugGenerationMode: postSlugGenerationSettings.mode,
    footerCopyrightText: footerCopyrightSettings.text,
    footerBrandingVisible: footerCopyrightSettings.brandingVisible,
    vipLevelIcons,
    vipNameColors,
    footerLinks: parseFooterLinks(record.footerLinksJson),
    headerAppLinks: parseSiteHeaderAppLinks(record.headerAppLinksJson),
    headerAppIconName: normalizeHeaderAppIconName(record.headerAppIconName),
    search: searchSettings,
    analyticsCode: record.analyticsCode,
    friendLinksEnabled: record.friendLinksEnabled,
    friendLinkApplicationEnabled: record.friendLinkApplicationEnabled,
    friendLinkAnnouncement: record.friendLinkAnnouncement,
    checkInEnabled: record.checkInEnabled,
    checkInReward: checkInRewards.normal,
    checkInVip1Reward: checkInRewards.vip1,
    checkInVip2Reward: checkInRewards.vip2,
    checkInVip3Reward: checkInRewards.vip3,
    checkInMakeUpCardPrice: checkInMakeUpPrices.normal,
    checkInMakeUpEnabled: checkInStreakSettings.enabled,
    checkInVipMakeUpCardPrice: checkInMakeUpPrices.vip1,
    checkInVip1MakeUpCardPrice: checkInMakeUpPrices.vip1,
    checkInVip2MakeUpCardPrice: checkInMakeUpPrices.vip2,
    checkInVip3MakeUpCardPrice: checkInMakeUpPrices.vip3,
    checkInMakeUpCountsTowardStreak: checkInStreakSettings.makeUpCountsTowardStreak,
    checkInMakeUpOldestDayLimit: checkInStreakSettings.oldestDayLimit,
    postOfflinePrice: record.postOfflinePrice,
    postOfflineVip1Price: record.postOfflineVip1Price,
    postOfflineVip2Price: record.postOfflineVip2Price,
    postOfflineVip3Price: record.postOfflineVip3Price,
    inviteRewardInviter: record.inviteRewardInviter,
    inviteRewardInvitee: record.inviteRewardInvitee,
    registerInitialPoints: registrationRewardSettings.initialPoints,
    registrationEnabled: record.registrationEnabled,
    authPageShowcaseEnabled: authPageShowcaseSettings.enabled,
    registrationRequireInviteCode: record.registrationRequireInviteCode,
    registerInviteCodeEnabled: record.registerInviteCodeEnabled,
    registerInviteCodeHelpEnabled: registerInviteCodeHelpSettings.enabled,
    registerInviteCodeHelpTitle: registerInviteCodeHelpSettings.title,
    registerInviteCodeHelpUrl: registerInviteCodeHelpSettings.url,
    inviteCodePurchaseEnabled: record.inviteCodePurchaseEnabled,
    boardApplicationEnabled: boardApplicationSettings.enabled,
    inviteCodePrice: inviteCodePurchasePrices.normal,
    inviteCodeVip1Price: inviteCodePurchasePrices.vip1,
    inviteCodeVip2Price: inviteCodePurchasePrices.vip2,
    inviteCodeVip3Price: inviteCodePurchasePrices.vip3,
    registerCaptchaMode: normalizeCaptchaMode(record.registerCaptchaMode),
    loginCaptchaMode: normalizeCaptchaMode(record.loginCaptchaMode),
    turnstileSiteKey: record.turnstileSiteKey,
    nicknameChangePointCost: nicknameChangePointCosts.normal,
    nicknameChangeVip1PointCost: nicknameChangePointCosts.vip1,
    nicknameChangeVip2PointCost: nicknameChangePointCosts.vip2,
    nicknameChangeVip3PointCost: nicknameChangePointCosts.vip3,
    introductionChangePointCost: introductionChangePointCosts.normal,
    introductionChangeVip1PointCost: introductionChangePointCosts.vip1,
    introductionChangeVip2PointCost: introductionChangePointCosts.vip2,
    introductionChangeVip3PointCost: introductionChangePointCosts.vip3,
    avatarChangePointCost: avatarChangePointCosts.normal,
    avatarChangeVip1PointCost: avatarChangePointCosts.vip1,
    avatarChangeVip2PointCost: avatarChangePointCosts.vip2,
    avatarChangeVip3PointCost: avatarChangePointCosts.vip3,
    postEditableMinutes: normalizePositiveInteger(record.postEditableMinutes, 10),
    commentEditableMinutes: normalizePositiveInteger(record.commentEditableMinutes, 5),
    guestCanViewComments: commentAccessSettings.guestCanView,
    commentInitialVisibleReplies: commentAccessSettings.initialVisibleReplies,
    anonymousPostEnabled: anonymousPostSettings.enabled,
    anonymousPostPrice: anonymousPostSettings.price,
    anonymousPostDailyLimit: anonymousPostSettings.dailyLimit,
    anonymousPostMaskUserId: anonymousPostSettings.maskUserId,
    anonymousPostAllowReplySwitch: anonymousPostSettings.allowReplySwitch,
    anonymousPostDefaultReplyAnonymous: anonymousPostSettings.defaultReplyAnonymous,
    interactionGates: interactionGateSettings,
    tippingEnabled: record.tippingEnabled,
    tippingDailyLimit: record.tippingDailyLimit,
    tippingPerPostLimit: record.tippingPerPostLimit,
    tippingAmounts,
    tippingGifts,
    tipGiftTaxEnabled: boardTreasurySettings.tipGiftTaxEnabled,
    tipGiftTaxRateBps: boardTreasurySettings.tipGiftTaxRateBps,
    postRedPacketEnabled: record.postRedPacketEnabled,
    postRedPacketMaxPoints: record.postRedPacketMaxPoints,
    postRedPacketDailyLimit: record.postRedPacketDailyLimit,
    postRedPacketRandomClaimProbability: postRedPacketSettings.randomClaimProbability,
    postJackpotEnabled: postJackpotSettings.enabled,
    postJackpotMinInitialPoints: postJackpotSettings.minInitialPoints,
    postJackpotMaxInitialPoints: postJackpotSettings.maxInitialPoints,
    postJackpotReplyIncrementPoints: postJackpotSettings.replyIncrementPoints,
    postJackpotHitProbability: postJackpotSettings.hitProbability,
    heatViewWeight: record.heatViewWeight,
    heatCommentWeight: record.heatCommentWeight,
    heatLikeWeight: record.heatLikeWeight,
    heatTipCountWeight: record.heatTipCountWeight,
    heatTipPointsWeight: record.heatTipPointsWeight,
    heatStageThresholds: parseHeatThresholds(record.heatStageThresholds),
    heatStageColors: parseHeatColors(record.heatStageColors),
    registerEmailEnabled: record.registerEmailEnabled,
    registerEmailRequired: record.registerEmailRequired,
    registerEmailVerification: record.registerEmailVerification,
    sessionIpMismatchLogoutEnabled: siteSecuritySettings.sessionIpMismatchLogoutEnabled,
    loginIpChangeEmailAlertEnabled: siteSecuritySettings.loginIpChangeEmailAlertEnabled,
    passwordChangeRequireEmailVerification: siteSecuritySettings.passwordChangeRequireEmailVerification,
    registerEmailWhitelistEnabled: registerEmailWhitelistSettings.enabled,
    registerEmailWhitelistDomains: registerEmailWhitelistSettings.domains,
    registerPhoneEnabled: record.registerPhoneEnabled,
    registerPhoneRequired: record.registerPhoneRequired,
    registerPhoneVerification: record.registerPhoneVerification,
    registerNicknameEnabled: record.registerNicknameEnabled,
    registerNicknameRequired: record.registerNicknameRequired,
    registerNicknameMinLength: registerNicknameLengthSettings.minLength,
    registerNicknameMaxLength: registerNicknameLengthSettings.maxLength,
    registerGenderEnabled: record.registerGenderEnabled,
    registerGenderRequired: record.registerGenderRequired,
    registerInviterEnabled: record.registerInviterEnabled,
    registrationEmailTemplates: registrationEmailTemplateSettings,
    authGithubEnabled: authProviderSettings.githubEnabled,
    authGoogleEnabled: authProviderSettings.googleEnabled,
    authPasskeyEnabled: authProviderSettings.passkeyEnabled,
    githubClientId: authProviderSensitiveConfig.githubClientId,
    githubClientSecret: authProviderSensitiveConfig.githubClientSecret,
    googleClientId: authProviderSensitiveConfig.googleClientId,
    googleClientSecret: authProviderSensitiveConfig.googleClientSecret,
    passkeyRpId: authProviderSensitiveConfig.passkeyRpId,
    passkeyRpName: authProviderSensitiveConfig.passkeyRpName,
    passkeyOrigin: authProviderSensitiveConfig.passkeyOrigin,
    turnstileSecretKey: captchaSensitiveConfig.turnstileSecretKey,
    smtpEnabled: record.smtpEnabled,
    smtpHost: record.smtpHost,
    smtpPort: record.smtpPort,
    smtpUser: record.smtpUser,
    smtpPass: record.smtpPass,
    smtpFrom: record.smtpFrom,
    smtpSecure: record.smtpSecure,
    vipMonthlyPrice: record.vipMonthlyPrice,
    vipQuarterlyPrice: record.vipQuarterlyPrice,
    vipYearlyPrice: record.vipYearlyPrice,
    uploadProvider: normalizeUploadProvider(record.uploadProvider),
    uploadLocalPath: record.uploadLocalPath,
    uploadBaseUrl: record.uploadBaseUrl,
    uploadOssBucket: record.uploadOssBucket,
    uploadOssRegion: record.uploadOssRegion,
    uploadOssEndpoint: record.uploadOssEndpoint,
    uploadS3ForcePathStyle: uploadObjectStorageSettings.forcePathStyle,
    uploadRequireLogin: record.uploadRequireLogin,
    uploadAllowedImageTypes: String(record.uploadAllowedImageTypes || "jpg,jpeg,png,gif,webp").split(/[，,\s]+/).map((item) => item.trim().toLowerCase()).filter(Boolean),
    uploadMaxFileSizeMb: record.uploadMaxFileSizeMb,
    uploadAvatarMaxFileSizeMb: record.uploadAvatarMaxFileSizeMb,
    uploadS3AccessKeyId: uploadStorageSensitiveConfig.accessKeyId,
    uploadS3SecretAccessKey: uploadStorageSensitiveConfig.secretAccessKey,
    markdownImageUploadEnabled: markdownImageUploadSettings.enabled,
    imageWatermarkEnabled: imageWatermarkSettings.enabled,
    imageWatermarkText: imageWatermarkSettings.text,
    imageWatermarkPosition: imageWatermarkSettings.position,
    imageWatermarkTiled: imageWatermarkSettings.tiled,
    imageWatermarkOpacity: imageWatermarkSettings.opacity,
    imageWatermarkFontSize: imageWatermarkSettings.fontSize,
    imageWatermarkFontFamily: imageWatermarkSettings.fontFamily,
    imageWatermarkMargin: imageWatermarkSettings.margin,
    imageWatermarkColor: imageWatermarkSettings.color,
    imageWatermarkLogoPath: imageWatermarkSettings.logoPath,
    imageWatermarkLogoScalePercent: imageWatermarkSettings.logoScalePercent,
    attachmentUploadEnabled: attachmentFeatureSettings.uploadEnabled,
    attachmentDownloadEnabled: attachmentFeatureSettings.downloadEnabled,
    attachmentMinUploadLevel: attachmentFeatureSettings.minUploadLevel,
    attachmentMinUploadVipLevel: attachmentFeatureSettings.minUploadVipLevel,
    attachmentAllowedExtensions: attachmentFeatureSettings.allowedExtensions,
    attachmentMaxFileSizeMb: attachmentFeatureSettings.maxFileSizeMb,
    markdownEmojiMap: parseMarkdownEmojiMapJson(record.markdownEmojiMapJson),
    appStateJson: record.appStateJson,
  }
}

async function applyAddonSiteSettings(
  data: ServerSiteSettingsData,
): Promise<ServerSiteSettingsData> {
  const [navigationLinks, markdownEmojiMap] = await Promise.all([
    mergeAddonNavigationLinks({
      footerLinks: data.footerLinks,
      headerAppLinks: data.headerAppLinks,
    }),
    mergeMarkdownEmojiItems(data.markdownEmojiMap),
  ])

  return {
    ...data,
    footerLinks: navigationLinks.footerLinks,
    headerAppLinks: navigationLinks.headerAppLinks,
    markdownEmojiMap,
  }
}

export async function ensureSiteSettings(): Promise<SiteSettingsData> {
  const existingRecord = await findSiteSettingsRecord()

  if (existingRecord) {
    return toPublicSiteSettings(
      await applyAddonSiteSettings(mapSiteSettings(existingRecord)),
    )
  }

  const createdRecord = await createSiteSettingsRecord(defaultSiteSettingsCreateInput)

  return toPublicSiteSettings(
    await applyAddonSiteSettings(mapSiteSettings(createdRecord)),
  )
}

function toPublicSiteSettings(data: ServerSiteSettingsData): SiteSettingsData {
  const {
    githubClientId,
    githubClientSecret,
    googleClientId,
    googleClientSecret,
    passkeyRpId,
    passkeyRpName,
    passkeyOrigin,
    turnstileSecretKey,
    uploadS3AccessKeyId,
    uploadS3SecretAccessKey,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpFrom,
    smtpSecure,
    ...rest
  } = data
  void githubClientId
  void githubClientSecret
  void googleClientId
  void googleClientSecret
  void passkeyRpId
  void passkeyRpName
  void passkeyOrigin
  void turnstileSecretKey
  void uploadS3AccessKeyId
  void uploadS3SecretAccessKey
  void smtpHost
  void smtpPort
  void smtpUser
  void smtpPass
  void smtpFrom
  void smtpSecure
  return rest
}

const getPersistentSiteSettings = unstable_cache(
  async (): Promise<ServerSiteSettingsData> => readSiteSettingsFromDB(),
  [SITE_SETTINGS_CACHE_TAG],
  { tags: [SITE_SETTINGS_CACHE_TAG] },
)

function isMissingIncrementalCacheInUnstableCacheError(error: unknown) {
  return error instanceof Error
    && error.message.includes("Invariant: incrementalCache missing in unstable_cache")
}

async function resolveServerSiteSettings(): Promise<ServerSiteSettingsData> {
  try {
    return applyAddonSiteSettings(
      normalizeLegacyServerSiteSettings(await getPersistentSiteSettings()),
    )
  } catch (error) {
    if (!isMissingIncrementalCacheInUnstableCacheError(error)) {
      throw error
    }

    return applyAddonSiteSettings(
      normalizeLegacyServerSiteSettings(await readSiteSettingsFromDB()),
    )
  }
}

export async function getSiteSettings(): Promise<SiteSettingsData> {
  return toPublicSiteSettings(await resolveServerSiteSettings())
}

/** 仅服务端内部使用（mailer、lottery 等），包含 smtp 等敏感字段，禁止序列化到客户端 */
export async function getServerSiteSettings(): Promise<ServerSiteSettingsData> {
  return resolveServerSiteSettings()
}

export async function getSensitiveWordPage(options: { page?: number; pageSize?: number } = {}) {
  const requestedPageSize = normalizePositiveInteger(options.pageSize, 20)
  const pageSize = [20, 50, 100].includes(requestedPageSize) ? requestedPageSize : 20
  const requestedPage = normalizePositiveInteger(options.page, 1)

  const { total, active, reject, replace } = await getSensitiveWordStats()

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const skip = (page - 1) * pageSize

  const words = await findSensitiveWordsPage(skip, pageSize)

  return {
    words: words.map((item) => ({
      id: item.id,
      word: item.word,
      matchType: item.matchType,
      actionType: normalizeSensitiveActionType(item.actionType),
      status: item.status,
      createdAt: item.createdAt.toISOString(),
    })),
    summary: {
      total,
      active,
      reject,
      replace,
    },
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    },
  }
}
