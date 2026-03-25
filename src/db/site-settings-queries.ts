import type { Prisma } from "@prisma/client"

import { prisma } from "@/db/client"



export const siteSettingsSelect = {
  siteName: true,
  siteSlogan: true,
  siteDescription: true,
  siteLogoText: true,
  siteLogoPath: true,
  siteSeoKeywords: true,
  pointName: true,
  analyticsCode: true,
  friendLinksEnabled: true,
  friendLinkApplicationEnabled: true,
  friendLinkAnnouncement: true,

  checkInEnabled: true,
  checkInReward: true,
  checkInMakeUpCardPrice: true,
  checkInVipMakeUpCardPrice: true,
  inviteRewardInviter: true,
  inviteRewardInvitee: true,
  registrationEnabled: true,
  registrationRequireInviteCode: true,
  registerInviteCodeEnabled: true,
  inviteCodePurchaseEnabled: true,
  inviteCodePrice: true,
  registerCaptchaMode: true,
  loginCaptchaMode: true,
  turnstileSiteKey: true,
  nicknameChangePointCost: true,
  tippingEnabled: true,
  tippingDailyLimit: true,
  tippingPerPostLimit: true,
  tippingAmounts: true,
  heatViewWeight: true,
  heatCommentWeight: true,
  heatLikeWeight: true,
  heatTipCountWeight: true,
  heatTipPointsWeight: true,
  heatStageThresholds: true,
  heatStageColors: true,
  registerEmailEnabled: true,
  registerEmailRequired: true,
  registerEmailVerification: true,
  registerPhoneEnabled: true,
  registerPhoneRequired: true,
  registerPhoneVerification: true,
  registerNicknameEnabled: true,
  registerNicknameRequired: true,
  registerGenderEnabled: true,
  registerGenderRequired: true,
  registerInviterEnabled: true,
  smtpEnabled: true,
  smtpHost: true,
  smtpPort: true,
  smtpUser: true,
  smtpPass: true,
  smtpFrom: true,
  smtpSecure: true,
  vipMonthlyPrice: true,
  vipQuarterlyPrice: true,
  vipYearlyPrice: true,
  uploadProvider: true,
  uploadLocalPath: true,
  uploadBaseUrl: true,
  uploadOssBucket: true,
  uploadOssRegion: true,
  uploadOssEndpoint: true,
  uploadRequireLogin: true,
  uploadAllowedImageTypes: true,
  uploadMaxFileSizeMb: true,
  uploadAvatarMaxFileSizeMb: true,
  footerLinksJson: true,
  pluginStateJson: true,
} as const

export async function findSiteSettingsRecord() {
  return prisma.siteSetting.findFirst({
    orderBy: { createdAt: "asc" },
    select: siteSettingsSelect,
  })
}

export async function createSiteSettingsRecord(data: Prisma.SiteSettingCreateInput) {
  return prisma.siteSetting.create({
    data,
    select: siteSettingsSelect,
  })
}


export async function getSensitiveWordStats() {
  const [total, active, reject, review] = await Promise.all([
    prisma.sensitiveWord.count(),
    prisma.sensitiveWord.count({ where: { status: true } }),
    prisma.sensitiveWord.count({ where: { actionType: "REJECT" } }),
    prisma.sensitiveWord.count({ where: { actionType: "REVIEW" } }),
  ])

  return { total, active, reject, review }
}

export async function findSensitiveWordsPage(skip: number, take: number) {
  return prisma.sensitiveWord.findMany({
    orderBy: [{ createdAt: "desc" }],
    skip,
    take,
  })
}
