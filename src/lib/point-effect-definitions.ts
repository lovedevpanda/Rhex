import { PointEffectDirection, PointEffectRuleKind, PointEffectTargetType } from "@/lib/shared/point-effect-enums"

export const BADGE_EFFECT_SCOPE_HOME_AUTO_CHECK_IN = "HOME_AUTO_CHECK_IN"

export const POINT_EFFECT_SCOPE_OPTIONS = [
  { value: "ALL_POINT_CHANGES", label: "所有积分增减", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: true, badgeEffectRuntimeMatchable: false },
  { value: "ALL_PROBABILITIES", label: "所有概率", targetTypes: [PointEffectTargetType.PROBABILITY], badgeEffectEnabled: true, badgeEffectRuntimeMatchable: false },
  { value: "POST_CREATE", label: "发帖积分", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: true, badgeEffectRuntimeMatchable: true },
  { value: "COMMENT_CREATE", label: "回帖积分", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: true, badgeEffectRuntimeMatchable: true },
  { value: "CHECK_IN_REWARD", label: "签到奖励", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: true, badgeEffectRuntimeMatchable: true },
  { value: "CHECK_IN_MAKE_UP_COST", label: "补签消耗", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: true, badgeEffectRuntimeMatchable: true },
  { value: BADGE_EFFECT_SCOPE_HOME_AUTO_CHECK_IN, label: "首页自动签到", targetTypes: [PointEffectTargetType.FUNCTION], badgeEffectEnabled: true, badgeEffectRuntimeMatchable: false },
  { value: "TIP_OUTGOING", label: "打赏支出", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "TIP_INCOMING", label: "被打赏收入", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: true, badgeEffectRuntimeMatchable: true },
  { value: "GIFT_OUTGOING", label: "礼物支出", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "GIFT_INCOMING", label: "收到礼物收入", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: true, badgeEffectRuntimeMatchable: true },
  { value: "RED_PACKET_PUBLISH", label: "发布红包", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "RED_PACKET_RANDOM_CLAIM_PROBABILITY", label: "红包随机领取概率", targetTypes: [PointEffectTargetType.PROBABILITY], badgeEffectEnabled: true, badgeEffectRuntimeMatchable: true },
  { value: "RED_PACKET_CLAIM", label: "领取红包", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: true, badgeEffectRuntimeMatchable: true },
  { value: "JACKPOT_PUBLISH", label: "发布聚宝盆", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "JACKPOT_REPLY_INCREMENT", label: "聚宝盆回帖加池", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "JACKPOT_HIT_PROBABILITY", label: "聚宝盆中奖概率", targetTypes: [PointEffectTargetType.PROBABILITY], badgeEffectEnabled: true, badgeEffectRuntimeMatchable: true },
  { value: "JACKPOT_CLAIM", label: "聚宝盆中奖积分", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: true, badgeEffectRuntimeMatchable: true },
  { value: "BADGE_PURCHASE", label: "勋章购买", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "NICKNAME_CHANGE", label: "修改昵称", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "INTRODUCTION_CHANGE", label: "修改介绍", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "AVATAR_CHANGE", label: "修改头像", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "INVITE_CODE_PURCHASE", label: "购买邀请码", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "INVITE_REWARD_INVITER", label: "邀请人奖励", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "INVITE_REWARD_INVITEE", label: "被邀请人奖励", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "REGISTER_INITIAL_REWARD", label: "注册初始奖励", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "POINTS_TOPUP", label: "积分充值", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "VIP_PURCHASE", label: "VIP 购买", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "POST_OFFLINE_PURCHASE", label: "帖子下线消耗", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "POST_UNLOCK_OUTGOING", label: "付费内容购买支出", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "POST_UNLOCK_INCOMING", label: "付费内容购买收入", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "POST_AUCTION_BID_FREEZE", label: "拍卖出价冻结", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "POST_AUCTION_OUTBID_REFUND", label: "拍卖被超退款", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "POST_AUCTION_LOSE_REFUND", label: "拍卖失败退款", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "POST_AUCTION_WIN_SETTLEMENT", label: "拍卖赢家结算", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "POST_AUCTION_SELLER_INCOME", label: "拍卖卖家收入", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "BOUNTY_ACCEPT_REWARD", label: "悬赏采纳奖励", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "BOUNTY_POST_FREEZE", label: "悬赏发帖冻结", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "REDEEM_CODE_REWARD", label: "兑换码奖励", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "YINYANG_STAKE_OUTGOING", label: "阴阳赌注支出", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "YINYANG_SETTLEMENT_INCOMING", label: "阴阳结算收入", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "YINYANG_SETTLEMENT_OUTGOING", label: "阴阳结算支出", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "SELF_SERVE_AD_PURCHASE", label: "自助广告购买", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "GOBANG_WAGER_OUTGOING", label: "五子棋支出", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
  { value: "GOBANG_WAGER_INCOMING", label: "五子棋收入", targetTypes: [PointEffectTargetType.POINTS], badgeEffectEnabled: false, badgeEffectRuntimeMatchable: false },
] as const

export type PointEffectScopeKey = (typeof POINT_EFFECT_SCOPE_OPTIONS)[number]["value"]

const POINT_EFFECT_SCOPE_VALUE_SET = new Set<string>(POINT_EFFECT_SCOPE_OPTIONS.map((item) => item.value))

export const POINT_EFFECT_TARGET_OPTIONS = [
  { value: PointEffectTargetType.POINTS, label: "积分" },
  { value: PointEffectTargetType.PROBABILITY, label: "概率" },
  { value: PointEffectTargetType.FUNCTION, label: "功能" },
] as const

export const POINT_EFFECT_RULE_KIND_OPTIONS = [
  { value: PointEffectRuleKind.FIXED, label: "固定值" },
  { value: PointEffectRuleKind.PERCENTAGE, label: "百分比" },
  { value: PointEffectRuleKind.RANDOM_FIXED, label: "随机固定值" },
  { value: PointEffectRuleKind.RANDOM_PERCENTAGE, label: "随机百分比" },
  { value: PointEffectRuleKind.RANDOM_SIGNED_MULTIPLIER, label: "随机正负倍数" },
] as const

export const POINT_EFFECT_DIRECTION_OPTIONS = [
  { value: PointEffectDirection.BUFF, label: "增益" },
  { value: PointEffectDirection.NERF, label: "减益" },
  { value: PointEffectDirection.RANDOM_SIGNED, label: "随机正负" },
] as const

export function isPointEffectScopeKey(value: string): value is PointEffectScopeKey {
  return POINT_EFFECT_SCOPE_VALUE_SET.has(value)
}

export function getPointEffectScopeLabel(scopeKey: string) {
  return POINT_EFFECT_SCOPE_OPTIONS.find((item) => item.value === scopeKey)?.label ?? scopeKey
}

export function getPointEffectScopeOptionsByTargetType(targetType: PointEffectTargetType) {
  return POINT_EFFECT_SCOPE_OPTIONS.filter((item) => item.badgeEffectEnabled && item.targetTypes.some((candidate) => candidate === targetType))
}

export function getPointEffectAllScopeKeyByTargetType(targetType: PointEffectTargetType) {
  if (targetType === PointEffectTargetType.POINTS) {
    return "ALL_POINT_CHANGES"
  }

  if (targetType === PointEffectTargetType.PROBABILITY) {
    return "ALL_PROBABILITIES"
  }

  return null
}

export function getPointEffectTargetOptionsForBadgeEffects() {
  return POINT_EFFECT_TARGET_OPTIONS.filter((item) => getPointEffectScopeOptionsByTargetType(item.value).length > 0)
}

export function isPointEffectTargetTypeEnabledForBadgeEffects(targetType: PointEffectTargetType) {
  return getPointEffectScopeOptionsByTargetType(targetType).length > 0
}

export function isPointEffectScopeCompatibleWithTargetType(scopeKey: string, targetType: PointEffectTargetType) {
  return POINT_EFFECT_SCOPE_OPTIONS.some((item) => item.value === scopeKey && item.badgeEffectEnabled && item.targetTypes.some((candidate) => candidate === targetType))
}

export function isPointEffectScopeMatchableForBadgeEffects(scopeKey: string) {
  return POINT_EFFECT_SCOPE_OPTIONS.some((item) => item.value === scopeKey && item.badgeEffectEnabled && item.badgeEffectRuntimeMatchable)
}

export function filterPointEffectScopeKeysByTargetType(scopeKeys: string[], targetType: PointEffectTargetType) {
  return scopeKeys.filter((scopeKey) => isPointEffectScopeCompatibleWithTargetType(scopeKey, targetType))
}

export function normalizePointEffectScopeKeysByTargetType(scopeKeys: string[], targetType: PointEffectTargetType) {
  const filteredScopeKeys = Array.from(new Set(filterPointEffectScopeKeysByTargetType(scopeKeys, targetType)))
  const allScopeKey = getPointEffectAllScopeKeyByTargetType(targetType)

  if (allScopeKey && filteredScopeKeys.includes(allScopeKey)) {
    return [allScopeKey]
  }

  return filteredScopeKeys
}

export function isFunctionalPointEffectTargetType(targetType: PointEffectTargetType) {
  return targetType === PointEffectTargetType.FUNCTION
}

export function getDefaultPointEffectScopeKeysByTargetType(targetType: PointEffectTargetType) {
  const options = getPointEffectScopeOptionsByTargetType(targetType)
  return options[0] ? [options[0].value] : []
}

export function getPointEffectRuleKindLabel(ruleKind: PointEffectRuleKind) {
  return POINT_EFFECT_RULE_KIND_OPTIONS.find((item) => item.value === ruleKind)?.label ?? ruleKind
}

export function getPointEffectDirectionLabel(direction: PointEffectDirection) {
  return POINT_EFFECT_DIRECTION_OPTIONS.find((item) => item.value === direction)?.label ?? direction
}

export function getPointEffectDirectionOptionsByRuleKind(ruleKind: PointEffectRuleKind) {
  if (ruleKind === PointEffectRuleKind.RANDOM_SIGNED_MULTIPLIER) {
    return POINT_EFFECT_DIRECTION_OPTIONS.filter((item) => item.value === PointEffectDirection.RANDOM_SIGNED)
  }

  return POINT_EFFECT_DIRECTION_OPTIONS.filter((item) => item.value !== PointEffectDirection.RANDOM_SIGNED)
}

export function normalizePointEffectDirectionByRuleKind(direction: PointEffectDirection, ruleKind: PointEffectRuleKind) {
  const compatibleOptions = getPointEffectDirectionOptionsByRuleKind(ruleKind)
  return compatibleOptions.some((item) => item.value === direction)
    ? direction
    : compatibleOptions[0]?.value ?? PointEffectDirection.BUFF
}

export function getPointEffectTargetLabel(targetType: PointEffectTargetType) {
  return POINT_EFFECT_TARGET_OPTIONS.find((item) => item.value === targetType)?.label ?? targetType
}

export function minuteOfDayToTimeInput(minuteOfDay: number | null | undefined) {
  if (typeof minuteOfDay !== "number" || !Number.isFinite(minuteOfDay)) {
    return ""
  }

  const normalized = Math.min(1439, Math.max(0, Math.floor(minuteOfDay)))
  const hour = String(Math.floor(normalized / 60)).padStart(2, "0")
  const minute = String(normalized % 60).padStart(2, "0")
  return `${hour}:${minute}`
}

export function timeInputToMinuteOfDay(value: string | null | undefined) {
  const normalized = String(value ?? "").trim()
  if (!normalized) {
    return null
  }

  const match = normalized.match(/^(\d{2}):(\d{2})$/)
  if (!match) {
    return null
  }

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }

  return hour * 60 + minute
}
