export type AdminUserManageAction =
  | "activate"
  | "mute"
  | "ban"
  | "promoteModerator"
  | "setAdmin"
  | "demoteToUser"
  | "vip"
  | "vipConfigure"

export interface AdminUserModeratedZoneScope {
  zoneId: string
  zoneName: string
  zoneSlug: string
  canEditSettings: boolean
}

export interface AdminUserModeratedBoardScope {
  boardId: string
  boardName: string
  boardSlug: string
  zoneId: string | null
  zoneName: string | null
  zoneSlug: string | null
  canEditSettings: boolean
}

export interface AdminUserListItem {
  id: number
  username: string
  displayName: string
  nickname: string | null
  role: string
  status: string
  email: string | null
  phone: string | null
  points: number
  level: number
  vipLevel: number
  vipExpiresAt: string | null
  inviteCount: number
  inviterName: string | null
  postCount: number
  commentCount: number
  checkInDays: number
  favoriteCount: number
  likeReceivedCount: number
  lastLoginAt: string | null
  lastLoginIp: string | null
  createdAt: string
  bio: string
  moderatedZoneScopes: AdminUserModeratedZoneScope[]
  moderatedBoardScopes: AdminUserModeratedBoardScope[]
}

export interface AdminUserListResult {
  users: AdminUserListItem[]
  moderatorScopeOptions: {
    zones: Array<{
      id: string
      name: string
      slug: string
    }>
    boards: Array<{
      id: string
      name: string
      slug: string
      zoneId: string | null
      zoneName: string | null
    }>
  } | null
  summary: {
    total: number
    active: number
    muted: number
    banned: number
    admin: number
    moderator: number
    vip: number
    inactive: number
  }
  filters: {
    keyword: string
    role: string
    status: string
    vip: string
    activity: string
    sort: string
  }
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
}

export interface AdminUserEditableProfile {
  nickname: string
  email: string
  phone: string
  bio: string
  introduction: string
  gender: string
}

export interface AdminUserDetailLogItem {
  id: string
  occurredAt: string
  title: string
  description: string
  meta: string[]
  tone: "default" | "success" | "warning" | "danger" | "info"
}

export interface AdminUserDetailLogSection {
  key: "login" | "checkins" | "points" | "uploads" | "admin"
  title: string
  description: string
  total: number
  href: string
  emptyText: string
  items: AdminUserDetailLogItem[]
}

export interface AdminUserDetailResult {
  id: number
  username: string
  displayName: string
  nickname: string | null
  role: string
  status: string
  email: string | null
  phone: string | null
  points: number
  level: number
  vipLevel: number
  vipExpiresAt: string | null
  inviteCount: number
  inviterName: string | null
  postCount: number
  commentCount: number
  checkInDays: number
  favoriteCount: number
  likeReceivedCount: number
  lastLoginAt: string | null
  lastLoginIp: string | null
  createdAt: string
  bio: string
  editableProfile: AdminUserEditableProfile
  moderatedZoneScopes: AdminUserModeratedZoneScope[]
  moderatedBoardScopes: AdminUserModeratedBoardScope[]
  logSections: AdminUserDetailLogSection[]
}

