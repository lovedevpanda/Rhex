import { BadgeRuleType } from "@/lib/shared/badge-rule-enums"

export type BadgeRuleValueMode = "number" | "text" | "user-level" | "vip-level" | "datetime-local"

export const EXTRA_BADGE_RULE_TYPES = [
  "ACCEPTED_ANSWER_COUNT",
  "SENT_TIP_COUNT",
  "RECEIVED_TIP_COUNT",
  "FOLLOWER_COUNT",
] as const

export type ExtraBadgeRuleType = (typeof EXTRA_BADGE_RULE_TYPES)[number]
export type BadgeRuleTypeValue = BadgeRuleType | ExtraBadgeRuleType

type BadgeRuleTypeOption = {
  value: BadgeRuleTypeValue
  label: string
  placeholder: string
  valueMode: BadgeRuleValueMode
}

export const BADGE_RULE_TYPE_OPTIONS: BadgeRuleTypeOption[] = [
  { value: BadgeRuleType.REGISTER_DAYS, label: "注册天数", placeholder: "如 30", valueMode: "number" },
  { value: BadgeRuleType.REGISTER_TIME_RANGE, label: "注册时间", placeholder: "选择注册时间", valueMode: "datetime-local" },
  { value: BadgeRuleType.POST_COUNT, label: "发帖数", placeholder: "如 10", valueMode: "number" },
  { value: BadgeRuleType.COMMENT_COUNT, label: "回复数", placeholder: "如 20", valueMode: "number" },
  { value: BadgeRuleType.RECEIVED_LIKE_COUNT, label: "获赞数", placeholder: "如 100", valueMode: "number" },
  { value: BadgeRuleType.INVITE_COUNT, label: "邀请人数", placeholder: "如 5", valueMode: "number" },
  { value: "ACCEPTED_ANSWER_COUNT", label: "被采纳数", placeholder: "如 3", valueMode: "number" },
  { value: "SENT_TIP_COUNT", label: "打赏次数", placeholder: "如 10", valueMode: "number" },
  { value: "RECEIVED_TIP_COUNT", label: "被打赏次数", placeholder: "如 10", valueMode: "number" },
  { value: "FOLLOWER_COUNT", label: "粉丝数", placeholder: "如 100", valueMode: "number" },
  { value: BadgeRuleType.USER_ID, label: "UID", placeholder: "如 1000", valueMode: "number" },
  { value: BadgeRuleType.LEVEL, label: "等级", placeholder: "选择等级", valueMode: "user-level" },
  { value: BadgeRuleType.CHECK_IN_DAYS, label: "签到天数", placeholder: "如 30", valueMode: "number" },
  { value: BadgeRuleType.CURRENT_CHECK_IN_STREAK, label: "连续签到天数", placeholder: "如 7", valueMode: "number" },
  { value: BadgeRuleType.MAX_CHECK_IN_STREAK, label: "最高连续签到天数", placeholder: "如 30", valueMode: "number" },
  { value: BadgeRuleType.VIP_LEVEL, label: "VIP 等级", placeholder: "选择 VIP 等级", valueMode: "vip-level" },
]

const BADGE_RULE_TYPE_VALUE_SET = new Set<string>(BADGE_RULE_TYPE_OPTIONS.map((item) => item.value))

export function isBadgeRuleTypeValue(value: string): value is BadgeRuleTypeValue {
  return BADGE_RULE_TYPE_VALUE_SET.has(value)
}

export function getBadgeRuleTypeOption(ruleType: string) {
  return BADGE_RULE_TYPE_OPTIONS.find((item) => item.value === ruleType) ?? null
}
