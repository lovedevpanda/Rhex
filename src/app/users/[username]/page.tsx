import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AddonSlotRenderer } from "@/addons-host"
import { AccessDeniedCard } from "@/components/access-denied-card"
import { AiAgentIndicator } from "@/components/user/ai-agent-indicator"
import { AnonymousUserIndicator } from "@/components/user/anonymous-user-indicator"
import { ForumPostStream } from "@/components/forum/forum-post-stream"
import { LevelBadge } from "@/components/level-badge"
import { MarkdownContent } from "@/components/markdown-content"
import { UserProfileBadgeShowcase } from "@/components/user/user-profile-badge-showcase"
import { ReportDialog } from "@/components/post/report-dialog"
import { SiteHeader } from "@/components/site-header"
import { UserPublicCollectionsPanel } from "@/components/user/user-public-collections-panel"
import { UserRecentActivityPanel } from "@/components/user/user-recent-activity-panel"
import { UserRecentRepliesList } from "@/components/user/user-recent-replies-list"
import { UserAvatar } from "@/components/user/user-avatar"
import { UserProfileOverviewCard } from "@/components/user/user-profile-overview-card"
import { UserStatusBadge } from "@/components/user/user-status-badge"
import { UserVerificationBadge } from "@/components/user/user-verification-badge"
import { canViewUserProfileVisibility } from "@/lib/user-profile-settings"
import { VipDisplayName } from "@/components/vip/vip-display-name"
import { VipBadge } from "@/components/vip/vip-badge"
import { Button } from "@/components/ui/rbutton"
import { Card, CardContent } from "@/components/ui/card"
import { getAiAgentUserId } from "@/lib/ai-agent"
import { getCurrentUser } from "@/lib/auth"
import { getGrantedBadgesForUser } from "@/lib/badges"
import { getPublicFavoriteCollectionsByUsername } from "@/lib/favorite-collections"
import { isUserFollowingTarget } from "@/lib/follows"
import { getSiteSettings } from "@/lib/site-settings"
import { getUserProfileAccessState } from "@/lib/user-blocks"
import { cn } from "@/lib/utils"
import { getUserProfile, getUserPosts, getUserRecentReplies } from "@/lib/users"
import { getVipLevel, isVipActive } from "@/lib/vip-status"

const profileCardClassName = "rounded-2xl border  shadow-xs"

const identityTagClassNames = {
  vip: "rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 dark:bg-violet-400/15 dark:text-violet-200",
  level: "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200",
  orange: "rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700 dark:bg-orange-400/15 dark:text-orange-200",
  sky: "rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700 dark:bg-sky-400/15 dark:text-sky-200",
  danger: "rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-500/15 dark:text-red-200",
  warning: "rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-200",
  plain: "rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground dark:bg-white/6 dark:text-slate-300",
} satisfies Record<"plain" | "vip" | "level" | "orange" | "sky" | "danger" | "warning", string>

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
  const [user, settings, currentUser, aiAgentUserId] = await Promise.all([getUserProfile(params.username), getSiteSettings(), getCurrentUser(), getAiAgentUserId()])

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

  const [posts, recentReplies, publicCollections, badgeItems, isFollowingUser] = await Promise.all([
    canViewRecentActivity ? getUserPosts(params.username) : Promise.resolve([]),
    canViewRecentActivity ? getUserRecentReplies(params.username) : Promise.resolve([]),
    getPublicFavoriteCollectionsByUsername(params.username, { page: 1 }),
    getGrantedBadgesForUser(user.id),
    currentUser && currentUser.id !== user.id && !profileAccess.relation.isBlocked
      ? isUserFollowingTarget({
          userId: currentUser.id,
          targetType: "user",
          targetId: user.id,
        })
      : Promise.resolve(false),
  ])

  const canToggleFollow = (!currentUser || currentUser.id !== user.id) && !profileAccess.relation.isBlocked
  const isAnonymousMaskUser = settings.anonymousPostMaskUserId === user.id
  const isAiAgentUser = aiAgentUserId === user.id

  const vipActive = isVipActive(user)
  const vipLevel = getVipLevel(user)
  const canSendMessage = Boolean(currentUser && currentUser.username !== user.username && !profileAccess.relation.isBlocked)
  const isRestrictedUser = user.status === "BANNED" || user.status === "MUTED"
  const restrictionLabel = user.status === "BANNED" ? "封禁中" : user.status === "MUTED" ? "禁言中" : null
  const restrictionDescription = user.status === "BANNED" ? "该用户当前因封禁处于受限状态" : user.status === "MUTED" ? "该用户当前处于禁言状态" : null

  const statItems = [
    { label: settings.pointName, value: user.points },
    { label: "帖子", value: user.postCount },
    { label: "回复", value: user.commentCount },
    { label: "获赞", value: user.likeReceivedCount },
  ]

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

  return (
    <div className="min-h-screen  text-foreground dark:bg-[#0f1115]">
      <SiteHeader />
      <main className={cn("mx-auto max-w-[1200px] px-1 py-6 lg:px-6", isRestrictedUser && "grayscale") }>
        <AddonSlotRenderer slot="user.page.before" />
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
          <aside className="space-y-4 xl:sticky  xl:self-start">
            <AddonSlotRenderer slot="user.sidebar.before" />
            <Card className={cn("relative", profileCardClassName)}>
              <CardContent className="p-5">
                <div className="flex flex-col text-left">
                  {isRestrictedUser ? <UserStatusBadge status={user.status} compact className="absolute right-4 top-4 shadow-xs" /> : null}
                  <div className="flex items-start gap-4">
                    <UserAvatar
                      name={user.displayName || user.username}
                      avatarPath={user.avatarPath}
                      size="lg"
                      isVip={vipActive}
                      vipLevel={vipLevel}
                    />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <UserVerificationBadge verification={user.verification ?? null} appearance="plain" />
                        <div className="flex min-w-0 items-center gap-1.5">
                          <h1 className="min-w-0 truncate text-[22px] font-semibold leading-6 tracking-tight">
                            <VipDisplayName
                              name={user.displayName || user.username}
                              isVip={vipActive}
                              vipLevel={vipLevel}
                              emphasize
                              className="truncate"
                            />
                          </h1>
                          {isAnonymousMaskUser ? <AnonymousUserIndicator /> : null}
                          {isAiAgentUser ? <AiAgentIndicator /> : null}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {user.role === "ADMIN" ? <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-500/15 dark:text-red-200">管理员</span> : null}
                        {user.role === "MODERATOR" ? <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">版主</span> : null}
                        {vipActive ? <VipBadge level={vipLevel} compact /> : null}
                        {user.levelName && user.levelColor && user.levelIcon ? <LevelBadge level={user.level} name={user.levelName} color={user.levelColor} icon={user.levelIcon} compact /> : null}
                        {isRestrictedUser ? <UserStatusBadge status={user.status} /> : null}
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">{user.bio}</p>
                  {restrictionDescription ? <p className="mt-3 rounded-xl border border-border/70 bg-secondary/60 px-3 py-2 text-xs leading-6 text-muted-foreground">{restrictionDescription}</p> : null}
                  {canSendMessage ? (
                    <Link href={`/messages?conversation=user-${user.id}`} className="mt-5 w-full">
                      <Button className="h-10 w-full rounded-xl">发私信</Button>
                    </Link>
                  ) : null}
                  {currentUser && currentUser.username !== user.username ? (
                    <div className="mt-3 w-full">
                      <ReportDialog targetType="USER" targetId={String(user.id)} targetLabel={`@${user.username}`} buttonText="举报用户" buttonClassName="h-10 w-full rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground" />
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className={profileCardClassName}>
              <CardContent className="p-4">
                <h2 className="text-sm font-semibold text-foreground">勋章</h2>
                <UserProfileBadgeShowcase badges={badgeItems} />
              </CardContent>
            </Card>

            <Card className={profileCardClassName}>
              <CardContent className="p-4">
                <h2 className="text-sm font-semibold text-foreground">身份标签</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {identityTags.map((tag) => (
                    <span
                      key={tag.label}
                      className={identityTagClassNames[tag.tone]}
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
            <AddonSlotRenderer slot="user.sidebar.after" />
          </aside>

          <section className="space-y-4 xl:self-start">
            <AddonSlotRenderer slot="user.profile.before" />
            <UserProfileOverviewCard
              title={(
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <VipDisplayName
                      name={user.displayName}
                      isVip={vipActive}
                      vipLevel={vipLevel}
                      emphasize
                      className="min-w-0 truncate"
                    />
                    {isAnonymousMaskUser ? <AnonymousUserIndicator /> : null}
                    {isAiAgentUser ? <AiAgentIndicator /> : null}
                  </span>
                  <span className="shrink-0 text-foreground">的主页</span>
                </span>
              )}
              status={restrictionLabel ? user.status : null}
              initialFollowerCount={user.followerCount}
              stats={statItems}
              rssHref={`/users/${user.username}/rss.xml`}
              rssLabel="订阅用户 RSS"
              followAction={canToggleFollow ? {
                targetId: user.id,
                initialFollowed: isFollowingUser,
                activeLabel: "已关注用户",
                inactiveLabel: "关注用户",
              } : null}
              blockAction={currentUser && currentUser.id !== user.id && !isAnonymousMaskUser ? {
                targetId: user.id,
                initialBlocked: profileAccess.relation.hasBlocked,
                activeLabel: "已拉黑",
                inactiveLabel: "拉黑用户",
              } : null}
            />
            <AddonSlotRenderer slot="user.profile.after" />

            <AddonSlotRenderer slot="user.activity.before" />
            <UserRecentActivityPanel
              description={canViewRecentActivity ? "" : ""}
              defaultTabKey="introduction"
              tabs={[
                {
                  key: "introduction",
                  label: "介绍",
                  content: !canViewIntroduction ? (
                    <div className="rounded-xl border border-dashed  px-4 py-12 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-white/2">
                      {user.introductionVisibility === "MEMBERS" ? "该用户将介绍设置为登录后可见。" : "该用户未公开介绍。"}
                    </div>
                  ) : introduction ? (
                    <div className="rounded-2xl border border-border/70 bg-card px-4 py-4 shadow-xs">
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
                  count: posts.length,
                  content: !canViewRecentActivity ? (
                    <div className="rounded-xl border border-dashed  px-4 py-12 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-white/2">
                      {user.activityVisibility === "MEMBERS" ? "该用户将最近帖子设置为登录后可见。" : "该用户未公开最近帖子。"}
                    </div>
                  ) : posts.length === 0 ? (
                    <div className="rounded-xl border border-dashed  px-4 py-12 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-white/2">
                      最近还没有发布帖子。
                    </div>
                  ) : (
                    <ForumPostStream posts={posts} compactFirstItem={false} />
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
                  count: recentReplies.length,
                  content: canViewRecentActivity
                    ? <UserRecentRepliesList replies={recentReplies} postLinkDisplayMode={settings.postLinkDisplayMode} />
                    : (
                      <div className="rounded-xl border border-dashed  px-4 py-12 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-white/2">
                        {user.activityVisibility === "MEMBERS" ? "该用户将最近回复设置为登录后可见。" : "该用户未公开最近回复。"}
                      </div>
                    ),
                },
              ]}
            />
            <AddonSlotRenderer slot="user.activity.after" />
          </section>
        </div>
        <AddonSlotRenderer slot="user.page.after" />
      </main>
    </div>
  )
}
