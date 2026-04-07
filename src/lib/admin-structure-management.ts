export interface ZoneItem {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  sortOrder: number
  hiddenFromSidebar: boolean
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
  postListLoadMode: string | null
  canEditSettings: boolean
}

export interface BoardItem {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  sidebarLinks: Array<{
    title: string
    url: string
    icon: string | null
    titleColor: string | null
  }>
  rulesMarkdown: string | null
  moderatorsCanWithdrawTreasury: boolean
  sortOrder: number
  zoneId: string | null
  zoneName: string | null
  status: string
  allowPost: boolean
  postCount: number
  followerCount: number
  todayPostCount: number
  treasuryPoints: number
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
  postListLoadMode: string | null
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
  boardApplications: Array<{
    id: string
    applicantId: number
    zoneId: string
    boardId: string | null
    name: string
    slug: string
    description: string
    icon: string
    reason: string
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
    reviewNote: string
    reviewedAt: string | null
    createdAt: string
    applicant: {
      id: number
      username: string
      displayName: string
      role: "USER" | "MODERATOR" | "ADMIN"
      status: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
    }
    reviewer: {
      id: number
      displayName: string
    } | null
    zone: {
      id: string
      name: string
      slug: string
    }
    board: {
      id: string
      name: string
      slug: string
      treasuryPoints: number
    } | null
  }>
  canReviewBoardApplications: boolean
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
