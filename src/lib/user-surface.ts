import { unstable_cache, revalidateTag } from "next/cache"
import { cache } from "react"

import { getUnreadConversationCount } from "@/db/message-read-queries"
import { countUnreadNotifications } from "@/db/notification-read-queries"
import {
  countUserSurfaceBoardFollows,
  countUserSurfaceFavorites,
  findUserSurfaceBaseById,
  findUserSurfaceCheckInRecord,
  type UserSurfaceBaseRecord,
} from "@/db/user-surface-queries"
import { getCurrentUser, type SessionActor } from "@/lib/auth"
import { getUserCheckInStreakSummary } from "@/lib/check-in-streak-service"
import { getLocalDateKey } from "@/lib/date-key"

export interface UserSurfaceSnapshot {
  unreadNotificationCount: number
  unreadMessageCount: number
  boardCount: number
  favoriteCount: number
  followerCount: number
  postCount: number
  receivedLikeCount: number
  points: number
  checkedInToday: boolean
  currentCheckInStreak: number
  maxCheckInStreak: number
}

export const USER_SURFACE_CACHE_TAG = "user-surface"

const USER_SURFACE_CACHE_REVALIDATE_SECONDS = 15

function getUserSurfaceCacheTag(userId: number) {
  return `${USER_SURFACE_CACHE_TAG}:${userId}`
}

function isMissingRevalidateStoreError(error: unknown) {
  return error instanceof Error
    && error.message.startsWith("Invariant: static generation store missing in revalidateTag")
}

function isRenderPhaseRevalidateError(error: unknown) {
  return error instanceof Error
    && error.message.includes('used "revalidateTag ')
    && error.message.includes("during render which is unsupported")
}

function hasPersistedCheckInStreakSummary(progress: UserSurfaceBaseRecord["levelProgress"]) {
  if (!progress) {
    return false
  }

  if (progress.checkInDays === 0) {
    return true
  }

  return progress.maxCheckInStreak > 0 || progress.lastCheckInDate !== null
}

async function readUserSurfaceSnapshot(userId: number, todayKey: string): Promise<UserSurfaceSnapshot | null> {
  const user = await findUserSurfaceBaseById(userId)

  if (!user) {
    return null
  }

  const streakSummary = hasPersistedCheckInStreakSummary(user.levelProgress)
    ? {
        currentStreak: user.levelProgress?.currentCheckInStreak ?? 0,
        maxStreak: user.levelProgress?.maxCheckInStreak ?? 0,
      }
    : await getUserCheckInStreakSummary(userId)

  const [unreadNotificationCount, unreadMessageCount, boardCount, favoriteCount, checkInRecord] = await Promise.all([
    countUnreadNotifications(userId),
    getUnreadConversationCount(userId),
    countUserSurfaceBoardFollows(userId),
    countUserSurfaceFavorites(userId),
    findUserSurfaceCheckInRecord(userId, todayKey),
  ])

  return {
    unreadNotificationCount,
    unreadMessageCount,
    boardCount,
    favoriteCount,
    followerCount: user._count.followedByUsers,
    postCount: user.postCount,
    receivedLikeCount: user.likeReceivedCount,
    points: user.points,
    checkedInToday: Boolean(checkInRecord),
    currentCheckInStreak: streakSummary.currentStreak,
    maxCheckInStreak: streakSummary.maxStreak,
  }
}

async function getPersistentUserSurfaceSnapshot(userId: number, todayKey: string) {
  return unstable_cache(
    async (): Promise<UserSurfaceSnapshot | null> => readUserSurfaceSnapshot(userId, todayKey),
    [USER_SURFACE_CACHE_TAG, String(userId), todayKey],
    {
      tags: [USER_SURFACE_CACHE_TAG, getUserSurfaceCacheTag(userId)],
      revalidate: USER_SURFACE_CACHE_REVALIDATE_SECONDS,
    },
  )()
}

const getCachedUserSurfaceSnapshot = cache(async (userId?: number | null, todayKey?: string) => {
  if (!userId) {
    return null
  }

  return getPersistentUserSurfaceSnapshot(userId, todayKey ?? getLocalDateKey())
})

export async function getUserSurfaceSnapshot(userId?: number | null) {
  return getCachedUserSurfaceSnapshot(userId, getLocalDateKey())
}

export async function resolveUserSurfaceSnapshot(user: SessionActor | null) {
  return getUserSurfaceSnapshot(user?.id)
}

export async function getCurrentUserSurfaceSnapshot() {
  const user = await getCurrentUser()
  return resolveUserSurfaceSnapshot(user)
}

export function revalidateUserSurfaceCache(userId?: number | null) {
  const tag = userId ? getUserSurfaceCacheTag(userId) : USER_SURFACE_CACHE_TAG

  try {
    // User-surface data powers read-your-own-writes UI like header unread badges.
    // Expire immediately so the next request blocks for fresh data instead of
    // serving stale counts and updating later in the background.
    revalidateTag(tag, { expire: 0 })
  } catch (error) {
    // Background workers and render-time recovery paths do not have a legal
    // revalidation context. The cache still self-heals via the short TTL.
    if (isMissingRevalidateStoreError(error) || isRenderPhaseRevalidateError(error)) {
      return
    }

    throw error
  }
}
