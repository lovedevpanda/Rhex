import type { SidebarUserCardData } from "@/components/sidebar-user-card"
import { countSidebarUserBoardFollows, countSidebarUserFavorites, findHomeSidebarHotTopics, findSidebarCurrentUser, findSidebarUserCheckInRecord } from "@/db/home-sidebar-queries"
import type { getCurrentUser } from "@/lib/auth"
import { applyAnonymousIdentityToPost, getAnonymousMaskDisplayIdentity } from "@/lib/post-anonymous"
import { getUserCheckInStreakSummary } from "@/lib/check-in-streak-service"
import { getLocalDateKey } from "@/lib/date-key"
import { formatMonthDayTime } from "@/lib/formatters"
import { getLevelBadgeData } from "@/lib/level-badge"
import type { SiteSettingsData } from "@/lib/site-settings"
import { getUserDisplayName } from "@/lib/users"
import { getVipLevel, isVipActive } from "@/lib/vip-status"

function hasPersistedCheckInStreakSummary(progress: {
  checkInDays: number
  currentCheckInStreak: number
  maxCheckInStreak: number
  lastCheckInDate: string | null
} | null | undefined) {
  if (!progress) {
    return false
  }

  if (progress.checkInDays === 0) {
    return true
  }

  return progress.maxCheckInStreak > 0 || progress.lastCheckInDate !== null
}

export async function getHomeSidebarHotTopics(limit = 5) {
  const [posts, anonymousMaskIdentity] = await Promise.all([
    findHomeSidebarHotTopics(limit),
    getAnonymousMaskDisplayIdentity(),
  ])

  return posts.map((post) => ({
    ...(function () {
      const maskedAuthor = applyAnonymousIdentityToPost({
        isAnonymous: Boolean(post.isAnonymous),
        author: getUserDisplayName(post.author),
        authorUsername: post.author.username,
        authorAvatarPath: post.author.avatarPath,
      }, anonymousMaskIdentity)
      const latestReply = post.comments[0]
      const latestReplyAuthorName = post.isAnonymous && latestReply?.userId === post.author.id && latestReply.useAnonymousIdentity
        ? (anonymousMaskIdentity?.name ?? anonymousMaskIdentity?.username ?? "匿名用户")
        : getUserDisplayName(latestReply?.user ?? post.author)
      return {
        authorName: maskedAuthor.author,
        authorAvatarPath: maskedAuthor.authorAvatarPath,
        lastReplyAuthorName: latestReplyAuthorName,
      }
    })(),
    id: post.id,
    slug: post.slug,
    title: post.title,
    lastRepliedAt: formatMonthDayTime(post.lastCommentedAt ?? post.createdAt),
  }))
}

export async function getSidebarCurrentUserStats(username: string) {
  const user = await findSidebarCurrentUser(username)
  const todayKey = getLocalDateKey()

  if (!user) {
    return {
      boardCount: 0,
      favoriteCount: 0,
      followerCount: 0,
      postCount: 0,
      receivedLikeCount: 0,
      points: 0,
      checkedInToday: false,
      currentCheckInStreak: 0,
      maxCheckInStreak: 0,
    }
  }

  const streakSummary = hasPersistedCheckInStreakSummary(user.levelProgress)
    ? {
        currentStreak: user.levelProgress?.currentCheckInStreak ?? 0,
        maxStreak: user.levelProgress?.maxCheckInStreak ?? 0,
      }
    : await getUserCheckInStreakSummary(user.id)
  const [boardCount, favoriteCount, checkInRecord] = await Promise.all([
    countSidebarUserBoardFollows(user.id),
    countSidebarUserFavorites(user.id),
    findSidebarUserCheckInRecord(user.id, todayKey),
  ])

  return {
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

type SidebarUserSource = Awaited<ReturnType<typeof getCurrentUser>> | null

type SidebarUserStats = Awaited<ReturnType<typeof getSidebarCurrentUserStats>> | null

export async function buildSidebarUser(user: SidebarUserSource, stats: SidebarUserStats, settings: SiteSettingsData): Promise<SidebarUserCardData | null> {
  if (!user) {
    return null
  }

  const checkInReward = isVipActive(user)
    ? getVipLevel(user) >= 3
      ? settings.checkInVip3Reward
      : getVipLevel(user) === 2
        ? settings.checkInVip2Reward
        : settings.checkInVip1Reward
    : settings.checkInReward
  const level = Math.max(1, user.level ?? 1)
  const levelBadge = await getLevelBadgeData(level)

  return {
    username: user.username,
    nickname: user.nickname,
    avatarPath: user.avatarPath,
    role: user.role ?? "USER",
    status: user.status ?? "ACTIVE",
    level,
    levelName: levelBadge.name,
    levelColor: levelBadge.color,
    levelIcon: levelBadge.icon,
    vipLevel: user.vipLevel ?? 0,
    vipExpiresAt: user.vipExpiresAt?.toString?.() ?? null,
    boardCount: stats?.boardCount ?? 0,
    favoriteCount: stats?.favoriteCount ?? 0,
    followerCount: stats?.followerCount ?? 0,
    postCount: stats?.postCount ?? 0,
    receivedLikeCount: stats?.receivedLikeCount ?? 0,
    points: stats?.points ?? user.points ?? 0,
    pointName: settings.pointName,
    checkInEnabled: settings.checkInEnabled,
    checkInReward,
    checkInMakeUpCardPrice: settings.checkInMakeUpCardPrice,
    checkInVipMakeUpCardPrice: settings.checkInVipMakeUpCardPrice,
    checkInVip1MakeUpCardPrice: settings.checkInVip1MakeUpCardPrice,
    checkInVip2MakeUpCardPrice: settings.checkInVip2MakeUpCardPrice,
    checkInVip3MakeUpCardPrice: settings.checkInVip3MakeUpCardPrice,
    checkInMakeUpCountsTowardStreak: settings.checkInMakeUpCountsTowardStreak,
    checkedInToday: stats?.checkedInToday ?? false,
    currentCheckInStreak: stats?.currentCheckInStreak ?? 0,
    maxCheckInStreak: stats?.maxCheckInStreak ?? 0,
  }
}

export async function resolveSidebarUser(user: SidebarUserSource, settings: SiteSettingsData) {
  if (!user) {
    return null
  }

  const stats = await getSidebarCurrentUserStats(user.username)
  return buildSidebarUser(user, stats, settings)
}
