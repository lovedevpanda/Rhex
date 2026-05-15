import { getCurrentUser } from "@/lib/auth"
import { getBadgeEligibilitySnapshot, getDisplayedBadgesForUser, type DisplayedUserBadgeItem } from "@/lib/badges"
import { isUserFollowingTarget } from "@/lib/follows"
import { formatNumber, serializeDate } from "@/lib/formatters"
import { buildUserProfileRadarData, type UserProfileRadarData } from "@/lib/user-profile-radar"
import { canViewUserProfileVisibility } from "@/lib/user-profile-settings"
import { getUserProfileAccessState } from "@/lib/user-blocks"
import { getUserProfile, type SiteUserProfile } from "@/lib/users"
import { getVipLevel, isVipActive } from "@/lib/vip-status"

export interface UserPreviewCardData {
  allowed: boolean
  reason?: string
  profileHref?: string
  postsHref?: string
  collectionsHref?: string
  repliesHref?: string
  canViewIntroduction?: boolean
  canViewRecentActivity?: boolean
  user?: {
    id: number
    username: string
    displayName: string
    role: SiteUserProfile["role"]
    bio: string
    avatarPath?: string | null
    vipActive: boolean
    vipLevel: number | null
    status: SiteUserProfile["status"]
    level: number
    levelName?: string
    createdAt: string
    joinedDateText: string
    likeReceivedCount: number
    followerCount: number
    postCount: number
    commentCount: number
    verification: SiteUserProfile["verification"]
    displayedBadges: DisplayedUserBadgeItem[]
  }
  follow?: {
    canFollow: boolean
    initialFollowed: boolean
  }
  canSendMessage?: boolean
  radarData?: UserProfileRadarData | null
}

export async function getUserPreviewCardData(username: string): Promise<UserPreviewCardData | null> {
  const normalizedUsername = username.trim()

  if (!normalizedUsername) {
    return null
  }

  const [user, currentUser] = await Promise.all([
    getUserProfile(normalizedUsername),
    getCurrentUser(),
  ])

  if (!user) {
    return null
  }

  const profileAccess = await getUserProfileAccessState(currentUser?.id, user.id)
  const visibilityContext = {
    isOwner: currentUser?.id === user.id,
    isLoggedIn: Boolean(currentUser),
  }
  const canViewIntroduction = profileAccess.allowed
    ? canViewUserProfileVisibility(user.introductionVisibility, visibilityContext)
    : false
  const canViewRecentActivity = profileAccess.allowed
    ? canViewUserProfileVisibility(user.activityVisibility, visibilityContext)
    : false

  const [displayedBadges, radarSnapshot, initialFollowed] = await Promise.all([
    getDisplayedBadgesForUser(user.id),
    getBadgeEligibilitySnapshot(user.id),
    currentUser && currentUser.id !== user.id && !profileAccess.relation.isBlocked
      ? isUserFollowingTarget({
        userId: currentUser.id,
        targetType: "user",
        targetId: user.id,
      })
      : Promise.resolve(false),
  ])
  const vipActive = isVipActive(user)
  const vipLevel = vipActive ? getVipLevel(user) : null

  return {
    allowed: profileAccess.allowed,
    reason: profileAccess.allowed ? undefined : profileAccess.reason,
    profileHref: `/users/${user.username}`,
    postsHref: `/users/${user.username}?tab=posts`,
    collectionsHref: `/users/${user.username}?tab=collections`,
    repliesHref: `/users/${user.username}?tab=replies`,
    canViewIntroduction,
    canViewRecentActivity,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      bio: user.bio,
      avatarPath: user.avatarPath,
      vipActive,
      vipLevel,
      status: user.status,
      level: user.level,
      levelName: user.levelName,
      createdAt: user.createdAt,
      joinedDateText: serializeDate(user.createdAt) ?? user.createdAt,
      likeReceivedCount: user.likeReceivedCount,
      followerCount: user.followerCount,
      postCount: user.postCount,
      commentCount: user.commentCount,
      verification: user.verification,
      displayedBadges,
    },
    follow: {
      canFollow: (!currentUser || currentUser.id !== user.id) && !profileAccess.relation.isBlocked,
      initialFollowed,
    },
    canSendMessage: Boolean(currentUser && currentUser.id !== user.id && !profileAccess.relation.isBlocked),
    radarData: buildUserProfileRadarData({
      user,
      snapshot: radarSnapshot,
    }),
  }
}

export function getPreviewCardAccessSummary(data: UserPreviewCardData) {
  if (!data.allowed) {
    return data.reason ?? "当前无法查看该用户资料。"
  }

  const user = data.user
  if (!user) {
    return ""
  }

  const parts = [
    `Lv.${user.level}${user.levelName ? ` ${user.levelName}` : ""}`,
    `#${formatNumber(user.id)}`,
    user.joinedDateText,
  ]

  return parts.join(" · ")
}
