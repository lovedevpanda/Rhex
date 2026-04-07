import { listActiveGiftDefinitions } from "@/db/post-gift-queries"
import { updateSiteSettingsRecord, updateSiteSettingsRecordWithGiftDefinitions } from "@/db/site-settings-write-queries"
import { apiError, readOptionalNumberField, readOptionalStringField, type JsonObject } from "@/lib/api-route"
import { finalizeSiteSettingsUpdate, type SiteSettingsRecord } from "@/lib/admin-site-settings-shared"
import {
  mergeAnonymousPostSettings,
  mergeBoardTreasurySettings,
  mergeCommentAccessSettings,
  mergeHomeHotFeedSettings,
  mergeInteractionGateSettings,
  mergePostContentLengthSettings,
  mergePostPageSizeSettings,
  mergePostJackpotSettings,
  mergePostRedPacketSettings,
  resolveAnonymousPostSettings,
  resolveBoardTreasurySettings,
  resolveCommentAccessSettings,
  resolveHomeHotFeedSettings,
  resolvePostContentLengthSettings,
  resolvePostPageSizeSettings,
  resolvePostJackpotSettings,
  resolvePostRedPacketSettings,
} from "@/lib/site-settings-app-state"
import { normalizeHeatColors, normalizeHeatThresholds, normalizeTippingAmounts } from "@/lib/shared/normalizers"
import { parseNonNegativeSafeInteger } from "@/lib/shared/safe-integer"
import { getDefaultTippingGiftItemsFromAmounts, normalizeTippingGiftItems } from "@/lib/tipping-gifts"

export async function updateInteractionSiteSettingsSection(existing: SiteSettingsRecord, body: JsonObject, section: string) {
  if (section === "site-interaction") {
    const guestCanViewComments = body.guestCanViewComments === undefined ? true : Boolean(body.guestCanViewComments)
    const existingCommentAccessSettings = resolveCommentAccessSettings({
      appStateJson: existing.appStateJson,
      guestCanViewFallback: true,
      initialVisibleRepliesFallback: 10,
    })
    const commentInitialVisibleReplies = Math.min(
      100,
      Math.max(
        1,
        readOptionalNumberField(body, "commentInitialVisibleReplies") ?? existingCommentAccessSettings.initialVisibleReplies,
      ),
    )
    const existingAnonymousPostSettings = resolveAnonymousPostSettings({
      appStateJson: existing.appStateJson,
      enabledFallback: false,
      priceFallback: 0,
      dailyLimitFallback: 0,
      maskUserIdFallback: null,
      allowReplySwitchFallback: true,
      defaultReplyAnonymousFallback: true,
    })
    const anonymousPostEnabled = body.anonymousPostEnabled === undefined
      ? existingAnonymousPostSettings.enabled
      : Boolean(body.anonymousPostEnabled)
    const anonymousPostPrice = Math.max(0, readOptionalNumberField(body, "anonymousPostPrice") ?? existingAnonymousPostSettings.price)
    const anonymousPostDailyLimit = Math.max(0, readOptionalNumberField(body, "anonymousPostDailyLimit") ?? existingAnonymousPostSettings.dailyLimit)
    const rawAnonymousMaskUserId = readOptionalNumberField(body, "anonymousPostMaskUserId")
    const anonymousPostMaskUserId = typeof rawAnonymousMaskUserId === "number"
      ? (rawAnonymousMaskUserId > 0 ? rawAnonymousMaskUserId : null)
      : existingAnonymousPostSettings.maskUserId
    const anonymousPostAllowReplySwitch = body.anonymousPostAllowReplySwitch === undefined
      ? existingAnonymousPostSettings.allowReplySwitch
      : Boolean(body.anonymousPostAllowReplySwitch)
    const anonymousPostDefaultReplyAnonymous = body.anonymousPostDefaultReplyAnonymous === undefined
      ? existingAnonymousPostSettings.defaultReplyAnonymous
      : Boolean(body.anonymousPostDefaultReplyAnonymous)
    const postCreateRequireEmailVerified = Boolean(body.postCreateRequireEmailVerified)
    const commentCreateRequireEmailVerified = Boolean(body.commentCreateRequireEmailVerified)
    const postCreateMinRegisteredMinutes = Math.max(0, readOptionalNumberField(body, "postCreateMinRegisteredMinutes") ?? 0)
    const commentCreateMinRegisteredMinutes = Math.max(0, readOptionalNumberField(body, "commentCreateMinRegisteredMinutes") ?? 0)
    const existingPostPageSizeSettings = resolvePostPageSizeSettings({
      appStateJson: existing.appStateJson,
      homeFeedFallback: 35,
      zonePostsFallback: 20,
      boardPostsFallback: 20,
      commentsFallback: 15,
      hotTopicsFallback: 5,
      postRelatedTopicsFallback: 5,
    })
    const existingPostContentLengthSettings = resolvePostContentLengthSettings({
      appStateJson: existing.appStateJson,
      postTitleMinLengthFallback: 5,
      postTitleMaxLengthFallback: 100,
      postContentMinLengthFallback: 10,
      postContentMaxLengthFallback: 50000,
      commentContentMinLengthFallback: 2,
      commentContentMaxLengthFallback: 2000,
    })
    const commentPageSize = Math.min(100, Math.max(1, readOptionalNumberField(body, "commentPageSize") ?? existingPostPageSizeSettings.comments))
    const postTitleMinLength = Math.min(
      100,
      Math.max(1, readOptionalNumberField(body, "postTitleMinLength") ?? existingPostContentLengthSettings.postTitleMinLength),
    )
    const postTitleMaxLength = Math.min(
      500,
      Math.max(postTitleMinLength, readOptionalNumberField(body, "postTitleMaxLength") ?? existingPostContentLengthSettings.postTitleMaxLength),
    )
    const postContentMinLength = Math.min(
      1000,
      Math.max(1, readOptionalNumberField(body, "postContentMinLength") ?? existingPostContentLengthSettings.postContentMinLength),
    )
    const postContentMaxLength = Math.min(
      100000,
      Math.max(postContentMinLength, readOptionalNumberField(body, "postContentMaxLength") ?? existingPostContentLengthSettings.postContentMaxLength),
    )
    const commentContentMinLength = Math.min(
      500,
      Math.max(1, readOptionalNumberField(body, "commentContentMinLength") ?? existingPostContentLengthSettings.commentContentMinLength),
    )
    const commentContentMaxLength = Math.min(
      20000,
      Math.max(commentContentMinLength, readOptionalNumberField(body, "commentContentMaxLength") ?? existingPostContentLengthSettings.commentContentMaxLength),
    )
    const tippingEnabled = Boolean(body.tippingEnabled)
    const tippingDailyLimit = Math.max(1, readOptionalNumberField(body, "tippingDailyLimit") ?? 1)
    const tippingPerPostLimit = Math.max(1, readOptionalNumberField(body, "tippingPerPostLimit") ?? 1)
    const tippingAmounts = normalizeTippingAmounts(body.tippingAmounts)
    const existingTippingGifts = await listActiveGiftDefinitions()
    const tippingGifts = normalizeTippingGiftItems(
      body.tippingGifts,
      existingTippingGifts.length > 0 ? existingTippingGifts : getDefaultTippingGiftItemsFromAmounts(tippingAmounts),
    )
    const existingBoardTreasurySettings = resolveBoardTreasurySettings({
      appStateJson: existing.appStateJson,
      tipGiftTaxEnabledFallback: false,
      tipGiftTaxRateBpsFallback: 0,
    })
    const tipGiftTaxEnabled = body.tipGiftTaxEnabled === undefined
      ? existingBoardTreasurySettings.tipGiftTaxEnabled
      : Boolean(body.tipGiftTaxEnabled)
    const tipGiftTaxRateBps = Math.min(
      10000,
      Math.max(
        0,
        parseNonNegativeSafeInteger(body.tipGiftTaxRateBps)
          ?? existingBoardTreasurySettings.tipGiftTaxRateBps,
      ),
    )
    const postRedPacketEnabled = Boolean(body.postRedPacketEnabled)
    const postRedPacketMaxPoints = Math.max(1, readOptionalNumberField(body, "postRedPacketMaxPoints") ?? 1)
    const postRedPacketDailyLimit = Math.max(1, readOptionalNumberField(body, "postRedPacketDailyLimit") ?? 1)
    const existingPostRedPacketSettings = resolvePostRedPacketSettings({
      appStateJson: existing.appStateJson,
      randomClaimProbabilityFallback: 0,
    })
    const postRedPacketRandomClaimProbability = Math.max(
      0,
      Math.min(
        100,
        readOptionalNumberField(body, "postRedPacketRandomClaimProbability") ?? existingPostRedPacketSettings.randomClaimProbability,
      ),
    )
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
    const existingHomeHotFeedSettings = resolveHomeHotFeedSettings({
      appStateJson: existing.appStateJson,
      recentWindowHoursFallback: 72,
    })
    const homeHotRecentWindowHours = Math.min(
      720,
      Math.max(1, readOptionalNumberField(body, "homeHotRecentWindowHours") ?? existingHomeHotFeedSettings.recentWindowHours),
    )
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
      initialVisibleReplies: commentInitialVisibleReplies,
    })
    const appStateWithAnonymousPost = mergeAnonymousPostSettings(appStateWithCommentAccess, {
      enabled: anonymousPostEnabled,
      price: anonymousPostPrice,
      dailyLimit: anonymousPostDailyLimit,
      maskUserId: anonymousPostMaskUserId,
      allowReplySwitch: anonymousPostAllowReplySwitch,
      defaultReplyAnonymous: anonymousPostDefaultReplyAnonymous,
    })

    const appStateWithInteractionGates = mergeInteractionGateSettings(appStateWithAnonymousPost, {
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

    const appStateWithJackpot = mergePostJackpotSettings(appStateWithInteractionGates, {
      enabled: postJackpotEnabled,
      minInitialPoints: postJackpotMinInitialPoints,
      maxInitialPoints: postJackpotMaxInitialPoints,
      replyIncrementPoints: postJackpotReplyIncrementPoints,
      hitProbability: postJackpotHitProbability,
    })
    const appStateWithHomeHotFeed = mergeHomeHotFeedSettings(appStateWithJackpot, {
      recentWindowHours: homeHotRecentWindowHours,
    })
    const appStateWithPostRedPacket = mergePostRedPacketSettings(appStateWithHomeHotFeed, {
      randomClaimProbability: postRedPacketRandomClaimProbability,
    })
    const appStateWithPostPageSizes = mergePostPageSizeSettings(appStateWithPostRedPacket, {
      homeFeed: existingPostPageSizeSettings.homeFeed,
      zonePosts: existingPostPageSizeSettings.zonePosts,
      boardPosts: existingPostPageSizeSettings.boardPosts,
      comments: commentPageSize,
      hotTopics: existingPostPageSizeSettings.hotTopics,
      postRelatedTopics: existingPostPageSizeSettings.postRelatedTopics,
    })
    const appStateWithPostContentLengths = mergePostContentLengthSettings(appStateWithPostPageSizes, {
      postTitleMinLength,
      postTitleMaxLength,
      postContentMinLength,
      postContentMaxLength,
      commentContentMinLength,
      commentContentMaxLength,
    })
    const appStateJson = mergeBoardTreasurySettings(appStateWithPostContentLengths, {
      tipGiftTaxEnabled,
      tipGiftTaxRateBps,
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
