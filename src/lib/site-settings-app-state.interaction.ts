import { parseNonNegativeSafeInteger } from "@/lib/shared/safe-integer"
import { getDefaultTippingGiftItemsFromAmounts, normalizeTippingGiftItems } from "@/lib/tipping-gifts"
import { normalizeVipLevelIcons } from "@/lib/vip-level-icons"
import { normalizeVipNameColors } from "@/lib/vip-name-colors"
import {
  isRecord,
  normalizeNonNegativeInteger,
  readSiteSettingsState,
  writeSiteSettingsState,
} from "@/lib/site-settings-app-state.types"
import type {
  AnonymousPostSettings,
  BoardApplicationSettings,
  BoardTreasurySettings,
  CommentAccessSettings,
  InteractionGateCondition,
  InteractionGateRule,
  InteractionGateSettings,
  PostContentLengthSettings,
  PostJackpotSettings,
  PostRedPacketSettings,
  SiteTippingGiftItem,
  VipLevelIconSettings,
  VipNameColorSettings,
} from "@/lib/site-settings-app-state.types"

export function resolveTippingGiftSettings(options: {
  appStateJson?: string | null
  fallbackAmounts: number[]
}) {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const fallbackItems = getDefaultTippingGiftItemsFromAmounts(options.fallbackAmounts)

  return normalizeTippingGiftItems(siteSettingsState.tippingGifts, fallbackItems)
}

export function mergeTippingGiftSettings(
  appStateJson: string | null | undefined,
  input: SiteTippingGiftItem[],
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    tippingGifts: normalizeTippingGiftItems(input),
  })
}

export function getTippingGiftPriceOptions(gifts: SiteTippingGiftItem[]) {
  return Array.from(new Set(gifts.map((item) => normalizeNonNegativeInteger(item.price, 0)).filter((item) => item > 0)))
}

export function resolveCommentAccessSettings(options: {
  appStateJson?: string | null
  guestCanViewFallback?: boolean
  initialVisibleRepliesFallback?: number
} = {}): CommentAccessSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const commentAccess = isRecord(siteSettingsState.commentAccess)
    ? siteSettingsState.commentAccess
    : {}

  return {
    guestCanView:
      typeof commentAccess.guestCanView === "boolean"
        ? commentAccess.guestCanView
        : options.guestCanViewFallback ?? true,
    initialVisibleReplies: Math.min(
      100,
      Math.max(
        1,
        normalizeNonNegativeInteger(
          commentAccess.initialVisibleReplies,
          normalizeNonNegativeInteger(options.initialVisibleRepliesFallback, 10),
        ),
      ),
    ),
  }
}

export function mergeCommentAccessSettings(
  appStateJson: string | null | undefined,
  input: CommentAccessSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    commentAccess: {
      guestCanView: input.guestCanView,
      initialVisibleReplies: Math.min(100, Math.max(1, normalizeNonNegativeInteger(input.initialVisibleReplies, 10))),
    },
  })
}

function createEmptyInteractionGateRule(): InteractionGateRule {
  return {
    enabled: false,
    conditions: [],
  }
}

function normalizeInteractionGateCondition(value: unknown): InteractionGateCondition | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null
  }

  if (value.type === "EMAIL_VERIFIED") {
    return value.enabled === false ? null : { type: "EMAIL_VERIFIED", enabled: true }
  }

  if (value.type === "REGISTERED_MINUTES") {
    const minutes = normalizeNonNegativeInteger(value.value, 0)
    return minutes > 0 ? { type: "REGISTERED_MINUTES", value: minutes } : null
  }

  return null
}

function normalizeInteractionGateRule(value: unknown): InteractionGateRule {
  if (!isRecord(value)) {
    return createEmptyInteractionGateRule()
  }

  const conditions = Array.isArray(value.conditions)
    ? value.conditions.map(normalizeInteractionGateCondition).filter(Boolean) as InteractionGateCondition[]
    : []

  const dedupedConditions = Array.from(
    new Map(conditions.map((condition) => [condition.type, condition])).values(),
  )

  return {
    enabled: dedupedConditions.length > 0,
    conditions: dedupedConditions,
  }
}

function normalizeInteractionGateSettings(value: unknown): InteractionGateSettings {
  const actions = isRecord(value) && isRecord(value.actions) ? value.actions : {}

  return {
    version: 1,
    actions: {
      POST_CREATE: normalizeInteractionGateRule(actions.POST_CREATE),
      COMMENT_CREATE: normalizeInteractionGateRule(actions.COMMENT_CREATE),
    },
  }
}

export function resolveInteractionGateSettings(options: {
  appStateJson?: string | null
} = {}): InteractionGateSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  return normalizeInteractionGateSettings(siteSettingsState.interactionGates)
}

export function mergeInteractionGateSettings(
  appStateJson: string | null | undefined,
  input: InteractionGateSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)
  const normalized = normalizeInteractionGateSettings(input)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    interactionGates: normalized,
  })
}

export function resolveVipLevelIconSettings(options: {
  appStateJson?: string | null
} = {}): VipLevelIconSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const vipLevelIcons = isRecord(siteSettingsState.vipLevelIcons)
    ? siteSettingsState.vipLevelIcons
    : {}

  return normalizeVipLevelIcons({
    vip1: typeof vipLevelIcons.vip1 === "string" ? vipLevelIcons.vip1 : undefined,
    vip2: typeof vipLevelIcons.vip2 === "string" ? vipLevelIcons.vip2 : undefined,
    vip3: typeof vipLevelIcons.vip3 === "string" ? vipLevelIcons.vip3 : undefined,
  })
}

export function mergeVipLevelIconSettings(
  appStateJson: string | null | undefined,
  input: VipLevelIconSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    vipLevelIcons: normalizeVipLevelIcons(input),
  })
}

export function resolveVipNameColorSettings(options: {
  appStateJson?: string | null
} = {}): VipNameColorSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const vipNameColors = isRecord(siteSettingsState.vipNameColors)
    ? siteSettingsState.vipNameColors
    : {}

  return normalizeVipNameColors({
    normal: typeof vipNameColors.normal === "string" ? vipNameColors.normal : undefined,
    vip1: typeof vipNameColors.vip1 === "string" ? vipNameColors.vip1 : undefined,
    vip2: typeof vipNameColors.vip2 === "string" ? vipNameColors.vip2 : undefined,
    vip3: typeof vipNameColors.vip3 === "string" ? vipNameColors.vip3 : undefined,
  })
}

export function mergeVipNameColorSettings(
  appStateJson: string | null | undefined,
  input: VipNameColorSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    vipNameColors: normalizeVipNameColors(input),
  })
}

export function resolvePostJackpotSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
  minInitialPointsFallback?: number
  maxInitialPointsFallback?: number
  replyIncrementPointsFallback?: number
  hitProbabilityFallback?: number
} = {}): PostJackpotSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const postJackpot = isRecord(siteSettingsState.postJackpot)
    ? siteSettingsState.postJackpot
    : {}
  const minInitialPoints = normalizeNonNegativeInteger(postJackpot.minInitialPoints, normalizeNonNegativeInteger(options.minInitialPointsFallback, 100))
  const maxInitialPoints = Math.max(
    minInitialPoints,
    normalizeNonNegativeInteger(postJackpot.maxInitialPoints, normalizeNonNegativeInteger(options.maxInitialPointsFallback, 1000)),
  )

  return {
    enabled: typeof postJackpot.enabled === "boolean" ? postJackpot.enabled : options.enabledFallback ?? false,
    minInitialPoints,
    maxInitialPoints,
    replyIncrementPoints: normalizeNonNegativeInteger(postJackpot.replyIncrementPoints, normalizeNonNegativeInteger(options.replyIncrementPointsFallback, 25)),
    hitProbability: Math.max(1, Math.min(100, normalizeNonNegativeInteger(postJackpot.hitProbability, normalizeNonNegativeInteger(options.hitProbabilityFallback, 15)))),
  }
}

export function mergePostJackpotSettings(
  appStateJson: string | null | undefined,
  input: PostJackpotSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    postJackpot: {
      enabled: input.enabled,
      minInitialPoints: normalizeNonNegativeInteger(input.minInitialPoints, 100),
      maxInitialPoints: Math.max(
        normalizeNonNegativeInteger(input.minInitialPoints, 100),
        normalizeNonNegativeInteger(input.maxInitialPoints, 1000),
      ),
      replyIncrementPoints: normalizeNonNegativeInteger(input.replyIncrementPoints, 25),
      hitProbability: Math.max(1, Math.min(100, normalizeNonNegativeInteger(input.hitProbability, 15))),
    },
  })
}

export function resolvePostRedPacketSettings(options: {
  appStateJson?: string | null
  randomClaimProbabilityFallback?: number
} = {}): PostRedPacketSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const postRedPacket = isRecord(siteSettingsState.postRedPacket)
    ? siteSettingsState.postRedPacket
    : {}

  return {
    randomClaimProbability: Math.max(
      0,
      Math.min(
        100,
        normalizeNonNegativeInteger(
          postRedPacket.randomClaimProbability,
          normalizeNonNegativeInteger(options.randomClaimProbabilityFallback, 0),
        ),
      ),
    ),
  }
}

export function mergePostRedPacketSettings(
  appStateJson: string | null | undefined,
  input: PostRedPacketSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    postRedPacket: {
      randomClaimProbability: Math.max(0, Math.min(100, normalizeNonNegativeInteger(input.randomClaimProbability, 0))),
    },
  })
}

export function resolvePostContentLengthSettings(options: {
  appStateJson?: string | null
  postTitleMinLengthFallback?: number
  postTitleMaxLengthFallback?: number
  postContentMinLengthFallback?: number
  postContentMaxLengthFallback?: number
  commentContentMinLengthFallback?: number
  commentContentMaxLengthFallback?: number
} = {}): PostContentLengthSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const postContentLengths = isRecord(siteSettingsState.postContentLengths)
    ? siteSettingsState.postContentLengths
    : {}
  const postTitleMinLength = Math.min(100, Math.max(1, normalizeNonNegativeInteger(postContentLengths.postTitleMinLength, normalizeNonNegativeInteger(options.postTitleMinLengthFallback, 5))))
  const postContentMinLength = Math.min(1000, Math.max(1, normalizeNonNegativeInteger(postContentLengths.postContentMinLength, normalizeNonNegativeInteger(options.postContentMinLengthFallback, 10))))
  const commentContentMinLength = Math.min(500, Math.max(1, normalizeNonNegativeInteger(postContentLengths.commentContentMinLength, normalizeNonNegativeInteger(options.commentContentMinLengthFallback, 2))))

  return {
    postTitleMinLength,
    postTitleMaxLength: Math.min(500, Math.max(postTitleMinLength, normalizeNonNegativeInteger(postContentLengths.postTitleMaxLength, normalizeNonNegativeInteger(options.postTitleMaxLengthFallback, 100)))),
    postContentMinLength,
    postContentMaxLength: Math.min(100000, Math.max(postContentMinLength, normalizeNonNegativeInteger(postContentLengths.postContentMaxLength, normalizeNonNegativeInteger(options.postContentMaxLengthFallback, 50000)))),
    commentContentMinLength,
    commentContentMaxLength: Math.min(20000, Math.max(commentContentMinLength, normalizeNonNegativeInteger(postContentLengths.commentContentMaxLength, normalizeNonNegativeInteger(options.commentContentMaxLengthFallback, 2000)))),
  }
}

export function mergePostContentLengthSettings(
  appStateJson: string | null | undefined,
  input: PostContentLengthSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)
  const postTitleMinLength = Math.min(100, Math.max(1, normalizeNonNegativeInteger(input.postTitleMinLength, 5)))
  const postContentMinLength = Math.min(1000, Math.max(1, normalizeNonNegativeInteger(input.postContentMinLength, 10)))
  const commentContentMinLength = Math.min(500, Math.max(1, normalizeNonNegativeInteger(input.commentContentMinLength, 2)))

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    postContentLengths: {
      postTitleMinLength,
      postTitleMaxLength: Math.min(500, Math.max(postTitleMinLength, normalizeNonNegativeInteger(input.postTitleMaxLength, 100))),
      postContentMinLength,
      postContentMaxLength: Math.min(100000, Math.max(postContentMinLength, normalizeNonNegativeInteger(input.postContentMaxLength, 50000))),
      commentContentMinLength,
      commentContentMaxLength: Math.min(20000, Math.max(commentContentMinLength, normalizeNonNegativeInteger(input.commentContentMaxLength, 2000))),
    },
  })
}

export function resolveBoardTreasurySettings(options: {
  appStateJson?: string | null
  tipGiftTaxEnabledFallback?: boolean
  tipGiftTaxRateBpsFallback?: number
} = {}): BoardTreasurySettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const boardTreasury = isRecord(siteSettingsState.boardTreasury)
    ? siteSettingsState.boardTreasury
    : {}

  return {
    tipGiftTaxEnabled: typeof boardTreasury.tipGiftTaxEnabled === "boolean" ? boardTreasury.tipGiftTaxEnabled : options.tipGiftTaxEnabledFallback ?? false,
    tipGiftTaxRateBps: Math.min(10000, normalizeNonNegativeInteger(boardTreasury.tipGiftTaxRateBps, normalizeNonNegativeInteger(options.tipGiftTaxRateBpsFallback, 0))),
  }
}

export function mergeBoardTreasurySettings(
  appStateJson: string | null | undefined,
  input: BoardTreasurySettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    boardTreasury: {
      tipGiftTaxEnabled: Boolean(input.tipGiftTaxEnabled),
      tipGiftTaxRateBps: Math.min(10000, normalizeNonNegativeInteger(input.tipGiftTaxRateBps, 0)),
    },
  })
}

export function resolveBoardApplicationSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
} = {}): BoardApplicationSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const boardApplications = isRecord(siteSettingsState.boardApplications)
    ? siteSettingsState.boardApplications
    : {}

  return {
    enabled:
      typeof boardApplications.enabled === "boolean"
        ? boardApplications.enabled
        : options.enabledFallback ?? true,
  }
}

export function mergeBoardApplicationSettings(
  appStateJson: string | null | undefined,
  input: BoardApplicationSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    boardApplications: {
      enabled: Boolean(input.enabled),
    },
  })
}

export function resolveAnonymousPostSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
  priceFallback?: number
  dailyLimitFallback?: number
  maskUserIdFallback?: number | null
  allowReplySwitchFallback?: boolean
  defaultReplyAnonymousFallback?: boolean
} = {}): AnonymousPostSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const anonymousPost = isRecord(siteSettingsState.anonymousPost)
    ? siteSettingsState.anonymousPost
    : {}
  const rawMaskUserId = parseNonNegativeSafeInteger(anonymousPost.maskUserId)

  return {
    enabled: typeof anonymousPost.enabled === "boolean" ? anonymousPost.enabled : options.enabledFallback ?? false,
    price: normalizeNonNegativeInteger(anonymousPost.price, normalizeNonNegativeInteger(options.priceFallback, 0)),
    dailyLimit: normalizeNonNegativeInteger(anonymousPost.dailyLimit, normalizeNonNegativeInteger(options.dailyLimitFallback, 0)),
    maskUserId: typeof rawMaskUserId === "number" && rawMaskUserId > 0
      ? rawMaskUserId
      : (typeof options.maskUserIdFallback === "number" && options.maskUserIdFallback > 0 ? options.maskUserIdFallback : null),
    allowReplySwitch: typeof anonymousPost.allowReplySwitch === "boolean" ? anonymousPost.allowReplySwitch : options.allowReplySwitchFallback ?? true,
    defaultReplyAnonymous: typeof anonymousPost.defaultReplyAnonymous === "boolean" ? anonymousPost.defaultReplyAnonymous : options.defaultReplyAnonymousFallback ?? true,
  }
}

export function mergeAnonymousPostSettings(
  appStateJson: string | null | undefined,
  input: AnonymousPostSettings,
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)
  const maskUserId = parseNonNegativeSafeInteger(input.maskUserId)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    anonymousPost: {
      enabled: Boolean(input.enabled),
      price: normalizeNonNegativeInteger(input.price, 0),
      dailyLimit: normalizeNonNegativeInteger(input.dailyLimit, 0),
      maskUserId: typeof maskUserId === "number" && maskUserId > 0 ? maskUserId : null,
      allowReplySwitch: Boolean(input.allowReplySwitch),
      defaultReplyAnonymous: Boolean(input.defaultReplyAnonymous),
    },
  })
}
