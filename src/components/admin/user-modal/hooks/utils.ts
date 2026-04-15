import type { AdminUserEditableProfile, AdminUserListItem } from "@/lib/admin-user-management"

import type { ApiEnvelope, EditableScopeItem } from "@/components/admin/user-modal/types"

export function toEditableScopes<T extends { canEditSettings: boolean; canWithdrawTreasury: boolean }>(items: T[], key: keyof T) {
  return items.map((item) => ({
    id: String(item[key]),
    canEditSettings: item.canEditSettings,
    canWithdrawTreasury: item.canWithdrawTreasury,
  })) satisfies EditableScopeItem[]
}

export function buildFallbackProfile(user: AdminUserListItem): AdminUserEditableProfile {
  return {
    nickname: user.nickname ?? user.username,
    email: user.email ?? "",
    phone: user.phone ?? "",
    bio: user.bio ?? "",
    introduction: "",
    gender: "unknown",
  }
}

export async function parseResponse<T>(response: Response) {
  return (await response.json().catch(() => null)) as ApiEnvelope<T> | null
}
