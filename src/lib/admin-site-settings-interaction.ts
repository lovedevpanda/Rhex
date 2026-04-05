import { listActiveGiftDefinitions } from "@/db/post-gift-queries"
import { updateSiteSettingsRecord, updateSiteSettingsRecordWithGiftDefinitions } from "@/db/site-settings-write-queries"
import { apiError, readOptionalNumberField, readOptionalStringField, type JsonObject } from "@/lib/api-route"
import { finalizeSiteSettingsUpdate, type SiteSettingsRecord } from "@/lib/admin-site-settings-shared"
import {
  mergeCommentAccessSettings,
  mergeInteractionGateSettings,
  mergePostJackpotSettings,
  resolvePostJackpotSettings,
} from "@/lib/site-settings-app-state"
import { normalizeHeatColors, normalizeHeatThresholds, normalizeTippingAmounts } from "@/lib/shared/normalizers"
import { getDefaultTippingGiftItemsFromAmounts, normalizeTippingGiftItems } from "@/lib/tipping-gifts"

export async function updateInteractionSiteSettingsSection(existing: SiteSettingsRecord, body: JsonObject, section: string) {
  if (section === "site-interaction") {
    const guestCanViewComments = body.guestCanViewComments === undefined ? true : Boolean(body.guestCanViewComments)
    const postCreateRequireEmailVerified = Boolean(body.postCreateRequireEmailVerified)
    const commentCreateRequireEmailVerified = Boolean(body.commentCreateRequireEmailVerified)
    const postCreateMinRegisteredMinutes = Math.max(0, readOptionalNumberField(body, "postCreateMinRegisteredMinutes") ?? 0)
    const commentCreateMinRegisteredMinutes = Math.max(0, readOptionalNumberField(body, "commentCreateMinRegisteredMinutes") ?? 0)
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
    const existingPostJackpotSettings = resolvePostJackpotSettings({
      appStateJson: existing.appStateJson,
      enabledFallback: false,
      minInitialPointsFallback: 100,
      maxInitialPointsFallback: 1000,
      replyIncrementPointsFallback: 25,
      hitProbabilityFallback: 15,
    })
    const postJackpotEnabled = body.postJackpotEnabled === undefined
      ? existingPostJackpotSettings.enabled
      : Boolean(body.postJackpotEnabled)
    const postJackpotMinInitialPoints = Math.max(1, readOptionalNumberField(body, "postJackpotMinInitialPoints") ?? existingPostJackpotSettings.minInitialPoints)
    const postJackpotMaxInitialPoints = Math.max(postJackpotMinInitialPoints, readOptionalNumberField(body, "postJackpotMaxInitialPoints") ?? existingPostJackpotSettings.maxInitialPoints)
    const postJackpotReplyIncrementPoints = Math.max(1, readOptionalNumberField(body, "postJackpotReplyIncrementPoints") ?? existingPostJackpotSettings.replyIncrementPoints)
    const postJackpotHitProbability = Math.min(100, Math.max(1, readOptionalNumberField(body, "postJackpotHitProbability") ?? existingPostJackpotSettings.hitProbability))
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

    const appStateWithCommentAccess = mergeCommentAccessSettings(existing.appStateJson, {
      guestCanView: guestCanViewComments,
    })

    const appStateWithInteractionGates = mergeInteractionGateSettings(appStateWithCommentAccess, {
      version: 1,
      actions: {
        POST_CREATE: {
          enabled: postCreateRequireEmailVerified || postCreateMinRegisteredMinutes > 0,
          conditions: [
            ...(postCreateRequireEmailVerified ? [{ type: "EMAIL_VERIFIED", enabled: true } as const] : []),
            ...(postCreateMinRegisteredMinutes > 0 ? [{ type: "REGISTERED_MINUTES", value: postCreateMinRegisteredMinutes } as const] : []),
          ],
        },
        COMMENT_CREATE: {
          enabled: commentCreateRequireEmailVerified || commentCreateMinRegisteredMinutes > 0,
          conditions: [
            ...(commentCreateRequireEmailVerified ? [{ type: "EMAIL_VERIFIED", enabled: true } as const] : []),
            ...(commentCreateMinRegisteredMinutes > 0 ? [{ type: "REGISTERED_MINUTES", value: commentCreateMinRegisteredMinutes } as const] : []),
          ],
        },
      },
    })

    const appStateJson = mergePostJackpotSettings(appStateWithInteractionGates, {
      enabled: postJackpotEnabled,
      minInitialPoints: postJackpotMinInitialPoints,
      maxInitialPoints: postJackpotMaxInitialPoints,
      replyIncrementPoints: postJackpotReplyIncrementPoints,
      hitProbability: postJackpotHitProbability,
    })

    if (heatStageThresholds.length !== 9) {
      apiError(400, "帖子热度阈值必须配置 9 段数值")
    }

    if (heatStageColors.length !== 9) {
      apiError(400, "帖子热度颜色必须配置 9 段颜色")
    }

    const settings = await updateSiteSettingsRecordWithGiftDefinitions(existing.id, {
      tippingEnabled,
      tippingDailyLimit,
      tippingPerPostLimit,
      tippingAmounts: tippingAmounts.join(","),
      postRedPacketEnabled,
      postRedPacketMaxPoints,
      postRedPacketDailyLimit,
      appStateJson,
      heatViewWeight,
      heatCommentWeight,
      heatLikeWeight,
      heatTipCountWeight,
      heatTipPointsWeight,
      heatStageThresholds: heatStageThresholds.join(","),
      heatStageColors: heatStageColors.join(","),
    }, tippingGifts)

    return finalizeSiteSettingsUpdate({
      settings,
      message: "互动与热度设置已保存",
    })
  }

  if (section === "site-friend-links") {
    const friendLinksEnabled = Boolean(body.friendLinksEnabled)
    const friendLinkApplicationEnabled = Boolean(body.friendLinkApplicationEnabled)
    const friendLinkAnnouncement = readOptionalStringField(body, "friendLinkAnnouncement")

    const settings = await updateSiteSettingsRecord(existing.id, {
      friendLinksEnabled,
      friendLinkApplicationEnabled,
      friendLinkAnnouncement: friendLinkAnnouncement || "欢迎与本站交换友情链接，请先添加我方链接后再提交申请，我们会在 1-3 个工作日内完成审核。",
    })

    return finalizeSiteSettingsUpdate({
      settings,
      message: "友情链接设置已保存",
    })
  }

  return null
}

