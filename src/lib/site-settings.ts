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

export type { FooterLinkItem } from "@/lib/shared/config-parsers"

export interface SiteSettingsData {
  siteName: string
  siteSlogan: string
  siteDescription: string
  siteLogoText: string
  siteLogoPath?: string | null
  siteSeoKeywords: string[]
  pointName: string
  footerLinks: FooterLinkItem[]
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
  uploadAllowedImageTypes: string[]
  uploadMaxFileSizeMb: number
  uploadAvatarMaxFileSizeMb: number
  markdownEmojiMapJson?: string | null
  markdownEmojiMap: Array<{ shortcode: string; label: string; icon: string }>
  appStateJson?: string | null
}


function mapSiteSettings(record: {
  siteName: string
  siteSlogan: string
  siteDescription: string
  siteLogoText: string
  siteLogoPath?: string | null
  siteSeoKeywords?: string | null
  pointName: string
  footerLinksJson?: string | null
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
}): SiteSettingsData {
  return {
    siteName: record.siteName,
    siteSlogan: record.siteSlogan,
    siteDescription: record.siteDescription,
    siteLogoText: record.siteLogoText,
    siteLogoPath: record.siteLogoPath,
    siteSeoKeywords: String(record.siteSeoKeywords || "").split(/[，,\n]+/).map((item) => item.trim()).filter(Boolean),
    pointName: record.pointName,
    footerLinks: parseFooterLinks(record.footerLinksJson),
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
    return mapSiteSettings(existingRecord)
  }

  const createdRecord = await createSiteSettingsRecord(defaultSiteSettingsCreateInput)

  return mapSiteSettings(createdRecord)
}

const getCachedSiteSettings = cache(async (): Promise<SiteSettingsData> => {
  const record = await findSiteSettingsRecord()

  if (!record) {
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

  return mapSiteSettings(record)
})

export async function getSiteSettings(): Promise<SiteSettingsData> {
  return getCachedSiteSettings()
}

export async function getSensitiveWordPage(options: { page?: number; pageSize?: number } = {}) {
  const pageSize = [20, 50, 100].includes(Number(options.pageSize)) ? Number(options.pageSize) : 20
  const requestedPage = Math.max(1, Number(options.page) || 1)

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
