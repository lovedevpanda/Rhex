import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, CheckCircle2, Crown, Flame, Heart, MessageSquareText, Sparkles, ThumbsUp } from "lucide-react"

import { ChangeType } from "@/db/types"
import { BadgeCenter } from "@/components/badge-center"
import { BrowsingSettingsPanel } from "@/components/browsing-settings-panel"
import { InviteCodePurchaseCard } from "@/components/invite-code-purchase-card"
import { InviteLinkCopyButton } from "@/components/invite-link-copy-button"
import { LevelBadge } from "@/components/level-badge"
import { PostListLink } from "@/components/post-list-link"
import { ProfileEditForm } from "@/components/profile-edit-form"
import { ReadingHistoryPanel } from "@/components/reading-history-panel"
import { RedeemCodeCard } from "@/components/redeem-code-card"
import { SettingsShell } from "@/components/settings-shell"
import { SettingsTabs } from "@/components/settings-tabs"
import { SiteHeader } from "@/components/site-header"
import { UserBlockToggleButton } from "@/components/user-block-toggle-button"
import { VerificationCenter } from "@/components/verification-center"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { describeBadgeRule, getBadgeCenterData } from "@/lib/badges"
import { getCurrentUser } from "@/lib/auth"
import { getPostPath } from "@/lib/post-links"
import { getUserPointLogs } from "@/lib/points"
import { readSearchParam } from "@/lib/search-params"
import { getSiteSettings } from "@/lib/site-settings"
import { getCurrentUserLevelProgressView } from "@/lib/user-level-view"
import { getUserBlocks, getUserBoardFollows, getUserFavoritePosts, getUserLikedPosts, getUserPostFollows, getUserPosts, getUserReplies, getUserTagFollows, getUserUserFollows } from "@/lib/user-panel"
import { getUserAccountSettings, getUserProfile } from "@/lib/users"
import { getCurrentUserVerificationData } from "@/lib/verifications"
import { getVipLevel, isVipActive } from "@/lib/vip-status"

type SettingsTabKey = "profile" | "invite" | "post-management" | "level" | "badges" | "verifications" | "points" | "follows"
type ProfileTabKey = "basic" | "browsing"
type PostManagementTabKey = "posts" | "replies" | "favorites" | "likes"
type FollowTabKey = "boards" | "users" | "tags" | "posts" | "history" | "blocks"

const tabs: SettingsTabKey[] = ["profile", "invite", "post-management", "level", "badges", "verifications", "points", "follows"]
const profileTabs: Array<{ key: ProfileTabKey; label: string }> = [
  { key: "basic", label: "资料设置" },
  { key: "browsing", label: "浏览设置" },
]
const postManagementTabs: Array<{ key: PostManagementTabKey; label: string }> = [
  { key: "posts", label: "我的帖子" },
  { key: "replies", label: "我的回复" },
  { key: "favorites", label: "我的收藏" },
  { key: "likes", label: "我的点赞" },
]
const followTabs: Array<{ key: FollowTabKey; label: string }> = [
  { key: "boards", label: "节点" },
  { key: "users", label: "用户" },
  { key: "tags", label: "标签" },
  { key: "posts", label: "帖子" },
  { key: "history", label: "足迹" },
  { key: "blocks", label: "拉黑" },
]

const settingsTabTitles: Record<SettingsTabKey, string> = {
  profile: "个人设置",
  invite: "邀请中心",
  "post-management": "帖子管理",
  level: "等级中心",
  badges: "勋章中心",
  verifications: "认证中心",
  points: "积分记录",
  follows: "关注管理",
}

export async function generateMetadata(props: PageProps<"/settings">): Promise<Metadata> {
  const searchParams = await props.searchParams
  const currentTabValue = readSearchParam(searchParams?.tab)
  const currentTab: SettingsTabKey = tabs.includes((currentTabValue as SettingsTabKey) ?? "profile")
    ? ((currentTabValue as SettingsTabKey) ?? "profile")
    : "profile"
  const settings = await getSiteSettings()

  return {
    title: `${settingsTabTitles[currentTab]} - ${settings.siteName}`,
  }
}

export default async function SettingsPage(props: PageProps<"/settings">) {
  const searchParams = await props.searchParams;
  const [currentUser, settings] = await Promise.all([getCurrentUser(), getSiteSettings()])

  if (!currentUser) {
    redirect("/login?redirect=/settings")
  }

  const [profile, dbUser] = await Promise.all([
    getUserProfile(currentUser.username),
    getUserAccountSettings(currentUser.id),
  ])

  if (!profile) {
    redirect("/")
  }

  const currentTabValue = readSearchParam(searchParams?.tab)
  const currentProfileTabValue = readSearchParam(searchParams?.profileTab)
  const currentPostTabValue = readSearchParam(searchParams?.postTab)
  const currentFollowTabValue = readSearchParam(searchParams?.followTab)
  const currentTab: SettingsTabKey = tabs.includes((currentTabValue as SettingsTabKey) ?? "profile")
    ? ((currentTabValue as SettingsTabKey) ?? "profile")
    : "profile"
  const currentProfileTab: ProfileTabKey = profileTabs.some((tab) => tab.key === currentProfileTabValue)
    ? (currentProfileTabValue as ProfileTabKey)
    : "basic"
  const currentPostTab: PostManagementTabKey = postManagementTabs.some((tab) => tab.key === currentPostTabValue)
    ? (currentPostTabValue as PostManagementTabKey)
    : "posts"
  const currentFollowTab: FollowTabKey = followTabs.some((tab) => tab.key === currentFollowTabValue)
    ? (currentFollowTabValue as FollowTabKey)
    : "boards"
  const currentPage = Math.max(1, Number(readSearchParam(searchParams?.page) ?? "1") || 1)

  const [userPosts, replies, favoritePosts, likedPosts, followedBoards, followedUsers, followedTags, followedPosts, blockedUsers, levelView, badges, verificationData, pointLogs] = await Promise.all([
    currentTab === "post-management" && currentPostTab === "posts"
      ? getUserPosts(currentUser.id, { page: currentPage, pageSize: 10 })
      : Promise.resolve<Awaited<ReturnType<typeof getUserPosts>> | null>(null),
    currentTab === "post-management" && currentPostTab === "replies"
      ? getUserReplies(currentUser.id, { page: currentPage, pageSize: 10 })
      : Promise.resolve<Awaited<ReturnType<typeof getUserReplies>> | null>(null),
    currentTab === "post-management" && currentPostTab === "favorites"
      ? getUserFavoritePosts(currentUser.id, { page: currentPage, pageSize: 10 })
      : Promise.resolve<Awaited<ReturnType<typeof getUserFavoritePosts>> | null>(null),
    currentTab === "post-management" && currentPostTab === "likes"
      ? getUserLikedPosts(currentUser.id, { page: currentPage, pageSize: 10 })
      : Promise.resolve<Awaited<ReturnType<typeof getUserLikedPosts>> | null>(null),
    currentTab === "follows" && currentFollowTab === "boards"
      ? getUserBoardFollows(currentUser.id, { page: currentPage, pageSize: 12 })
      : Promise.resolve<Awaited<ReturnType<typeof getUserBoardFollows>> | null>(null),
    currentTab === "follows" && currentFollowTab === "users"
      ? getUserUserFollows(currentUser.id, { page: currentPage, pageSize: 12 })
      : Promise.resolve<Awaited<ReturnType<typeof getUserUserFollows>> | null>(null),
    currentTab === "follows" && currentFollowTab === "tags"
      ? getUserTagFollows(currentUser.id, { page: currentPage, pageSize: 18 })
      : Promise.resolve<Awaited<ReturnType<typeof getUserTagFollows>> | null>(null),
    currentTab === "follows" && currentFollowTab === "posts"
      ? getUserPostFollows(currentUser.id, { page: currentPage, pageSize: 10 })
      : Promise.resolve<Awaited<ReturnType<typeof getUserPostFollows>> | null>(null),
    currentTab === "follows" && currentFollowTab === "blocks"
      ? getUserBlocks(currentUser.id, { page: currentPage, pageSize: 12 })
      : Promise.resolve<Awaited<ReturnType<typeof getUserBlocks>> | null>(null),
    currentTab === "level" ? getCurrentUserLevelProgressView() : Promise.resolve(null),
    currentTab === "badges" ? getBadgeCenterData(currentUser.id) : Promise.resolve([]),
    currentTab === "verifications" ? getCurrentUserVerificationData() : Promise.resolve({ currentUserId: currentUser.id, types: [], approvedVerification: null }),
    currentTab === "points" ? getUserPointLogs(currentUser.id, { page: currentPage, pageSize: 10 }) : Promise.resolve(null),
  ])

  const invitePath = `/register?invite=${encodeURIComponent(profile.username)}`
  const inviteCodePrice = isVipActive(currentUser)
    ? getVipLevel(currentUser) >= 3
      ? settings.inviteCodeVip3Price
      : getVipLevel(currentUser) === 2
        ? settings.inviteCodeVip2Price
        : settings.inviteCodeVip1Price
    : settings.inviteCodePrice
  const inviteCodePriceDescription = isVipActive(currentUser)
    ? getVipLevel(currentUser) >= 3
      ? "你当前按 VIP3 价购买邀请码"
      : getVipLevel(currentUser) === 2
        ? "你当前按 VIP2 价购买邀请码"
        : "你当前按 VIP1 价购买邀请码"
    : "你当前按普通用户价格购买邀请码"
  const nicknameChangePriceDescription = isVipActive(currentUser)
    ? getVipLevel(currentUser) >= 3
      ? "你当前按 VIP3 价结算"
      : getVipLevel(currentUser) === 2
        ? "你当前按 VIP2 价结算"
        : "你当前按 VIP1 价结算"
    : "你当前按普通用户价格结算"
  const nicknameChangePointCost = isVipActive(currentUser)
    ? getVipLevel(currentUser) >= 3
      ? settings.nicknameChangeVip3PointCost
      : getVipLevel(currentUser) === 2
        ? settings.nicknameChangeVip2PointCost
        : settings.nicknameChangeVip1PointCost
    : settings.nicknameChangePointCost

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1240px] px-4 py-8 lg:px-6">
        <SettingsShell profile={profile} pointName={settings.pointName}>
          {currentTab === "profile" ? (
            <ProfilePanel
              currentTab={currentProfileTab}
              tabs={profileTabs}
              profile={profile}
              dbUser={dbUser}
              nicknameChangePointCost={nicknameChangePointCost}
              nicknameChangePriceDescription={nicknameChangePriceDescription}
              pointName={settings.pointName}
              avatarMaxFileSizeMb={settings.uploadAvatarMaxFileSizeMb}
            />
          ) : null}

          {currentTab === "invite" ? (
            <Card>
              <CardHeader>
                <CardTitle>邀请中心</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[20px] bg-secondary/60 p-4">
                    <p className="text-2xl font-semibold">{profile.inviteCount}</p>
                    <p className="mt-1 text-sm text-muted-foreground">已邀请注册</p>
                  </div>
                  <div className="rounded-[20px] bg-secondary/60 p-4">
                    <p className="text-2xl font-semibold">{profile.inviterUsername ?? "-"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">邀请人</p>
                  </div>
                  <div className="rounded-[20px] bg-secondary/60 p-4">
                    <p className="text-2xl font-semibold">{settings.inviteRewardInviter}</p>
                    <p className="mt-1 text-sm text-muted-foreground">邀请成功可得 {settings.pointName}</p>
                  </div>
                </div>
                <div className="space-y-3 rounded-[24px] border border-border px-4 py-4 text-sm">
                  <div>
                    <p className="font-medium">我的邀请链接</p>
                    <p className="mt-2 break-all text-muted-foreground">{invitePath}</p>
                    <p className="mt-2 text-xs leading-6 text-muted-foreground">把这个链接发给好友，对方注册时会自动带上你的邀请信息。</p>
                  </div>
                  <InviteLinkCopyButton path={invitePath} />
                </div>
                <InviteCodePurchaseCard enabled={settings.inviteCodePurchaseEnabled} price={inviteCodePrice} priceDescription={inviteCodePriceDescription} pointName={settings.pointName} />
              </CardContent>
            </Card>
          ) : null}

          {currentTab === "post-management" ? (
            <PostManagementPanel
              currentTab={currentPostTab}
              tabs={postManagementTabs}
              userPosts={userPosts}
              replies={replies}
              favoritePosts={favoritePosts}
              likedPosts={likedPosts}
              postLinkDisplayMode={settings.postLinkDisplayMode}
            />
          ) : null}

          {currentTab === "level" ? <LevelPanel levelView={levelView} pointName={settings.pointName} /> : null}

          {currentTab === "badges" ? (
            <div className="space-y-6">
              <BadgeCenter
                isLoggedIn
                badges={badges.map((badge) => ({
                  id: badge.id,
                  name: badge.name,
                  code: badge.code,
                  description: badge.description,
                  iconPath: badge.iconPath,
                  iconText: badge.iconText,
                  color: badge.color,
                  imageUrl: badge.imageUrl,
                  category: badge.category,
                  grantedUserCount: badge.grantedUserCount,
                  rules: badge.rules.map((rule) => ({
                    id: rule.id,
                    ruleType: describeBadgeRule(rule),
                    operator: rule.operator,
                    value: describeBadgeRule(rule),
                    extraValue: null,
                    sortOrder: rule.sortOrder,
                  })),
                  eligibility: badge.eligibility,
                  display: badge.display,
                }))}
              />

              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">如何获得更多勋章</h2>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">围绕发帖、回复、获赞、邀请、等级、签到和 VIP 成长来积累你的社区身份。达成条件后记得回来手动领取。</p>
                    </div>
                    <Link href="/write" className="inline-flex rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90">
                      去参与社区
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {currentTab === "verifications" ? <VerificationCenter types={verificationData.types ?? []} approvedVerification={verificationData.approvedVerification ?? null} /> : null}

          {currentTab === "points" ? <PointsPanel pointLogs={pointLogs} currentPoints={profile.points} pointName={settings.pointName} /> : null}

      {currentTab === "follows" ? <FollowsPanel currentTab={currentFollowTab} tabs={followTabs} followedBoards={followedBoards} followedUsers={followedUsers} followedTags={followedTags} followedPosts={followedPosts} blockedUsers={blockedUsers} postLinkDisplayMode={settings.postLinkDisplayMode} /> : null}
        </SettingsShell>
      </main>
    </div>
  )
}

function ProfilePanel({
  currentTab,
  tabs,
  profile,
  dbUser,
  nicknameChangePointCost,
  nicknameChangePriceDescription,
  pointName,
  avatarMaxFileSizeMb,
}: {
  currentTab: ProfileTabKey
  tabs: Array<{ key: ProfileTabKey; label: string }>
  profile: NonNullable<Awaited<ReturnType<typeof getUserProfile>>>
  dbUser: Awaited<ReturnType<typeof getUserAccountSettings>>
  nicknameChangePointCost: number
  nicknameChangePriceDescription: string
  pointName: string
  avatarMaxFileSizeMb: number
}) {
  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="space-y-1">
          <CardTitle>{currentTab === "basic" ? "资料设置" : "浏览设置"}</CardTitle>
          <p className="text-sm text-muted-foreground">在这里维护个人资料和当前浏览器的浏览偏好。</p>
        </div>
        <SettingsTabs tabs={tabs} queryKey="profileTab" basePath="/settings?tab=profile" />
      </CardHeader>
      <CardContent className="space-y-6">
        {currentTab === "basic" ? (
          <ProfileEditForm
            username={profile.username}
            initialNickname={profile.displayName}
            initialBio={profile.bio}
            initialGender={profile.gender ?? null}
            initialAvatarPath={profile.avatarPath}
            initialEmail={dbUser?.email ?? null}
            initialEmailVerified={Boolean(dbUser?.emailVerifiedAt)}
            nicknameChangePointCost={nicknameChangePointCost}
            nicknameChangePriceDescription={nicknameChangePriceDescription}
            pointName={pointName}
            avatarMaxFileSizeMb={avatarMaxFileSizeMb}
          />
        ) : null}

        {currentTab === "browsing" ? <BrowsingSettingsPanel /> : null}
      </CardContent>
    </Card>
  )
}

function PostManagementPanel({
  currentTab,
  tabs,
  userPosts,
  replies,
  favoritePosts,
  likedPosts,
  postLinkDisplayMode,
}: {
  currentTab: PostManagementTabKey
  tabs: Array<{ key: PostManagementTabKey; label: string }>
  userPosts: Awaited<ReturnType<typeof getUserPosts>> | null
  replies: Awaited<ReturnType<typeof getUserReplies>> | null
  favoritePosts: Awaited<ReturnType<typeof getUserFavoritePosts>> | null
  likedPosts: Awaited<ReturnType<typeof getUserLikedPosts>> | null
  postLinkDisplayMode: "SLUG" | "ID"
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-4">
          <div className="space-y-1">
            <CardTitle>帖子管理</CardTitle>
            <p className="text-sm text-muted-foreground">集中查看你发布、回复、收藏和点赞过的帖子内容。</p>
          </div>
          <SettingsTabs tabs={tabs} queryKey="postTab" basePath="/settings?tab=post-management" />
        </CardHeader>
      </Card>

      {currentTab === "posts" ? <MyPostsPanel userPosts={userPosts} postLinkDisplayMode={postLinkDisplayMode} /> : null}
      {currentTab === "replies" ? <MyRepliesPanel replies={replies} postLinkDisplayMode={postLinkDisplayMode} /> : null}
      {currentTab === "favorites" ? <FavoritesPanel favoritePosts={favoritePosts} postLinkDisplayMode={postLinkDisplayMode} /> : null}
      {currentTab === "likes" ? <MyLikesPanel likedPosts={likedPosts} postLinkDisplayMode={postLinkDisplayMode} /> : null}
    </div>
  )
}

function LevelPanel({ levelView, pointName }: { levelView: Awaited<ReturnType<typeof getCurrentUserLevelProgressView>>; pointName: string }) {
  if (!levelView) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载等级进度，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-none bg-[linear-gradient(135deg,rgba(37,99,235,0.10),rgba(124,58,237,0.10),rgba(249,115,22,0.08))] shadow-soft">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[11px] font-medium text-slate-700 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                <Sparkles className="h-3.5 w-3.5" />
                我的成长等级
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">当前已达到 Lv.{levelView.currentLevel.level}</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">这里会展示你当前等级、成长进度，以及升级到下一等级还差哪些条件。</p>
            </div>
            <div className="rounded-[28px] border border-white/60 bg-white/75 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
              <LevelBadge
                level={levelView.currentLevel.level}
                name={levelView.currentLevel.name}
                color={levelView.currentLevel.color}
                icon={levelView.currentLevel.icon}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="累计发帖" value={levelView.snapshot.postCount} hint="公开发帖数量" icon={<Flame className="h-4 w-4" />} />
        <StatCard title="累计回复" value={levelView.snapshot.commentCount} hint="公开回复数量" icon={<MessageSquareText className="h-4 w-4" />} />
        <StatCard title="累计获赞" value={levelView.snapshot.likeReceivedCount} hint="收到的点赞总数" icon={<Heart className="h-4 w-4" />} />
        <StatCard title="累计签到" value={levelView.snapshot.checkInDays} hint="已完成签到天数" icon={<CheckCircle2 className="h-4 w-4" />} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{levelView.nextLevel ? `升级到 Lv.${levelView.nextLevel.level} · ${levelView.nextLevel.name}` : "已达到最高等级"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {levelView.nextLevel ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <LevelBadge
                  level={levelView.nextLevel.level}
                  name={levelView.nextLevel.name}
                  color={levelView.nextLevel.color}
                  icon={levelView.nextLevel.icon}
                />
                <span className="text-sm text-muted-foreground">升级条件为“且”关系，需要同时满足下面所有门槛。</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <ProgressItem title="签到天数" current={levelView.completion?.checkInDays.current ?? 0} required={levelView.completion?.checkInDays.required ?? 0} remaining={levelView.completion?.checkInDays.remaining ?? 0} completed={Boolean(levelView.completion?.checkInDays.completed)} />
                <ProgressItem title="发帖数量" current={levelView.completion?.postCount.current ?? 0} required={levelView.completion?.postCount.required ?? 0} remaining={levelView.completion?.postCount.remaining ?? 0} completed={Boolean(levelView.completion?.postCount.completed)} />
                <ProgressItem title="回复数量" current={levelView.completion?.commentCount.current ?? 0} required={levelView.completion?.commentCount.required ?? 0} remaining={levelView.completion?.commentCount.remaining ?? 0} completed={Boolean(levelView.completion?.commentCount.completed)} />
                <ProgressItem title="收到点赞数" current={levelView.completion?.likeReceivedCount.current ?? 0} required={levelView.completion?.likeReceivedCount.required ?? 0} remaining={levelView.completion?.likeReceivedCount.remaining ?? 0} completed={Boolean(levelView.completion?.likeReceivedCount.completed)} />
              </div>
            </>
          ) : (
            <div className="rounded-[24px] border border-dashed border-border px-4 py-8 text-center">
              <Crown className="mx-auto h-8 w-8 text-amber-500" />
              <p className="mt-3 text-base font-semibold">你已经达到当前站点的最高等级</p>
              <p className="mt-2 text-sm text-muted-foreground">后续如果后台新增更高等级，你的成长页会自动展示新的升级目标。</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>快速入口</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <QuickLink href="/write" title="去发帖" description="发布主题会推动成长进度。" />
          <QuickLink href="/settings?tab=points" title={`查看${pointName}明细`} description={`顺便查看当前 ${pointName} 账户情况。`} />
          <QuickLink href="/settings?tab=badges" title="前往勋章中心" description="查看哪些社区勋章已经达成。" />
        </CardContent>
      </Card>
    </div>
  )
}

function MyPostsPanel({ userPosts, postLinkDisplayMode }: { userPosts: Awaited<ReturnType<typeof getUserPosts>> | null; postLinkDisplayMode: "SLUG" | "ID" }) {
  if (!userPosts) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载我的帖子，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return <PostListPanel title="我的帖子" emptyText="当前还没有发布过帖子。" posts={userPosts} postLinkDisplayMode={postLinkDisplayMode} paginationBase="/settings?tab=post-management&postTab=posts" />
}

function MyRepliesPanel({ replies, postLinkDisplayMode }: { replies: Awaited<ReturnType<typeof getUserReplies>> | null; postLinkDisplayMode: "SLUG" | "ID" }) {
  if (!replies) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载我的回复，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>我的回复</CardTitle>
          <span className="text-sm text-muted-foreground">共 {replies.total} 条记录 · 第 {replies.page} / {replies.totalPages} 页</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {replies.items.length === 0 ? <p className="text-sm text-muted-foreground">当前还没有发表过回复。</p> : null}
        {replies.items.map((reply) => {
          const postPath = getPostPath({ id: reply.postId, slug: reply.postSlug }, { mode: postLinkDisplayMode })

          return (
          <div key={reply.id} className="rounded-[20px] border border-border bg-card p-4 transition-colors hover:bg-accent/40">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{reply.boardName}</span>
              <span>·</span>
              <span>{formatDateTime(reply.createdAt)}</span>
              {reply.replyToUsername ? (
                <>
                  <span>·</span>
                  <span>回复 @{reply.replyToUsername}</span>
                </>
              ) : null}
            </div>
            <PostListLink href={postPath} visitedPath={postPath} dimWhenRead className="mt-2 inline-block">
              <h2 className="text-base font-semibold">{reply.postTitle}</h2>
            </PostListLink>
            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{reply.content}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <ThumbsUp className="h-3.5 w-3.5" />
              <span>{reply.likeCount} 次点赞</span>
            </div>
          </div>
        )})}

        {replies.total > 0 ? <PaginationBar page={replies.page} hasPrevPage={replies.hasPrevPage} hasNextPage={replies.hasNextPage} basePath="/settings?tab=post-management&postTab=replies" /> : null}
      </CardContent>
    </Card>
  )
}

function FollowsPanel({
  currentTab,
  tabs,
  followedBoards,
  followedUsers,
  followedTags,
  followedPosts,
  blockedUsers,
  postLinkDisplayMode,
}: {
  currentTab: FollowTabKey
  tabs: Array<{ key: FollowTabKey; label: string }>
  followedBoards: Awaited<ReturnType<typeof getUserBoardFollows>> | null
  followedUsers: Awaited<ReturnType<typeof getUserUserFollows>> | null
  followedTags: Awaited<ReturnType<typeof getUserTagFollows>> | null
  followedPosts: Awaited<ReturnType<typeof getUserPostFollows>> | null
  blockedUsers: Awaited<ReturnType<typeof getUserBlocks>> | null
  postLinkDisplayMode: "SLUG" | "ID"
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-4">
          <div className="space-y-1">
            <CardTitle>我的关注</CardTitle>
            <p className="text-sm text-muted-foreground">统一管理你关注的节点、用户、标签和帖子动态。</p>
          </div>
          <SettingsTabs tabs={tabs} queryKey="followTab" basePath="/settings?tab=follows" />
        </CardHeader>
      </Card>

      {currentTab === "boards" ? <FollowBoardsPanel followedBoards={followedBoards} /> : null}
      {currentTab === "users" ? <FollowUsersPanel followedUsers={followedUsers} /> : null}
      {currentTab === "tags" ? <FollowTagsPanel followedTags={followedTags} /> : null}
      {currentTab === "posts" ? <FollowPostsPanel followedPosts={followedPosts} postLinkDisplayMode={postLinkDisplayMode} /> : null}
      {currentTab === "history" ? <ReadingHistoryTabPanel /> : null}
      {currentTab === "blocks" ? <BlockedUsersPanel blockedUsers={blockedUsers} /> : null}
    </div>
  )
}

function ReadingHistoryTabPanel() {
  return (
    <ReadingHistoryPanel
      variant="page"
      title="足迹"
      showClearButton
      emptyDescription="浏览过的帖子会自动保存在当前浏览器本地，最多保留 2000 条。"
    />
  )
}

function FollowBoardsPanel({ followedBoards }: { followedBoards: Awaited<ReturnType<typeof getUserBoardFollows>> | null }) {
  if (!followedBoards) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载关注节点，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>关注节点</CardTitle>
          <span className="text-sm text-muted-foreground">共 {followedBoards.total} 个节点 · 第 {followedBoards.page} / {followedBoards.totalPages} 页</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {followedBoards.items.length === 0 ? <p className="text-sm text-muted-foreground">你还没有关注任何节点。</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {followedBoards.items.map((board) => (
            <Link key={board.id} href={`/boards/${board.slug}`} className="rounded-[18px] border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">💬</span>
                    <p className="truncate text-sm font-semibold text-foreground">{board.name}</p>
                  </div>
                  {board.zoneName ? <p className="mt-1 text-xs text-muted-foreground">所属分区：{board.zoneName}</p> : null}
                </div>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{board.description?.trim() || "这个节点还没有填写简介。"}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span>内容 {board.postCount}</span>
                <span>关注 {board.followerCount}</span>
              </div>
            </Link>
          ))}
        </div>

        {followedBoards.total > 0 ? <PaginationBar page={followedBoards.page} hasPrevPage={followedBoards.hasPrevPage} hasNextPage={followedBoards.hasNextPage} basePath="/settings?tab=follows&followTab=boards" /> : null}
      </CardContent>
    </Card>
  )
}

function FollowUsersPanel({ followedUsers }: { followedUsers: Awaited<ReturnType<typeof getUserUserFollows>> | null }) {
  if (!followedUsers) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载关注用户，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>关注用户</CardTitle>
          <span className="text-sm text-muted-foreground">共 {followedUsers.total} 位用户 · 第 {followedUsers.page} / {followedUsers.totalPages} 页</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {followedUsers.items.length === 0 ? <p className="text-sm text-muted-foreground">你还没有关注任何用户。</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {followedUsers.items.map((user) => (
            <Link key={user.id} href={`/users/${user.username}`} className="rounded-[18px] border border-border bg-card px-4 py-4 transition-colors hover:bg-accent/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{user.displayName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">@{user.username}</p>
                </div>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
              <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{user.bio}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span>Lv.{user.level}</span>
                <span>帖子 {user.postCount}</span>
                <span>粉丝 {user.followerCount}</span>
              </div>
            </Link>
          ))}
        </div>

        {followedUsers.total > 0 ? <PaginationBar page={followedUsers.page} hasPrevPage={followedUsers.hasPrevPage} hasNextPage={followedUsers.hasNextPage} basePath="/settings?tab=follows&followTab=users" /> : null}
      </CardContent>
    </Card>
  )
}

function FollowTagsPanel({ followedTags }: { followedTags: Awaited<ReturnType<typeof getUserTagFollows>> | null }) {
  if (!followedTags) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载关注标签，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>关注标签</CardTitle>
          <span className="text-sm text-muted-foreground">共 {followedTags.total} 个标签 · 第 {followedTags.page} / {followedTags.totalPages} 页</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {followedTags.items.length === 0 ? <p className="text-sm text-muted-foreground">你还没有关注任何标签。</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {followedTags.items.map((tag) => (
            <Link key={tag.id} href={`/tags/${tag.slug}`} className="rounded-[18px] border border-border bg-card px-4 py-4 transition-colors hover:bg-accent/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">#{tag.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">/tags/{tag.slug}</p>
                </div>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span>内容 {tag.postCount}</span>
                <span>关注 {tag.followerCount}</span>
              </div>
            </Link>
          ))}
        </div>

        {followedTags.total > 0 ? <PaginationBar page={followedTags.page} hasPrevPage={followedTags.hasPrevPage} hasNextPage={followedTags.hasNextPage} basePath="/settings?tab=follows&followTab=tags" /> : null}
      </CardContent>
    </Card>
  )
}

function FollowPostsPanel({
  followedPosts,
  postLinkDisplayMode,
}: {
  followedPosts: Awaited<ReturnType<typeof getUserPostFollows>> | null
  postLinkDisplayMode: "SLUG" | "ID"
}) {
  if (!followedPosts) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载关注帖子，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return <PostListPanel title="关注帖子" emptyText="当前还没有关注任何帖子。" posts={followedPosts} postLinkDisplayMode={postLinkDisplayMode} paginationBase="/settings?tab=follows&followTab=posts" />
}

function BlockedUsersPanel({ blockedUsers }: { blockedUsers: Awaited<ReturnType<typeof getUserBlocks>> | null }) {
  if (!blockedUsers) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载拉黑列表，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>拉黑用户</CardTitle>
          <span className="text-sm text-muted-foreground">共 {blockedUsers.total} 位用户 · 第 {blockedUsers.page} / {blockedUsers.totalPages} 页</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {blockedUsers.items.length === 0 ? <p className="text-sm text-muted-foreground">当前还没有拉黑任何用户。</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {blockedUsers.items.map((user) => (
            <div key={user.id} className="rounded-[18px] border border-border bg-card px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/users/${user.username}`} className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{user.displayName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">@{user.username}</p>
                </Link>
                <UserBlockToggleButton
                  targetUserId={user.id}
                  initialBlocked
                  activeLabel="取消拉黑"
                  inactiveLabel="拉黑用户"
                  showLabel
                  reloadOnChange
                  className="h-8 rounded-xl px-3 text-xs"
                />
              </div>
              <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{user.bio}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span>Lv.{user.level}</span>
                <span>帖子 {user.postCount}</span>
                <span>粉丝 {user.followerCount}</span>
              </div>
            </div>
          ))}
        </div>

        {blockedUsers.total > 0 ? <PaginationBar page={blockedUsers.page} hasPrevPage={blockedUsers.hasPrevPage} hasNextPage={blockedUsers.hasNextPage} basePath="/settings?tab=follows&followTab=blocks" /> : null}
      </CardContent>
    </Card>
  )
}

function FavoritesPanel({ favoritePosts, postLinkDisplayMode }: { favoritePosts: Awaited<ReturnType<typeof getUserFavoritePosts>> | null; postLinkDisplayMode: "SLUG" | "ID" }) {
  if (!favoritePosts) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载收藏列表，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return <PostListPanel title="我的收藏" emptyText="当前还没有收藏的帖子。" posts={favoritePosts} postLinkDisplayMode={postLinkDisplayMode} paginationBase="/settings?tab=post-management&postTab=favorites" />
}

function MyLikesPanel({ likedPosts, postLinkDisplayMode }: { likedPosts: Awaited<ReturnType<typeof getUserLikedPosts>> | null; postLinkDisplayMode: "SLUG" | "ID" }) {
  if (!likedPosts) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载点赞列表，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return <PostListPanel title="我的点赞" emptyText="当前还没有点赞过帖子。" posts={likedPosts} postLinkDisplayMode={postLinkDisplayMode} paginationBase="/settings?tab=post-management&postTab=likes" />
}

function PostListPanel({
  title,
  emptyText,
  posts,
  postLinkDisplayMode,
  paginationBase,
}: {
  title: string
  emptyText: string
  posts: Awaited<ReturnType<typeof getUserPosts>>
  postLinkDisplayMode: "SLUG" | "ID"
  paginationBase: string
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <span className="text-sm text-muted-foreground">共 {posts.total} 条记录 · 第 {posts.page} / {posts.totalPages} 页</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {posts.items.length === 0 ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null}
        {posts.items.map((post) => {
          const postPath = getPostPath({ id: post.id, slug: post.slug }, { mode: postLinkDisplayMode })

          return (
          <div key={post.id} className="rounded-[20px] border border-border bg-card p-4 transition-colors hover:bg-accent/40">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{post.board}</span>
              <span>·</span>
              <span>{post.publishedAt}</span>
            </div>
            <PostListLink href={postPath} visitedPath={postPath} dimWhenRead className="mt-2 inline-block">
              <h2 className="text-base font-semibold">{post.title}</h2>
            </PostListLink>
            <p className="mt-2 text-sm text-muted-foreground">{post.excerpt}</p>
          </div>
        )})}

        {posts.total > 0 ? <PaginationBar page={posts.page} hasPrevPage={posts.hasPrevPage} hasNextPage={posts.hasNextPage} basePath={paginationBase} /> : null}
      </CardContent>
    </Card>
  )
}

function PointsPanel({ pointLogs, currentPoints, pointName }: { pointLogs: Awaited<ReturnType<typeof getUserPointLogs>> | null; currentPoints: number; pointName: string }) {
  if (!pointLogs) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载积分明细，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{pointName}明细</CardTitle>
            <span className="text-sm text-muted-foreground">当前余额：{currentPoints}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {pointLogs.items.length === 0 ? <p className="text-sm text-muted-foreground">当前还没有任何积分变动记录。</p> : null}
          {pointLogs.items.map((log) => {
            const positive = log.changeType === ChangeType.INCREASE
            return (
              <div key={log.id} className="rounded-[20px] border border-border px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{log.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</p>
                  </div>
                  <span className={positive ? "rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700" : "rounded-full bg-rose-100 px-3 py-1 text-sm font-medium text-rose-700"}>
                    {positive ? "+" : "-"}
                    {log.changeValue}
                  </span>
                </div>
              </div>
            )
          })}

          {pointLogs.total > 0 ? <PaginationBar page={pointLogs.page} hasPrevPage={pointLogs.hasPrevPage} hasNextPage={pointLogs.hasNextPage} basePath="/settings?tab=points" /> : null}
        </CardContent>
      </Card>

      <RedeemCodeCard pointName={pointName} currentPoints={currentPoints} />
    </div>
  )
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-[22px] border border-border bg-card px-5 py-4 transition-colors hover:bg-accent/40">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  )
}

function StatCard({ title, value, hint, icon }: { title: string; value: number; hint: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function ProgressItem({ title, current, required, remaining, completed }: { title: string; current: number; required: number; remaining: number; completed: boolean }) {
  const progress = required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 100

  return (
    <div className="rounded-[24px] border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{title}</p>
        <span className={completed ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700" : "rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground"}>
          {completed ? "已完成" : `还差 ${remaining}`}
        </span>
      </div>
      <div className="mt-4 h-2 rounded-full bg-secondary">
        <div className="h-2 rounded-full bg-foreground transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{current} / {required}</p>
    </div>
  )
}

function PaginationBar({ page, hasPrevPage, hasNextPage, basePath }: { page: number; hasPrevPage: boolean; hasNextPage: boolean; basePath: string }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-2">
      <Link
        href={`${basePath}&page=${Math.max(1, page - 1)}`}
        aria-disabled={!hasPrevPage}
        className={hasPrevPage ? "rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-accent/40" : "pointer-events-none rounded-full border border-border px-4 py-2 text-sm text-muted-foreground opacity-50"}
      >
        上一页
      </Link>
      <Link
        href={`${basePath}&page=${page + 1}`}
        aria-disabled={!hasNextPage}
        className={hasNextPage ? "rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-accent/40" : "pointer-events-none rounded-full border border-border px-4 py-2 text-sm text-muted-foreground opacity-50"}
      >
        下一页
      </Link>
    </div>
  )
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
