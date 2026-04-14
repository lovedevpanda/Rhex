export const BadgeRuleType = {
  REGISTER_DAYS: "REGISTER_DAYS",
  REGISTER_TIME_RANGE: "REGISTER_TIME_RANGE",
  POST_COUNT: "POST_COUNT",
  COMMENT_COUNT: "COMMENT_COUNT",
  RECEIVED_LIKE_COUNT: "RECEIVED_LIKE_COUNT",
  INVITE_COUNT: "INVITE_COUNT",
  ACCEPTED_ANSWER_COUNT: "ACCEPTED_ANSWER_COUNT",
  SENT_TIP_COUNT: "SENT_TIP_COUNT",
  RECEIVED_TIP_COUNT: "RECEIVED_TIP_COUNT",
  FOLLOWER_COUNT: "FOLLOWER_COUNT",
  USER_ID: "USER_ID",
  LEVEL: "LEVEL",
  CHECK_IN_DAYS: "CHECK_IN_DAYS",
  CURRENT_CHECK_IN_STREAK: "CURRENT_CHECK_IN_STREAK",
  MAX_CHECK_IN_STREAK: "MAX_CHECK_IN_STREAK",
  VIP_LEVEL: "VIP_LEVEL",
} as const

export type BadgeRuleType = (typeof BadgeRuleType)[keyof typeof BadgeRuleType]

export const BADGE_RULE_TYPE_VALUES: BadgeRuleType[] = Object.values(BadgeRuleType)

const badgeRuleTypeValueSet = new Set<string>(BADGE_RULE_TYPE_VALUES)

export function isBadgeRuleType(value: string): value is BadgeRuleType {
  return badgeRuleTypeValueSet.has(value)
}

export const BadgeRuleOperator = {
  GT: "GT",
  GTE: "GTE",
  EQ: "EQ",
  LT: "LT",
  LTE: "LTE",
  BETWEEN: "BETWEEN",
  BEFORE: "BEFORE",
  AFTER: "AFTER",
} as const

export type BadgeRuleOperator = (typeof BadgeRuleOperator)[keyof typeof BadgeRuleOperator]

export const BADGE_RULE_OPERATOR_VALUES: BadgeRuleOperator[] = Object.values(BadgeRuleOperator)

const badgeRuleOperatorValueSet = new Set<string>(BADGE_RULE_OPERATOR_VALUES)

export function isBadgeRuleOperator(value: string): value is BadgeRuleOperator {
  return badgeRuleOperatorValueSet.has(value)
}
