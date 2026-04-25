import { resolvePagination } from "@/db/helpers"
import { countUserPublicPostsByUsername, countVisibleUserRepliesByUsername, findUserAccountSettingsById, findUserPostsByUsername, findUserProfileByUsername, findUserRepliesByUsername } from "@/db/user-queries"
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

const USER_PROFILE_POSTS_PAGE_SIZE = 10
const USER_PROFILE_REPLIES_PAGE_SIZE = 6
const USER_PROFILE_ACTIVE_BOARDS_LIMIT = 5
const USER_PROFILE_ACTIVE_BOARD_BATCH_SIZE = 20
const USER_PROFILE_ACTIVE_BOARD_MAX_BATCHES = 10

export interface SiteUserProfile {
  id: number
  createdAt: string
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
    customIconText?: string | null
    description?: string | null
    customDescription?: string | null
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

export interface UserActiveBoardItem {
  slug: string
  name: string
  iconPath?: string | null
  lastRepliedAt: string
  activityCount: number
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
      createdAt: user.createdAt.toISOString(),
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
            customIconText: approvedVerification.customIconText,
            description: approvedVerification.type.description,
            customDescription: approvedVerification.customDescription,
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

export async function getUserPostsPage(username: string, input: { page?: unknown } = {}) {
  try {
    const total = await countUserPublicPostsByUsername(username)
    const pagination = resolvePagination(
      { page: input.page, pageSize: USER_PROFILE_POSTS_PAGE_SIZE },
      total,
      [USER_PROFILE_POSTS_PAGE_SIZE],
      USER_PROFILE_POSTS_PAGE_SIZE,
    )
    const [posts, anonymousMaskIdentity] = await Promise.all([
      findUserPostsByUsername(username, {
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      getAnonymousMaskDisplayIdentity(),
    ])

    return {
      items: posts.map((post) => mapListPost(post, anonymousMaskIdentity)),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages: pagination.totalPages,
        hasPrevPage: pagination.hasPrevPage,
        hasNextPage: pagination.hasNextPage,
      },
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      pagination: {
        page: 1,
        pageSize: USER_PROFILE_POSTS_PAGE_SIZE,
        total: 0,
        totalPages: 1,
        hasPrevPage: false,
        hasNextPage: false,
      },
    }
  }
}

export async function getUserPosts(username: string) {
  const page = await getUserPostsPage(username, { page: 1 })
  return page.items
}

export async function getUserRecentRepliesPage(username: string, input: { page?: unknown } = {}) {
  try {
    const total = await countVisibleUserRepliesByUsername(username)
    const pagination = resolvePagination(
      { page: input.page, pageSize: USER_PROFILE_REPLIES_PAGE_SIZE },
      total,
      [USER_PROFILE_REPLIES_PAGE_SIZE],
      USER_PROFILE_REPLIES_PAGE_SIZE,
    )
    const replies = await findUserRepliesByUsername(username, {
      skip: pagination.skip,
      take: pagination.pageSize,
    })

    return {
      items: replies.map((reply) => ({
        id: reply.id,
        content: reply.content,
        createdAt: reply.createdAt.toISOString(),
        postId: reply.post.id,
        postTitle: reply.post.title,
        postSlug: reply.post.slug,
        boardName: reply.post.board.name,
        boardSlug: reply.post.board.slug,
        boardIcon: reply.post.board.iconPath ?? "💬",
        likeCount: reply.likeCount,
        replyToUsername: reply.replyToUser?.username ?? null,
      })),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages: pagination.totalPages,
        hasPrevPage: pagination.hasPrevPage,
        hasNextPage: pagination.hasNextPage,
      },
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      pagination: {
        page: 1,
        pageSize: USER_PROFILE_REPLIES_PAGE_SIZE,
        total: 0,
        totalPages: 1,
        hasPrevPage: false,
        hasNextPage: false,
      },
    }
  }
}

export async function getUserRecentReplies(username: string, limit = USER_PROFILE_REPLIES_PAGE_SIZE) {
  const page = await getUserRecentRepliesPage(username, { page: 1 })
  return page.items.slice(0, limit)
}

export async function getUserActiveBoardsByRecentReplies(username: string, limit = USER_PROFILE_ACTIVE_BOARDS_LIMIT): Promise<UserActiveBoardItem[]> {
  const normalizedLimit = Math.min(USER_PROFILE_ACTIVE_BOARDS_LIMIT, Math.max(0, Math.trunc(limit)))

  if (normalizedLimit === 0) {
    return []
  }

  return withRuntimeFallback(async () => {
    const boardActivityMap = new Map<string, UserActiveBoardItem>()
    let skip = 0

    for (let batchIndex = 0; batchIndex < USER_PROFILE_ACTIVE_BOARD_MAX_BATCHES; batchIndex += 1) {
      const replies = await findUserRepliesByUsername(username, {
        skip,
        take: USER_PROFILE_ACTIVE_BOARD_BATCH_SIZE,
      })

      if (replies.length === 0) {
        break
      }

      for (const reply of replies) {
        const board = reply.post.board
        const existingBoard = boardActivityMap.get(board.slug)

        if (existingBoard) {
          existingBoard.activityCount += 1

          if (reply.createdAt.toISOString() > existingBoard.lastRepliedAt) {
            existingBoard.lastRepliedAt = reply.createdAt.toISOString()
          }

          continue
        }

        boardActivityMap.set(board.slug, {
          slug: board.slug,
          name: board.name,
          iconPath: board.iconPath,
          lastRepliedAt: reply.createdAt.toISOString(),
          activityCount: 1,
        })
      }

      if (replies.length < USER_PROFILE_ACTIVE_BOARD_BATCH_SIZE) {
        break
      }

      skip += replies.length
    }

    return [...boardActivityMap.values()]
      .sort((left, right) => {
        const activityDifference = right.activityCount - left.activityCount

        if (activityDifference !== 0) {
          return activityDifference
        }

        return right.lastRepliedAt.localeCompare(left.lastRepliedAt)
      })
      .slice(0, normalizedLimit)
  }, {
    area: "users",
    action: "getUserActiveBoardsByRecentReplies",
    message: "用户活跃节点加载失败",
    metadata: {
      username,
      limit: normalizedLimit,
    },
    fallback: [],
  })
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
    notificationPreferences: profileSettings.notificationPreferences,
  }
}
