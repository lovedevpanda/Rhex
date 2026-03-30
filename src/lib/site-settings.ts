import { cache } from "react"

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
import { normalizePositiveInteger } from "@/lib/shared/normalizers"
import { normalizeHeaderAppIconName, parseSiteHeaderAppLinks, type SiteHeaderAppLinkItem } from "./site-header-app-links"

export type { FooterLinkItem } from "@/lib/shared/config-parsers"

export type PostLinkDisplayMode = "SLUG" | "ID"

export interface SiteSettingsData {
  siteName: string
  siteSlogan: string
  siteDescription: string
  siteLogoText: string
  siteLogoPath?: string | null
  siteSeoKeywords: string[]
  pointName: string
  postLinkDisplayMode: PostLinkDisplayMode
  footerLinks: FooterLinkItem[]
  headerAppLinks: SiteHeaderAppLinkItem[]
  headerAppIconName: string
  analyticsCode?: string | null
  friendLinksEnabled: boolean
  friendLinkApplicationEnabled: boolean
  friendLinkAnnouncement: string
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
  registerCaptchaMode: "OFF" | "TURNSTILE" | "BUILTIN"
  loginCaptchaMode: "OFF" | "TURNSTILE" | "BUILTIN"
  turnstileSiteKey?: string | null
  nicknameChangePointCost: number
  postEditableMinutes: number
  commentEditableMinutes: number
  tippingEnabled: boolean
  tippingDailyLimit: number
  tippingPerPostLimit: number
  tippingAmounts: number[]
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

const SITE_SETTINGS_CACHE_TTL_MS = 60_000

let cachedServerSiteSettings: ServerSiteSettingsData | null = null
let siteSettingsCacheExpiry = 0
let siteSettingsCachePromise: Promise<ServerSiteSettingsData> | null = null

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

function setSiteSettingsCache(data: ServerSiteSettingsData) {
  cachedServerSiteSettings = data
  siteSettingsCacheExpiry = Date.now() + SITE_SETTINGS_CACHE_TTL_MS
}

async function readSiteSettingsFromDB(): Promise<ServerSiteSettingsData> {
  const record = await findSiteSettingsRecord()

  if (!record) {
    return getDefaultServerSiteSettings()
  }

  return mapSiteSettings(record)
}

export function invalidateSiteSettingsCache() {
  cachedServerSiteSettings = null
  siteSettingsCacheExpiry = 0
  siteSettingsCachePromise = null
}

async function getMemoryCachedSiteSettings(): Promise<ServerSiteSettingsData> {
  if (cachedServerSiteSettings && Date.now() < siteSettingsCacheExpiry) {
    return cachedServerSiteSettings
  }

  if (!siteSettingsCachePromise) {
    siteSettingsCachePromise = readSiteSettingsFromDB()
      .then((data) => {
        setSiteSettingsCache(data)
        return data
      })
      .finally(() => {
        siteSettingsCachePromise = null
      })
  }

  return siteSettingsCachePromise
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
}): ServerSiteSettingsData {
  return {
    siteName: record.siteName,
    siteSlogan: record.siteSlogan,
    siteDescription: record.siteDescription,
    siteLogoText: record.siteLogoText,
    siteLogoPath: record.siteLogoPath,
    siteSeoKeywords: String(record.siteSeoKeywords || "").split(/[，,\n]+/).map((item) => item.trim()).filter(Boolean),
    pointName: record.pointName,
    postLinkDisplayMode: record.postLinkDisplayMode === "ID" ? "ID" : "SLUG",
    footerLinks: parseFooterLinks(record.footerLinksJson),
    headerAppLinks: parseSiteHeaderAppLinks(record.headerAppLinksJson),
    headerAppIconName: normalizeHeaderAppIconName(record.headerAppIconName),
    analyticsCode: record.analyticsCode,
    friendLinksEnabled: record.friendLinksEnabled,
    friendLinkApplicationEnabled: record.friendLinkApplicationEnabled,
    friendLinkAnnouncement: record.friendLinkAnnouncement,
    checkInEnabled: record.checkInEnabled,
    checkInReward: record.checkInReward,
    checkInMakeUpCardPrice: record.checkInMakeUpCardPrice,
    checkInVipMakeUpCardPrice: record.checkInVipMakeUpCardPrice,
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
    inviteCodePrice: record.inviteCodePrice,
    registerCaptchaMode: normalizeCaptchaMode(record.registerCaptchaMode),
    loginCaptchaMode: normalizeCaptchaMode(record.loginCaptchaMode),
    turnstileSiteKey: record.turnstileSiteKey,
    nicknameChangePointCost: record.nicknameChangePointCost,
    postEditableMinutes: normalizePositiveInteger(record.postEditableMinutes, 10),
    commentEditableMinutes: normalizePositiveInteger(record.commentEditableMinutes, 5),
    tippingEnabled: record.tippingEnabled,
    tippingDailyLimit: record.tippingDailyLimit,
    tippingPerPostLimit: record.tippingPerPostLimit,
    tippingAmounts: parseTippingAmounts(record.tippingAmounts),
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
  return getMemoryCachedSiteSettings()
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
