import { countUserPublicPostsByUsername, findUserAccountSettingsById, findUserPostsByUsername, findUserProfileByUsername, findUserRepliesByUsername } from "@/db/user-queries"
import { getCurrentSessionActor } from "@/lib/auth"
import { getLevelBadgeData } from "@/lib/level-badge"
import { getAnonymousMaskDisplayIdentity } from "@/lib/post-anonymous"
import { mapListPost } from "@/lib/post-map"
import type { UserProfileVisibility } from "@/lib/user-profile-settings"
import { resolveUserProfileSettings } from "@/lib/user-profile-settings"
import { getUserDisplayName } from "@/lib/user-display"
import { withRuntimeFallback } from "@/lib/runtime-errors"

export type PublicUserStatus = "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
export type PublicUserRole = "USER" | "MODERATOR" | "ADMIN"

export { getUserDisplayName }
export type { UserDisplayNameSource } from "@/lib/user-display"

export interface SiteUserProfile {
  id: number
  username: string
  displayName: string
  role: PublicUserRole
  bio: string
  introduction: string
  avatarPath?: string | null
  gender?: string | null
  status: PublicUserStatus
  level: number
  levelName?: string
  levelColor?: string
  levelIcon?: string
  points: number
  vipLevel?: number
  vipExpiresAt?: string | null
  inviteCount: number
  inviterUsername?: string | null
  verification?: {
    id: string
    name: string
    color: string
    iconText?: string | null
  } | null
  activityVisibility: UserProfileVisibility
  introductionVisibility: UserProfileVisibility
  postCount: number
  commentCount: number
  likeReceivedCount: number
  followerCount: number
  favoriteCount?: number
  boardCount?: number
}

export async function getUserProfile(username: string): Promise<SiteUserProfile | null> {
  return withRuntimeFallback(async () => {
    const [user, publicPostCount] = await Promise.all([
      findUserProfileByUsername(username),
      countUserPublicPostsByUsername(username),
    ])

    if (!user) {
      return null
    }

    const levelBadge = await getLevelBadgeData(user.level)
    const approvedVerification = user.verificationApplications?.[0]
    const profileSettings = resolveUserProfileSettings(user.signature)

    return {
      id: Number(user.id),
      username: user.username,
      displayName: getUserDisplayName(user),
      role: user.role,
      bio: user.bio ?? "这个用户还没有留下简介。",
      introduction: profileSettings.introduction,
      avatarPath: user.avatarPath,
      gender: user.gender,
      status: user.status,
      level: user.level,
      levelName: levelBadge.name,
      levelColor: levelBadge.color,
      levelIcon: levelBadge.icon,
      points: user.points,
      vipLevel: user.vipLevel,
      vipExpiresAt: user.vipExpiresAt?.toISOString() ?? null,
      inviteCount: user.inviteCount,
      inviterUsername: user.inviter?.username ?? null,
      verification: approvedVerification
        ? {
            id: approvedVerification.type.id,
            name: approvedVerification.type.name,
            color: approvedVerification.type.color,
            iconText: approvedVerification.type.iconText,
          }
        : null,
      activityVisibility: profileSettings.activityVisibility,
      introductionVisibility: profileSettings.introductionVisibility,
      postCount: publicPostCount,
      commentCount: user.commentCount,
      likeReceivedCount: user.likeReceivedCount,
      followerCount: user._count.followedByUsers,
      favoriteCount: user._count.favorites,
      boardCount: user._count.boardFollows,
    }
  }, {
    area: "users",
    action: "getUserProfile",
    message: "用户资料加载失败",
    metadata: { username },
    fallback: null,
  })
}

export async function getCurrentUserProfile(): Promise<SiteUserProfile | null> {
  const actor = await getCurrentSessionActor()

  if (!actor) {
    return null
  }

  return getUserProfile(actor.username)
}

export async function getUserPosts(username: string) {
  try {
    const [posts, anonymousMaskIdentity] = await Promise.all([
      findUserPostsByUsername(username),
      getAnonymousMaskDisplayIdentity(),
    ])

    return posts.map((post) => mapListPost(post, anonymousMaskIdentity))
  } catch (error) {
    console.error(error)
    return []
  }
}

export async function getUserRecentReplies(username: string, limit = 20) {
  try {
    const replies = await findUserRepliesByUsername(username, limit)

    return replies.map((reply) => ({
      id: reply.id,
      content: reply.content,
      createdAt: reply.createdAt.toISOString(),
      postId: reply.post.id,
      postTitle: reply.post.title,
      postSlug: reply.post.slug,
      boardName: reply.post.board.name,
      likeCount: reply.likeCount,
      replyToUsername: reply.replyToUser?.username ?? null,
    }))
  } catch (error) {
    console.error(error)
    return []
  }
}

export async function getUserAccountSettings(userId: number) {
  const settings = await findUserAccountSettingsById(userId)
  if (!settings) {
    return null
  }

  const profileSettings = resolveUserProfileSettings(settings.signature)

  return {
    ...settings,
    activityVisibility: profileSettings.activityVisibility,
    introductionVisibility: profileSettings.introductionVisibility,
    externalNotificationEnabled: profileSettings.externalNotificationEnabled,
    notificationWebhookUrl: profileSettings.notificationWebhookUrl,
  }
}
