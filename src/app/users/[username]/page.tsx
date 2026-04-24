import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Crown, Flag, MessageCircleMore, ShieldCheck } from "lucide-react"
import type { CSSProperties } from "react"

import { AddonSlotRenderer } from "@/addons-host"
import { AccessDeniedCard } from "@/components/access-denied-card"
import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { PageNumberPagination } from "@/components/page-number-pagination"
import { AiAgentIndicator } from "@/components/user/ai-agent-indicator"
import { AnonymousUserIndicator } from "@/components/user/anonymous-user-indicator"
import { ForumPostStream } from "@/components/forum/forum-post-stream"
import { MarkdownContent } from "@/components/markdown-content"
import { UserProfileBadgeShowcase } from "@/components/user/user-profile-badge-showcase"
import { ReportDialog } from "@/components/post/report-dialog"
import { SiteHeader } from "@/components/site-header"
import { UserPublicCollectionsPanel } from "@/components/user/user-public-collections-panel"
import { UserActiveBoardsPanel } from "@/components/user/user-active-boards-panel"
import { UserRecentActivityPanel } from "@/components/user/user-recent-activity-panel"
import { UserRecentRepliesList } from "@/components/user/user-recent-replies-list"
import { UserAvatar } from "@/components/user/user-avatar"
import { UserDisplayedBadges } from "@/components/user/user-displayed-badges"
import { UserProfileOverviewCard } from "@/components/user/user-profile-overview-card"
import { UserProfileRadarPanel } from "@/components/user/user-profile-radar-panel"
import { UserStatusBadge } from "@/components/user/user-status-badge"
import { UserVerificationBadge } from "@/components/user/user-verification-badge"
import { VipLevelIcon } from "@/components/vip/vip-level-icon"
import { formatNumber, serializeDate } from "@/lib/formatters"
import { canViewUserProfileVisibility } from "@/lib/user-profile-settings"
import { buildUserProfileRadarData } from "@/lib/user-profile-radar"
import { VipDisplayName } from "@/components/vip/vip-display-name"
import { getAiAgentUserId } from "@/lib/ai-agent"
import { getCurrentUser } from "@/lib/auth"
import { getBadgeEligibilitySnapshot, getDisplayedBadgesForUser, getGrantedBadgesForUser } from "@/lib/badges"
import { getBoards } from "@/lib/boards"
import { getPublicFavoriteCollectionsByUsername } from "@/lib/favorite-collections"
import { isUserFollowingTarget } from "@/lib/follows"
import { getSiteSettings } from "@/lib/site-settings"
import { getUserProfileAccessState } from "@/lib/user-blocks"
import { cn } from "@/lib/utils"
import { readSearchParam } from "@/lib/search-params"
import { getUserActiveBoardsByRecentReplies, getUserProfile, getUserPostsPage, getUserRecentRepliesPage } from "@/lib/users"
import { getVipLevel, isVipActive } from "@/lib/vip-status"
import { getZones } from "@/lib/zones"

const identityTagClassNames = {
  vip: "rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 dark:bg-violet-400/15 dark:text-violet-200",
  level: "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200",
  orange: "rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700 dark:bg-orange-400/15 dark:text-orange-200",
  sky: "rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700 dark:bg-sky-400/15 dark:text-sky-200",
  danger: "rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-500/15 dark:text-red-200",
  warning: "rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-200",
  plain: "rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground dark:bg-white/6 dark:text-slate-300",
} satisfies Record<"plain" | "vip" | "level" | "orange" | "sky" | "danger" | "warning", string>

const userActivityTabKeys = ["introduction", "posts", "collections", "replies"] as const

type UserActivityTabKey = typeof userActivityTabKeys[number]
type ProfileVipBadgeStyle = CSSProperties & Record<`--profile-vip-badge-${string}`, string>

const profileNameBadgeClassName = "inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.75 text-[10px] font-semibold leading-none backdrop-blur-sm sm:gap-1 sm:px-2.5 sm:py-1 sm:text-[11px]"
const profileVipBadgeClassName = `${profileNameBadgeClassName} border-[color:var(--profile-vip-badge-border)] bg-[image:var(--profile-vip-badge-background)] text-[color:var(--profile-vip-badge-foreground)] shadow-[var(--profile-vip-badge-shadow)] dark:border-[color:var(--profile-vip-badge-border-dark)] dark:bg-[image:var(--profile-vip-badge-background-dark)] dark:text-[color:var(--profile-vip-badge-foreground-dark)] dark:shadow-[var(--profile-vip-badge-shadow-dark)]`

function getProfileRoleBadgeConfig(role: "USER" | "MODERATOR" | "ADMIN" | null) {
  if (role === "ADMIN") {
    return {
      label: "管理员",
      icon: <Crown className="h-3.5 w-3.5" />,
      className: "border-red-200/80 bg-linear-to-b from-red-50 to-red-100/70 text-red-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-red-500/25 dark:from-red-500/18 dark:to-red-500/8 dark:text-red-200 dark:shadow-none",
    }
  }

  if (role === "MODERATOR") {
    return {
      label: "版主",
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
      className: "border-sky-200/80 bg-linear-to-b from-sky-50 to-sky-100/70 text-sky-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-sky-500/25 dark:from-sky-500/18 dark:to-sky-500/8 dark:text-sky-200 dark:shadow-none",
    }
  }

  return null
}

function getProfileVipBadgeStyle(level: number): ProfileVipBadgeStyle {
  const colorVariableName = level >= 3
    ? "--vip-name-color-vip3"
    : level === 2
      ? "--vip-name-color-vip2"
      : "--vip-name-color-vip1"

  return {
    "--profile-vip-badge-border": `color-mix(in srgb, var(${colorVariableName}) 36%, transparent)`,
    "--profile-vip-badge-background": `linear-gradient(180deg, color-mix(in srgb, var(${colorVariableName}) 16%, white), color-mix(in srgb, var(${colorVariableName}) 10%, transparent))`,
    "--profile-vip-badge-foreground": `var(${colorVariableName})`,
    "--profile-vip-badge-shadow": "inset 0 1px 0 rgba(255,255,255,0.65)",
    "--profile-vip-badge-border-dark": `color-mix(in srgb, var(${colorVariableName}) 68%, transparent)`,
    "--profile-vip-badge-background-dark": `linear-gradient(180deg, color-mix(in srgb, var(${colorVariableName}) 38%, rgb(12 14 18 / 0.96)), color-mix(in srgb, var(${colorVariableName}) 24%, rgb(12 14 18 / 0.72)))`,
    "--profile-vip-badge-foreground-dark": `color-mix(in srgb, white 84%, var(${colorVariableName}) 16%)`,
    "--profile-vip-badge-shadow-dark": "0 0 0 1px rgba(255,255,255,0.03) inset",
  }
}

function parsePageParam(value: string | string[] | undefined) {
  const page = Number(readSearchParam(value))
  return Number.isInteger(page) && page > 0 ? page : 1
}

function resolveUserActivityTab(value: string | undefined, pages: { postsPage: number; repliesPage: number }): UserActivityTabKey {
  if (value && userActivityTabKeys.includes(value as UserActivityTabKey)) {
    return value as UserActivityTabKey
  }

  if (pages.postsPage > 1) {
    return "posts"
  }

  if (pages.repliesPage > 1) {
    return "replies"
  }

  return "introduction"
}

function buildUserActivityHref(
  username: string,
  currentState: { tab: UserActivityTabKey; postsPage: number; repliesPage: number },
  overrides: Partial<{ tab: UserActivityTabKey; postsPage: number; repliesPage: number }> = {},
) {
  const nextState = {
    ...currentState,
    ...overrides,
  }
  const searchParams = new URLSearchParams()

  if (nextState.tab !== "introduction" || nextState.postsPage > 1 || nextState.repliesPage > 1) {
    searchParams.set("tab", nextState.tab)
  }

  if (nextState.postsPage > 1) {
    searchParams.set("postsPage", String(nextState.postsPage))
  }

  if (nextState.repliesPage > 1) {
    searchParams.set("repliesPage", String(nextState.repliesPage))
  }

  const query = searchParams.toString()
  return query ? `/users/${username}?${query}` : `/users/${username}`
}

export async function generateMetadata(props: PageProps<"/users/[username]">): Promise<Metadata> {
  const params = await props.params;
  const [user, settings] = await Promise.all([getUserProfile(params.username), getSiteSettings()])

  if (!user) {
    return { title: `用户不存在 - ${settings.siteName}` }
  }

  return {
    title: `${user.displayName} - ${settings.siteName}`,
    description: user.bio,
    alternates: {
      canonical: `/users/${user.username}`,
    },
  }
}

export default async function UserPage(props: PageProps<"/users/[username]">) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : undefined
  const postsPage = parsePageParam(searchParams?.postsPage)
  const repliesPage = parsePageParam(searchParams?.repliesPage)
  const activityTab = resolveUserActivityTab(readSearchParam(searchParams?.tab), { postsPage, repliesPage })
  const [user, settings, currentUser, aiAgentUserId, boards, zones] = await Promise.all([getUserProfile(params.username), getSiteSettings(), getCurrentUser(), getAiAgentUserId(), getBoards(), getZones()])

  if (!user) {
    notFound()
  }

  const profileAccess = await getUserProfileAccessState(currentUser?.id, user.id)

  if (!profileAccess.allowed) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-[960px] px-4 py-8">
          <AddonSlotRenderer slot="user.page.before" />
          <AccessDeniedCard
            title="当前主页暂不可访问"
            description="该用户已对你的访问做出限制，因此你无法查看其主页内容、动态与互动信息。"
            reason={profileAccess.reason}
            isLoggedIn={Boolean(currentUser)}
          />
          <AddonSlotRenderer slot="user.page.after" />
        </main>
      </div>
    )
  }

  const visibilityContext = {
    isOwner: currentUser?.id === user.id,
    isLoggedIn: Boolean(currentUser),
  }
  const canViewRecentActivity = canViewUserProfileVisibility(user.activityVisibility, visibilityContext)
  const canViewIntroduction = canViewUserProfileVisibility(user.introductionVisibility, visibilityContext)
  const introduction = user.introduction.trim()

  const [postsPageData, recentRepliesPageData, activeBoards, publicCollections, badgeItems, displayedBadgeItems, radarSnapshot, isFollowingUser] = await Promise.all([
    canViewRecentActivity
      ? getUserPostsPage(params.username, { page: postsPage })
      : Promise.resolve({
          items: [],
          pagination: {
            page: 1,
            pageSize: 10,
            total: 0,
            totalPages: 1,
            hasPrevPage: false,
            hasNextPage: false,
          },
        }),
    canViewRecentActivity
      ? getUserRecentRepliesPage(params.username, { page: repliesPage })
      : Promise.resolve({
          items: [],
          pagination: {
            page: 1,
            pageSize: 6,
            total: 0,
            totalPages: 1,
            hasPrevPage: false,
            hasNextPage: false,
          },
        }),
    canViewRecentActivity
      ? getUserActiveBoardsByRecentReplies(params.username)
      : Promise.resolve([]),
    getPublicFavoriteCollectionsByUsername(params.username, { page: 1 }),
    getGrantedBadgesForUser(user.id),
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
  const activityRouteState = {
    tab: activityTab,
    postsPage: postsPageData.pagination.page,
    repliesPage: recentRepliesPageData.pagination.page,
  }

  const canToggleFollow = (!currentUser || currentUser.id !== user.id) && !profileAccess.relation.isBlocked
  const isAnonymousMaskUser = settings.anonymousPostMaskUserId === user.id
  const isAiAgentUser = aiAgentUserId === user.id
  const profileRadarData = buildUserProfileRadarData({
    user,
    snapshot: radarSnapshot,
  })
  const desktopRadarPanel = profileRadarData ? <UserProfileRadarPanel data={profileRadarData} /> : null
  const mobileRadarPanel = profileRadarData ? <UserProfileRadarPanel data={profileRadarData} className="w-full" /> : null
  const activeBoardsEmptyText = canViewRecentActivity
    ? "最近还没有可展示的回复活跃记录。"
    : user.activityVisibility === "MEMBERS"
      ? "该用户将最近回复设置为登录后可见。"
      : "该用户未公开最近回复。"

  const vipActive = isVipActive(user)
  const vipLevel = getVipLevel(user)
  const canSendMessage = Boolean(currentUser && currentUser.username !== user.username && !profileAccess.relation.isBlocked)
  const isRestrictedUser = user.status === "BANNED" || user.status === "MUTED"
  const restrictionLabel = user.status === "BANNED" ? "封禁中" : user.status === "MUTED" ? "禁言中" : null
  const restrictionDescription = user.status === "BANNED" ? "该用户当前因封禁处于受限状态" : user.status === "MUTED" ? "该用户当前处于禁言状态" : null
  const roleBadge = getProfileRoleBadgeConfig(user.role)
  const joinedAtText = serializeDate(user.createdAt) ?? user.createdAt
  const levelMetaText = user.levelName ? `Lv.${user.level} ${user.levelName}` : `Lv.${user.level}`

  const identityTags = [
    { label: `@${user.username}`, tone: "plain" as const },
    user.role === "ADMIN" ? { label: "管理员", tone: "danger" as const } : null,
    user.role === "MODERATOR" ? { label: "版主", tone: "sky" as const } : null,
    user.status === "BANNED" ? { label: "账号封禁中", tone: "danger" as const } : null,
    user.status === "MUTED" ? { label: "账号禁言中", tone: "warning" as const } : null,
    vipActive ? { label: `VIP${vipLevel}`, tone: "vip" as const } : null,
    user.levelName ? { label: user.levelName, tone: "level" as const } : null,
    user.inviteCount > 0 ? { label: "邀请达人", tone: "orange" as const } : null,
    user.likeReceivedCount >= 50 ? { label: "高赞用户", tone: "level" as const } : null,
    user.postCount >= 10 ? { label: "活跃创作者", tone: "sky" as const } : null,
  ].filter(Boolean) as Array<{ label: string; tone: "plain" | "vip" | "level" | "orange" | "sky" | "danger" | "warning" }>

  const hasIdentityIcons = Boolean(user.verification || isAnonymousMaskUser || isAiAgentUser || restrictionLabel)
  const hasDisplayedBadges = displayedBadgeItems.length > 0
  const identityRow = hasIdentityIcons || hasDisplayedBadges
    ? (
      <>
        {hasIdentityIcons ? (
          <span className="inline-flex shrink-0 items-center gap-1">
            {user.verification ? <UserVerificationBadge verification={user.verification} appearance="plain" compact className="h-5 min-w-5 sm:h-[22px] sm:min-w-[22px]" iconClassName="h-5 min-w-5 text-[20px] sm:h-[22px] sm:min-w-[22px] sm:text-[22px]" /> : null}
            {isAnonymousMaskUser ? <AnonymousUserIndicator /> : null}
            {isAiAgentUser ? <AiAgentIndicator /> : null}
            {restrictionLabel ? <UserStatusBadge status={user.status} compact /> : null}
          </span>
        ) : null}
        {hasIdentityIcons && hasDisplayedBadges ? <span className="shrink-0 text-border">|</span> : null}
        {hasDisplayedBadges ? (
          <div className="shrink-0">
            <UserDisplayedBadges badges={displayedBadgeItems} appearance="plain" spacing="tight" itemClassName="h-5 sm:h-[22px]" iconClassName="h-5 min-w-5 text-[20px] sm:h-[22px] sm:min-w-[22px] sm:text-[22px]" />
          </div>
        ) : null}
      </>
    )
    : null

  return (
    <div className="min-h-screen  text-foreground dark:bg-[#0f1115]">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1">
        <AddonSlotRenderer slot="user.page.before" />
        <ForumPageShell
          zones={zones}
          boards={boards}
          main={(
            <main className={cn("mt-6 pb-12", isRestrictedUser && "grayscale")}>
              <div className="flex flex-col gap-0">
                <AddonSlotRenderer slot="user.profile.before" />
                <UserProfileOverviewCard
                  className="rounded-b-none border-b-0"
                  avatar={(
                    <UserAvatar
                      name={user.displayName || user.username}
                      avatarPath={user.avatarPath}
                      size="2xl"
                      isVip={vipActive}
                      vipLevel={vipLevel}
                    />
                  )}
                  displayName={(
                    <h1 className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden text-[1rem] font-semibold leading-6 tracking-tight sm:gap-2 sm:text-[clamp(1.22rem,2.1vw,1.6rem)] sm:leading-7">
                      <span className="min-w-0 flex-1 truncate">
                        <VipDisplayName
                          name={user.displayName || user.username}
                          isVip={vipActive}
                          vipLevel={vipLevel}
                          emphasize
                          className="min-w-0 truncate"
                        />
                      </span>
                      {vipActive ? (
                        <span
                          className={profileVipBadgeClassName}
                          style={getProfileVipBadgeStyle(vipLevel)}
                          title={`VIP${vipLevel}`}
                          aria-label={`VIP${vipLevel}`}
                        >
                          <VipLevelIcon
                            level={vipLevel}
                            className="size-3.5"
                            iconClassName="[&>svg]:size-full"
                            title={`VIP${vipLevel}`}
                          />
                          <span className="hidden sm:inline">VIP{vipLevel}</span>
                        </span>
                      ) : null}
                      {roleBadge ? (
                        <span
                          className={cn(profileNameBadgeClassName, roleBadge.className)}
                          title={roleBadge.label}
                          aria-label={roleBadge.label}
                        >
                          {roleBadge.icon}
                          <span className="hidden sm:inline">{roleBadge.label}</span>
                        </span>
                      ) : null}
                    </h1>
                  )}
                  pointsBadge={(
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium leading-none text-amber-700 dark:bg-amber-500/15 dark:text-amber-200 sm:px-2.5 sm:py-0.75 sm:text-xs">
                      {formatNumber(user.points)} {settings.pointName}
                    </span>
                  )}
                  sidePanel={desktopRadarPanel}
                  mobileSidePanel={mobileRadarPanel}
                  mobileSidePanelTitle="论坛画像"
                  mobileSidePanelButtonLabel="查看论坛画像"
                  identityRow={identityRow}
                  metaRow={(
                    <>
                      <span className="shrink-0">@{user.username}</span>
                      <span className="hidden size-1 rounded-full bg-border sm:inline-flex" />
                      <span className="shrink-0">{levelMetaText}</span>
                      <span className="hidden size-1 rounded-full bg-border sm:inline-flex" />
                      <span className="shrink-0">{joinedAtText} 加入</span>
                    </>
                  )}
                  bio={user.bio}
                  avatarActions={(
                    <>
                      {canSendMessage ? (
                        <Link
                          href={`/messages?conversation=user-${user.id}`}
                          aria-label="发私信"
                          title="发私信"
                          className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <MessageCircleMore className="h-3.5 w-3.5" />
                        </Link>
                      ) : null}
                      {currentUser && currentUser.username !== user.username ? (
                        <ReportDialog
                          targetType="USER"
                          targetId={String(user.id)}
                          targetLabel={`@${user.username}`}
                          buttonText="举报"
                          icon={<Flag className="h-3.5 w-3.5" />}
                          buttonClassName="size-8 rounded-full border border-border bg-background p-0 text-muted-foreground hover:bg-accent hover:text-foreground"
                        />
                      ) : null}
                    </>
                  )}
                  initialFollowerCount={user.followerCount}
                  likeCount={user.likeReceivedCount}
                  rssHref={`/users/${user.username}/rss.xml`}
                  rssLabel="RSS"
                  followAction={canToggleFollow ? {
                    targetId: user.id,
                    initialFollowed: isFollowingUser,
                    activeLabel: "取关",
                    inactiveLabel: "关注",
                  } : null}
                  blockAction={currentUser && currentUser.id !== user.id && !isAnonymousMaskUser ? {
                    targetId: user.id,
                    initialBlocked: profileAccess.relation.hasBlocked,
                    activeLabel: "已拉黑",
                    inactiveLabel: "拉黑",
                  } : null}
                  restrictionNotice={restrictionDescription ? <p className="rounded-[18px] border border-border/70 bg-secondary/60 px-3 py-2 text-xs leading-6 text-muted-foreground">{restrictionDescription}</p> : null}
                />
                <AddonSlotRenderer slot="user.profile.after" />

                <AddonSlotRenderer slot="user.activity.before" />
                <UserRecentActivityPanel
                  className="rounded-t-none"
                  description={canViewRecentActivity ? "" : ""}
                  showSummary={false}
                  activeTabKey={activityTab}
                  buildTabHref={(tabKey) => buildUserActivityHref(params.username, activityRouteState, { tab: tabKey as UserActivityTabKey })}
                  tabs={[
                    {
                      key: "introduction",
                      label: "介绍",
                      content: !canViewIntroduction ? (
                        <div className="rounded-xl border border-dashed  px-4 py-12 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-white/2">
                          {user.introductionVisibility === "MEMBERS" ? "该用户将介绍设置为登录后可见。" : "该用户未公开介绍。"}
                        </div>
                      ) : introduction ? (
                        <div className="bg-card px-4 pb-4">
                          <MarkdownContent
                            content={introduction}
                            markdownEmojiMap={settings.markdownEmojiMap}
                            className="markdown-body prose prose-sm max-w-none prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1"
                          />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed  px-4 py-12 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-white/2">
                          这个用户还没有填写详细介绍。
                        </div>
                      ),
                    },
                    {
                      key: "posts",
                      label: "帖子",
                      count: canViewRecentActivity ? user.postCount : 0,
                      content: !canViewRecentActivity ? (
                        <div className="rounded-xl border border-dashed  px-4 py-12 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-white/2">
                          {user.activityVisibility === "MEMBERS" ? "该用户将最近帖子设置为登录后可见。" : "该用户未公开最近帖子。"}
                        </div>
                      ) : postsPageData.items.length === 0 ? (
                        <div className="rounded-xl border border-dashed  px-4 py-12 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-white/2">
                          最近还没有发布帖子。
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <ForumPostStream posts={postsPageData.items} compactFirstItem={false} />
                          {postsPageData.pagination.totalPages > 1 ? (
                            <PageNumberPagination
                              page={postsPageData.pagination.page}
                              totalPages={postsPageData.pagination.totalPages}
                              hasPrevPage={postsPageData.pagination.hasPrevPage}
                              hasNextPage={postsPageData.pagination.hasNextPage}
                              buildHref={(targetPage) => buildUserActivityHref(params.username, activityRouteState, {
                                tab: "posts",
                                postsPage: targetPage,
                              })}
                            />
                          ) : null}
                        </div>
                      ),
                    },
                    {
                      key: "collections",
                      label: "合集",
                      count: publicCollections.pagination.total,
                      content: <UserPublicCollectionsPanel username={user.username} initialData={publicCollections} />,
                    },
                    {
                      key: "replies",
                      label: "回复",
                      count: canViewRecentActivity ? recentRepliesPageData.pagination.total : 0,
                      content: canViewRecentActivity
                        ? (
                          <div className="space-y-4">
                            <UserRecentRepliesList replies={recentRepliesPageData.items} postLinkDisplayMode={settings.postLinkDisplayMode} />
                            {recentRepliesPageData.pagination.totalPages > 1 ? (
                              <PageNumberPagination
                                page={recentRepliesPageData.pagination.page}
                                totalPages={recentRepliesPageData.pagination.totalPages}
                                hasPrevPage={recentRepliesPageData.pagination.hasPrevPage}
                                hasNextPage={recentRepliesPageData.pagination.hasNextPage}
                                buildHref={(targetPage) => buildUserActivityHref(params.username, activityRouteState, {
                                  tab: "replies",
                                  repliesPage: targetPage,
                                })}
                              />
                            ) : null}
                          </div>
                        )
                        : (
                          <div className="rounded-xl border border-dashed  px-4 py-12 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-white/2">
                            {user.activityVisibility === "MEMBERS" ? "该用户将最近回复设置为登录后可见。" : "该用户未公开最近回复。"}
                          </div>
                        ),
                    },
                  ]}
                />
                <AddonSlotRenderer slot="user.activity.after" />
              </div>
            </main>
          )}
          rightSidebar={(
            <aside className={cn("mt-6 hidden pb-12 lg:block", isRestrictedUser && "grayscale")}>
              <AddonSlotRenderer slot="user.sidebar.before" />
              <section className="sticky top-20 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                <div className="divide-y divide-border/80">
                  <div className="p-6">
                    <UserProfileBadgeShowcase badges={badgeItems} />
                  </div>
                  <div className="p-6">
                    <UserActiveBoardsPanel boards={activeBoards} emptyText={activeBoardsEmptyText} />
                  </div>
                  <div className="p-6">
                    <div className="flex flex-col gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">身份标签</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {identityTags.map((tag) => (
                        <span
                          key={tag.label}
                          className={identityTagClassNames[tag.tone]}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  </div>
                </div>
              </section>
              <AddonSlotRenderer slot="user.sidebar.after" />
            </aside>
          )}
        />
        <AddonSlotRenderer slot="user.page.after" />
      </div>
    </div>
  )
}
