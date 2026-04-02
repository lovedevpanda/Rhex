import { isVipActive, type VipStateSource } from "@/lib/vip-status"

export interface PostAccessRequirements {
  minViewLevel: number
  minViewVipLevel: number
}

export interface PostAccessPermission {
  allowed: boolean
  message: string
}

export interface PostAccessSource {
  minViewLevel?: number | null
  minViewVipLevel?: number | null
}

export function resolvePostAccessRequirements(source?: PostAccessSource | null): PostAccessRequirements {
  return {
    minViewLevel: source?.minViewLevel ?? 0,
    minViewVipLevel: source?.minViewVipLevel ?? 0,
  }
}

export function checkPostAccessPermission(
  user: ({ level: number } & VipStateSource) | null,
  requirements: PostAccessRequirements,
): PostAccessPermission {
  const currentVipLevel = isVipActive(user) ? Math.max(0, user?.vipLevel ?? 0) : 0

  if (requirements.minViewVipLevel > 0 && currentVipLevel < requirements.minViewVipLevel) {
    return {
      allowed: false,
      message: `该帖子要求至少 VIP ${requirements.minViewVipLevel}`,
    }
  }

  if ((user?.level ?? 0) < requirements.minViewLevel) {
    return {
      allowed: false,
      message: `该帖子要求用户等级至少达到 Lv.${requirements.minViewLevel}`,
    }
  }

  return {
    allowed: true,
    message: "",
  }
}

export function mergeAccessPermissions(...permissions: PostAccessPermission[]): PostAccessPermission {
  return permissions.find((permission) => !permission.allowed) ?? { allowed: true, message: "" }
}
