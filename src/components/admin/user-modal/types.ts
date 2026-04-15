import type {
  AdminUserDetailResult,
  AdminUserEditableProfile,
  AdminUserListItem,
  AdminUserListResult,
} from "@/lib/admin-user-management"

export interface AdminUserModalProps {
  user: AdminUserListItem
  moderatorScopeOptions: AdminUserListResult["moderatorScopeOptions"]
}

export interface EditableScopeItem {
  id: string
  canEditSettings: boolean
  canWithdrawTreasury: boolean
}

export interface ApiEnvelope<T> {
  code: number
  message?: string
  data?: T
}

export type AdminUserModalTab = "profile" | "activity" | "permissions" | "actions"

export const ADMIN_USER_MODAL_TABS: Array<{ key: AdminUserModalTab; label: string }> = [
  { key: "profile", label: "资料" },
  { key: "activity", label: "活动" },
  { key: "permissions", label: "权限" },
  { key: "actions", label: "操作" },
]

export function getAdminUserModalTabLabel(tab: AdminUserModalTab) {
  return ADMIN_USER_MODAL_TABS.find((item) => item.key === tab)?.label ?? "资料"
}

export interface AdminUserMetricItem {
  label: string
  value: string
}

export interface ProfileFormState {
  draft: AdminUserEditableProfile
  feedback: string
  adminNote: string
  noteFeedback: string
}

export interface PermissionsFormState {
  message: string
  feedback: string
  scopeFeedback: string
  zoneScopes: EditableScopeItem[]
  boardScopes: EditableScopeItem[]
}

export interface AccountFormState {
  statusMessage: string
  statusFeedback: string
  newPassword: string
  confirmPassword: string
  passwordMessage: string
  passwordFeedback: string
}

export interface OperationsFormState {
  points: string
  pointsMessage: string
  pointsFeedback: string
  vipLevelDraft: string
  vipExpiresAtDraft: string
  vipMessage: string
  vipFeedback: string
  badgeId: string
  badgeMessage: string
  badgeFeedback: string
  notificationTitle: string
  notificationContent: string
  notificationMessage: string
  notificationFeedback: string
}

export interface UserModalDataState {
  activeTab: AdminUserModalTab
  detail: AdminUserDetailResult | null
  detailError: string
  isLoadingDetail: boolean
  activeUser: AdminUserDetailResult | AdminUserListItem
  vipActive: boolean
  isModerator: boolean
  metrics: AdminUserMetricItem[]
  grantableBadges: NonNullable<AdminUserDetailResult["availableBadges"]>
  setActiveTab: (tab: AdminUserModalTab) => void
  reloadDetail: () => void
  refreshData: () => void
}
