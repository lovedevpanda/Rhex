import { unstable_cache } from "next/cache"

import { listActiveGiftDefinitions } from "@/db/post-gift-queries"
import { createSiteSettingsRecord, findSensitiveWordsPage, findSiteSettingsRecord, getSensitiveWordStats } from "@/db/site-settings-queries"
import {
  normalizeCaptchaMode,
  parseFooterLinks,
  parseHeatColors,
  parseHeatThresholds,
  parseTippingAmounts,
  type FooterLinkItem,
} from "@/lib/shared/config-parsers"
import { defaultSiteSettingsCreateInput } from "@/lib/site-settings-defaults"
import { parseMarkdownEmojiMapJson } from "@/lib/markdown-emoji"
import { normalizePostListLoadMode, type PostListLoadMode } from "@/lib/post-list-load-mode"
import { normalizePostListDisplayMode, type PostListDisplayMode } from "@/lib/post-list-display"
import { resolveAnonymousPostSettings, resolveAuthProviderSettings, resolveAvatarChangePointCostSettings, resolveBoardApplicationSettings, resolveBoardTreasurySettings, resolveCheckInMakeUpPriceSettings, resolveCheckInRewardSettings, resolveCheckInStreakSettings, resolveCommentAccessSettings, resolveFooterCopyrightSettings, resolveHomeFeedPostListLoadSettings, resolveHomeHotFeedSettings, resolveHomeSidebarAnnouncementSettings, resolveInteractionGateSettings, resolveIntroductionChangePointCostSettings, resolveInviteCodePurchasePriceSettings, resolveMarkdownImageUploadSettings, resolveNicknameChangePointCostSettings, resolvePostContentLengthSettings, resolvePostJackpotSettings, resolvePostPageSizeSettings, resolvePostRedPacketSettings, resolveRegistrationRewardSettings, resolveUploadObjectStorageSettings, resolveVipLevelIconSettings, type InteractionGateSettings } from "@/lib/site-settings-app-state"
import { resolveAuthProviderSensitiveConfig, resolveCaptchaSensitiveConfig, resolveUploadStorageSensitiveConfig } from "@/lib/site-settings-sensitive-state"
import { resolveSiteSearchSettings, type SiteSearchSettings } from "@/lib/site-search-settings"
import { normalizePositiveInteger } from "@/lib/shared/normalizers"
import { type SiteTippingGiftItem } from "@/lib/tipping-gifts"
import { normalizeUploadProvider, type UploadProvider } from "@/lib/upload-provider"
import { type VipLevelIcons } from "@/lib/vip-level-icons"
import { normalizeHeaderAppIconName, parseSiteHeaderAppLinks, type SiteHeaderAppLinkItem } from "./site-header-app-links"

export type { FooterLinkItem } from "@/lib/shared/config-parsers"

export type PostLinkDisplayMode = "SLUG" | "ID"
export type { SiteSearchSettings } from "@/lib/site-search-settings"
export type { SiteTippingGiftItem } from "@/lib/tipping-gifts"
export type { InteractionGateAction, InteractionGateCondition, InteractionGateRule, InteractionGateSettings } from "@/lib/site-settings-app-state"

export interface SiteSettingsData {
  siteName: string
  siteSlogan: string
  siteDescription: string
  siteLogoText: string
  siteLogoPath?: string | null
  siteSeoKeywords: string[]
  pointName: string
  postLinkDisplayMode: PostLinkDisplayMode
  homeFeedPostListDisplayMode: PostListDisplayMode
  homeFeedPostListLoadMode: PostListLoadMode
  homeFeedPostPageSize: number
  zonePostPageSize: number
  boardPostPageSize: number
  commentPageSize: number
  postTitleMinLength: number
  postTitleMaxLength: number
  postContentMinLength: number
  postContentMaxLength: number
  commentContentMinLength: number
  commentContentMaxLength: number
  homeSidebarHotTopicsCount: number
  postSidebarRelatedTopicsCount: number
  homeHotRecentWindowHours: number
  homeSidebarStatsCardEnabled: boolean
  homeSidebarAnnouncementsEnabled: boolean
  footerCopyrightText: string
  footerBrandingVisible: boolean
  vipLevelIcons: VipLevelIcons
  footerLinks: FooterLinkItem[]
  headerAppLinks: SiteHeaderAppLinkItem[]
  headerAppIconName: string
  search: SiteSearchSettings
  analyticsCode?: string | null
  friendLinksEnabled: boolean
  friendLinkApplicationEnabled: boolean
  friendLinkAnnouncement: string
  checkInEnabled: boolean
  checkInReward: number
  checkInVip1Reward: number
  checkInVip2Reward: number
  checkInVip3Reward: number
  checkInMakeUpCardPrice: number
  checkInVipMakeUpCardPrice: number
  checkInVip1MakeUpCardPrice: number
  checkInVip2MakeUpCardPrice: number
  checkInVip3MakeUpCardPrice: number
  checkInMakeUpCountsTowardStreak: boolean
  postOfflinePrice: number
  postOfflineVip1Price: number
  postOfflineVip2Price: number
  postOfflineVip3Price: number
  inviteRewardInviter: number
  inviteRewardInvitee: number
  registerInitialPoints: number
  registrationEnabled: boolean
  registrationRequireInviteCode: boolean
  registerInviteCodeEnabled: boolean
  inviteCodePurchaseEnabled: boolean
  boardApplicationEnabled: boolean
  inviteCodePrice: number
  inviteCodeVip1Price: number
  inviteCodeVip2Price: number
  inviteCodeVip3Price: number
  registerCaptchaMode: "OFF" | "TURNSTILE" | "BUILTIN" | "POW"
  loginCaptchaMode: "OFF" | "TURNSTILE" | "BUILTIN" | "POW"
  turnstileSiteKey?: string | null
  nicknameChangePointCost: number
  nicknameChangeVip1PointCost: number
  nicknameChangeVip2PointCost: number
  nicknameChangeVip3PointCost: number
  introductionChangePointCost: number
  introductionChangeVip1PointCost: number
  introductionChangeVip2PointCost: number
  introductionChangeVip3PointCost: number
  avatarChangePointCost: number
  avatarChangeVip1PointCost: number
  avatarChangeVip2PointCost: number
  avatarChangeVip3PointCost: number
  postEditableMinutes: number
  commentEditableMinutes: number
  guestCanViewComments: boolean
  commentInitialVisibleReplies: number
  anonymousPostEnabled: boolean
  anonymousPostPrice: number
  anonymousPostDailyLimit: number
  anonymousPostMaskUserId: number | null
  anonymousPostAllowReplySwitch: boolean
  anonymousPostDefaultReplyAnonymous: boolean
  interactionGates: InteractionGateSettings
  tippingEnabled: boolean
  tippingDailyLimit: number
  tippingPerPostLimit: number
  tippingAmounts: number[]
  tippingGifts: SiteTippingGiftItem[]
  tipGiftTaxEnabled: boolean
  tipGiftTaxRateBps: number
  postRedPacketEnabled: boolean
  postRedPacketMaxPoints: number
  postRedPacketDailyLimit: number
  postRedPacketRandomClaimProbability: number
  postJackpotEnabled: boolean
  postJackpotMinInitialPoints: number
  postJackpotMaxInitialPoints: number
  postJackpotReplyIncrementPoints: number
  postJackpotHitProbability: number
  heatViewWeight: number
  heatCommentWeight: number
  heatLikeWeight: number
  heatTipCountWeight: number
  heatTipPointsWeight: number
  heatStageThresholds: number[]
  heatStageColors: string[]
  registerEmailEnabled: boolean
  registerEmailRequired: boolean
  registerEmailVerification: boolean
  registerPhoneEnabled: boolean
  registerPhoneRequired: boolean
  registerPhoneVerification: boolean
  registerNicknameEnabled: boolean
  registerNicknameRequired: boolean
  registerGenderEnabled: boolean
  registerGenderRequired: boolean
  registerInviterEnabled: boolean
  authGithubEnabled: boolean
  authGoogleEnabled: boolean
  authPasskeyEnabled: boolean
  smtpEnabled: boolean
  vipMonthlyPrice: number
  vipQuarterlyPrice: number
  vipYearlyPrice: number
  uploadProvider: UploadProvider
  uploadLocalPath: string
  uploadBaseUrl?: string | null
  uploadOssBucket?: string | null
  uploadOssRegion?: string | null
  uploadOssEndpoint?: string | null
  uploadS3ForcePathStyle: boolean
  uploadRequireLogin: boolean
  uploadAllowedImageTypes: string[]
  uploadMaxFileSizeMb: number
  uploadAvatarMaxFileSizeMb: number
  markdownImageUploadEnabled: boolean
  markdownEmojiMapJson?: string | null
  markdownEmojiMap: Array<{ shortcode: string; label: string; icon: string }>
  appStateJson?: string | null
}

/** 含敏感字段的完整配置，仅在服务端内部使用（mailer、lottery 等），禁止序列化到客户端 */
export interface ServerSiteSettingsData extends SiteSettingsData {
  githubClientId?: string | null
  githubClientSecret?: string | null
  googleClientId?: string | null
  googleClientSecret?: string | null
  passkeyRpId?: string | null
  passkeyRpName?: string | null
  passkeyOrigin?: string | null
  turnstileSecretKey?: string | null
  uploadS3AccessKeyId?: string | null
  uploadS3SecretAccessKey?: string | null
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUser?: string | null
  smtpPass?: string | null
  smtpFrom?: string | null
  smtpSecure: boolean
}

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

async function readSiteSettingsFromDB(): Promise<ServerSiteSettingsData> {
  const record = await findSiteSettingsRecord()

  if (!record) {
    return getDefaultServerSiteSettings()
  }

  const databaseTippingGifts = await listActiveGiftDefinitions()

  return mapSiteSettings(record, databaseTippingGifts)
}

export const SITE_SETTINGS_CACHE_TAG = "site-settings"

function mapSiteSettings(record: {
  siteName: string
  siteSlogan: string
  siteDescription: string
  siteLogoText: string
  siteLogoPath?: string | null
  siteSeoKeywords?: string | null
  pointName: string
  postLinkDisplayMode?: "SLUG" | "ID" | string | null
  homeFeedPostListDisplayMode?: string | null
  homeSidebarStatsCardEnabled: boolean
  footerLinksJson?: string | null
  headerAppLinksJson?: string | null
  headerAppIconName?: string | null
  analyticsCode?: string | null
  checkInEnabled: boolean
  checkInReward: number
  checkInMakeUpCardPrice: number
  checkInVipMakeUpCardPrice: number
  postOfflinePrice: number
  postOfflineVip1Price: number
  postOfflineVip2Price: number
  postOfflineVip3Price: number
  inviteRewardInviter: number
  inviteRewardInvitee: number
  registrationEnabled: boolean
  registrationRequireInviteCode: boolean
  registerInviteCodeEnabled: boolean
  inviteCodePurchaseEnabled: boolean
  inviteCodePrice: number
  registerCaptchaMode: string
  loginCaptchaMode: string
  turnstileSiteKey?: string | null
  nicknameChangePointCost: number
  postEditableMinutes: number
  commentEditableMinutes: number
  tippingEnabled: boolean
  tippingDailyLimit: number
  tippingPerPostLimit: number
  tippingAmounts: string
  postRedPacketEnabled: boolean
  postRedPacketMaxPoints: number
  postRedPacketDailyLimit: number
  heatViewWeight: number
  heatCommentWeight: number
  heatLikeWeight: number
  heatTipCountWeight: number
  heatTipPointsWeight: number
  heatStageThresholds: string
  heatStageColors: string
  registerEmailEnabled: boolean
  registerEmailRequired: boolean
  registerEmailVerification: boolean
  registerPhoneEnabled: boolean
  registerPhoneRequired: boolean
  registerPhoneVerification: boolean
  registerNicknameEnabled: boolean
  registerNicknameRequired: boolean
  registerGenderEnabled: boolean
  registerGenderRequired: boolean
  registerInviterEnabled: boolean
  smtpEnabled: boolean
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUser?: string | null
  smtpPass?: string | null
  smtpFrom?: string | null
  smtpSecure: boolean
  vipMonthlyPrice: number
  vipQuarterlyPrice: number
  vipYearlyPrice: number
  uploadProvider: string
  uploadLocalPath: string
  uploadBaseUrl?: string | null
  uploadOssBucket?: string | null
  uploadOssRegion?: string | null
  uploadOssEndpoint?: string | null
  uploadRequireLogin: boolean
  uploadAllowedImageTypes: string
  uploadMaxFileSizeMb: number
  uploadAvatarMaxFileSizeMb: number
  markdownEmojiMapJson?: string | null
  appStateJson?: string | null
  sensitiveStateJson?: string | null
  friendLinksEnabled: boolean
  friendLinkApplicationEnabled: boolean
  friendLinkAnnouncement: string
}, tippingGifts: SiteTippingGiftItem[] = []): ServerSiteSettingsData {
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
    makeUpCountsTowardStreakFallback: true,
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
  const footerCopyrightSettings = resolveFooterCopyrightSettings({
    appStateJson: record.appStateJson,
    textFallback: `${record.siteName} @ ${new Date().getFullYear()}`,
    brandingVisibleFallback: true,
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
  const markdownImageUploadSettings = resolveMarkdownImageUploadSettings({
    appStateJson: record.appStateJson,
    enabledFallback: true,
  })
  const uploadObjectStorageSettings = resolveUploadObjectStorageSettings({
    appStateJson: record.appStateJson,
    forcePathStyleFallback: true,
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
    siteSeoKeywords: String(record.siteSeoKeywords || "").split(/[，,\n]+/).map((item) => item.trim()).filter(Boolean),
    pointName: record.pointName,
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
    footerCopyrightText: footerCopyrightSettings.text,
    footerBrandingVisible: footerCopyrightSettings.brandingVisible,
    vipLevelIcons,
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
    checkInVipMakeUpCardPrice: checkInMakeUpPrices.vip1,
    checkInVip1MakeUpCardPrice: checkInMakeUpPrices.vip1,
    checkInVip2MakeUpCardPrice: checkInMakeUpPrices.vip2,
    checkInVip3MakeUpCardPrice: checkInMakeUpPrices.vip3,
    checkInMakeUpCountsTowardStreak: checkInStreakSettings.makeUpCountsTowardStreak,
    postOfflinePrice: record.postOfflinePrice,
    postOfflineVip1Price: record.postOfflineVip1Price,
    postOfflineVip2Price: record.postOfflineVip2Price,
    postOfflineVip3Price: record.postOfflineVip3Price,
    inviteRewardInviter: record.inviteRewardInviter,
    inviteRewardInvitee: record.inviteRewardInvitee,
    registerInitialPoints: registrationRewardSettings.initialPoints,
    registrationEnabled: record.registrationEnabled,
    registrationRequireInviteCode: record.registrationRequireInviteCode,
    registerInviteCodeEnabled: record.registerInviteCodeEnabled,
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
    registerPhoneEnabled: record.registerPhoneEnabled,
    registerPhoneRequired: record.registerPhoneRequired,
    registerPhoneVerification: record.registerPhoneVerification,
    registerNicknameEnabled: record.registerNicknameEnabled,
    registerNicknameRequired: record.registerNicknameRequired,
    registerGenderEnabled: record.registerGenderEnabled,
    registerGenderRequired: record.registerGenderRequired,
    registerInviterEnabled: record.registerInviterEnabled,
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
    markdownEmojiMap: parseMarkdownEmojiMapJson(record.markdownEmojiMapJson),
    appStateJson: record.appStateJson,
  }
}

export async function ensureSiteSettings(): Promise<SiteSettingsData> {
  const existingRecord = await findSiteSettingsRecord()

  if (existingRecord) {
    return toPublicSiteSettings(mapSiteSettings(existingRecord))
  }

  const createdRecord = await createSiteSettingsRecord(defaultSiteSettingsCreateInput)

  return toPublicSiteSettings(mapSiteSettings(createdRecord))
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

export async function getSiteSettings(): Promise<SiteSettingsData> {
  return toPublicSiteSettings(await getPersistentSiteSettings())
}

/** 仅服务端内部使用（mailer、lottery 等），包含 smtp 等敏感字段，禁止序列化到客户端 */
export async function getServerSiteSettings(): Promise<ServerSiteSettingsData> {
  return getPersistentSiteSettings()
}

export async function getSensitiveWordPage(options: { page?: number; pageSize?: number } = {}) {
  const requestedPageSize = normalizePositiveInteger(options.pageSize, 20)
  const pageSize = [20, 50, 100].includes(requestedPageSize) ? requestedPageSize : 20
  const requestedPage = normalizePositiveInteger(options.page, 1)

  const { total, active, reject, review } = await getSensitiveWordStats()

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const skip = (page - 1) * pageSize

  const words = await findSensitiveWordsPage(skip, pageSize)

  return {
    words: words.map((item) => ({
      id: item.id,
      word: item.word,
      matchType: item.matchType,
      actionType: item.actionType,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
    })),
    summary: {
      total,
      active,
      reject,
      review,
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
