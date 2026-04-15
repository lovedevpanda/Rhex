import type { InteractionGateSettings } from "@/lib/site-settings-app-state"
import type { SiteTippingGiftItem } from "@/lib/tipping-gifts"

export interface SiteSettingsContentData {
  postEditableMinutes: number
  commentEditableMinutes: number
  guestCanViewComments: boolean
  commentInitialVisibleReplies: number
  anonymousPostEnabled: boolean
  anonymousPostPrice: number
  anonymousPostDailyLimit: number
  anonymousPostMaskUserId: number | null
  anonymousPostAllowReplySwitch: boolean
  anonymousPostDefaultReplyAnonymous: boolean
  interactionGates: InteractionGateSettings
  tippingEnabled: boolean
  tippingDailyLimit: number
  tippingPerPostLimit: number
  tippingAmounts: number[]
  tippingGifts: SiteTippingGiftItem[]
  tipGiftTaxEnabled: boolean
  tipGiftTaxRateBps: number
  postRedPacketEnabled: boolean
  postRedPacketMaxPoints: number
  postRedPacketDailyLimit: number
  postRedPacketRandomClaimProbability: number
  postJackpotEnabled: boolean
  postJackpotMinInitialPoints: number
  postJackpotMaxInitialPoints: number
  postJackpotReplyIncrementPoints: number
  postJackpotHitProbability: number
  heatViewWeight: number
  heatCommentWeight: number
  heatLikeWeight: number
  heatTipCountWeight: number
  heatTipPointsWeight: number
  heatStageThresholds: number[]
  heatStageColors: string[]
}
