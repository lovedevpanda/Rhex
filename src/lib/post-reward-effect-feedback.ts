export interface PostRewardPoolEffectFeedbackEvent {
  kind: "probability" | "points"
  tone: "positive" | "negative"
  title: string
  description: string
  badgeNames?: string[]
}

export interface PostRewardPoolEffectFeedbackBadge {
  name: string | null
  iconText: string | null
  color: string | null
}

export interface PostRewardPoolEffectFeedback {
  badgeName: string | null
  badgeIconText: string | null
  badgeColor: string | null
  badges?: PostRewardPoolEffectFeedbackBadge[]
  events: PostRewardPoolEffectFeedbackEvent[]
}
