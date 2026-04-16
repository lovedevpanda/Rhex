import { updateSiteSettingsRecord } from "@/db/site-settings-write-queries"
import { apiError, readOptionalNumberField, readOptionalStringField, type JsonObject } from "@/lib/api-route"
import { normalizeCheckInMakeUpOldestDayLimit } from "@/lib/check-in-policy"
import { finalizeSiteSettingsUpdate, type SiteSettingsRecord } from "@/lib/admin-site-settings-shared"
import { enqueueRefreshAllUserCheckInStreakSummaries } from "@/lib/check-in-streak-service"
import {
  mergeAvatarChangePointCostSettings,
  mergeCheckInMakeUpPriceSettings,
  mergeCheckInRewardSettings,
  mergeCheckInStreakSettings,
  mergeIntroductionChangePointCostSettings,
  mergeInviteCodePurchasePriceSettings,
  mergeNicknameChangePointCostSettings,
  mergeVipNameColorSettings,
  resolveCheckInStreakSettings,
  mergeVipLevelIconSettings,
  resolveAvatarChangePointCostSettings,
  resolveIntroductionChangePointCostSettings,
  resolveVipNameColorSettings,
} from "@/lib/site-settings-app-state"
import { normalizeVipNameColors } from "@/lib/vip-name-colors"
import { normalizeVipLevelIcons } from "@/lib/vip-level-icons"

function isSupportedRedeemCodeHelpUrl(value: string) {
  return value.startsWith("/") || /^https?:\/\//i.test(value)
}

function parseSiteSettingsAppState(raw: string | null | undefined) {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {}
    }

    const siteSettingsState = (parsed as Record<string, unknown>).__siteSettings
    return siteSettingsState && typeof siteSettingsState === "object" && !Array.isArray(siteSettingsState)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

function resolveRedeemCodeHelpSettingsFromAppState(appStateJson?: string | null) {
  const root = parseSiteSettingsAppState(appStateJson)
  const siteSettingsState = root.__siteSettings
  const normalizedState = siteSettingsState && typeof siteSettingsState === "object" && !Array.isArray(siteSettingsState)
    ? siteSettingsState as Record<string, unknown>
    : {}
  const redeemCodeHelp = normalizedState.redeemCodeHelp
  const normalizedHelp = redeemCodeHelp && typeof redeemCodeHelp === "object" && !Array.isArray(redeemCodeHelp)
    ? redeemCodeHelp as Record<string, unknown>
    : {}

  return {
    enabled: typeof normalizedHelp.enabled === "boolean" ? normalizedHelp.enabled : false,
    title: typeof normalizedHelp.title === "string" ? normalizedHelp.title.trim() : "",
    url: typeof normalizedHelp.url === "string" ? normalizedHelp.url.trim() : "",
  }
}

function mergeRedeemCodeHelpSettingsIntoAppState(
  appStateJson: string | null | undefined,
  input: { enabled: boolean; title: string; url: string },
) {
  const root = parseSiteSettingsAppState(appStateJson)
  const siteSettingsState = root.__siteSettings && typeof root.__siteSettings === "object" && !Array.isArray(root.__siteSettings)
    ? root.__siteSettings as Record<string, unknown>
    : {}

  root.__siteSettings = {
    ...siteSettingsState,
    redeemCodeHelp: {
      enabled: Boolean(input.enabled),
      title: input.title.trim(),
      url: input.url.trim(),
    },
  }

  return JSON.stringify(root)
}

export async function updateVipSiteSettingsSection(existing: SiteSettingsRecord, body: JsonObject, section: string) {
  if (section !== "vip") {
    return null
  }

  const pointName = readOptionalStringField(body, "pointName")
  const existingRedeemCodeHelpSettings = resolveRedeemCodeHelpSettingsFromAppState(existing.appStateJson)
  const redeemCodeHelpEnabled = Boolean(body.redeemCodeHelpEnabled)
  const redeemCodeHelpTitle = "redeemCodeHelpTitle" in body
    ? readOptionalStringField(body, "redeemCodeHelpTitle")
    : existingRedeemCodeHelpSettings.title
  const redeemCodeHelpUrl = "redeemCodeHelpUrl" in body
    ? readOptionalStringField(body, "redeemCodeHelpUrl")
    : existingRedeemCodeHelpSettings.url
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
  const existingCheckInStreakSettings = resolveCheckInStreakSettings({
    appStateJson: existing.appStateJson,
    enabledFallback: true,
    makeUpCountsTowardStreakFallback: true,
    oldestDayLimitFallback: 0,
  })
  const checkInMakeUpEnabled = body.checkInMakeUpEnabled === undefined
    ? existingCheckInStreakSettings.enabled
    : Boolean(body.checkInMakeUpEnabled)
  const checkInMakeUpCountsTowardStreak = body.checkInMakeUpCountsTowardStreak === undefined
    ? existingCheckInStreakSettings.makeUpCountsTowardStreak
    : Boolean(body.checkInMakeUpCountsTowardStreak)
  const checkInMakeUpOldestDayLimit = normalizeCheckInMakeUpOldestDayLimit(
    readOptionalNumberField(body, "checkInMakeUpOldestDayLimit") ?? existingCheckInStreakSettings.oldestDayLimit,
  )
  const nicknameChangePointCost = Math.max(0, readOptionalNumberField(body, "nicknameChangePointCost") ?? existing.nicknameChangePointCost ?? 0)
  const nicknameChangeVip1PointCost = Math.max(0, readOptionalNumberField(body, "nicknameChangeVip1PointCost") ?? nicknameChangePointCost)
  const nicknameChangeVip2PointCost = Math.max(0, readOptionalNumberField(body, "nicknameChangeVip2PointCost") ?? nicknameChangePointCost)
  const nicknameChangeVip3PointCost = Math.max(0, readOptionalNumberField(body, "nicknameChangeVip3PointCost") ?? nicknameChangePointCost)
  const existingIntroductionChangePointCosts = resolveIntroductionChangePointCostSettings({
    appStateJson: existing.appStateJson,
    normalPrice: 0,
  })
  const introductionChangePointCost = Math.max(0, readOptionalNumberField(body, "introductionChangePointCost") ?? existingIntroductionChangePointCosts.normal)
  const introductionChangeVip1PointCost = Math.max(0, readOptionalNumberField(body, "introductionChangeVip1PointCost") ?? existingIntroductionChangePointCosts.vip1)
  const introductionChangeVip2PointCost = Math.max(0, readOptionalNumberField(body, "introductionChangeVip2PointCost") ?? existingIntroductionChangePointCosts.vip2)
  const introductionChangeVip3PointCost = Math.max(0, readOptionalNumberField(body, "introductionChangeVip3PointCost") ?? existingIntroductionChangePointCosts.vip3)
  const existingAvatarChangePointCosts = resolveAvatarChangePointCostSettings({
    appStateJson: existing.appStateJson,
    normalPrice: 0,
  })
  const avatarChangePointCost = Math.max(0, readOptionalNumberField(body, "avatarChangePointCost") ?? existingAvatarChangePointCosts.normal)
  const avatarChangeVip1PointCost = Math.max(0, readOptionalNumberField(body, "avatarChangeVip1PointCost") ?? existingAvatarChangePointCosts.vip1)
  const avatarChangeVip2PointCost = Math.max(0, readOptionalNumberField(body, "avatarChangeVip2PointCost") ?? existingAvatarChangePointCosts.vip2)
  const avatarChangeVip3PointCost = Math.max(0, readOptionalNumberField(body, "avatarChangeVip3PointCost") ?? existingAvatarChangePointCosts.vip3)
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
  const existingVipNameColors = resolveVipNameColorSettings({
    appStateJson: existing.appStateJson,
  })
  const vipNameColors = normalizeVipNameColors({
    normal: body.vipNameColorNormal === undefined ? existingVipNameColors.normal : readOptionalStringField(body, "vipNameColorNormal"),
    vip1: body.vipNameColorVip1 === undefined ? existingVipNameColors.vip1 : readOptionalStringField(body, "vipNameColorVip1"),
    vip2: body.vipNameColorVip2 === undefined ? existingVipNameColors.vip2 : readOptionalStringField(body, "vipNameColorVip2"),
    vip3: body.vipNameColorVip3 === undefined ? existingVipNameColors.vip3 : readOptionalStringField(body, "vipNameColorVip3"),
  }, existingVipNameColors)
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
  const appStateWithIntroductionPointCosts = mergeIntroductionChangePointCostSettings(appStateWithNicknamePointCosts, {
    normal: introductionChangePointCost,
    vip1: introductionChangeVip1PointCost,
    vip2: introductionChangeVip2PointCost,
    vip3: introductionChangeVip3PointCost,
  })
  const appStateWithAvatarPointCosts = mergeAvatarChangePointCostSettings(appStateWithIntroductionPointCosts, {
    normal: avatarChangePointCost,
    vip1: avatarChangeVip1PointCost,
    vip2: avatarChangeVip2PointCost,
    vip3: avatarChangeVip3PointCost,
  })
  const appStateJson = mergeInviteCodePurchasePriceSettings(appStateWithAvatarPointCosts, {
    vip1: inviteCodeVip1Price,
    vip2: inviteCodeVip2Price,
    vip3: inviteCodeVip3Price,
  })
  const appStateWithCheckInStreak = mergeCheckInStreakSettings(appStateJson, {
    enabled: checkInMakeUpEnabled,
    makeUpCountsTowardStreak: checkInMakeUpCountsTowardStreak,
    oldestDayLimit: checkInMakeUpOldestDayLimit,
  })
  const appStateWithVipLevelIcons = mergeVipLevelIconSettings(appStateWithCheckInStreak, vipLevelIcons)
  const appStateWithVipNameColors = mergeVipNameColorSettings(appStateWithVipLevelIcons, vipNameColors)

  if (existing.inviteCodePurchaseEnabled && inviteCodePrice < 1) {
    apiError(400, "开启积分购买邀请码时，普通用户价格必须大于 0")
  }

  if (redeemCodeHelpEnabled && !redeemCodeHelpTitle) {
    apiError(400, "开启兑换码入口链接时，必须填写链接文本")
  }

  if (redeemCodeHelpEnabled && !redeemCodeHelpUrl) {
    apiError(400, "开启兑换码入口链接时，必须填写链接地址")
  }

  if (redeemCodeHelpUrl && !isSupportedRedeemCodeHelpUrl(redeemCodeHelpUrl)) {
    apiError(400, "兑换码入口链接仅支持以 /、http:// 或 https:// 开头")
  }

  const appStateWithRedeemCodeHelp = mergeRedeemCodeHelpSettingsIntoAppState(appStateWithVipNameColors, {
    enabled: redeemCodeHelpEnabled,
    title: redeemCodeHelpTitle,
    url: redeemCodeHelpUrl,
  })

  const settings = await updateSiteSettingsRecord(existing.id, {
    pointName: pointName || "积分",
    checkInEnabled,
    checkInReward,
    checkInMakeUpCardPrice,
    checkInVipMakeUpCardPrice,
    nicknameChangePointCost,
    inviteCodePrice,
    appStateJson: appStateWithRedeemCodeHelp,
    vipMonthlyPrice,
    vipQuarterlyPrice,
    vipYearlyPrice,
    postOfflinePrice,
    postOfflineVip1Price,
    postOfflineVip2Price,
    postOfflineVip3Price,
  })

  if (existingCheckInStreakSettings.makeUpCountsTowardStreak !== checkInMakeUpCountsTowardStreak) {
    await enqueueRefreshAllUserCheckInStreakSummaries(checkInMakeUpCountsTowardStreak)
  }

  return finalizeSiteSettingsUpdate({
    settings,
    message: "积分与VIP设置已保存",
  })
}
