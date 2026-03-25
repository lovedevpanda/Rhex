import type { SidebarUserCardData } from "@/components/sidebar-user-card"
import { countSidebarUserBoardFollows, countSidebarUserFavorites, findHomeSidebarHotTopics, findSidebarCurrentUser, findSidebarUserCheckInRecord } from "@/db/home-sidebar-queries"
import type { getCurrentUser } from "@/lib/auth"
import { formatMonthDayTime } from "@/lib/formatters"
import { getLevelBadgeData } from "@/lib/level-badge"
import type { SiteSettingsData } from "@/lib/site-settings"
import { getUserDisplayName } from "@/lib/users"



function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export async function getHomeSidebarHotTopics(limit = 5) {
  const posts = await findHomeSidebarHotTopics(limit)

  return posts.map((post) => ({
    id: post.id,
    slug: post.slug,
    title: post.title,
    authorName: getUserDisplayName(post.author),
    authorAvatarPath: post.author.avatarPath,
    lastReplyAuthorName: getUserDisplayName(post.comments[0]?.user ?? post.author),
    lastRepliedAt: formatMonthDayTime(post.lastCommentedAt ?? post.createdAt),
  }))
}

export async function getSidebarCurrentUserStats(username: string) {
  const user = await findSidebarCurrentUser(username)

  if (!user) {
    return {
      boardCount: 0,
      favoriteCount: 0,
      postCount: 0,
      receivedLikeCount: 0,
      points: 0,
      checkedInToday: false,
    }
  }

  const [boardCount, favoriteCount, checkInRecord] = await Promise.all([
    countSidebarUserBoardFollows(user.id),
    countSidebarUserFavorites(user.id),
    findSidebarUserCheckInRecord(user.id, getLocalDateKey()),
  ])

  return {
    boardCount,
    favoriteCount,
    postCount: user.postCount,
    receivedLikeCount: user.likeReceivedCount,
    points: user.points,
    checkedInToday: Boolean(checkInRecord),
  }
}

type SidebarUserSource = Awaited<ReturnType<typeof getCurrentUser>> | null

type SidebarUserStats = Awaited<ReturnType<typeof getSidebarCurrentUserStats>> | null

export async function buildSidebarUser(user: SidebarUserSource, stats: SidebarUserStats, settings: SiteSettingsData): Promise<SidebarUserCardData | null> {
  if (!user) {
    return null
  }

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
    postCount: stats?.postCount ?? 0,
    receivedLikeCount: stats?.receivedLikeCount ?? 0,
    points: stats?.points ?? user.points ?? 0,
    pointName: settings.pointName,
    checkInEnabled: settings.checkInEnabled,
    checkInReward: settings.checkInReward,
    checkInMakeUpCardPrice: settings.checkInMakeUpCardPrice,
    checkInVipMakeUpCardPrice: settings.checkInVipMakeUpCardPrice,
    checkedInToday: stats?.checkedInToday ?? false,
  }
}

export async function resolveSidebarUser(user: SidebarUserSource, settings: SiteSettingsData) {
  if (!user) {
    return null
  }

  const stats = await getSidebarCurrentUserStats(user.username)
  return buildSidebarUser(user, stats, settings)
}





