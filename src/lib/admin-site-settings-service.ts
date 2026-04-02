import { prisma } from "@/db/client"
import { listActiveGiftDefinitions, syncGiftDefinitions } from "@/db/post-gift-queries"
import { apiError, readOptionalNumberField, readOptionalStringField, type JsonObject } from "@/lib/api-route"

import { normalizeMarkdownEmojiItems, serializeMarkdownEmojiItems } from "@/lib/markdown-emoji"
import { defaultSiteSettingsCreateInput } from "@/lib/site-settings-defaults"
import { normalizePostListDisplayMode } from "@/lib/post-list-display"
import { mergeCheckInMakeUpPriceSettings, mergeCheckInRewardSettings, mergeHomeSidebarAnnouncementSettings, mergeInviteCodePurchasePriceSettings, mergeMarkdownImageUploadSettings, mergeNicknameChangePointCostSettings, mergeVipLevelIconSettings, resolveHomeSidebarAnnouncementSettings, resolveMarkdownImageUploadSettings } from "@/lib/site-settings-app-state"
import { mergeSiteSearchSettings, resolveSiteSearchSettings } from "@/lib/site-search-settings"
import { normalizeCaptchaMode, normalizeFooterLinks } from "@/lib/shared/config-parsers"
import { normalizeHeatColors, normalizeHeatThresholds, normalizePositiveInteger, normalizeTippingAmounts } from "@/lib/shared/normalizers"
import { createSiteSettingsRecordWithFullData, updateSiteSettingsHeaderApps } from "@/db/site-settings-write-queries"
import { normalizeHeaderAppIconName, normalizeSiteHeaderAppLinks } from "@/lib/site-header-app-links"
import { invalidateSiteSettingsCache } from "@/lib/site-settings"
import { getDefaultTippingGiftItemsFromAmounts, normalizeTippingGiftItems } from "@/lib/tipping-gifts"
import { normalizeVipLevelIcons } from "@/lib/vip-level-icons"

export async function getOrCreateSiteSettings() {
  const existing = await prisma.siteSetting.findFirst({ orderBy: { createdAt: "asc" } })
  if (existing) {
    return existing
  }

  return createSiteSettingsRecordWithFullData(defaultSiteSettingsCreateInput)
}

export async function updateSiteSettingsBySection(body: JsonObject) {
  const section = readOptionalStringField(body, "section") || "site-profile"
  const existing = await getOrCreateSiteSettings()

  if (section === "site-profile") {
    const siteName = readOptionalStringField(body, "siteName")
    const siteSlogan = readOptionalStringField(body, "siteSlogan")
    const siteDescription = readOptionalStringField(body, "siteDescription")
    const siteLogoText = readOptionalStringField(body, "siteLogoText")
    const siteLogoPath = readOptionalStringField(body, "siteLogoPath")
    const siteSeoKeywords = readOptionalStringField(body, "siteSeoKeywords").split(/[，,\n]+/).map((item) => item.trim()).filter(Boolean).join(",")
    const analyticsCode = readOptionalStringField(body, "analyticsCode")
    const postLinkDisplayMode = readOptionalStringField(body, "postLinkDisplayMode") === "ID" ? "ID" : "SLUG"
    const homeFeedPostListDisplayMode = normalizePostListDisplayMode(body.homeFeedPostListDisplayMode)
    const homeSidebarStatsCardEnabled = body.homeSidebarStatsCardEnabled === undefined ? existing.homeSidebarStatsCardEnabled : Boolean(body.homeSidebarStatsCardEnabled)
    const existingHomeSidebarAnnouncementSettings = resolveHomeSidebarAnnouncementSettings({
      appStateJson: existing.appStateJson,
      enabledFallback: true,
    })
    const homeSidebarAnnouncementsEnabled = body.homeSidebarAnnouncementsEnabled === undefined
      ? existingHomeSidebarAnnouncementSettings.enabled
      : Boolean(body.homeSidebarAnnouncementsEnabled)
    const postEditableMinutes = Math.max(0, readOptionalNumberField(body, "postEditableMinutes") ?? 10)
    const commentEditableMinutes = Math.max(0, readOptionalNumberField(body, "commentEditableMinutes") ?? 5)
    const existingSearchSettings = resolveSiteSearchSettings(existing.appStateJson)
    const searchEnabled = body.searchEnabled === undefined ? existingSearchSettings.enabled : Boolean(body.searchEnabled)

    if (!siteName || !siteDescription) {
      apiError(400, "站点名称和描述不能为空")
    }

    const appStateWithHomeSidebarAnnouncement = mergeHomeSidebarAnnouncementSettings(existing.appStateJson, {
      enabled: homeSidebarAnnouncementsEnabled,
    })

    const appStateJson = mergeSiteSearchSettings(appStateWithHomeSidebarAnnouncement, {
      enabled: searchEnabled,
      externalEngines: existingSearchSettings.externalEngines,
    })

    const settings = await prisma.siteSetting.update({
      where: { id: existing.id },
      data: {
        siteName,
        siteSlogan,
        siteDescription,
        siteLogoText: siteLogoText || siteName,
        siteLogoPath: siteLogoPath || null,
        siteSeoKeywords,
        analyticsCode: analyticsCode || null,
        postLinkDisplayMode,
        homeFeedPostListDisplayMode,
        homeSidebarStatsCardEnabled,
        appStateJson,
        postEditableMinutes,
        commentEditableMinutes,
      },
    })

    invalidateSiteSettingsCache()

    return { settings, message: "基础信息已保存", revalidatePaths: ["/", "/write", "/admin"] }
  }

  if (section === "site-apps") {
    const headerAppLinks = normalizeSiteHeaderAppLinks(body.headerAppLinks)
    const headerAppIconName = normalizeHeaderAppIconName(body.headerAppIconName)

    await updateSiteSettingsHeaderApps(existing.id, JSON.stringify(headerAppLinks), headerAppIconName)

    invalidateSiteSettingsCache()

    return { settings: undefined, message: "应用入口已保存", revalidatePaths: ["/", "/admin"] }
  }

  if (section === "site-markdown-emoji") {
    const markdownEmojiMap = normalizeMarkdownEmojiItems(body.markdownEmojiMap)
    const markdownEmojiMapJson = serializeMarkdownEmojiItems(markdownEmojiMap)
    const settings = await prisma.siteSetting.update({
      where: { id: existing.id },
      data: {
        markdownEmojiMapJson,
      },
    })

    invalidateSiteSettingsCache()

    return { settings, message: "Markdown 表情已保存", revalidatePaths: ["/", "/write", "/admin"] }
  }

  if (section === "site-footer-links") {
    const footerLinks = normalizeFooterLinks(body.footerLinks)
    const settings = await prisma.siteSetting.update({
      where: { id: existing.id },
      data: {
        footerLinksJson: JSON.stringify(footerLinks),
      },
    })

    invalidateSiteSettingsCache()

    return { settings, message: "页脚导航已保存" }
  }

  if (section === "site-registration") {
    const inviteRewardInviter = Math.max(0, readOptionalNumberField(body, "inviteRewardInviter") ?? 0)
    const inviteRewardInvitee = Math.max(0, readOptionalNumberField(body, "inviteRewardInvitee") ?? 0)
    const registrationEnabled = Boolean(body.registrationEnabled)
    const registrationRequireInviteCode = Boolean(body.registrationRequireInviteCode)
    const registerInviteCodeEnabled = Boolean(body.registerInviteCodeEnabled)
    const inviteCodePurchaseEnabled = Boolean(body.inviteCodePurchaseEnabled)
    const registerCaptchaMode = normalizeCaptchaMode(body.registerCaptchaMode)
    const loginCaptchaMode = normalizeCaptchaMode(body.loginCaptchaMode)
    const turnstileSiteKey = readOptionalStringField(body, "turnstileSiteKey") || null
    const registerEmailEnabled = Boolean(body.registerEmailEnabled)
    const registerEmailRequired = registerEmailEnabled && Boolean(body.registerEmailRequired)
    const registerEmailVerification = registerEmailEnabled && Boolean(body.registerEmailVerification)
    const registerPhoneEnabled = Boolean(body.registerPhoneEnabled)
    const registerPhoneRequired = registerPhoneEnabled && Boolean(body.registerPhoneRequired)
    const registerPhoneVerification = registerPhoneEnabled && Boolean(body.registerPhoneVerification)
    const registerNicknameEnabled = Boolean(body.registerNicknameEnabled)
    const registerNicknameRequired = registerNicknameEnabled && Boolean(body.registerNicknameRequired)
    const registerGenderEnabled = Boolean(body.registerGenderEnabled)
    const registerGenderRequired = registerGenderEnabled && Boolean(body.registerGenderRequired)
    const registerInviterEnabled = Boolean(body.registerInviterEnabled)
    const smtpEnabled = Boolean(body.smtpEnabled)
    const smtpHost = readOptionalStringField(body, "smtpHost") || null
    const smtpPortRaw = readOptionalNumberField(body, "smtpPort") ?? 0
    const smtpPort = smtpPortRaw > 0 ? smtpPortRaw : null
    const smtpUser = readOptionalStringField(body, "smtpUser") || null
    const smtpPass = readOptionalStringField(body, "smtpPass") || null
    const smtpFrom = readOptionalStringField(body, "smtpFrom") || null
    const smtpSecure = Boolean(body.smtpSecure)

    if (registrationRequireInviteCode && !registerInviteCodeEnabled) {
      apiError(400, "注册要求必须填写邀请码时，不能关闭邀请码输入框显示")
    }

    if ((registerCaptchaMode === "TURNSTILE" || loginCaptchaMode === "TURNSTILE") && !turnstileSiteKey) {
      apiError(400, "启用 Turnstile 验证码时，必须填写 Turnstile Site Key")
    }

    if (smtpEnabled && (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom)) {
      apiError(400, "开启 SMTP 时请完整填写主机、端口、账号、密码和发件人地址")
    }

    const settings = await prisma.siteSetting.update({
      where: { id: existing.id },
      data: {
        inviteRewardInviter,
        inviteRewardInvitee,
        registrationEnabled,
        registrationRequireInviteCode,
        registerInviteCodeEnabled,
        inviteCodePurchaseEnabled,
        registerCaptchaMode,
        loginCaptchaMode,
        turnstileSiteKey: registerCaptchaMode === "TURNSTILE" || loginCaptchaMode === "TURNSTILE" ? turnstileSiteKey : null,
        registerEmailEnabled,
        registerEmailRequired,
        registerEmailVerification,
        registerPhoneEnabled,
        registerPhoneRequired,
        registerPhoneVerification,
        registerNicknameEnabled,
        registerNicknameRequired,
        registerGenderEnabled,
        registerGenderRequired,
        registerInviterEnabled,
        smtpEnabled,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
        smtpFrom,
        smtpSecure,
      },
    })

    invalidateSiteSettingsCache()

    return { settings, message: "注册与邀请设置已保存" }
  }

  if (section === "site-interaction") {
    const tippingEnabled = Boolean(body.tippingEnabled)
    const tippingDailyLimit = Math.max(1, readOptionalNumberField(body, "tippingDailyLimit") ?? 1)
    const tippingPerPostLimit = Math.max(1, readOptionalNumberField(body, "tippingPerPostLimit") ?? 1)
    const tippingAmounts = normalizeTippingAmounts(body.tippingAmounts)
    const existingTippingGifts = await listActiveGiftDefinitions()
    const tippingGifts = normalizeTippingGiftItems(
      body.tippingGifts,
      existingTippingGifts.length > 0 ? existingTippingGifts : getDefaultTippingGiftItemsFromAmounts(tippingAmounts),
    )
    const postRedPacketEnabled = Boolean(body.postRedPacketEnabled)
    const postRedPacketMaxPoints = Math.max(1, readOptionalNumberField(body, "postRedPacketMaxPoints") ?? 1)
    const postRedPacketDailyLimit = Math.max(1, readOptionalNumberField(body, "postRedPacketDailyLimit") ?? 1)
    const heatViewWeight = Math.max(0, readOptionalNumberField(body, "heatViewWeight") ?? 0)
    const heatCommentWeight = Math.max(0, readOptionalNumberField(body, "heatCommentWeight") ?? 0)
    const heatLikeWeight = Math.max(0, readOptionalNumberField(body, "heatLikeWeight") ?? 0)
    const heatTipCountWeight = Math.max(0, readOptionalNumberField(body, "heatTipCountWeight") ?? 0)
    const heatTipPointsWeight = Math.max(0, readOptionalNumberField(body, "heatTipPointsWeight") ?? 0)
    const heatStageThresholds = normalizeHeatThresholds(body.heatStageThresholds)
    const heatStageColors = normalizeHeatColors(body.heatStageColors)

    if (tippingEnabled && tippingAmounts.length === 0) {
      apiError(400, "开启打赏后，至少配置一个积分打赏档位")
    }

    if (postRedPacketEnabled && postRedPacketDailyLimit < postRedPacketMaxPoints) {
      apiError(400, "每日发红包积分上限不能小于单个红包上限")
    }

    if (heatStageThresholds.length !== 9) {
      apiError(400, "帖子热度阈值必须配置 9 段数值")
    }

    if (heatStageColors.length !== 9) {
      apiError(400, "帖子热度颜色必须配置 9 段颜色")
    }

    const settings = await prisma.$transaction(async (tx) => {
      const nextSettings = await tx.siteSetting.update({
        where: { id: existing.id },
        data: {
          tippingEnabled,
          tippingDailyLimit,
          tippingPerPostLimit,
          tippingAmounts: tippingAmounts.join(","),
          postRedPacketEnabled,
          postRedPacketMaxPoints,
          postRedPacketDailyLimit,
          heatViewWeight,
          heatCommentWeight,
          heatLikeWeight,
          heatTipCountWeight,
          heatTipPointsWeight,
          heatStageThresholds: heatStageThresholds.join(","),
          heatStageColors: heatStageColors.join(","),
        },
      })

      await syncGiftDefinitions(tippingGifts, tx)

      return nextSettings
    })

    invalidateSiteSettingsCache()

    return { settings, message: "互动与热度设置已保存" }
  }

  if (section === "site-friend-links") {
    const friendLinksEnabled = Boolean(body.friendLinksEnabled)
    const friendLinkApplicationEnabled = Boolean(body.friendLinkApplicationEnabled)
    const friendLinkAnnouncement = readOptionalStringField(body, "friendLinkAnnouncement")

    const settings = await prisma.siteSetting.update({
      where: { id: existing.id },
      data: {
        friendLinksEnabled,
        friendLinkApplicationEnabled,
        friendLinkAnnouncement: friendLinkAnnouncement || "欢迎与本站交换友情链接，请先添加我方链接后再提交申请，我们会在 1-3 个工作日内完成审核。",
      },
    })

    invalidateSiteSettingsCache()

    return { settings, message: "友情链接设置已保存" }
  }

  if (section === "vip") {
    const pointName = readOptionalStringField(body, "pointName")
    const checkInEnabled = body.checkInEnabled === undefined ? existing.checkInEnabled : Boolean(body.checkInEnabled)
    const checkInReward = Math.max(0, readOptionalNumberField(body, "checkInReward") ?? existing.checkInReward ?? 0)
    const checkInVip1Reward = Math.max(0, readOptionalNumberField(body, "checkInVip1Reward") ?? checkInReward)
    const checkInVip2Reward = Math.max(0, readOptionalNumberField(body, "checkInVip2Reward") ?? checkInReward)
    const checkInVip3Reward = Math.max(0, readOptionalNumberField(body, "checkInVip3Reward") ?? checkInReward)
    const checkInMakeUpCardPrice = Math.max(0, readOptionalNumberField(body, "checkInMakeUpCardPrice") ?? existing.checkInMakeUpCardPrice ?? 0)
    const legacyVipMakeUpCardPrice = Math.max(0, readOptionalNumberField(body, "checkInVipMakeUpCardPrice") ?? existing.checkInVipMakeUpCardPrice ?? 0)
    const checkInVip1MakeUpCardPrice = Math.max(0, readOptionalNumberField(body, "checkInVip1MakeUpCardPrice") ?? legacyVipMakeUpCardPrice)
    const checkInVip2MakeUpCardPrice = Math.max(0, readOptionalNumberField(body, "checkInVip2MakeUpCardPrice") ?? legacyVipMakeUpCardPrice)
    const checkInVip3MakeUpCardPrice = Math.max(0, readOptionalNumberField(body, "checkInVip3MakeUpCardPrice") ?? legacyVipMakeUpCardPrice)
    const checkInVipMakeUpCardPrice = Math.max(0, readOptionalNumberField(body, "checkInVipMakeUpCardPrice") ?? checkInVip1MakeUpCardPrice)
    const nicknameChangePointCost = Math.max(0, readOptionalNumberField(body, "nicknameChangePointCost") ?? existing.nicknameChangePointCost ?? 0)
    const nicknameChangeVip1PointCost = Math.max(0, readOptionalNumberField(body, "nicknameChangeVip1PointCost") ?? nicknameChangePointCost)
    const nicknameChangeVip2PointCost = Math.max(0, readOptionalNumberField(body, "nicknameChangeVip2PointCost") ?? nicknameChangePointCost)
    const nicknameChangeVip3PointCost = Math.max(0, readOptionalNumberField(body, "nicknameChangeVip3PointCost") ?? nicknameChangePointCost)
    const inviteCodePrice = Math.max(0, readOptionalNumberField(body, "inviteCodePrice") ?? existing.inviteCodePrice ?? 0)
    const inviteCodeVip1Price = Math.max(0, readOptionalNumberField(body, "inviteCodeVip1Price") ?? inviteCodePrice)
    const inviteCodeVip2Price = Math.max(0, readOptionalNumberField(body, "inviteCodeVip2Price") ?? inviteCodePrice)
    const inviteCodeVip3Price = Math.max(0, readOptionalNumberField(body, "inviteCodeVip3Price") ?? inviteCodePrice)
    const vipMonthlyPrice = Math.max(0, readOptionalNumberField(body, "vipMonthlyPrice") ?? 0)
    const vipQuarterlyPrice = Math.max(0, readOptionalNumberField(body, "vipQuarterlyPrice") ?? 0)
    const vipYearlyPrice = Math.max(0, readOptionalNumberField(body, "vipYearlyPrice") ?? 0)
    const postOfflinePrice = Math.max(0, readOptionalNumberField(body, "postOfflinePrice") ?? 0)
    const postOfflineVip1Price = Math.max(0, readOptionalNumberField(body, "postOfflineVip1Price") ?? 0)
    const postOfflineVip2Price = Math.max(0, readOptionalNumberField(body, "postOfflineVip2Price") ?? 0)
    const postOfflineVip3Price = Math.max(0, readOptionalNumberField(body, "postOfflineVip3Price") ?? 0)
    const vipLevelIcons = normalizeVipLevelIcons({
      vip1: readOptionalStringField(body, "vipLevelIconVip1"),
      vip2: readOptionalStringField(body, "vipLevelIconVip2"),
      vip3: readOptionalStringField(body, "vipLevelIconVip3"),
    })
    const appStateWithCheckInRewards = mergeCheckInRewardSettings(existing.appStateJson, {
      vip1: checkInVip1Reward,
      vip2: checkInVip2Reward,
      vip3: checkInVip3Reward,
    })
    const appStateWithCheckInPrices = mergeCheckInMakeUpPriceSettings(appStateWithCheckInRewards, {
      vip1: checkInVip1MakeUpCardPrice,
      vip2: checkInVip2MakeUpCardPrice,
      vip3: checkInVip3MakeUpCardPrice,
    })
    const appStateWithNicknamePointCosts = mergeNicknameChangePointCostSettings(appStateWithCheckInPrices, {
      vip1: nicknameChangeVip1PointCost,
      vip2: nicknameChangeVip2PointCost,
      vip3: nicknameChangeVip3PointCost,
    })
    const appStateJson = mergeInviteCodePurchasePriceSettings(appStateWithNicknamePointCosts, {
      vip1: inviteCodeVip1Price,
      vip2: inviteCodeVip2Price,
      vip3: inviteCodeVip3Price,
    })
    const appStateWithVipLevelIcons = mergeVipLevelIconSettings(appStateJson, vipLevelIcons)

    if (existing.inviteCodePurchaseEnabled && inviteCodePrice < 1) {
      apiError(400, "开启积分购买邀请码时，普通用户价格必须大于 0")
    }

    const settings = await prisma.siteSetting.update({
      where: { id: existing.id },
      data: {
        pointName: pointName || "积分",
        checkInEnabled,
        checkInReward,
        checkInMakeUpCardPrice,
        checkInVipMakeUpCardPrice,
        nicknameChangePointCost,
        inviteCodePrice,
        appStateJson: appStateWithVipLevelIcons,
        vipMonthlyPrice,
        vipQuarterlyPrice,
        vipYearlyPrice,
        postOfflinePrice,
        postOfflineVip1Price,
        postOfflineVip2Price,
        postOfflineVip3Price,
      },
    })

    invalidateSiteSettingsCache()

    return { settings, message: "积分与VIP设置已保存" }
  }

  if (section === "upload") {
    const uploadProvider = readOptionalStringField(body, "uploadProvider") || "local"
    const uploadLocalPath = readOptionalStringField(body, "uploadLocalPath") || "uploads"
    const uploadBaseUrl = readOptionalStringField(body, "uploadBaseUrl") || null
    const uploadOssBucket = readOptionalStringField(body, "uploadOssBucket") || null
    const uploadOssRegion = readOptionalStringField(body, "uploadOssRegion") || null
    const uploadOssEndpoint = readOptionalStringField(body, "uploadOssEndpoint") || null
    const uploadRequireLogin = Boolean(body.uploadRequireLogin)
    const uploadAllowedImageTypes = Array.from(new Set(readOptionalStringField(body, "uploadAllowedImageTypes").split(/[，,\s]+/).map((item) => item.trim().toLowerCase().replace(/^\./, "")).filter(Boolean)))
    const uploadMaxFileSizeMb = normalizePositiveInteger(body.uploadMaxFileSizeMb, 5)
    const uploadAvatarMaxFileSizeMb = normalizePositiveInteger(body.uploadAvatarMaxFileSizeMb, 2)
    const existingMarkdownImageUploadSettings = resolveMarkdownImageUploadSettings({
      appStateJson: existing.appStateJson,
      enabledFallback: true,
    })
    const markdownImageUploadEnabled = body.markdownImageUploadEnabled === undefined
      ? existingMarkdownImageUploadSettings.enabled
      : Boolean(body.markdownImageUploadEnabled)

    if (uploadAllowedImageTypes.length === 0) {
      apiError(400, "请至少配置一种允许上传的图片格式")
    }

    if (uploadAvatarMaxFileSizeMb > uploadMaxFileSizeMb) {
      apiError(400, "头像上传大小限制不能大于通用上传大小限制")
    }

    const appStateJson = mergeMarkdownImageUploadSettings(existing.appStateJson, {
      enabled: markdownImageUploadEnabled,
    })

    const settings = await prisma.siteSetting.update({
      where: { id: existing.id },
      data: {
        uploadProvider,
        uploadLocalPath,
        uploadBaseUrl,
        uploadOssBucket,
        uploadOssRegion,
        uploadOssEndpoint,
        uploadRequireLogin,
        uploadAllowedImageTypes: uploadAllowedImageTypes.join(","),
        uploadMaxFileSizeMb,
        uploadAvatarMaxFileSizeMb,
        appStateJson,
      },
    })

    invalidateSiteSettingsCache()

    return { settings, message: "上传设置已保存" }
  }

  apiError(400, "不支持的设置分组")
}
