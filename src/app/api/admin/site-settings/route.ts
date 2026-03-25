import { NextResponse } from "next/server"

import { requireAdminUser } from "@/lib/admin"
import { prisma } from "@/db/client"
import {
  normalizeCaptchaMode,
  normalizeFooterLinks,
} from "@/lib/shared/config-parsers"
import { defaultSiteSettingsCreateInput } from "@/lib/site-settings-defaults"
import {
  normalizeHeatColors,
  normalizeHeatThresholds,
  normalizeTippingAmounts,
} from "@/lib/shared/normalizers"

async function getOrCreateSettings() {
  const existing = await prisma.siteSetting.findFirst({ orderBy: { createdAt: "asc" } })

  if (existing) {
    return existing
  }

  return prisma.siteSetting.create({
    data: defaultSiteSettingsCreateInput,
  })
}

export async function GET() {
  const admin = await requireAdminUser()

  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权访问" }, { status: 403 })
  }

  const settings = await getOrCreateSettings()
  return NextResponse.json({ code: 0, data: settings })
}

export async function POST(request: Request) {
  const admin = await requireAdminUser()

  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权操作" }, { status: 403 })
  }

  const body = await request.json()
  const section = String(body.section ?? "site-profile")
  const existing = await getOrCreateSettings()

  if (section === "site-profile") {
    const siteName = String(body.siteName ?? "").trim()
    const siteSlogan = String(body.siteSlogan ?? "").trim()
    const siteDescription = String(body.siteDescription ?? "").trim()
    const siteLogoText = String(body.siteLogoText ?? "").trim()
    const siteLogoPath = String(body.siteLogoPath ?? "").trim()
    const siteSeoKeywords = String(body.siteSeoKeywords ?? "").split(/[，,\n]+/).map((item) => item.trim()).filter(Boolean).join(",")
    const pointName = String(body.pointName ?? "").trim()
    const analyticsCode = typeof body.analyticsCode === "string" ? body.analyticsCode : ""
    const checkInEnabled = Boolean(body.checkInEnabled)
    const checkInReward = Math.max(0, Number(body.checkInReward ?? 0) || 0)
    const checkInMakeUpCardPrice = Math.max(0, Number(body.checkInMakeUpCardPrice ?? 0) || 0)
    const checkInVipMakeUpCardPrice = Math.max(0, Number(body.checkInVipMakeUpCardPrice ?? 0) || 0)
    const nicknameChangePointCost = Math.max(0, Number(body.nicknameChangePointCost ?? 0) || 0)

    if (!siteName || !siteDescription) {
      return NextResponse.json({ code: 400, message: "站点名称和描述不能为空" }, { status: 400 })
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
        analyticsCode: analyticsCode.trim() || null,
        checkInEnabled,
        checkInReward,
        checkInMakeUpCardPrice,
        checkInVipMakeUpCardPrice,
        nicknameChangePointCost,
      },
    })

    return NextResponse.json({ code: 0, message: "基础信息已保存", data: settings })
  }

  if (section === "site-footer-links") {
    const footerLinks = normalizeFooterLinks(body.footerLinks)

    const settings = await prisma.siteSetting.update({
      where: { id: existing.id },
      data: {
        footerLinksJson: JSON.stringify(footerLinks),
      },
    })

    return NextResponse.json({ code: 0, message: "页脚导航已保存", data: settings })
  }

  if (section === "site-registration") {
    const inviteRewardInviter = Math.max(0, Number(body.inviteRewardInviter ?? 0) || 0)
    const inviteRewardInvitee = Math.max(0, Number(body.inviteRewardInvitee ?? 0) || 0)
    const registrationEnabled = Boolean(body.registrationEnabled)
    const registrationRequireInviteCode = Boolean(body.registrationRequireInviteCode)
    const registerInviteCodeEnabled = Boolean(body.registerInviteCodeEnabled)
    const inviteCodePurchaseEnabled = Boolean(body.inviteCodePurchaseEnabled)
    const inviteCodePrice = Math.max(0, Number(body.inviteCodePrice ?? 0) || 0)
    const registerCaptchaMode = normalizeCaptchaMode(body.registerCaptchaMode)
    const loginCaptchaMode = normalizeCaptchaMode(body.loginCaptchaMode)
    const turnstileSiteKey = String(body.turnstileSiteKey ?? "").trim() || null
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
    const smtpHost = String(body.smtpHost ?? "").trim() || null
    const smtpPortRaw = Number(body.smtpPort ?? 0) || 0
    const smtpPort = smtpPortRaw > 0 ? smtpPortRaw : null
    const smtpUser = String(body.smtpUser ?? "").trim() || null
    const smtpPass = String(body.smtpPass ?? "").trim() || null
    const smtpFrom = String(body.smtpFrom ?? "").trim() || null
    const smtpSecure = Boolean(body.smtpSecure)

    if (inviteCodePurchaseEnabled && inviteCodePrice < 1) {
      return NextResponse.json({ code: 400, message: "开启积分购买邀请码时，价格必须大于 0" }, { status: 400 })
    }

    if (registrationRequireInviteCode && !registerInviteCodeEnabled) {
      return NextResponse.json({ code: 400, message: "注册要求必须填写邀请码时，不能关闭邀请码输入框显示" }, { status: 400 })
    }

    if ((registerCaptchaMode === "TURNSTILE" || loginCaptchaMode === "TURNSTILE") && !turnstileSiteKey) {
      return NextResponse.json({ code: 400, message: "启用 Turnstile 验证码时，必须填写 Turnstile Site Key" }, { status: 400 })
    }

    if (smtpEnabled && (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom)) {
      return NextResponse.json({ code: 400, message: "开启 SMTP 时请完整填写主机、端口、账号、密码和发件人地址" }, { status: 400 })
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

    return NextResponse.json({ code: 0, message: "注册与邀请设置已保存", data: settings })
  }

  if (section === "site-interaction") {
    const tippingEnabled = Boolean(body.tippingEnabled)
    const tippingDailyLimit = Math.max(1, Number(body.tippingDailyLimit ?? 1) || 1)
    const tippingPerPostLimit = Math.max(1, Number(body.tippingPerPostLimit ?? 1) || 1)
    const tippingAmounts = normalizeTippingAmounts(body.tippingAmounts)
    const heatViewWeight = Math.max(0, Number(body.heatViewWeight ?? 0) || 0)
    const heatCommentWeight = Math.max(0, Number(body.heatCommentWeight ?? 0) || 0)
    const heatLikeWeight = Math.max(0, Number(body.heatLikeWeight ?? 0) || 0)
    const heatTipCountWeight = Math.max(0, Number(body.heatTipCountWeight ?? 0) || 0)
    const heatTipPointsWeight = Math.max(0, Number(body.heatTipPointsWeight ?? 0) || 0)
    const heatStageThresholds = normalizeHeatThresholds(body.heatStageThresholds)
    const heatStageColors = normalizeHeatColors(body.heatStageColors)

    if (tippingEnabled && tippingAmounts.length === 0) {
      return NextResponse.json({ code: 400, message: "开启打赏后，至少配置一个固定打赏金额" }, { status: 400 })
    }

    if (heatStageThresholds.length !== 9) {
      return NextResponse.json({ code: 400, message: "帖子热度阈值必须配置 9 段数值" }, { status: 400 })
    }

    if (heatStageColors.length !== 9) {
      return NextResponse.json({ code: 400, message: "帖子热度颜色必须配置 9 段颜色" }, { status: 400 })
    }

    const settings = await prisma.siteSetting.update({
      where: { id: existing.id },
      data: {
        tippingEnabled,
        tippingDailyLimit,
        tippingPerPostLimit,
        tippingAmounts: tippingAmounts.join(","),
        heatViewWeight,
        heatCommentWeight,
        heatLikeWeight,
        heatTipCountWeight,
        heatTipPointsWeight,
        heatStageThresholds: heatStageThresholds.join(","),
        heatStageColors: heatStageColors.join(","),
      },
    })

    return NextResponse.json({ code: 0, message: "互动与热度设置已保存", data: settings })
  }

  if (section === "site-friend-links") {
    const friendLinksEnabled = Boolean(body.friendLinksEnabled)
    const friendLinkApplicationEnabled = Boolean(body.friendLinkApplicationEnabled)
    const friendLinkAnnouncement = String(body.friendLinkAnnouncement ?? "").trim()

    const settings = await prisma.siteSetting.update({
      where: { id: existing.id },
      data: {
        friendLinksEnabled,
        friendLinkApplicationEnabled,
        friendLinkAnnouncement: friendLinkAnnouncement || "欢迎与本站交换友情链接，请先添加我方链接后再提交申请，我们会在 1-3 个工作日内完成审核。",
      },
    })

    return NextResponse.json({ code: 0, message: "友情链接设置已保存", data: settings })
  }

  if (section === "vip") {
    const vipMonthlyPrice = Number(body.vipMonthlyPrice ?? 0) || 0
    const vipQuarterlyPrice = Number(body.vipQuarterlyPrice ?? 0) || 0
    const vipYearlyPrice = Number(body.vipYearlyPrice ?? 0) || 0

    const settings = await prisma.siteSetting.update({
      where: { id: existing.id },
      data: {
        vipMonthlyPrice,
        vipQuarterlyPrice,
        vipYearlyPrice,
      },
    })

    return NextResponse.json({ code: 0, message: "VIP设置已保存", data: settings })
  }

  if (section === "upload") {
    const uploadProvider = String(body.uploadProvider ?? "local").trim() || "local"
    const uploadLocalPath = String(body.uploadLocalPath ?? "uploads").trim() || "uploads"
    const uploadBaseUrl = String(body.uploadBaseUrl ?? "").trim() || null
    const uploadOssBucket = String(body.uploadOssBucket ?? "").trim() || null
    const uploadOssRegion = String(body.uploadOssRegion ?? "").trim() || null
    const uploadOssEndpoint = String(body.uploadOssEndpoint ?? "").trim() || null
    const uploadRequireLogin = Boolean(body.uploadRequireLogin)
    const uploadAllowedImageTypes = Array.from(
      new Set(
        String(body.uploadAllowedImageTypes ?? "")
          .split(/[，,\s]+/)
          .map((item) => item.trim().toLowerCase().replace(/^\./, ""))
          .filter(Boolean),
      ),
    )
    const uploadMaxFileSizeMb = Math.max(1, Number(body.uploadMaxFileSizeMb ?? 5) || 5)
    const uploadAvatarMaxFileSizeMb = Math.max(1, Number(body.uploadAvatarMaxFileSizeMb ?? 2) || 2)

    if (uploadAllowedImageTypes.length === 0) {
      return NextResponse.json({ code: 400, message: "请至少配置一种允许上传的图片格式" }, { status: 400 })
    }

    if (uploadAvatarMaxFileSizeMb > uploadMaxFileSizeMb) {
      return NextResponse.json({ code: 400, message: "头像上传大小限制不能大于通用上传大小限制" }, { status: 400 })
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

    return NextResponse.json({ code: 0, message: "上传设置已保存", data: settings })
  }

  return NextResponse.json({ code: 400, message: "不支持的设置分组" }, { status: 400 })
}
