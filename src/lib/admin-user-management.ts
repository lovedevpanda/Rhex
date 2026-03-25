export type AdminUserManageAction =
  | "activate"
  | "mute"
  | "ban"
  | "promoteModerator"
  | "setAdmin"
  | "demoteToUser"
  | "vip"
  | "vipConfigure"

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
  loginLogs: Array<{
    id: string
    ip: string | null
    createdAt: string
    userAgent: string | null
  }>
}

export interface AdminUserListResult {
  users: AdminUserListItem[]
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

