export interface ZoneItem {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  sortOrder: number
  boardCount: number
  postCount: number
  followerCount: number
  requirePostReview: boolean
  postPointDelta: number
  replyPointDelta: number
  postIntervalSeconds: number
  replyIntervalSeconds: number
  allowedPostTypes: string
  minViewPoints: number
  minViewLevel: number
  minPostPoints: number
  minPostLevel: number
  minReplyPoints: number
  minReplyLevel: number
  minViewVipLevel: number

  minPostVipLevel: number
  minReplyVipLevel: number
  postListDisplayMode: string | null
  canEditSettings: boolean
}

export interface BoardItem {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  sortOrder: number
  zoneId: string | null
  zoneName: string | null
  status: string
  allowPost: boolean
  postCount: number
  followerCount: number
  todayPostCount: number
  requirePostReview: boolean | null
  postPointDelta: number | null
  replyPointDelta: number | null
  postIntervalSeconds: number | null
  replyIntervalSeconds: number | null
  allowedPostTypes: string | null
  minViewPoints: number | null
  minViewLevel: number | null
  minPostPoints: number | null
  minPostLevel: number | null
  minReplyPoints: number | null
  minReplyLevel: number | null
  minViewVipLevel: number | null

  minPostVipLevel: number | null
  minReplyVipLevel: number | null
  postListDisplayMode: string | null
  canEditSettings: boolean
}

export interface StructureManagerData {
  zones: ZoneItem[]
  boards: BoardItem[]
  permissions: {
    canCreateZone: boolean
    canCreateBoard: boolean
    canDeleteZone: boolean
    canDeleteBoard: boolean
  }
  filters: {
    keyword: string
    zoneId: string
    boardStatus: string
    posting: string
  }
  summary: {
    zoneCount: number
    boardCount: number
    activeBoardCount: number
    hiddenBoardCount: number
    reviewBoardCount: number
    lockedPostingBoardCount: number
  }
}
