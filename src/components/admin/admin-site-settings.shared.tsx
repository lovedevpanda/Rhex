"use client"

import Image from "next/image"
import { Loader2, Upload } from "lucide-react"

import { Button } from "@/components/ui/rbutton"
import { buildDefaultRegistrationEmailTemplateSettings, normalizeRegistrationEmailTemplateSettings } from "@/lib/email-template-settings"
import { normalizeEmailBusinessSwitchSettings, type EmailBusinessSwitchSettings } from "@/lib/email-business-switches"
import { COMMENT_LOAD_MODE_INFINITE, COMMENT_LOAD_MODE_PAGINATION, type CommentLoadMode } from "@/lib/comment-load-mode"
import { POST_LIST_LOAD_MODE_INFINITE, POST_LIST_LOAD_MODE_PAGINATION, type PostListLoadMode } from "@/lib/post-list-load-mode"
import { normalizePostListDisplayMode, POST_LIST_DISPLAY_MODE_DEFAULT, type PostListDisplayMode } from "@/lib/post-list-display"
import { defaultSiteSettingsCreateInput } from "@/lib/site-settings-defaults"
import { DEFAULT_GOD_COMMENT_AUTO_LIKE_THRESHOLD } from "@/lib/god-comment-settings"
import { DEFAULT_THEME_CUSTOMIZATION_SETTINGS, type BuiltInThemePreset, type EditableThemePresetDefinition, type FontSizePreset, type FontSizePresetDefinition, type PostContentImageMode, type ThemeCustomizationSettings, type ThemePreference, type ThemeRuntimeSettings } from "@/lib/theme"
import type { InteractionGateCondition, InteractionGateSettings, MentionRecommendationSettings } from "@/lib/site-settings"
import type { LeftSidebarDisplayMode, LeftSidebarHomeSettings, LeftSidebarNavigationMode, PostSlugGenerationMode, RegistrationEmailTemplateSettings, SiteSearchSettings, SiteTippingGiftItem } from "@/lib/site-settings"
import type { PasswordStrength } from "@/lib/password-policy"
import type { SmsBuiltinProvider } from "@/lib/site-settings-app-state.types"

export interface AdminBasicSettingsInitialSettings {
  siteName: string
  siteSlogan: string
  siteDescription: string
  siteLogoText: string
  siteLogoPath?: string | null
  siteIconPath?: string | null
  siteSeoKeywords?: string[]
  postLinkDisplayMode: "SLUG" | "ID"
  homeFeedPostListDisplayMode: PostListDisplayMode
  homeFeedPostListLoadMode: PostListLoadMode
  homeFeedPostPageSize: number
  zonePostPageSize: number
  boardPostPageSize: number
  commentPageSize: number
  commentLoadMode: CommentLoadMode
  postTitleMinLength: number
  postTitleMaxLength: number
  postContentMinLength: number
  postContentMaxLength: number
  commentContentMinLength: number
  commentContentMaxLength: number
  homeSidebarHotTopicsCount: number
  postSidebarRelatedTopicsCount: number
  homeSidebarStatsCardEnabled: boolean
  homeSidebarAnnouncementsEnabled: boolean
  userProfileIpLocationEnabled: boolean
  userProfileIntroductionEnabled: boolean
  leftSidebarDisplayMode: LeftSidebarDisplayMode
  leftSidebarNavigationMode: LeftSidebarNavigationMode
  leftSidebarHome: LeftSidebarHomeSettings
  theme: ThemeRuntimeSettings
  postSlugGenerationMode: PostSlugGenerationMode
  footerCopyrightText: string
  footerBrandingVisible: boolean
  search: SiteSearchSettings
  analyticsCode?: string | null
  inviteRewardInviter: number
  inviteRewardInvitee: number
  registerInitialPoints: number
  registrationEnabled: boolean
  authPageShowcaseEnabled: boolean
  registrationRequireInviteCode: boolean
  registerInviteCodeEnabled: boolean
  registerInviteCodeHelpEnabled: boolean
  registerInviteCodeHelpTitle: string
  registerInviteCodeHelpUrl: string
  inviteCodePurchaseEnabled: boolean
  boardApplicationEnabled: boolean
  registerCaptchaMode: "OFF" | "TURNSTILE" | "BUILTIN" | "POW"
  loginCaptchaMode: "OFF" | "TURNSTILE" | "BUILTIN" | "POW"
  turnstileSiteKey?: string | null
  turnstileSecretKey?: string | null
  postEditableMinutes: number
  commentEditableMinutes: number
  godCommentAutoLikeThreshold: number
  guestCanViewComments: boolean
  forumRequireLoginToBrowse: boolean
  commentInitialVisibleReplies: number
  mentionRecommendations: MentionRecommendationSettings
  siteChatEnabled: boolean
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
  homeHotRecentWindowHours: number
  heatStageThresholds: number[]
  heatStageColors: string[]
  registerEmailEnabled: boolean
  registerEmailRequired: boolean
  registerEmailVerification: boolean
  sessionIpMismatchLogoutEnabled: boolean
  loginIpChangeEmailAlertEnabled: boolean
  passwordChangeRequireEmailVerification: boolean
  oauthServerEnabled: boolean
  oauthClientApplicationEnabled: boolean
  oauthAccessTokenTtlMinutes: number
  oauthRefreshTokenTtlDays: number
  registerPasswordMinLength: number
  registerPasswordStrength: PasswordStrength
  usernameSensitiveWordsEnabled: boolean
  usernameSensitiveWords: string[]
  registerEmailWhitelistEnabled: boolean
  registerEmailWhitelistDomains: string[]
  registerPhoneEnabled: boolean
  registerPhoneRequired: boolean
  registerPhoneVerification: boolean
  registerNicknameEnabled: boolean
  registerNicknameRequired: boolean
  registerNicknameMinLength: number
  registerNicknameMaxLength: number
  registerGenderEnabled: boolean
  registerGenderRequired: boolean
  registerInviterEnabled: boolean
  registrationEmailTemplates: RegistrationEmailTemplateSettings
  emailBusinessSwitches: EmailBusinessSwitchSettings
  authGithubEnabled: boolean
  authGoogleEnabled: boolean
  authPasskeyEnabled: boolean
  githubClientId?: string | null
  githubClientSecret?: string | null
  googleClientId?: string | null
  googleClientSecret?: string | null
  passkeyRpId?: string | null
  passkeyRpName?: string | null
  passkeyOrigin?: string | null
  smsEnabled: boolean
  smsProvider: SmsBuiltinProvider
  smsCaptchaMode: "OFF" | "TURNSTILE" | "BUILTIN" | "POW"
  smsAliyunAccessKeyId?: string | null
  smsAliyunAccessKeySecret?: string | null
  smsAliyunEndpoint: string
  smsAliyunRegionId: string
  smsAliyunSignName: string
  smsAliyunTemplateCode: string
  smsAliyunCodeParamName: string
  smsTencentSecretId?: string | null
  smsTencentSecretKey?: string | null
  smsTencentRegion: string
  smsTencentEndpoint: string
  smsTencentSmsSdkAppId: string
  smsTencentSignName: string
  smsTencentTemplateId: string
  smsTencentTemplateParamKeys: string[]
  smtpEnabled: boolean
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUser?: string | null
  smtpPass?: string | null
  smtpFrom?: string | null
  smtpSecure: boolean
}

export type AdminBasicSettingsMode = "profile" | "registration" | "interaction" | "board-applications"

export interface AdminBasicSettingsDraft {
  siteName: string
  siteSlogan: string
  siteDescription: string
  siteLogoText: string
  siteLogoPath: string
  siteIconPath: string
  siteSeoKeywords: string
  postLinkDisplayMode: "SLUG" | "ID"
  homeFeedPostListDisplayMode: PostListDisplayMode
  homeFeedPostListLoadMode: PostListLoadMode
  homeFeedPostPageSize: string
  zonePostPageSize: string
  boardPostPageSize: string
  commentPageSize: string
  commentLoadMode: CommentLoadMode
  postTitleMinLength: string
  postTitleMaxLength: string
  postContentMinLength: string
  postContentMaxLength: string
  commentContentMinLength: string
  commentContentMaxLength: string
  homeSidebarHotTopicsCount: string
  postSidebarRelatedTopicsCount: string
  homeSidebarStatsCardEnabled: boolean
  homeSidebarAnnouncementsEnabled: boolean
  userProfileIpLocationEnabled: boolean
  userProfileIntroductionEnabled: boolean
  leftSidebarDisplayMode: LeftSidebarDisplayMode
  leftSidebarNavigationMode: LeftSidebarNavigationMode
  leftSidebarHomeEnabled: boolean
  leftSidebarHomeName: string
  leftSidebarHomeIcon: string
  defaultPreference: ThemePreference
  defaultThemePreset: BuiltInThemePreset
  defaultFontSizePreset: FontSizePreset
  defaultMobileThemePreset: BuiltInThemePreset
  defaultMobileFontSizePreset: FontSizePreset
  postContentImageMode: PostContentImageMode
  fontSizePresets: Record<FontSizePreset, FontSizePresetDefinition>
  themePresets: Record<BuiltInThemePreset, EditableThemePresetDefinition>
  postSlugGenerationMode: PostSlugGenerationMode
  footerCopyrightText: string
  footerBrandingVisible: boolean
  searchEnabled: boolean
  analyticsCode: string
  postEditableMinutes: string
  commentEditableMinutes: string
  godCommentAutoLikeThreshold: string
  guestCanViewComments: boolean
  forumRequireLoginToBrowse: boolean
  commentInitialVisibleReplies: string
  mentionDefaultUsernames: string
  siteChatEnabled: boolean
  anonymousPostEnabled: boolean
  anonymousPostPrice: string
  anonymousPostDailyLimit: string
  anonymousPostMaskUserId: string
  anonymousPostAllowReplySwitch: boolean
  anonymousPostDefaultReplyAnonymous: boolean
  postCreateRequireEmailVerified: boolean
  postCreateRequirePhoneVerified: boolean
  commentCreateRequireEmailVerified: boolean
  commentCreateRequirePhoneVerified: boolean
  postCreateMinRegisteredMinutes: string
  commentCreateMinRegisteredMinutes: string
  inviteRewardInviter: string
  inviteRewardInvitee: string
  registerInitialPoints: string
  registrationEnabled: boolean
  authPageShowcaseEnabled: boolean
  registrationRequireInviteCode: boolean
  registerInviteCodeEnabled: boolean
  registerInviteCodeHelpEnabled: boolean
  registerInviteCodeHelpTitle: string
  registerInviteCodeHelpUrl: string
  inviteCodePurchaseEnabled: boolean
  boardApplicationEnabled: boolean
  registerCaptchaMode: "OFF" | "TURNSTILE" | "BUILTIN" | "POW"
  loginCaptchaMode: "OFF" | "TURNSTILE" | "BUILTIN" | "POW"
  turnstileSiteKey: string
  turnstileSecretKey: string
  tippingEnabled: boolean
  tippingDailyLimit: string
  tippingPerPostLimit: string
  tippingAmounts: string
  tippingGifts: SiteTippingGiftItem[]
  tipGiftTaxEnabled: boolean
  tipGiftTaxRateBps: string
  postRedPacketEnabled: boolean
  postRedPacketMaxPoints: string
  postRedPacketDailyLimit: string
  postRedPacketRandomClaimProbability: string
  postJackpotEnabled: boolean
  postJackpotMinInitialPoints: string
  postJackpotMaxInitialPoints: string
  postJackpotReplyIncrementPoints: string
  postJackpotHitProbability: string
  heatViewWeight: string
  heatCommentWeight: string
  heatLikeWeight: string
  heatTipCountWeight: string
  heatTipPointsWeight: string
  homeHotRecentWindowHours: string
  heatStageThresholds: string
  heatStageColors: string[]
  previewViews: string
  previewComments: string
  previewLikes: string
  previewTipCount: string
  previewTipPoints: string
  registerEmailEnabled: boolean
  registerEmailRequired: boolean
  registerEmailVerification: boolean
  sessionIpMismatchLogoutEnabled: boolean
  loginIpChangeEmailAlertEnabled: boolean
  passwordChangeRequireEmailVerification: boolean
  oauthServerEnabled: boolean
  oauthClientApplicationEnabled: boolean
  oauthAccessTokenTtlMinutes: string
  oauthRefreshTokenTtlDays: string
  registerPasswordMinLength: string
  registerPasswordStrength: PasswordStrength
  usernameSensitiveWordsEnabled: boolean
  usernameSensitiveWords: string
  registerEmailWhitelistEnabled: boolean
  registerEmailWhitelistDomains: string
  registerPhoneEnabled: boolean
  registerPhoneRequired: boolean
  registerPhoneVerification: boolean
  registerNicknameEnabled: boolean
  registerNicknameRequired: boolean
  registerNicknameMinLength: string
  registerNicknameMaxLength: string
  registerGenderEnabled: boolean
  registerGenderRequired: boolean
  registerInviterEnabled: boolean
  registerVerificationEmailSubject: string
  registerVerificationEmailText: string
  registerVerificationEmailHtml: string
  resetPasswordEmailSubject: string
  resetPasswordEmailText: string
  resetPasswordEmailHtml: string
  passwordChangeEmailSubject: string
  passwordChangeEmailText: string
  passwordChangeEmailHtml: string
  loginIpChangeAlertEmailSubject: string
  loginIpChangeAlertEmailText: string
  loginIpChangeAlertEmailHtml: string
  paymentOrderSuccessEmailSubject: string
  paymentOrderSuccessEmailText: string
  paymentOrderSuccessEmailHtml: string
  emailBusinessSwitches: EmailBusinessSwitchSettings
  authGithubEnabled: boolean
  authGoogleEnabled: boolean
  authPasskeyEnabled: boolean
  githubClientId: string
  githubClientSecret: string
  googleClientId: string
  googleClientSecret: string
  passkeyRpId: string
  passkeyRpName: string
  passkeyOrigin: string
  smsEnabled: boolean
  smsProvider: SmsBuiltinProvider
  smsCaptchaMode: "OFF" | "TURNSTILE" | "BUILTIN" | "POW"
  smsAliyunAccessKeyId: string
  smsAliyunAccessKeySecret: string
  smsAliyunEndpoint: string
  smsAliyunRegionId: string
  smsAliyunSignName: string
  smsAliyunTemplateCode: string
  smsAliyunCodeParamName: string
  smsTencentSecretId: string
  smsTencentSecretKey: string
  smsTencentRegion: string
  smsTencentEndpoint: string
  smsTencentSmsSdkAppId: string
  smsTencentSignName: string
  smsTencentTemplateId: string
  smsTencentTemplateParamKeys: string
  smtpEnabled: boolean
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPass: string
  smtpFrom: string
  smtpSecure: boolean
}

function getRegisteredMinutesConditionValue(settings: InteractionGateSettings, action: "POST_CREATE" | "COMMENT_CREATE") {
  const conditions = settings.actions[action]?.conditions ?? []
  const condition = conditions.find((item): item is Extract<InteractionGateCondition, { type: "REGISTERED_MINUTES" }> => item.type === "REGISTERED_MINUTES")
  return condition?.value ?? 0
}

function coerceString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback
}

function coerceNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function coerceNumberString(value: unknown, fallback = 0) {
  return String(coerceNumber(value, fallback))
}

function coerceBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback
}

function copyThemeCustomizationFromRuntime(theme?: ThemeRuntimeSettings): ThemeCustomizationSettings {
  return theme?.customization ?? DEFAULT_THEME_CUSTOMIZATION_SETTINGS
}

function getDefaultInteractionGates(): InteractionGateSettings {
  return {
    version: 1,
    actions: {
      POST_CREATE: {
        enabled: false,
        conditions: [],
      },
      COMMENT_CREATE: {
        enabled: false,
        conditions: [],
      },
    },
  }
}

export function createAdminBasicSettingsDraft(initialSettings: AdminBasicSettingsInitialSettings): AdminBasicSettingsDraft {
  const themeCustomization = copyThemeCustomizationFromRuntime(initialSettings.theme)
  const interactionGates = initialSettings.interactionGates ?? getDefaultInteractionGates()
  const registrationEmailTemplates = normalizeRegistrationEmailTemplateSettings(
    initialSettings.registrationEmailTemplates,
    buildDefaultRegistrationEmailTemplateSettings(initialSettings.siteName),
  )
  const emailBusinessSwitches = normalizeEmailBusinessSwitchSettings(initialSettings.emailBusinessSwitches)
  const postCreateConditions = interactionGates.actions.POST_CREATE?.conditions ?? []
  const commentCreateConditions = interactionGates.actions.COMMENT_CREATE?.conditions ?? []
  const postCreateRequireEmailVerified = postCreateConditions.some((condition) => condition.type === "EMAIL_VERIFIED")
  const postCreateRequirePhoneVerified = postCreateConditions.some((condition) => condition.type === "PHONE_VERIFIED")
  const commentCreateRequireEmailVerified = commentCreateConditions.some((condition) => condition.type === "EMAIL_VERIFIED")
  const commentCreateRequirePhoneVerified = commentCreateConditions.some((condition) => condition.type === "PHONE_VERIFIED")
  const postCreateMinRegisteredMinutes = getRegisteredMinutesConditionValue(interactionGates, "POST_CREATE")
  const commentCreateMinRegisteredMinutes = getRegisteredMinutesConditionValue(interactionGates, "COMMENT_CREATE")
  const defaultTippingAmounts = String(defaultSiteSettingsCreateInput.tippingAmounts)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item))
  const defaultHeatStageThresholds = String(defaultSiteSettingsCreateInput.heatStageThresholds)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  const defaultHeatStageColors = String(defaultSiteSettingsCreateInput.heatStageColors)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  return {
    siteName: coerceString(initialSettings.siteName),
    siteSlogan: coerceString(initialSettings.siteSlogan),
    siteDescription: coerceString(initialSettings.siteDescription),
    siteLogoText: coerceString(initialSettings.siteLogoText),
    siteLogoPath: initialSettings.siteLogoPath ?? "",
    siteIconPath: initialSettings.siteIconPath ?? "",
    siteSeoKeywords: (initialSettings.siteSeoKeywords ?? []).join(","),
    postLinkDisplayMode: initialSettings.postLinkDisplayMode === "ID" ? "ID" : "SLUG",
    homeFeedPostListDisplayMode: normalizePostListDisplayMode(initialSettings.homeFeedPostListDisplayMode),
    homeFeedPostListLoadMode: initialSettings.homeFeedPostListLoadMode === POST_LIST_LOAD_MODE_INFINITE ? POST_LIST_LOAD_MODE_INFINITE : POST_LIST_LOAD_MODE_PAGINATION,
    homeFeedPostPageSize: coerceNumberString(initialSettings.homeFeedPostPageSize, 35),
    zonePostPageSize: coerceNumberString(initialSettings.zonePostPageSize, 20),
    boardPostPageSize: coerceNumberString(initialSettings.boardPostPageSize, 20),
    commentPageSize: coerceNumberString(initialSettings.commentPageSize, 15),
    commentLoadMode: initialSettings.commentLoadMode === COMMENT_LOAD_MODE_INFINITE ? COMMENT_LOAD_MODE_INFINITE : COMMENT_LOAD_MODE_PAGINATION,
    postTitleMinLength: coerceNumberString(initialSettings.postTitleMinLength, 5),
    postTitleMaxLength: coerceNumberString(initialSettings.postTitleMaxLength, 100),
    postContentMinLength: coerceNumberString(initialSettings.postContentMinLength, 10),
    postContentMaxLength: coerceNumberString(initialSettings.postContentMaxLength, 50000),
    commentContentMinLength: coerceNumberString(initialSettings.commentContentMinLength, 2),
    commentContentMaxLength: coerceNumberString(initialSettings.commentContentMaxLength, 2000),
    homeSidebarHotTopicsCount: coerceNumberString(initialSettings.homeSidebarHotTopicsCount, 5),
    postSidebarRelatedTopicsCount: coerceNumberString(initialSettings.postSidebarRelatedTopicsCount, 5),
    homeSidebarStatsCardEnabled: coerceBoolean(initialSettings.homeSidebarStatsCardEnabled, true),
    homeSidebarAnnouncementsEnabled: coerceBoolean(initialSettings.homeSidebarAnnouncementsEnabled, true),
    userProfileIpLocationEnabled: coerceBoolean(initialSettings.userProfileIpLocationEnabled, false),
    userProfileIntroductionEnabled: coerceBoolean(initialSettings.userProfileIntroductionEnabled, true),
    leftSidebarDisplayMode: initialSettings.leftSidebarDisplayMode ?? "DEFAULT",
    leftSidebarNavigationMode: initialSettings.leftSidebarNavigationMode ?? "DEFAULT",
    leftSidebarHomeEnabled: coerceBoolean(initialSettings.leftSidebarHome?.enabled, true),
    leftSidebarHomeName: coerceString(initialSettings.leftSidebarHome?.name, "首页"),
    leftSidebarHomeIcon: coerceString(initialSettings.leftSidebarHome?.icon, "🏠"),
    defaultPreference: themeCustomization.defaultPreference,
    defaultThemePreset: themeCustomization.defaultThemePreset,
    defaultFontSizePreset: themeCustomization.defaultFontSizePreset,
    defaultMobileThemePreset: themeCustomization.defaultMobileThemePreset,
    defaultMobileFontSizePreset: themeCustomization.defaultMobileFontSizePreset,
    postContentImageMode: themeCustomization.postContentImageMode,
    fontSizePresets: themeCustomization.fontSizePresets,
    themePresets: themeCustomization.themePresets,
    postSlugGenerationMode: initialSettings.postSlugGenerationMode ?? "TITLE_TIMESTAMP",
    footerCopyrightText: coerceString(initialSettings.footerCopyrightText, `${coerceString(initialSettings.siteName)} @ ${new Date().getFullYear()}`),
    footerBrandingVisible: coerceBoolean(initialSettings.footerBrandingVisible, true),
    searchEnabled: initialSettings.search?.enabled ?? true,
    analyticsCode: initialSettings.analyticsCode ?? "",
    postEditableMinutes: coerceNumberString(initialSettings.postEditableMinutes, 10),
    commentEditableMinutes: coerceNumberString(initialSettings.commentEditableMinutes, 5),
    godCommentAutoLikeThreshold: coerceNumberString(initialSettings.godCommentAutoLikeThreshold, DEFAULT_GOD_COMMENT_AUTO_LIKE_THRESHOLD),
    guestCanViewComments: coerceBoolean(initialSettings.guestCanViewComments, true),
    forumRequireLoginToBrowse: coerceBoolean(initialSettings.forumRequireLoginToBrowse, false),
    commentInitialVisibleReplies: coerceNumberString(initialSettings.commentInitialVisibleReplies, 10),
    mentionDefaultUsernames: (initialSettings.mentionRecommendations?.defaultUsernames ?? []).join("\n"),
    siteChatEnabled: coerceBoolean(initialSettings.siteChatEnabled, false),
    anonymousPostEnabled: coerceBoolean(initialSettings.anonymousPostEnabled, false),
    anonymousPostPrice: coerceNumberString(initialSettings.anonymousPostPrice, 0),
    anonymousPostDailyLimit: coerceNumberString(initialSettings.anonymousPostDailyLimit, 0),
    anonymousPostMaskUserId: initialSettings.anonymousPostMaskUserId ? String(initialSettings.anonymousPostMaskUserId) : "",
    anonymousPostAllowReplySwitch: coerceBoolean(initialSettings.anonymousPostAllowReplySwitch, true),
    anonymousPostDefaultReplyAnonymous: coerceBoolean(initialSettings.anonymousPostDefaultReplyAnonymous, true),
    postCreateRequireEmailVerified,
    postCreateRequirePhoneVerified,
    commentCreateRequireEmailVerified,
    commentCreateRequirePhoneVerified,
    postCreateMinRegisteredMinutes: coerceNumberString(postCreateMinRegisteredMinutes, 0),
    commentCreateMinRegisteredMinutes: coerceNumberString(commentCreateMinRegisteredMinutes, 0),
    inviteRewardInviter: coerceNumberString(initialSettings.inviteRewardInviter, 0),
    inviteRewardInvitee: coerceNumberString(initialSettings.inviteRewardInvitee, 0),
    registerInitialPoints: coerceNumberString(initialSettings.registerInitialPoints, 0),
    registrationEnabled: coerceBoolean(initialSettings.registrationEnabled, true),
    authPageShowcaseEnabled: coerceBoolean(initialSettings.authPageShowcaseEnabled, true),
    registrationRequireInviteCode: coerceBoolean(initialSettings.registrationRequireInviteCode, false),
    registerInviteCodeEnabled: coerceBoolean(initialSettings.registerInviteCodeEnabled, true),
    registerInviteCodeHelpEnabled: coerceBoolean(initialSettings.registerInviteCodeHelpEnabled, false),
    registerInviteCodeHelpTitle: coerceString(initialSettings.registerInviteCodeHelpTitle),
    registerInviteCodeHelpUrl: coerceString(initialSettings.registerInviteCodeHelpUrl),
    inviteCodePurchaseEnabled: coerceBoolean(initialSettings.inviteCodePurchaseEnabled, false),
    boardApplicationEnabled: coerceBoolean(initialSettings.boardApplicationEnabled, true),
    registerCaptchaMode: initialSettings.registerCaptchaMode ?? "OFF",
    loginCaptchaMode: initialSettings.loginCaptchaMode ?? "OFF",
    turnstileSiteKey: initialSettings.turnstileSiteKey ?? "",
    turnstileSecretKey: initialSettings.turnstileSecretKey ?? "",
    tippingEnabled: coerceBoolean(initialSettings.tippingEnabled, false),
    tippingDailyLimit: coerceNumberString(initialSettings.tippingDailyLimit, 3),
    tippingPerPostLimit: coerceNumberString(initialSettings.tippingPerPostLimit, 1),
    tippingAmounts: Array.isArray(initialSettings.tippingAmounts) ? initialSettings.tippingAmounts.join(",") : defaultTippingAmounts.join(","),
    tippingGifts: Array.isArray(initialSettings.tippingGifts) ? initialSettings.tippingGifts : [],
    tipGiftTaxEnabled: initialSettings.tipGiftTaxEnabled ?? false,
    tipGiftTaxRateBps: String(initialSettings.tipGiftTaxRateBps ?? 0),
    postRedPacketEnabled: coerceBoolean(initialSettings.postRedPacketEnabled, false),
    postRedPacketMaxPoints: coerceNumberString(initialSettings.postRedPacketMaxPoints, 100),
    postRedPacketDailyLimit: coerceNumberString(initialSettings.postRedPacketDailyLimit, 100),
    postRedPacketRandomClaimProbability: coerceNumberString(initialSettings.postRedPacketRandomClaimProbability, 0),
    postJackpotEnabled: coerceBoolean(initialSettings.postJackpotEnabled, false),
    postJackpotMinInitialPoints: coerceNumberString(initialSettings.postJackpotMinInitialPoints, 100),
    postJackpotMaxInitialPoints: coerceNumberString(initialSettings.postJackpotMaxInitialPoints, 1000),
    postJackpotReplyIncrementPoints: coerceNumberString(initialSettings.postJackpotReplyIncrementPoints, 25),
    postJackpotHitProbability: coerceNumberString(initialSettings.postJackpotHitProbability, 15),
    heatViewWeight: coerceNumberString(initialSettings.heatViewWeight, 1),
    heatCommentWeight: coerceNumberString(initialSettings.heatCommentWeight, 8),
    heatLikeWeight: coerceNumberString(initialSettings.heatLikeWeight, 6),
    heatTipCountWeight: coerceNumberString(initialSettings.heatTipCountWeight, 10),
    heatTipPointsWeight: coerceNumberString(initialSettings.heatTipPointsWeight, 1),
    homeHotRecentWindowHours: coerceNumberString(initialSettings.homeHotRecentWindowHours, 72),
    heatStageThresholds: Array.isArray(initialSettings.heatStageThresholds) ? initialSettings.heatStageThresholds.join(",") : defaultHeatStageThresholds.join(","),
    heatStageColors: Array.isArray(initialSettings.heatStageColors) && initialSettings.heatStageColors.length > 0 ? initialSettings.heatStageColors : defaultHeatStageColors,
    previewViews: "120",
    previewComments: "18",
    previewLikes: "12",
    previewTipCount: "4",
    previewTipPoints: "160",
    registerEmailEnabled: coerceBoolean(initialSettings.registerEmailEnabled, false),
    registerEmailRequired: coerceBoolean(initialSettings.registerEmailRequired, false),
    registerEmailVerification: coerceBoolean(initialSettings.registerEmailVerification, false),
    sessionIpMismatchLogoutEnabled: coerceBoolean(initialSettings.sessionIpMismatchLogoutEnabled, true),
    loginIpChangeEmailAlertEnabled: coerceBoolean(initialSettings.loginIpChangeEmailAlertEnabled, false),
    passwordChangeRequireEmailVerification: coerceBoolean(initialSettings.passwordChangeRequireEmailVerification, false),
    oauthServerEnabled: coerceBoolean(initialSettings.oauthServerEnabled, false),
    oauthClientApplicationEnabled: coerceBoolean(initialSettings.oauthClientApplicationEnabled, false),
    oauthAccessTokenTtlMinutes: coerceNumberString(initialSettings.oauthAccessTokenTtlMinutes, 60),
    oauthRefreshTokenTtlDays: coerceNumberString(initialSettings.oauthRefreshTokenTtlDays, 30),
    registerPasswordMinLength: coerceNumberString(initialSettings.registerPasswordMinLength, 6),
    registerPasswordStrength: initialSettings.registerPasswordStrength ?? "LOW",
    usernameSensitiveWordsEnabled: coerceBoolean(initialSettings.usernameSensitiveWordsEnabled, false),
    usernameSensitiveWords: Array.isArray(initialSettings.usernameSensitiveWords)
      ? initialSettings.usernameSensitiveWords.join("\n")
      : "",
    registerEmailWhitelistEnabled: coerceBoolean(initialSettings.registerEmailWhitelistEnabled, false),
    registerEmailWhitelistDomains: Array.isArray(initialSettings.registerEmailWhitelistDomains)
      ? initialSettings.registerEmailWhitelistDomains.join("\n")
      : "",
    registerPhoneEnabled: coerceBoolean(initialSettings.registerPhoneEnabled, false),
    registerPhoneRequired: coerceBoolean(initialSettings.registerPhoneRequired, false),
    registerPhoneVerification: coerceBoolean(initialSettings.registerPhoneVerification, false),
    registerNicknameEnabled: coerceBoolean(initialSettings.registerNicknameEnabled, true),
    registerNicknameRequired: coerceBoolean(initialSettings.registerNicknameRequired, false),
    registerNicknameMinLength: coerceNumberString(initialSettings.registerNicknameMinLength, 1),
    registerNicknameMaxLength: coerceNumberString(initialSettings.registerNicknameMaxLength, 20),
    registerGenderEnabled: coerceBoolean(initialSettings.registerGenderEnabled, false),
    registerGenderRequired: coerceBoolean(initialSettings.registerGenderRequired, false),
    registerInviterEnabled: coerceBoolean(initialSettings.registerInviterEnabled, true),
    registerVerificationEmailSubject: registrationEmailTemplates.registerVerification.subject,
    registerVerificationEmailText: registrationEmailTemplates.registerVerification.text,
    registerVerificationEmailHtml: registrationEmailTemplates.registerVerification.html,
    resetPasswordEmailSubject: registrationEmailTemplates.resetPasswordVerification.subject,
    resetPasswordEmailText: registrationEmailTemplates.resetPasswordVerification.text,
    resetPasswordEmailHtml: registrationEmailTemplates.resetPasswordVerification.html,
    passwordChangeEmailSubject: registrationEmailTemplates.passwordChangeVerification.subject,
    passwordChangeEmailText: registrationEmailTemplates.passwordChangeVerification.text,
    passwordChangeEmailHtml: registrationEmailTemplates.passwordChangeVerification.html,
    loginIpChangeAlertEmailSubject: registrationEmailTemplates.loginIpChangeAlert.subject,
    loginIpChangeAlertEmailText: registrationEmailTemplates.loginIpChangeAlert.text,
    loginIpChangeAlertEmailHtml: registrationEmailTemplates.loginIpChangeAlert.html,
    paymentOrderSuccessEmailSubject: registrationEmailTemplates.paymentOrderSuccessNotification.subject,
    paymentOrderSuccessEmailText: registrationEmailTemplates.paymentOrderSuccessNotification.text,
    paymentOrderSuccessEmailHtml: registrationEmailTemplates.paymentOrderSuccessNotification.html,
    emailBusinessSwitches,
    authGithubEnabled: coerceBoolean(initialSettings.authGithubEnabled, false),
    authGoogleEnabled: coerceBoolean(initialSettings.authGoogleEnabled, false),
    authPasskeyEnabled: coerceBoolean(initialSettings.authPasskeyEnabled, false),
    githubClientId: initialSettings.githubClientId ?? "",
    githubClientSecret: initialSettings.githubClientSecret ?? "",
    googleClientId: initialSettings.googleClientId ?? "",
    googleClientSecret: initialSettings.googleClientSecret ?? "",
    passkeyRpId: initialSettings.passkeyRpId ?? "",
    passkeyRpName: initialSettings.passkeyRpName ?? "",
    passkeyOrigin: initialSettings.passkeyOrigin ?? "",
    smsEnabled: coerceBoolean(initialSettings.smsEnabled, false),
    smsProvider: initialSettings.smsProvider ?? "aliyun",
    smsCaptchaMode: initialSettings.smsCaptchaMode ?? "OFF",
    smsAliyunAccessKeyId: initialSettings.smsAliyunAccessKeyId ?? "",
    smsAliyunAccessKeySecret: initialSettings.smsAliyunAccessKeySecret ?? "",
    smsAliyunEndpoint: initialSettings.smsAliyunEndpoint || "dysmsapi.aliyuncs.com",
    smsAliyunRegionId: initialSettings.smsAliyunRegionId || "cn-hangzhou",
    smsAliyunSignName: initialSettings.smsAliyunSignName ?? "",
    smsAliyunTemplateCode: initialSettings.smsAliyunTemplateCode ?? "",
    smsAliyunCodeParamName: initialSettings.smsAliyunCodeParamName || "code",
    smsTencentSecretId: initialSettings.smsTencentSecretId ?? "",
    smsTencentSecretKey: initialSettings.smsTencentSecretKey ?? "",
    smsTencentRegion: initialSettings.smsTencentRegion || "ap-guangzhou",
    smsTencentEndpoint: initialSettings.smsTencentEndpoint || "sms.tencentcloudapi.com",
    smsTencentSmsSdkAppId: initialSettings.smsTencentSmsSdkAppId ?? "",
    smsTencentSignName: initialSettings.smsTencentSignName ?? "",
    smsTencentTemplateId: initialSettings.smsTencentTemplateId ?? "",
    smsTencentTemplateParamKeys: (initialSettings.smsTencentTemplateParamKeys ?? ["code"]).join(","),
    smtpEnabled: coerceBoolean(initialSettings.smtpEnabled, false),
    smtpHost: initialSettings.smtpHost ?? "",
    smtpPort: initialSettings.smtpPort ? String(initialSettings.smtpPort) : "",
    smtpUser: initialSettings.smtpUser ?? "",
    smtpPass: initialSettings.smtpPass ?? "",
    smtpFrom: initialSettings.smtpFrom ?? "",
    smtpSecure: coerceBoolean(initialSettings.smtpSecure, false),
  }
}

export function buildAdminBasicSettingsPayload(draft: AdminBasicSettingsDraft, mode: AdminBasicSettingsMode) {
  if (mode === "profile") {
    return {
      siteName: draft.siteName,
      siteSlogan: draft.siteSlogan,
      siteDescription: draft.siteDescription,
      siteLogoText: draft.siteLogoText,
      siteLogoPath: draft.siteLogoPath,
      siteIconPath: draft.siteIconPath,
      siteSeoKeywords: draft.siteSeoKeywords,
      postLinkDisplayMode: draft.postLinkDisplayMode,
      homeFeedPostListDisplayMode: draft.homeFeedPostListDisplayMode,
      homeFeedPostListLoadMode: draft.homeFeedPostListLoadMode ?? POST_LIST_LOAD_MODE_PAGINATION,
      homeFeedPostPageSize: Number(draft.homeFeedPostPageSize),
      zonePostPageSize: Number(draft.zonePostPageSize),
      boardPostPageSize: Number(draft.boardPostPageSize),
      homeSidebarHotTopicsCount: Number(draft.homeSidebarHotTopicsCount),
      postSidebarRelatedTopicsCount: Number(draft.postSidebarRelatedTopicsCount),
      homeSidebarStatsCardEnabled: draft.homeSidebarStatsCardEnabled,
      homeSidebarAnnouncementsEnabled: draft.homeSidebarAnnouncementsEnabled,
      userProfileIpLocationEnabled: draft.userProfileIpLocationEnabled,
      userProfileIntroductionEnabled: draft.userProfileIntroductionEnabled,
      leftSidebarDisplayMode: draft.leftSidebarDisplayMode,
      leftSidebarNavigationMode: draft.leftSidebarNavigationMode,
      leftSidebarHome: {
        enabled: draft.leftSidebarHomeEnabled,
        name: draft.leftSidebarHomeName,
        icon: draft.leftSidebarHomeIcon,
      },
      themeCustomization: {
        defaultPreference: draft.defaultPreference,
        defaultThemePreset: draft.defaultThemePreset,
        defaultFontSizePreset: draft.defaultFontSizePreset,
        defaultMobileThemePreset: draft.defaultMobileThemePreset,
        defaultMobileFontSizePreset: draft.defaultMobileFontSizePreset,
        postContentImageMode: draft.postContentImageMode,
        fontSizePresets: draft.fontSizePresets,
        themePresets: draft.themePresets,
      },
      postSlugGenerationMode: draft.postSlugGenerationMode,
      footerCopyrightText: draft.footerCopyrightText,
      footerBrandingVisible: draft.footerBrandingVisible,
      searchEnabled: draft.searchEnabled,
      analyticsCode: draft.analyticsCode,
      postEditableMinutes: Number(draft.postEditableMinutes),
      commentEditableMinutes: Number(draft.commentEditableMinutes),
      section: "site-profile",
    }
  }

  if (mode === "registration") {
    return {
      inviteRewardInviter: Number(draft.inviteRewardInviter),
      inviteRewardInvitee: Number(draft.inviteRewardInvitee),
      registerInitialPoints: Number(draft.registerInitialPoints),
      registrationEnabled: draft.registrationEnabled,
      authPageShowcaseEnabled: draft.authPageShowcaseEnabled,
      registrationRequireInviteCode: draft.registrationRequireInviteCode,
      registerInviteCodeEnabled: draft.registerInviteCodeEnabled,
      registerInviteCodeHelpEnabled: draft.registerInviteCodeHelpEnabled,
      registerInviteCodeHelpTitle: draft.registerInviteCodeHelpTitle,
      registerInviteCodeHelpUrl: draft.registerInviteCodeHelpUrl,
      inviteCodePurchaseEnabled: draft.inviteCodePurchaseEnabled,
      registerCaptchaMode: draft.registerCaptchaMode,
      loginCaptchaMode: draft.loginCaptchaMode,
      turnstileSiteKey: draft.turnstileSiteKey,
      turnstileSecretKey: draft.turnstileSecretKey,
      registerEmailEnabled: draft.registerEmailEnabled,
      registerEmailRequired: draft.registerEmailRequired,
      registerEmailVerification: draft.registerEmailVerification,
      sessionIpMismatchLogoutEnabled: draft.sessionIpMismatchLogoutEnabled,
      loginIpChangeEmailAlertEnabled: draft.loginIpChangeEmailAlertEnabled,
      passwordChangeRequireEmailVerification: draft.passwordChangeRequireEmailVerification,
      oauthServerEnabled: draft.oauthServerEnabled,
      oauthClientApplicationEnabled: draft.oauthClientApplicationEnabled,
      oauthAccessTokenTtlMinutes: Number(draft.oauthAccessTokenTtlMinutes),
      oauthRefreshTokenTtlDays: Number(draft.oauthRefreshTokenTtlDays),
      registerPasswordMinLength: Number(draft.registerPasswordMinLength),
      registerPasswordStrength: draft.registerPasswordStrength,
      usernameSensitiveWordsEnabled: draft.usernameSensitiveWordsEnabled,
      usernameSensitiveWords: draft.usernameSensitiveWords,
      registerEmailWhitelistEnabled: draft.registerEmailWhitelistEnabled,
      registerEmailWhitelistDomains: draft.registerEmailWhitelistDomains,
      registerPhoneEnabled: draft.registerPhoneEnabled,
      registerPhoneRequired: draft.registerPhoneRequired,
      registerPhoneVerification: draft.registerPhoneVerification,
      registerNicknameEnabled: draft.registerNicknameEnabled,
      registerNicknameRequired: draft.registerNicknameRequired,
      registerNicknameMinLength: Number(draft.registerNicknameMinLength),
      registerNicknameMaxLength: Number(draft.registerNicknameMaxLength),
      registerGenderEnabled: draft.registerGenderEnabled,
      registerGenderRequired: draft.registerGenderRequired,
      registerInviterEnabled: draft.registerInviterEnabled,
      registerVerificationEmailSubject: draft.registerVerificationEmailSubject,
      registerVerificationEmailText: draft.registerVerificationEmailText,
      registerVerificationEmailHtml: draft.registerVerificationEmailHtml,
      resetPasswordEmailSubject: draft.resetPasswordEmailSubject,
      resetPasswordEmailText: draft.resetPasswordEmailText,
      resetPasswordEmailHtml: draft.resetPasswordEmailHtml,
      passwordChangeEmailSubject: draft.passwordChangeEmailSubject,
      passwordChangeEmailText: draft.passwordChangeEmailText,
      passwordChangeEmailHtml: draft.passwordChangeEmailHtml,
      loginIpChangeAlertEmailSubject: draft.loginIpChangeAlertEmailSubject,
      loginIpChangeAlertEmailText: draft.loginIpChangeAlertEmailText,
      loginIpChangeAlertEmailHtml: draft.loginIpChangeAlertEmailHtml,
      paymentOrderSuccessEmailSubject: draft.paymentOrderSuccessEmailSubject,
      paymentOrderSuccessEmailText: draft.paymentOrderSuccessEmailText,
      paymentOrderSuccessEmailHtml: draft.paymentOrderSuccessEmailHtml,
      emailBusinessSwitches: draft.emailBusinessSwitches,
      authGithubEnabled: draft.authGithubEnabled,
      authGoogleEnabled: draft.authGoogleEnabled,
      authPasskeyEnabled: draft.authPasskeyEnabled,
      githubClientId: draft.githubClientId,
      githubClientSecret: draft.githubClientSecret,
      googleClientId: draft.googleClientId,
      googleClientSecret: draft.googleClientSecret,
      passkeyRpId: draft.passkeyRpId,
      passkeyRpName: draft.passkeyRpName,
      passkeyOrigin: draft.passkeyOrigin,
      smsEnabled: draft.smsEnabled,
      smsProvider: draft.smsProvider,
      smsCaptchaMode: draft.smsCaptchaMode,
      smsAliyunAccessKeyId: draft.smsAliyunAccessKeyId,
      smsAliyunAccessKeySecret: draft.smsAliyunAccessKeySecret,
      smsAliyunEndpoint: draft.smsAliyunEndpoint,
      smsAliyunRegionId: draft.smsAliyunRegionId,
      smsAliyunSignName: draft.smsAliyunSignName,
      smsAliyunTemplateCode: draft.smsAliyunTemplateCode,
      smsAliyunCodeParamName: draft.smsAliyunCodeParamName,
      smsTencentSecretId: draft.smsTencentSecretId,
      smsTencentSecretKey: draft.smsTencentSecretKey,
      smsTencentRegion: draft.smsTencentRegion,
      smsTencentEndpoint: draft.smsTencentEndpoint,
      smsTencentSmsSdkAppId: draft.smsTencentSmsSdkAppId,
      smsTencentSignName: draft.smsTencentSignName,
      smsTencentTemplateId: draft.smsTencentTemplateId,
      smsTencentTemplateParamKeys: draft.smsTencentTemplateParamKeys,
      smtpEnabled: draft.smtpEnabled,
      smtpHost: draft.smtpHost,
      smtpPort: Number(draft.smtpPort),
      smtpUser: draft.smtpUser,
      smtpPass: draft.smtpPass,
      smtpFrom: draft.smtpFrom,
      smtpSecure: draft.smtpSecure,
      section: "site-registration",
    }
  }

  if (mode === "board-applications") {
    return {
      boardApplicationEnabled: draft.boardApplicationEnabled,
      section: "site-board-applications",
    }
  }

  return {
    tippingEnabled: draft.tippingEnabled,
    guestCanViewComments: draft.guestCanViewComments,
    forumRequireLoginToBrowse: draft.forumRequireLoginToBrowse,
    commentInitialVisibleReplies: Number(draft.commentInitialVisibleReplies),
    mentionDefaultUsernames: draft.mentionDefaultUsernames,
    siteChatEnabled: draft.siteChatEnabled,
    postEditableMinutes: Number(draft.postEditableMinutes),
    commentEditableMinutes: Number(draft.commentEditableMinutes),
    godCommentAutoLikeThreshold: Number(draft.godCommentAutoLikeThreshold),
    anonymousPostEnabled: draft.anonymousPostEnabled,
    anonymousPostPrice: Number(draft.anonymousPostPrice),
    anonymousPostDailyLimit: Number(draft.anonymousPostDailyLimit),
    anonymousPostMaskUserId: Number(draft.anonymousPostMaskUserId),
    anonymousPostAllowReplySwitch: draft.anonymousPostAllowReplySwitch,
    anonymousPostDefaultReplyAnonymous: draft.anonymousPostDefaultReplyAnonymous,
    postCreateRequireEmailVerified: draft.postCreateRequireEmailVerified,
    postCreateRequirePhoneVerified: draft.postCreateRequirePhoneVerified,
    commentCreateRequireEmailVerified: draft.commentCreateRequireEmailVerified,
    commentCreateRequirePhoneVerified: draft.commentCreateRequirePhoneVerified,
    postCreateMinRegisteredMinutes: Number(draft.postCreateMinRegisteredMinutes),
    commentCreateMinRegisteredMinutes: Number(draft.commentCreateMinRegisteredMinutes),
    commentPageSize: Number(draft.commentPageSize),
    commentLoadMode: draft.commentLoadMode ?? COMMENT_LOAD_MODE_PAGINATION,
    postTitleMinLength: Number(draft.postTitleMinLength),
    postTitleMaxLength: Number(draft.postTitleMaxLength),
    postContentMinLength: Number(draft.postContentMinLength),
    postContentMaxLength: Number(draft.postContentMaxLength),
    commentContentMinLength: Number(draft.commentContentMinLength),
    commentContentMaxLength: Number(draft.commentContentMaxLength),
    tippingDailyLimit: Number(draft.tippingDailyLimit),
    tippingPerPostLimit: Number(draft.tippingPerPostLimit),
    tippingAmounts: draft.tippingAmounts,
    tippingGifts: draft.tippingGifts,
    tipGiftTaxEnabled: draft.tipGiftTaxEnabled,
    tipGiftTaxRateBps: Number(draft.tipGiftTaxRateBps),
    postRedPacketEnabled: draft.postRedPacketEnabled,
    postRedPacketMaxPoints: Number(draft.postRedPacketMaxPoints),
    postRedPacketDailyLimit: Number(draft.postRedPacketDailyLimit),
    postRedPacketRandomClaimProbability: Number(draft.postRedPacketRandomClaimProbability),
    postJackpotEnabled: draft.postJackpotEnabled,
    postJackpotMinInitialPoints: Number(draft.postJackpotMinInitialPoints),
    postJackpotMaxInitialPoints: Number(draft.postJackpotMaxInitialPoints),
    postJackpotReplyIncrementPoints: Number(draft.postJackpotReplyIncrementPoints),
    postJackpotHitProbability: Number(draft.postJackpotHitProbability),
    heatViewWeight: Number(draft.heatViewWeight),
    heatCommentWeight: Number(draft.heatCommentWeight),
    heatLikeWeight: Number(draft.heatLikeWeight),
    heatTipCountWeight: Number(draft.heatTipCountWeight),
    heatTipPointsWeight: Number(draft.heatTipPointsWeight),
    homeHotRecentWindowHours: Number(draft.homeHotRecentWindowHours),
    heatStageThresholds: draft.heatStageThresholds,
    heatStageColors: draft.heatStageColors.join(","),
    section: "site-interaction",
  }
}

export interface AdminSiteSettingsInitialSettings {
  siteName: string
  siteSlogan: string
  siteDescription: string
  siteLogoText: string
  siteLogoPath?: string | null
  siteSeoKeywords?: string[]
  vipMonthlyPrice: number
  vipQuarterlyPrice: number
  vipYearlyPrice: number
  postOfflinePrice: number
  postOfflineVip1Price: number
  postOfflineVip2Price: number
  postOfflineVip3Price: number
  uploadProvider: string
  uploadLocalPath: string
  uploadBaseUrl?: string | null
  uploadOssBucket?: string | null
  uploadOssRegion?: string | null
  uploadOssEndpoint?: string | null
}

export interface AdminSiteSettingsDraft {
  siteName: string
  siteSlogan: string
  siteDescription: string
  siteLogoText: string
  siteLogoPath: string
  vipMonthlyPrice: string
  vipQuarterlyPrice: string
  vipYearlyPrice: string
  postOfflinePrice: string
  postOfflineVip1Price: string
  postOfflineVip2Price: string
  postOfflineVip3Price: string
  uploadProvider: string
  uploadLocalPath: string
  uploadBaseUrl: string
  uploadOssBucket: string
  uploadOssRegion: string
  uploadOssEndpoint: string
}

export function createAdminSiteSettingsDraft(initialSettings: AdminSiteSettingsInitialSettings): AdminSiteSettingsDraft {
  return {
    siteName: coerceString(initialSettings.siteName),
    siteSlogan: coerceString(initialSettings.siteSlogan),
    siteDescription: coerceString(initialSettings.siteDescription),
    siteLogoText: coerceString(initialSettings.siteLogoText),
    siteLogoPath: initialSettings.siteLogoPath ?? "",
    vipMonthlyPrice: coerceNumberString(initialSettings.vipMonthlyPrice, 3000),
    vipQuarterlyPrice: coerceNumberString(initialSettings.vipQuarterlyPrice, 8000),
    vipYearlyPrice: coerceNumberString(initialSettings.vipYearlyPrice, 30000),
    postOfflinePrice: coerceNumberString(initialSettings.postOfflinePrice, 0),
    postOfflineVip1Price: coerceNumberString(initialSettings.postOfflineVip1Price, 0),
    postOfflineVip2Price: coerceNumberString(initialSettings.postOfflineVip2Price, 0),
    postOfflineVip3Price: coerceNumberString(initialSettings.postOfflineVip3Price, 0),
    uploadProvider: coerceString(initialSettings.uploadProvider, defaultSiteSettingsCreateInput.uploadProvider),
    uploadLocalPath: coerceString(initialSettings.uploadLocalPath, defaultSiteSettingsCreateInput.uploadLocalPath),
    uploadBaseUrl: initialSettings.uploadBaseUrl ?? "",
    uploadOssBucket: initialSettings.uploadOssBucket ?? "",
    uploadOssRegion: initialSettings.uploadOssRegion ?? "",
    uploadOssEndpoint: initialSettings.uploadOssEndpoint ?? "",
  }
}

export function buildAdminSiteSettingsPayload(draft: AdminSiteSettingsDraft) {
  return {
    siteName: draft.siteName,
    siteSlogan: draft.siteSlogan,
    siteDescription: draft.siteDescription,
    siteLogoText: draft.siteLogoText,
    siteLogoPath: draft.siteLogoPath,
    vipMonthlyPrice: Number(draft.vipMonthlyPrice),
    vipQuarterlyPrice: Number(draft.vipQuarterlyPrice),
    vipYearlyPrice: Number(draft.vipYearlyPrice),
    postOfflinePrice: Number(draft.postOfflinePrice),
    postOfflineVip1Price: Number(draft.postOfflineVip1Price),
    postOfflineVip2Price: Number(draft.postOfflineVip2Price),
    postOfflineVip3Price: Number(draft.postOfflineVip3Price),
    uploadProvider: draft.uploadProvider,
    uploadLocalPath: draft.uploadLocalPath,
    uploadBaseUrl: draft.uploadBaseUrl,
    uploadOssBucket: draft.uploadOssBucket,
    uploadOssRegion: draft.uploadOssRegion,
    uploadOssEndpoint: draft.uploadOssEndpoint,
  }
}

async function uploadSiteAssetFile(options: {
  file: File
  endpoint: string
  folder: string
  errorMessage: string
  invalidTypeMessage: string
}) {
  if (options.file.type && !options.file.type.startsWith("image/")) {
    throw new Error(options.invalidTypeMessage)
  }

  const formData = new FormData()
  formData.append("file", options.file)
  formData.append("folder", options.folder)

  const response = await fetch(options.endpoint, {
    method: "POST",
    body: formData,
  })
  const result = await response.json()

  if (!response.ok || result.code !== 0) {
    throw new Error(result.message ?? options.errorMessage)
  }

  return String(result.data?.urlPath ?? "")
}

export async function uploadSiteLogoFile(file: File) {
  return uploadSiteAssetFile({
    file,
    endpoint: "/api/upload",
    folder: "site-logo",
    errorMessage: "站点 Logo 上传失败",
    invalidTypeMessage: "请先选择图片格式的站点 Logo",
  })
}

export async function uploadSiteIconFile(file: File) {
  return uploadSiteAssetFile({
    file,
    endpoint: "/api/admin/site-settings/icon-upload",
    folder: "icon",
    errorMessage: "站点图标上传失败",
    invalidTypeMessage: "请先选择图片格式的站点图标",
  })
}

function SiteImageUploadCard({
  title,
  description,
  uploadLabel,
  clearLabel,
  inputPlaceholder,
  previewAlt,
  value,
  uploading,
  onValueChange,
  onUpload,
  onClear,
}: {
  title: string
  description: string
  uploadLabel: string
  clearLabel: string
  inputPlaceholder: string
  previewAlt: string
  value: string
  uploading: boolean
  onValueChange: (value: string) => void
  onUpload: (file: File) => void | Promise<void>
  onClear: () => void
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-5">
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-3 rounded-[18px] border border-dashed border-border bg-card/60 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "上传中..." : uploadLabel}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  void onUpload(file)
                }
                event.target.value = ""
              }}
            />
          </label>
          <Button type="button" variant="ghost" disabled={!value || uploading} onClick={onClear}>{clearLabel}</Button>
        </div>
        <input value={value} onChange={(event) => onValueChange(event.target.value)} className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-hidden" placeholder={inputPlaceholder} />
        {value ? (
          <div className="relative h-16 w-40 overflow-hidden rounded-xl border border-border bg-white p-2">
            <Image src={value} alt={previewAlt} fill sizes="160px" className="object-contain" unoptimized />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function SiteLogoUploadCard(props: {
  value: string
  uploading: boolean
  onValueChange: (value: string) => void
  onUpload: (file: File) => void | Promise<void>
  onClear: () => void
}) {
  return (
    <SiteImageUploadCard
      title="站点 Logo"
      description="支持上传图片或直接填写图片地址；未设置时，前台继续使用图标作为默认站点标识。"
      uploadLabel="上传站点 Logo"
      clearLabel="清空图片 Logo"
      inputPlaceholder="或直接填写站点 Logo 地址"
      previewAlt="站点 Logo 预览"
      {...props}
    />
  )
}

export function SiteIconUploadCard(props: {
  value: string
  uploading: boolean
  onValueChange: (value: string) => void
  onUpload: (file: File) => void | Promise<void>
  onClear: () => void
}) {
  return (
    <SiteImageUploadCard
      title="站点图标"
      description="浏览器标签页、收藏夹和无 Logo 场景会使用这里的图标。支持后台上传图片，也支持直接填写 SVG/图片地址。"
      uploadLabel="上传站点图标"
      clearLabel="清空站点图标"
      inputPlaceholder="或直接填写站点图标地址"
      previewAlt="站点图标预览"
      {...props}
    />
  )
}

export function resolveHomeFeedPostListDisplayMode(value: string) {
  return normalizePostListDisplayMode(value, POST_LIST_DISPLAY_MODE_DEFAULT)
}
