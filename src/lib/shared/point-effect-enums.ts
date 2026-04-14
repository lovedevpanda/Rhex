export const PointEffectTargetType = {
  POINTS: "POINTS",
  PROBABILITY: "PROBABILITY",
  FUNCTION: "FUNCTION",
} as const

export type PointEffectTargetType = (typeof PointEffectTargetType)[keyof typeof PointEffectTargetType]

export const POINT_EFFECT_TARGET_TYPE_VALUES: PointEffectTargetType[] = Object.values(PointEffectTargetType)

const pointEffectTargetTypeValueSet = new Set<string>(POINT_EFFECT_TARGET_TYPE_VALUES)

export function isPointEffectTargetType(value: string): value is PointEffectTargetType {
  return pointEffectTargetTypeValueSet.has(value)
}

export const PointEffectRuleKind = {
  FIXED: "FIXED",
  PERCENTAGE: "PERCENTAGE",
  RANDOM_FIXED: "RANDOM_FIXED",
  RANDOM_PERCENTAGE: "RANDOM_PERCENTAGE",
  RANDOM_SIGNED_MULTIPLIER: "RANDOM_SIGNED_MULTIPLIER",
} as const

export type PointEffectRuleKind = (typeof PointEffectRuleKind)[keyof typeof PointEffectRuleKind]

export const POINT_EFFECT_RULE_KIND_VALUES: PointEffectRuleKind[] = Object.values(PointEffectRuleKind)

const pointEffectRuleKindValueSet = new Set<string>(POINT_EFFECT_RULE_KIND_VALUES)

export function isPointEffectRuleKind(value: string): value is PointEffectRuleKind {
  return pointEffectRuleKindValueSet.has(value)
}

export const PointEffectDirection = {
  BUFF: "BUFF",
  NERF: "NERF",
  RANDOM_SIGNED: "RANDOM_SIGNED",
} as const

export type PointEffectDirection = (typeof PointEffectDirection)[keyof typeof PointEffectDirection]

export const POINT_EFFECT_DIRECTION_VALUES: PointEffectDirection[] = Object.values(PointEffectDirection)

const pointEffectDirectionValueSet = new Set<string>(POINT_EFFECT_DIRECTION_VALUES)

export function isPointEffectDirection(value: string): value is PointEffectDirection {
  return pointEffectDirectionValueSet.has(value)
}
