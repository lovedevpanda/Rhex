import { prisma } from "@/db/client"
import { apiError, readOptionalNumberField, readOptionalStringField, type JsonObject } from "@/lib/api-route"

import { normalizeMarkdownEmojiItems, serializeMarkdownEmojiItems } from "@/lib/markdown-emoji"
import { defaultSiteSettingsCreateInput } from "@/lib/site-settings-defaults"
import { normalizeCaptchaMode, normalizeFooterLinks } from "@/lib/shared/config-parsers"
import { normalizeHeatColors, normalizeHeatThresholds, normalizePositiveInteger, normalizeTippingAmounts } from "@/lib/shared/normalizers"
import { createSiteSettingsRecordWithFullData } from "@/db/site-settings-write-queries"

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
    const pointName = readOptionalStringField(body, "pointName")
    const analyticsCode = readOptionalStringField(body, "analyticsCode")
    const checkInEnabled = Boolean(body.checkInEnabled)
    const checkInReward = Math.max(0, readOptionalNumberField(body, "checkInReward") ?? 0)
    const checkInMakeUpCardPrice = Math.max(0, readOptionalNumberField(body, "checkInMakeUpCardPrice") ?? 0)
    const checkInVipMakeUpCardPrice = Math.max(0, readOptionalNumberField(body, "checkInVipMakeUpCardPrice") ?? 0)
    const nicknameChangePointCost = Math.max(0, readOptionalNumberField(body, "nicknameChangePointCost") ?? 0)

    if (!siteName || !siteDescription) {
      apiError(400, "站点名称和描述不能为空")
    }

    const settings = await prisma.siteSetting.update({
      where: { id: existing.id },
      data: {
        siteName,
        siteSlogan,
        siteDescription,
        siteLogoText: siteLogoText || siteName,
        siteLogoPath: siteLogoPath || null,
        siteSeoKeywords,
        pointName: pointName || "积分",
        analyticsCode: analyticsCode || null,
        checkInEnabled,
        checkInReward,
        checkInMakeUpCardPrice,
        checkInVipMakeUpCardPrice,
        nicknameChangePointCost,
      },
    })

    return { settings, message: "基础信息已保存", revalidatePaths: ["/", "/write", "/admin"] }
  }

  if (section === "site-markdown-emoji") {
    const markdownEmojiMap = normalizeMarkdownEmojiItems(body.markdownEmojiMap)
    const markdownEmojiMapJson = serializeMarkdownEmojiItems(markdownEmojiMap)

    await prisma.$executeRaw`
      UPDATE "SiteSetting"
      SET "markdownEmojiMapJson" = ${markdownEmojiMapJson},
          "updatedAt" = NOW()
      WHERE "id" = ${existing.id}
    `

    return { settings: undefined, message: "Markdown 表情已保存", revalidatePaths: ["/", "/write", "/admin"] }
  }

  if (section === "site-footer-links") {
    const footerLinks = normalizeFooterLinks(body.footerLinks)
    const settings = await prisma.siteSetting.update({
      where: { id: existing.id },
      data: {
        footerLinksJson: JSON.stringify(footerLinks),
      },
    })

    return { settings, message: "页脚导航已保存" }
  }

  if (section === "site-registration") {
    const inviteRewardInviter = Math.max(0, readOptionalNumberField(body, "inviteRewardInviter") ?? 0)
    const inviteRewardInvitee = Math.max(0, readOptionalNumberField(body, "inviteRewardInvitee") ?? 0)
    const registrationEnabled = Boolean(body.registrationEnabled)
    const registrationRequireInviteCode = Boolean(body.registrationRequireInviteCode)
    const registerInviteCodeEnabled = Boolean(body.registerInviteCodeEnabled)
    const inviteCodePurchaseEnabled = Boolean(body.inviteCodePurchaseEnabled)
    const inviteCodePrice = Math.max(0, readOptionalNumberField(body, "inviteCodePrice") ?? 0)
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

    if (inviteCodePurchaseEnabled && inviteCodePrice < 1) {
      apiError(400, "开启积分购买邀请码时，价格必须大于 0")
    }

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
        inviteCodePrice,
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

    return { settings, message: "注册与邀请设置已保存" }
  }

  if (section === "site-interaction") {
    const tippingEnabled = Boolean(body.tippingEnabled)
    const tippingDailyLimit = Math.max(1, readOptionalNumberField(body, "tippingDailyLimit") ?? 1)
    const tippingPerPostLimit = Math.max(1, readOptionalNumberField(body, "tippingPerPostLimit") ?? 1)
    const tippingAmounts = normalizeTippingAmounts(body.tippingAmounts)
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
      apiError(400, "开启打赏后，至少配置一个固定打赏金额")
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

    const settings = await prisma.siteSetting.update({
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

    return { settings, message: "友情链接设置已保存" }
  }

  if (section === "vip") {
    const vipMonthlyPrice = Math.max(0, readOptionalNumberField(body, "vipMonthlyPrice") ?? 0)
    const vipQuarterlyPrice = Math.max(0, readOptionalNumberField(body, "vipQuarterlyPrice") ?? 0)
    const vipYearlyPrice = Math.max(0, readOptionalNumberField(body, "vipYearlyPrice") ?? 0)
    const postOfflinePrice = Math.max(0, readOptionalNumberField(body, "postOfflinePrice") ?? 0)
    const postOfflineVip1Price = Math.max(0, readOptionalNumberField(body, "postOfflineVip1Price") ?? 0)
    const postOfflineVip2Price = Math.max(0, readOptionalNumberField(body, "postOfflineVip2Price") ?? 0)
    const postOfflineVip3Price = Math.max(0, readOptionalNumberField(body, "postOfflineVip3Price") ?? 0)

    const settings = await prisma.siteSetting.update({
      where: { id: existing.id },
      data: {
        vipMonthlyPrice,
        vipQuarterlyPrice,
        vipYearlyPrice,
        postOfflinePrice,
        postOfflineVip1Price,
        postOfflineVip2Price,
        postOfflineVip3Price,
      },
    })

    return { settings, message: "VIP设置已保存" }
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

    if (uploadAllowedImageTypes.length === 0) {
      apiError(400, "请至少配置一种允许上传的图片格式")
    }

    if (uploadAvatarMaxFileSizeMb > uploadMaxFileSizeMb) {
      apiError(400, "头像上传大小限制不能大于通用上传大小限制")
    }

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
      },
    })

    return { settings, message: "上传设置已保存" }
  }

  apiError(400, "不支持的设置分组")
}
