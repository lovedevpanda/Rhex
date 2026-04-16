import { executeAddonAsyncWaterfallHook } from "@/addons-host/runtime/hooks"
import type { SidebarUserCardData } from "@/components/user/sidebar-user-card"
import { findHomeSidebarHotTopics } from "@/db/home-sidebar-queries"
import type { getCurrentUser } from "@/lib/auth"
import { applyAnonymousIdentityToPost, getAnonymousMaskDisplayIdentity } from "@/lib/post-anonymous"
import { formatMonthDayTime } from "@/lib/formatters"
import { getLevelBadgeData } from "@/lib/level-badge"
import type { SiteSettingsData } from "@/lib/site-settings"
import { resolveUserSurfaceSnapshot, type UserSurfaceSnapshot } from "@/lib/user-surface"
import { getUserDisplayName } from "@/lib/users"
import { getVipLevel, isVipActive } from "@/lib/vip-status"

export async function getHomeSidebarHotTopics(limit = 5) {
  const [posts, anonymousMaskIdentity] = await Promise.all([
    findHomeSidebarHotTopics(limit),
    getAnonymousMaskDisplayIdentity(),
  ])

  const items = posts.map((post) => ({
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
  const hooked = await executeAddonAsyncWaterfallHook("home.sidebar.hot-topics.items", items)

  return Array.isArray(hooked.value) ? hooked.value : items
}

type SidebarUserSource = Awaited<ReturnType<typeof getCurrentUser>> | null

export async function buildSidebarUser(user: SidebarUserSource, snapshot: UserSurfaceSnapshot | null, settings: SiteSettingsData): Promise<SidebarUserCardData | null> {
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
    boardCount: snapshot?.boardCount ?? 0,
    favoriteCount: snapshot?.favoriteCount ?? 0,
    followerCount: snapshot?.followerCount ?? 0,
    postCount: snapshot?.postCount ?? 0,
    receivedLikeCount: snapshot?.receivedLikeCount ?? 0,
    points: snapshot?.points ?? user.points ?? 0,
    pointName: settings.pointName,
    checkInEnabled: settings.checkInEnabled,
    checkInReward,
    checkInMakeUpEnabled: settings.checkInMakeUpEnabled,
    checkInMakeUpCardPrice: settings.checkInMakeUpCardPrice,
    checkInVipMakeUpCardPrice: settings.checkInVipMakeUpCardPrice,
    checkInVip1MakeUpCardPrice: settings.checkInVip1MakeUpCardPrice,
    checkInVip2MakeUpCardPrice: settings.checkInVip2MakeUpCardPrice,
    checkInVip3MakeUpCardPrice: settings.checkInVip3MakeUpCardPrice,
    checkInMakeUpCountsTowardStreak: settings.checkInMakeUpCountsTowardStreak,
    checkInMakeUpOldestDayLimit: settings.checkInMakeUpOldestDayLimit,
    checkedInToday: snapshot?.checkedInToday ?? false,
    currentCheckInStreak: snapshot?.currentCheckInStreak ?? 0,
    maxCheckInStreak: snapshot?.maxCheckInStreak ?? 0,
  }
}

export async function resolveSidebarUser(user: SidebarUserSource, settings: SiteSettingsData) {
  if (!user) {
    return null
  }

  const snapshot = await resolveUserSurfaceSnapshot(user)
  return buildSidebarUser(user, snapshot, settings)
}
