export interface SiteSettingsBaseRecordData {
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
  friendLinksEnabled: boolean
  friendLinkApplicationEnabled: boolean
  friendLinkAnnouncement: string
}

export interface SiteSettingsCommunityRecordData {
  checkInEnabled: boolean
  checkInReward: number
  checkInMakeUpCardPrice: number
  postOfflinePrice: number
  inviteRewardInviter: number
  inviteRewardInvitee: number
  nicknameChangePointCost: number
}

export interface SiteSettingsVipRecordData {
  checkInVipMakeUpCardPrice: number
  postOfflineVip1Price: number
  postOfflineVip2Price: number
  postOfflineVip3Price: number
  vipMonthlyPrice: number
  vipQuarterlyPrice: number
  vipYearlyPrice: number
}

export interface SiteSettingsRegistrationRecordData {
  registrationEnabled: boolean
  registrationRequireInviteCode: boolean
  registerInviteCodeEnabled: boolean
  inviteCodePurchaseEnabled: boolean
  inviteCodePrice: number
  registerCaptchaMode: string
  loginCaptchaMode: string
  turnstileSiteKey?: string | null
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
}

export interface SiteSettingsContentRecordData {
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
}

export interface SiteSettingsUploadRecordData {
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
}

export interface SiteSettingsRecordStateData {
  appStateJson?: string | null
  sensitiveStateJson?: string | null
}

export interface SiteSettingsRecordData extends
  SiteSettingsBaseRecordData,
  SiteSettingsCommunityRecordData,
  SiteSettingsVipRecordData,
  SiteSettingsRegistrationRecordData,
  SiteSettingsContentRecordData,
  SiteSettingsUploadRecordData,
  SiteSettingsRecordStateData {}
