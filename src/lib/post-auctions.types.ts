import type {
  LocalPostAuctionMode,
  LocalPostAuctionPricingRule,
} from "@/lib/post-auction-types"

export interface NormalizedPostAuctionConfig {
  mode: LocalPostAuctionMode
  pricingRule: LocalPostAuctionPricingRule
  startPrice: number
  incrementStep: number
  startsAt: Date | null
  endsAt: Date
  winnerOnlyContent: string
  winnerOnlyContentPreview: string | null
}

export interface PostAuctionVisibleBidRecord {
  id: string
  userId: number
  userName: string
  amount: number
  createdAt: string
}

export interface PostAuctionParticipantPreview {
  userId: number
  userName: string
  avatarPath: string | null
  isVip: boolean
  vipLevel: number | null
  amount: number | null
  isLeader: boolean
}

export interface PostAuctionParticipantPageItem {
  id: string
  userId: number
  userName: string
  createdAt: string
  amount: number | null
}

export interface PostAuctionSummary {
  id: string
  mode: LocalPostAuctionMode
  modeLabel: string
  status: string
  statusLabel: string
  pricingRule: LocalPostAuctionPricingRule
  pricingRuleLabel: string
  startPrice: number
  incrementStep: number
  startsAt: string | null
  endsAt: string
  participantCount: number
  bidCount: number
  leaderBidAmount: number | null
  leaderUserId: number | null
  winnerUserId: number | null
  winnerUserName: string | null
  winnerAvatarPath: string | null
  winnerIsVip: boolean
  winnerVipLevel: number | null
  winningBidAmount: number | null
  finalPrice: number | null
  settledAt: string | null
  hasStarted: boolean
  hasEnded: boolean
  minNextBidAmount: number
  viewerIsSeller: boolean
  viewerHasJoined: boolean
  viewerBidAmount: number | null
  viewerFrozenAmount: number | null
  viewerStatus: string | null
  viewerIsLeader: boolean
  viewerCanBid: boolean
  viewerCanViewWinnerContent: boolean
  winnerOnlyContentPreview: string | null
  winnerOnlyContent: string | null
  participantPreviews: PostAuctionParticipantPreview[]
}

export interface PostAuctionBidRecordPage {
  items: PostAuctionVisibleBidRecord[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export interface PostAuctionParticipantPage {
  items: PostAuctionParticipantPageItem[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}
