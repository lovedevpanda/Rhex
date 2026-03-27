import { getCurrentUserProfile as getCurrentUserProfileData, getUserProfile, type SiteUserProfile } from "@/lib/users"

export type { SiteUserProfile } from "@/lib/users"

export async function getCurrentUserProfile(): Promise<SiteUserProfile | null> {
  return getCurrentUserProfileData()
}

export async function requireCurrentUserProfile(): Promise<SiteUserProfile> {
  const profile = await getCurrentUserProfile()

  if (!profile) {
    throw new Error("当前登录用户不存在")
  }

  return profile
}

export { getUserProfile }
