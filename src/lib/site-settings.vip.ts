import type { VipNameColors } from "@/lib/vip-name-colors"
import type { VipLevelIcons } from "@/lib/vip-level-icons"

export interface SiteSettingsVipData {
  vipLevelIcons: VipLevelIcons
  vipNameColors: VipNameColors
  checkInVip1Reward: number
  checkInVip2Reward: number
  checkInVip3Reward: number
  checkInVipMakeUpCardPrice: number
  checkInVip1MakeUpCardPrice: number
  checkInVip2MakeUpCardPrice: number
  checkInVip3MakeUpCardPrice: number
  postOfflineVip1Price: number
  postOfflineVip2Price: number
  postOfflineVip3Price: number
  inviteCodeVip1Price: number
  inviteCodeVip2Price: number
  inviteCodeVip3Price: number
  nicknameChangeVip1PointCost: number
  nicknameChangeVip2PointCost: number
  nicknameChangeVip3PointCost: number
  introductionChangeVip1PointCost: number
  introductionChangeVip2PointCost: number
  introductionChangeVip3PointCost: number
  avatarChangeVip1PointCost: number
  avatarChangeVip2PointCost: number
  avatarChangeVip3PointCost: number
  vipMonthlyPrice: number
  vipQuarterlyPrice: number
  vipYearlyPrice: number
}
