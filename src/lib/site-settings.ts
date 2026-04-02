import { cache } from "react"

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
import { normalizePostListDisplayMode, type PostListDisplayMode } from "@/lib/post-list-display"
import { resolveCheckInMakeUpPriceSettings, resolveCheckInRewardSettings, resolveHomeSidebarAnnouncementSettings, resolveInviteCodePurchasePriceSettings, resolveMarkdownImageUploadSettings, resolveNicknameChangePointCostSettings, resolveVipLevelIconSettings } from "@/lib/site-settings-app-state"
import { resolveSiteSearchSettings, type SiteSearchSettings } from "@/lib/site-search-settings"
import { normalizePositiveInteger } from "@/lib/shared/normalizers"
import { type SiteTippingGiftItem } from "@/lib/tipping-gifts"
import { type VipLevelIcons } from "@/lib/vip-level-icons"
import { normalizeHeaderAppIconName, parseSiteHeaderAppLinks, type SiteHeaderAppLinkItem } from "./site-header-app-links"

export type { FooterLinkItem } from "@/lib/shared/config-parsers"

export type PostLinkDisplayMode = "SLUG" | "ID"
export type { SiteSearchSettings } from "@/lib/site-search-settings"
export type { SiteTippingGiftItem } from "@/lib/tipping-gifts"

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
  homeSidebarStatsCardEnabled: boolean
  homeSidebarAnnouncementsEnabled: boolean
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
  postEditableMinutes: number
  commentEditableMinutes: number
  tippingEnabled: boolean
  tippingDailyLimit: number
  tippingPerPostLimit: number
  tippingAmounts: number[]
  tippingGifts: SiteTippingGiftItem[]
  postRedPacketEnabled: boolean
  postRedPacketMaxPoints: number
  postRedPacketDailyLimit: number
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
  smtpEnabled: boolean
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

export function invalidateSiteSettingsCache() {
  // No-op: site settings are read fresh on each request.
  // React cache below only deduplicates reads inside a single render pass.
}

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
  const nicknameChangePointCosts = resolveNicknameChangePointCostSettings({
    appStateJson: record.appStateJson,
    normalPrice: record.nicknameChangePointCost,
  })
  const tippingAmounts = parseTippingAmounts(record.tippingAmounts)
  const searchSettings = resolveSiteSearchSettings(record.appStateJson)
  const homeSidebarAnnouncementSettings = resolveHomeSidebarAnnouncementSettings({
    appStateJson: record.appStateJson,
    enabledFallback: true,
  })
  const vipLevelIcons = resolveVipLevelIconSettings({
    appStateJson: record.appStateJson,
  })
  const markdownImageUploadSettings = resolveMarkdownImageUploadSettings({
    appStateJson: record.appStateJson,
    enabledFallback: true,
  })

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
    homeSidebarStatsCardEnabled: record.homeSidebarStatsCardEnabled,
    homeSidebarAnnouncementsEnabled: homeSidebarAnnouncementSettings.enabled,
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
    postOfflinePrice: record.postOfflinePrice,
    postOfflineVip1Price: record.postOfflineVip1Price,
    postOfflineVip2Price: record.postOfflineVip2Price,
    postOfflineVip3Price: record.postOfflineVip3Price,
    inviteRewardInviter: record.inviteRewardInviter,
    inviteRewardInvitee: record.inviteRewardInvitee,
    registrationEnabled: record.registrationEnabled,
    registrationRequireInviteCode: record.registrationRequireInviteCode,
    registerInviteCodeEnabled: record.registerInviteCodeEnabled,
    inviteCodePurchaseEnabled: record.inviteCodePurchaseEnabled,
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
    postEditableMinutes: normalizePositiveInteger(record.postEditableMinutes, 10),
    commentEditableMinutes: normalizePositiveInteger(record.commentEditableMinutes, 5),
    tippingEnabled: record.tippingEnabled,
    tippingDailyLimit: record.tippingDailyLimit,
    tippingPerPostLimit: record.tippingPerPostLimit,
    tippingAmounts,
    tippingGifts,
    postRedPacketEnabled: record.postRedPacketEnabled,
    postRedPacketMaxPoints: record.postRedPacketMaxPoints,
    postRedPacketDailyLimit: record.postRedPacketDailyLimit,
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
    uploadProvider: record.uploadProvider,
    uploadLocalPath: record.uploadLocalPath,
    uploadBaseUrl: record.uploadBaseUrl,
    uploadOssBucket: record.uploadOssBucket,
    uploadOssRegion: record.uploadOssRegion,
    uploadOssEndpoint: record.uploadOssEndpoint,
    uploadRequireLogin: record.uploadRequireLogin,
    uploadAllowedImageTypes: String(record.uploadAllowedImageTypes || "jpg,jpeg,png,gif,webp").split(/[，,\s]+/).map((item) => item.trim().toLowerCase()).filter(Boolean),
    uploadMaxFileSizeMb: record.uploadMaxFileSizeMb,
    uploadAvatarMaxFileSizeMb: record.uploadAvatarMaxFileSizeMb,
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

  invalidateSiteSettingsCache()

  return toPublicSiteSettings(mapSiteSettings(createdRecord))
}

function toPublicSiteSettings(data: ServerSiteSettingsData): SiteSettingsData {
  const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, smtpSecure, ...rest } = data
  void smtpHost
  void smtpPort
  void smtpUser
  void smtpPass
  void smtpFrom
  void smtpSecure
  return rest
}

const getCachedSiteSettings = cache(async (): Promise<ServerSiteSettingsData> => {
  return readSiteSettingsFromDB()
})

export async function getSiteSettings(): Promise<SiteSettingsData> {
  return toPublicSiteSettings(await getCachedSiteSettings())
}

/** 仅服务端内部使用（mailer、lottery 等），包含 smtp 等敏感字段，禁止序列化到客户端 */
export async function getServerSiteSettings(): Promise<ServerSiteSettingsData> {
  return getCachedSiteSettings()
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
