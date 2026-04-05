import { updateSiteSettingsRecord } from "@/db/site-settings-write-queries"
import { apiError, readOptionalNumberField, readOptionalStringField, type JsonObject } from "@/lib/api-route"
import { finalizeSiteSettingsUpdate, type SiteSettingsRecord } from "@/lib/admin-site-settings-shared"
import {
  mergeAvatarChangePointCostSettings,
  mergeCheckInMakeUpPriceSettings,
  mergeCheckInRewardSettings,
  mergeIntroductionChangePointCostSettings,
  mergeInviteCodePurchasePriceSettings,
  mergeNicknameChangePointCostSettings,
  mergeVipLevelIconSettings,
  resolveAvatarChangePointCostSettings,
  resolveIntroductionChangePointCostSettings,
} from "@/lib/site-settings-app-state"
import { normalizeVipLevelIcons } from "@/lib/vip-level-icons"

export async function updateVipSiteSettingsSection(existing: SiteSettingsRecord, body: JsonObject, section: string) {
  if (section !== "vip") {
    return null
  }

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
  const appStateWithVipLevelIcons = mergeVipLevelIconSettings(appStateJson, vipLevelIcons)

  if (existing.inviteCodePurchaseEnabled && inviteCodePrice < 1) {
    apiError(400, "开启积分购买邀请码时，普通用户价格必须大于 0")
  }

  const settings = await updateSiteSettingsRecord(existing.id, {
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
  })

  return finalizeSiteSettingsUpdate({
    settings,
    message: "积分与VIP设置已保存",
  })
}

