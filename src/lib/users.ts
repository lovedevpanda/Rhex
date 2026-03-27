import { findUserAccountSettingsById, findUserPostsByUsername, findUserProfileByUsername } from "@/db/user-queries"
import { getCurrentSessionActor } from "@/lib/auth"
import { getLevelBadgeData } from "@/lib/level-badge"
import { mapListPost } from "@/lib/post-map"
import { withRuntimeFallback } from "@/lib/runtime-errors"

export type PublicUserStatus = "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"

export interface UserDisplayNameSource {
  username: string
  nickname?: string | null
}

export function getUserDisplayName(user: UserDisplayNameSource | null | undefined, fallback = "") {
  if (!user) {
    return fallback
  }

  const nickname = user.nickname?.trim()
  return nickname || user.username || fallback
}

export interface SiteUserProfile {
  id: number
  username: string
  displayName: string
  bio: string
  avatarPath?: string | null
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

  postCount: number
  commentCount: number
  likeReceivedCount: number
  favoriteCount?: number
  boardCount?: number
}


export async function getUserProfile(username: string): Promise<SiteUserProfile | null> {
  return withRuntimeFallback(async () => {
    const user = await findUserProfileByUsername(username)

    if (!user) {
      return null
    }

    const levelBadge = await getLevelBadgeData(user.level)
    const approvedVerification = user.verificationApplications?.[0]

    return {
      id: Number(user.id),
      username: user.username,
      displayName: getUserDisplayName(user),
      bio: user.bio ?? "这个用户还没有留下简介。",
      avatarPath: user.avatarPath,
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
      postCount: user.postCount,
      commentCount: user.commentCount,
      likeReceivedCount: user.likeReceivedCount,
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
    const posts = await findUserPostsByUsername(username)

    return posts.map(mapListPost)
  } catch (error) {
    console.error(error)
    return []
  }
}

export async function getUserAccountSettings(userId: number) {
  return findUserAccountSettingsById(userId)
}

