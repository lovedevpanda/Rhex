import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Crown, Flame, Heart, MessageSquareText, Sparkles } from "lucide-react"

import { ChangeType } from "@/db/types"
import { BadgeCenter } from "@/components/badge-center"
import { BrowsingSettingsPanel } from "@/components/browsing-settings-panel"
import { InviteCodePurchaseCard } from "@/components/invite-code-purchase-card"
import { InviteLinkCopyButton } from "@/components/invite-link-copy-button"
import { LevelBadge } from "@/components/level-badge"
import { PostListLink } from "@/components/post-list-link"
import { ProfileAccountBindingSettings } from "@/components/profile-account-binding-settings"
import { ProfileEditForm } from "@/components/profile-edit-form"
import { ProfileNotificationSettings } from "@/components/profile-notification-settings"
import { ReadingHistoryPanel } from "@/components/reading-history-panel"
import { RedeemCodeCard } from "@/components/redeem-code-card"
import { SettingsTabs } from "@/components/settings-tabs"
import { UserRecentRepliesList } from "@/components/user-recent-replies-list"
import { UserBlockToggleButton } from "@/components/user-block-toggle-button"
import { VerificationCenter } from "@/components/verification-center"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPostPath } from "@/lib/post-links"
import type { SettingsPageData } from "@/app/settings/settings-page-loader"
import { followTabs, postManagementTabs, profileTabs } from "@/app/settings/settings-page-loader"

function parsePointEffectSummaryToken(token: string) {
  const normalized = token.trim()
  if (!normalized) {
    return null
  }

  const match = normalized.match(/^(.*?)([+-]\d+(?:\.\d+)?)$/)
  const rawLabel = (match?.[1] ?? normalized).trim()
  const adjustmentValue = match?.[2] ?? ""
  const [badgeName, effectName] = rawLabel.includes(".")
    ? rawLabel.split(/\.(.+)/, 2)
    : [null, rawLabel]

  return {
    badgeName: badgeName?.trim() || null,
    effectName: effectName.trim(),
    adjustmentValue,
  }
}

function parsePointEffectSummary(summary: string | null | undefined) {
  return String(summary ?? "")
    .split("|")
    .map((token) => parsePointEffectSummaryToken(token))
    .filter((item): item is NonNullable<ReturnType<typeof parsePointEffectSummaryToken>> => Boolean(item))
}

function buildCursorHref(basePath: string, queryKey: string, cursor: string | null) {
  return cursor ? `${basePath}&${queryKey}=${encodeURIComponent(cursor)}` : "#"
}

export function SettingsPageContent({ data }: { data: SettingsPageData }) {
  const { route, settings } = data

  return (
    <>
      {route.currentTab === "profile" ? (
        <ProfilePanel
          currentTab={route.currentProfileTab}
          profile={data.profile}
          dbUser={data.dbUser}
          nicknameChangePointCost={data.nicknameChangePointCost}
          nicknameChangePriceDescription={data.nicknameChangePriceDescription}
          introductionChangePointCost={data.introductionChangePointCost}
          introductionChangePriceDescription={data.introductionChangePriceDescription}
          avatarChangePointCost={data.avatarChangePointCost}
          avatarChangePriceDescription={data.avatarChangePriceDescription}
          pointName={settings.pointName}
          avatarMaxFileSizeMb={settings.uploadAvatarMaxFileSizeMb}
          markdownEmojiMap={settings.markdownEmojiMap}
          markdownImageUploadEnabled={settings.markdownImageUploadEnabled}
          accountBindings={data.accountBindings}
        />
      ) : null}

      {route.currentTab === "invite" ? (
        <InvitePanel
          profile={data.profile}
          pointName={settings.pointName}
          inviteRewardInviter={settings.inviteRewardInviter}
          inviteCodePurchaseEnabled={settings.inviteCodePurchaseEnabled}
          invitePath={data.invitePath}
          inviteCodePrice={data.inviteCodePrice}
          inviteCodePriceDescription={data.inviteCodePriceDescription}
        />
      ) : null}

      {route.currentTab === "post-management" ? (
        <PostManagementPanel
          currentTab={route.currentPostTab}
          userPosts={data.userPosts}
          replies={data.replies}
          favoritePosts={data.favoritePosts}
          likedPosts={data.likedPosts}
          postLinkDisplayMode={settings.postLinkDisplayMode}
        />
      ) : null}

      {route.currentTab === "level" ? <LevelPanel levelView={data.levelView} pointName={settings.pointName} /> : null}

      {route.currentTab === "badges" ? <BadgesPanel badges={data.badgeDisplayItems} /> : null}

      {route.currentTab === "verifications" ? (
        <VerificationCenter
          types={data.verificationData.types ?? []}
          approvedVerification={data.verificationData.approvedVerification ?? null}
        />
      ) : null}

      {route.currentTab === "points" ? (
        <PointsPanel pointLogs={data.pointLogs} currentPoints={data.profile.points} pointName={settings.pointName} />
      ) : null}

      {route.currentTab === "follows" ? (
        <FollowsPanel
          currentTab={route.currentFollowTab}
          followedBoards={data.followedBoards}
          followedUsers={data.followedUsers}
          followers={data.followers}
          followedTags={data.followedTags}
          followedPosts={data.followedPosts}
          blockedUsers={data.blockedUsers}
          postLinkDisplayMode={settings.postLinkDisplayMode}
        />
      ) : null}
    </>
  )
}

function InvitePanel({
  profile,
  pointName,
  inviteRewardInviter,
  inviteCodePurchaseEnabled,
  invitePath,
  inviteCodePrice,
  inviteCodePriceDescription,
}: {
  profile: SettingsPageData["profile"]
  pointName: string
  inviteRewardInviter: number
  inviteCodePurchaseEnabled: boolean
  invitePath: string
  inviteCodePrice: number
  inviteCodePriceDescription: string
}) {
  return (
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
            <p className="text-2xl font-semibold">{inviteRewardInviter}</p>
            <p className="mt-1 text-sm text-muted-foreground">邀请成功可得 {pointName}</p>
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
        <InviteCodePurchaseCard enabled={inviteCodePurchaseEnabled} price={inviteCodePrice} priceDescription={inviteCodePriceDescription} pointName={pointName} />
      </CardContent>
    </Card>
  )
}

function BadgesPanel({ badges }: { badges: SettingsPageData["badgeDisplayItems"] }) {
  return (
    <div className="space-y-6">
      <BadgeCenter isLoggedIn badges={badges} />

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
  )
}

function ProfilePanel({
  currentTab,
  profile,
  dbUser,
  nicknameChangePointCost,
  nicknameChangePriceDescription,
  introductionChangePointCost,
  introductionChangePriceDescription,
  avatarChangePointCost,
  avatarChangePriceDescription,
  pointName,
  avatarMaxFileSizeMb,
  markdownEmojiMap,
  markdownImageUploadEnabled,
  accountBindings,
}: {
  currentTab: SettingsPageData["route"]["currentProfileTab"]
  profile: SettingsPageData["profile"]
  dbUser: SettingsPageData["dbUser"]
  nicknameChangePointCost: number
  nicknameChangePriceDescription: string
  introductionChangePointCost: number
  introductionChangePriceDescription: string
  avatarChangePointCost: number
  avatarChangePriceDescription: string
  pointName: string
  avatarMaxFileSizeMb: number
  markdownEmojiMap: SettingsPageData["settings"]["markdownEmojiMap"]
  markdownImageUploadEnabled: boolean
  accountBindings: SettingsPageData["accountBindings"]
}) {
  const panelTitle = currentTab === "browsing"
    ? "浏览设置"
    : currentTab === "privacy"
      ? "隐私设置"
      : currentTab === "notifications"
        ? "通知设置"
        : currentTab === "accounts"
          ? "账号绑定"
        : "资料设置"
  const panelDescription = currentTab === "browsing"
    ? "在这里维护当前浏览器的浏览偏好。"
    : currentTab === "privacy"
      ? "在这里控制个人主页活动轨迹的公开范围。"
      : currentTab === "notifications"
        ? "在这里配置站外通知开关、Webhook 地址与测试投递。"
        : currentTab === "accounts"
          ? "在这里绑定或解绑 GitHub、Google 与 Passkey 登录方式。"
      : "在这里维护个人资料与账号信息。"

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="space-y-1">
          <CardTitle>{panelTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">{panelDescription}</p>
        </div>
        <SettingsTabs tabs={profileTabs} queryKey="profileTab" basePath="/settings?tab=profile" />
      </CardHeader>
      <CardContent className="space-y-6">
        {currentTab === "basic" || currentTab === "privacy" ? (
          <ProfileEditForm
            key={currentTab}
            username={profile.username}
            initialNickname={profile.displayName}
            initialBio={profile.bio}
            initialIntroduction={profile.introduction}
            initialGender={profile.gender ?? null}
            initialAvatarPath={profile.avatarPath}
            initialEmail={dbUser?.email ?? null}
            initialEmailVerified={Boolean(dbUser?.emailVerifiedAt)}
            initialActivityVisibilityPublic={dbUser?.activityVisibilityPublic ?? true}
            nicknameChangePointCost={nicknameChangePointCost}
            nicknameChangePriceDescription={nicknameChangePriceDescription}
            introductionChangePointCost={introductionChangePointCost}
            introductionChangePriceDescription={introductionChangePriceDescription}
            avatarChangePointCost={avatarChangePointCost}
            avatarChangePriceDescription={avatarChangePriceDescription}
            pointName={pointName}
            avatarMaxFileSizeMb={avatarMaxFileSizeMb}
            markdownEmojiMap={markdownEmojiMap}
            markdownImageUploadEnabled={markdownImageUploadEnabled}
            initialSection={currentTab === "privacy" ? "privacy" : "basic"}
            availableSections={currentTab === "privacy" ? ["privacy"] : ["basic", "avatar", "email", "password"]}
          />
        ) : null}

        {currentTab === "notifications" ? (
          <ProfileNotificationSettings
            initialExternalNotificationEnabled={dbUser?.externalNotificationEnabled ?? false}
            initialNotificationWebhookUrl={dbUser?.notificationWebhookUrl ?? ""}
          />
        ) : null}

        {currentTab === "accounts" && accountBindings ? (
          <ProfileAccountBindingSettings providers={accountBindings.providers} passkey={accountBindings.passkey} />
        ) : null}

        {currentTab === "browsing" ? <BrowsingSettingsPanel /> : null}
      </CardContent>
    </Card>
  )
}

function PostManagementPanel({
  currentTab,
  userPosts,
  replies,
  favoritePosts,
  likedPosts,
  postLinkDisplayMode,
}: {
  currentTab: SettingsPageData["route"]["currentPostTab"]
  userPosts: SettingsPageData["userPosts"]
  replies: SettingsPageData["replies"]
  favoritePosts: SettingsPageData["favoritePosts"]
  likedPosts: SettingsPageData["likedPosts"]
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
          <SettingsTabs tabs={postManagementTabs} queryKey="postTab" basePath="/settings?tab=post-management" />
        </CardHeader>
      </Card>

      {currentTab === "posts" ? <MyPostsPanel userPosts={userPosts} postLinkDisplayMode={postLinkDisplayMode} /> : null}
      {currentTab === "replies" ? <MyRepliesPanel replies={replies} postLinkDisplayMode={postLinkDisplayMode} /> : null}
      {currentTab === "favorites" ? <FavoritesPanel favoritePosts={favoritePosts} postLinkDisplayMode={postLinkDisplayMode} /> : null}
      {currentTab === "likes" ? <MyLikesPanel likedPosts={likedPosts} postLinkDisplayMode={postLinkDisplayMode} /> : null}
    </div>
  )
}

function LevelPanel({ levelView, pointName }: { levelView: SettingsPageData["levelView"]; pointName: string }) {
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

function MyPostsPanel({ userPosts, postLinkDisplayMode }: { userPosts: SettingsPageData["userPosts"]; postLinkDisplayMode: "SLUG" | "ID" }) {
  if (!userPosts) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载我的帖子，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return <PostListPanel title="我的帖子" emptyText="当前还没有发布过帖子。" posts={userPosts} postLinkDisplayMode={postLinkDisplayMode} paginationBase="/settings?tab=post-management&postTab=posts" />
}

function MyRepliesPanel({ replies, postLinkDisplayMode }: { replies: SettingsPageData["replies"]; postLinkDisplayMode: "SLUG" | "ID" }) {
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
          <span className="text-sm text-muted-foreground">共 {replies.total} 条记录</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <UserRecentRepliesList replies={replies.items} postLinkDisplayMode={postLinkDisplayMode} emptyText="当前还没有发表过回复。" />

        {replies.total > 0 ? (
          <CursorPaginationBar
            hasPrevPage={replies.hasPrevPage}
            hasNextPage={replies.hasNextPage}
            prevHref={buildCursorHref("/settings?tab=post-management&postTab=replies", "listBefore", replies.prevCursor)}
            nextHref={buildCursorHref("/settings?tab=post-management&postTab=replies", "listAfter", replies.nextCursor)}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function FollowsPanel({
  currentTab,
  followedBoards,
  followedUsers,
  followers,
  followedTags,
  followedPosts,
  blockedUsers,
  postLinkDisplayMode,
}: {
  currentTab: SettingsPageData["route"]["currentFollowTab"]
  followedBoards: SettingsPageData["followedBoards"]
  followedUsers: SettingsPageData["followedUsers"]
  followers: SettingsPageData["followers"]
  followedTags: SettingsPageData["followedTags"]
  followedPosts: SettingsPageData["followedPosts"]
  blockedUsers: SettingsPageData["blockedUsers"]
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
          <SettingsTabs tabs={followTabs} queryKey="followTab" basePath="/settings?tab=follows" />
        </CardHeader>
      </Card>

      {currentTab === "boards" ? <FollowBoardsPanel followedBoards={followedBoards} /> : null}
      {currentTab === "users" ? <FollowUsersPanel followedUsers={followedUsers} /> : null}
      {currentTab === "followers" ? <FollowersPanel followers={followers} /> : null}
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

function FollowBoardsPanel({ followedBoards }: { followedBoards: SettingsPageData["followedBoards"] }) {
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
          <span className="text-sm text-muted-foreground">共 {followedBoards.total} 个节点</span>
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

        {followedBoards.total > 0 ? (
          <CursorPaginationBar
            hasPrevPage={followedBoards.hasPrevPage}
            hasNextPage={followedBoards.hasNextPage}
            prevHref={buildCursorHref("/settings?tab=follows&followTab=boards", "listBefore", followedBoards.prevCursor)}
            nextHref={buildCursorHref("/settings?tab=follows&followTab=boards", "listAfter", followedBoards.nextCursor)}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function FollowUsersPanel({ followedUsers }: { followedUsers: SettingsPageData["followedUsers"] }) {
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
          <span className="text-sm text-muted-foreground">共 {followedUsers.total} 位用户</span>
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

        {followedUsers.total > 0 ? (
          <CursorPaginationBar
            hasPrevPage={followedUsers.hasPrevPage}
            hasNextPage={followedUsers.hasNextPage}
            prevHref={buildCursorHref("/settings?tab=follows&followTab=users", "listBefore", followedUsers.prevCursor)}
            nextHref={buildCursorHref("/settings?tab=follows&followTab=users", "listAfter", followedUsers.nextCursor)}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function FollowersPanel({ followers }: { followers: SettingsPageData["followers"] }) {
  if (!followers) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载粉丝列表，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>我的粉丝</CardTitle>
          <span className="text-sm text-muted-foreground">共 {followers.total} 位用户</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {followers.items.length === 0 ? <p className="text-sm text-muted-foreground">当前还没有粉丝。</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {followers.items.map((user) => (
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

        {followers.total > 0 ? (
          <CursorPaginationBar
            hasPrevPage={followers.hasPrevPage}
            hasNextPage={followers.hasNextPage}
            prevHref={buildCursorHref("/settings?tab=follows&followTab=followers", "listBefore", followers.prevCursor)}
            nextHref={buildCursorHref("/settings?tab=follows&followTab=followers", "listAfter", followers.nextCursor)}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function FollowTagsPanel({ followedTags }: { followedTags: SettingsPageData["followedTags"] }) {
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
          <span className="text-sm text-muted-foreground">共 {followedTags.total} 个标签</span>
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

        {followedTags.total > 0 ? (
          <CursorPaginationBar
            hasPrevPage={followedTags.hasPrevPage}
            hasNextPage={followedTags.hasNextPage}
            prevHref={buildCursorHref("/settings?tab=follows&followTab=tags", "listBefore", followedTags.prevCursor)}
            nextHref={buildCursorHref("/settings?tab=follows&followTab=tags", "listAfter", followedTags.nextCursor)}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function FollowPostsPanel({ followedPosts, postLinkDisplayMode }: { followedPosts: SettingsPageData["followedPosts"]; postLinkDisplayMode: "SLUG" | "ID" }) {
  if (!followedPosts) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载关注帖子，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return <PostListPanel title="关注帖子" emptyText="当前还没有关注任何帖子。" posts={followedPosts} postLinkDisplayMode={postLinkDisplayMode} paginationBase="/settings?tab=follows&followTab=posts" />
}

function BlockedUsersPanel({ blockedUsers }: { blockedUsers: SettingsPageData["blockedUsers"] }) {
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
          <span className="text-sm text-muted-foreground">共 {blockedUsers.total} 位用户</span>
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

        {blockedUsers.total > 0 ? (
          <CursorPaginationBar
            hasPrevPage={blockedUsers.hasPrevPage}
            hasNextPage={blockedUsers.hasNextPage}
            prevHref={buildCursorHref("/settings?tab=follows&followTab=blocks", "listBefore", blockedUsers.prevCursor)}
            nextHref={buildCursorHref("/settings?tab=follows&followTab=blocks", "listAfter", blockedUsers.nextCursor)}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function FavoritesPanel({ favoritePosts, postLinkDisplayMode }: { favoritePosts: SettingsPageData["favoritePosts"]; postLinkDisplayMode: "SLUG" | "ID" }) {
  if (!favoritePosts) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载收藏列表，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return <PostListPanel title="我的收藏" emptyText="当前还没有收藏的帖子。" posts={favoritePosts} postLinkDisplayMode={postLinkDisplayMode} paginationBase="/settings?tab=post-management&postTab=favorites" />
}

function MyLikesPanel({ likedPosts, postLinkDisplayMode }: { likedPosts: SettingsPageData["likedPosts"]; postLinkDisplayMode: "SLUG" | "ID" }) {
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
  posts: NonNullable<SettingsPageData["userPosts"]>
  postLinkDisplayMode: "SLUG" | "ID"
  paginationBase: string
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <span className="text-sm text-muted-foreground">共 {posts.total} 条记录</span>
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
          )
        })}

        {posts.total > 0 ? (
          <CursorPaginationBar
            hasPrevPage={posts.hasPrevPage}
            hasNextPage={posts.hasNextPage}
            prevHref={buildCursorHref(paginationBase, "listBefore", posts.prevCursor)}
            nextHref={buildCursorHref(paginationBase, "listAfter", posts.nextCursor)}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function PointsPanel({ pointLogs, currentPoints, pointName }: { pointLogs: SettingsPageData["pointLogs"]; currentPoints: number; pointName: string }) {
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
            const effectItems = parsePointEffectSummary(log.pointEffect?.ruleSummary)
            return (
              <div key={log.id} className="rounded-[20px] border border-border px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{log.displayReason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</p>
                    {typeof log.beforeBalance === "number" && typeof log.afterBalance === "number" ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        更改前：{log.beforeBalance} · 更改后：{log.afterBalance}
                      </p>
                    ) : null}
                  </div>
                  <span className={positive ? "rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700" : "rounded-full bg-rose-100 px-3 py-1 text-sm font-medium text-rose-700"}>
                    {positive ? "+" : "-"}
                    {log.changeValue}
                  </span>
                </div>
                {log.pointEffect ? (
                  <div className="mt-3 rounded-[18px] border border-amber-200 bg-amber-50/70 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800">
                        <Sparkles className="h-3.5 w-3.5" />
                        勋章特效
                      </span>
                      <span className="text-muted-foreground">初始：{log.pointEffect.baseValue}</span>
                      <span className={String(log.pointEffect.deltaValue).startsWith("-") ? "text-rose-700" : "text-emerald-700"}>
                        特效：{log.pointEffect.deltaValue}
                      </span>
                    </div>
                    {effectItems.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {effectItems.map((item, index) => (
                          <span key={`${log.id}-effect-${index}`} className="inline-flex flex-wrap items-center gap-1 rounded-full border border-amber-200 bg-background px-3 py-1 text-xs text-foreground">
                            {item.badgeName ? <span className="text-muted-foreground">{item.badgeName}</span> : null}
                            <span>{item.effectName}</span>
                            {item.adjustmentValue ? (
                              <span className={item.adjustmentValue.startsWith("-") ? "text-rose-700" : "text-emerald-700"}>
                                {item.adjustmentValue}
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}

          {pointLogs.total > 0 ? (
            <div className="flex items-center justify-end gap-2 pt-2">
              <Link
                href={pointLogs.hasPrevPage && pointLogs.prevCursor ? `/settings?tab=points&pointsBefore=${encodeURIComponent(pointLogs.prevCursor)}` : "#"}
                aria-disabled={!pointLogs.hasPrevPage}
                className={pointLogs.hasPrevPage ? "rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-accent/40" : "pointer-events-none rounded-full border border-border px-4 py-2 text-sm text-muted-foreground opacity-50"}
              >
                上一页
              </Link>
              <Link
                href={pointLogs.hasNextPage && pointLogs.nextCursor ? `/settings?tab=points&pointsAfter=${encodeURIComponent(pointLogs.nextCursor)}` : "#"}
                aria-disabled={!pointLogs.hasNextPage}
                className={pointLogs.hasNextPage ? "rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-accent/40" : "pointer-events-none rounded-full border border-border px-4 py-2 text-sm text-muted-foreground opacity-50"}
              >
                下一页
              </Link>
            </div>
          ) : null}
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

function StatCard({ title, value, hint, icon }: { title: string; value: number; hint: string; icon: ReactNode }) {
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

function CursorPaginationBar({ hasPrevPage, hasNextPage, prevHref, nextHref }: { hasPrevPage: boolean; hasNextPage: boolean; prevHref: string; nextHref: string }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-2">
      <Link
        href={hasPrevPage ? prevHref : "#"}
        aria-disabled={!hasPrevPage}
        className={hasPrevPage ? "rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-accent/40" : "pointer-events-none rounded-full border border-border px-4 py-2 text-sm text-muted-foreground opacity-50"}
      >
        上一页
      </Link>
      <Link
        href={hasNextPage ? nextHref : "#"}
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
