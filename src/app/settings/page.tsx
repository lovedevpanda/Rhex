import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, CheckCircle2, Crown, Flame, Heart, MessageSquareText, Sparkles } from "lucide-react"

import { ChangeType } from "@/db/types"
import { BadgeCenter } from "@/components/badge-center"
import { InviteCodePurchaseCard } from "@/components/invite-code-purchase-card"
import { InviteLinkCopyButton } from "@/components/invite-link-copy-button"
import { LevelBadge } from "@/components/level-badge"
import { PasswordChangeForm } from "@/components/password-change-form"
import { ProfileEditForm } from "@/components/profile-edit-form"
import { RedeemCodeCard } from "@/components/redeem-code-card"
import { SettingsShell } from "@/components/settings-shell"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { describeBadgeRule, getBadgeCenterData } from "@/lib/badges"
import { getCurrentUser } from "@/lib/auth"
import { getUserPointLogs } from "@/lib/points"
import { getSiteSettings } from "@/lib/site-settings"
import { getUserBoardFollows, getUserFavoritePosts } from "@/lib/user-panel"
import { getCurrentUserLevelProgressView } from "@/lib/user-level-view"
import { getUserAccountSettings, getUserProfile } from "@/lib/users"
import { getCurrentUserVerificationData } from "@/lib/verifications"
import { VerificationCenter } from "@/components/verification-center"

interface SettingsPageProps {
  searchParams?: {
    tab?: string
    page?: string
  }
}

type SettingsTabKey = "profile" | "password" | "invite" | "level" | "badges" | "verifications" | "points" | "favorites" | "follows"

const tabs: SettingsTabKey[] = ["profile", "password", "invite", "level", "badges", "verifications", "points", "favorites", "follows"]

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
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

  const currentTab: SettingsTabKey = tabs.includes((searchParams?.tab as SettingsTabKey) ?? "profile")
    ? ((searchParams?.tab as SettingsTabKey) ?? "profile")
    : "profile"
  const currentPage = Math.max(1, Number(searchParams?.page ?? "1") || 1)

  const [favoritePosts, followedBoards, levelView, badges, verificationData, pointLogs] = await Promise.all([
    currentTab === "favorites"
      ? getUserFavoritePosts(currentUser.id, { page: currentPage, pageSize: 10 })
      : Promise.resolve<Awaited<ReturnType<typeof getUserFavoritePosts>> | null>(null),
    currentTab === "follows"
      ? getUserBoardFollows(currentUser.id, { page: currentPage, pageSize: 12 })
      : Promise.resolve<Awaited<ReturnType<typeof getUserBoardFollows>> | null>(null),
    currentTab === "level" ? getCurrentUserLevelProgressView() : Promise.resolve(null),
    currentTab === "badges" ? getBadgeCenterData(currentUser.id) : Promise.resolve([]),
    currentTab === "verifications" ? getCurrentUserVerificationData() : Promise.resolve({ currentUserId: currentUser.id, types: [], approvedVerification: null }),
    currentTab === "points" ? getUserPointLogs(currentUser.id, { page: currentPage, pageSize: 10 }) : Promise.resolve(null),
  ])

  const invitePath = `/register?invite=${encodeURIComponent(profile.username)}`

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1240px] px-4 py-8 lg:px-6">
        <SettingsShell profile={profile} pointName={settings.pointName}>
          {currentTab === "profile" ? (
            <Card>
              <CardHeader>
                <CardTitle>资料设置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-[24px] bg-secondary/50 p-4 text-sm text-muted-foreground">
                  当前头像：未上传头像时会自动显示基于用户名生成的默认头像。头像修改模块下一步可继续接入上传能力。
                </div>
                <ProfileEditForm
                  username={profile.username}
                  initialNickname={profile.displayName}
                  initialBio={profile.bio}
                  initialAvatarPath={profile.avatarPath}
                  initialEmail={dbUser?.email ?? null}
                  initialEmailVerified={Boolean(dbUser?.emailVerifiedAt)}
                  nicknameChangePointCost={settings.nicknameChangePointCost}
                  pointName={settings.pointName}
                />
              </CardContent>
            </Card>
          ) : null}

          {currentTab === "password" ? (
            <Card>
              <CardHeader>
                <CardTitle>修改密码</CardTitle>
              </CardHeader>
              <CardContent>
                <PasswordChangeForm />
              </CardContent>
            </Card>
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
                <InviteCodePurchaseCard enabled={settings.inviteCodePurchaseEnabled} price={settings.inviteCodePrice} pointName={settings.pointName} />
              </CardContent>
            </Card>
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

          {currentTab === "favorites" ? <FavoritesPanel favoritePosts={favoritePosts} /> : null}

          {currentTab === "follows" ? <FollowsPanel followedBoards={followedBoards} /> : null}
        </SettingsShell>
      </main>
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

function FollowsPanel({ followedBoards }: { followedBoards: Awaited<ReturnType<typeof getUserBoardFollows>> | null }) {
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

        {followedBoards.total > 0 ? (
          <div className="flex items-center justify-between pt-2">
            <Link href={`/settings?tab=follows&page=${Math.max(1, followedBoards.page - 1)}`} className={followedBoards.hasPrevPage ? "" : "pointer-events-none opacity-50"}>
              <span className="rounded-full border border-border bg-card px-4 py-2 text-sm">上一页</span>
            </Link>
            <span className="text-sm text-muted-foreground">第 {followedBoards.page} 页</span>
            <Link href={`/settings?tab=follows&page=${followedBoards.page + 1}`} className={followedBoards.hasNextPage ? "" : "pointer-events-none opacity-50"}>
              <span className="rounded-full border border-border bg-card px-4 py-2 text-sm">下一页</span>
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function FavoritesPanel({ favoritePosts }: { favoritePosts: Awaited<ReturnType<typeof getUserFavoritePosts>> | null }) {
  if (!favoritePosts) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载收藏列表，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>帖子收藏</CardTitle>
          <span className="text-sm text-muted-foreground">共 {favoritePosts.total} 条记录 · 第 {favoritePosts.page} / {favoritePosts.totalPages} 页</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {favoritePosts.items.length === 0 ? <p className="text-sm text-muted-foreground">当前还没有收藏的帖子。</p> : null}
        {favoritePosts.items.map((post) => (
          <a key={post.id} href={`/posts/${post.slug}`} className="block rounded-[20px] border border-border bg-card p-4 transition-colors hover:bg-accent/40">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{post.board}</span>
              <span>·</span>
              <span>{post.publishedAt}</span>
            </div>
            <h2 className="mt-2 text-base font-semibold">{post.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{post.excerpt}</p>
          </a>
        ))}

        {favoritePosts.total > 0 ? (
          <div className="flex items-center justify-between pt-2">
            <Link href={`/settings?tab=favorites&page=${Math.max(1, favoritePosts.page - 1)}`} className={favoritePosts.hasPrevPage ? "" : "pointer-events-none opacity-50"}>
              <span className="rounded-full border border-border bg-card px-4 py-2 text-sm">上一页</span>
            </Link>
            <span className="text-sm text-muted-foreground">第 {favoritePosts.page} 页</span>
            <Link href={`/settings?tab=favorites&page=${favoritePosts.page + 1}`} className={favoritePosts.hasNextPage ? "" : "pointer-events-none opacity-50"}>
              <span className="rounded-full border border-border bg-card px-4 py-2 text-sm">下一页</span>
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function PointsPanel({ pointLogs, currentPoints, pointName }: { pointLogs: Awaited<ReturnType<typeof getUserPointLogs>> | null; currentPoints: number; pointName: string }) {
  if (!pointLogs) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载{pointName}明细，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-stretch">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>我的{pointName}</CardTitle>
          </CardHeader>
          <CardContent className="h-full">
            <div>
              <p className="text-sm text-muted-foreground">当前{pointName}</p>
              <p className="mt-2 text-3xl font-semibold">{currentPoints}</p>
            </div>
          </CardContent>
        </Card>

        <RedeemCodeCard pointName={pointName} currentPoints={currentPoints} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{pointName}明细</CardTitle>
            <span className="text-sm text-muted-foreground">共 {pointLogs.total} 条记录 · 第 {pointLogs.page} / {pointLogs.totalPages} 页</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {pointLogs.items.length === 0 ? <p className="text-sm text-muted-foreground">当前还没有{pointName}变动记录。</p> : null}
          {pointLogs.items.map((log) => (
            <div key={log.id} className="rounded-[20px] border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={log.changeType === ChangeType.INCREASE ? "rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700" : "rounded-full bg-rose-100 px-3 py-1 text-xs text-rose-700"}>
                    {log.changeType === ChangeType.INCREASE ? `+${log.changeValue}` : `-${log.changeValue}`}
                  </span>
                  {log.isRedeemCode ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700">兑换码</span> : null}
                  <span className="text-sm font-medium">{log.reason}</span>
                </div>
                <span className="text-xs text-muted-foreground">{log.createdAt}</span>
              </div>

              {log.relatedType && log.relatedId ? <p className="mt-2 text-xs text-muted-foreground">关联对象：{log.relatedType} / {log.relatedId}</p> : null}
            </div>
          ))}

          {pointLogs.total > 0 ? (
            <div className="flex items-center justify-between pt-2">
              <Link href={`/settings?tab=points&page=${Math.max(1, pointLogs.page - 1)}`} className={pointLogs.hasPrevPage ? "" : "pointer-events-none opacity-50"}>
                <span className="rounded-full border border-border bg-card px-4 py-2 text-sm">上一页</span>
              </Link>
              <span className="text-sm text-muted-foreground">第 {pointLogs.page} 页</span>
              <Link href={`/settings?tab=points&page=${pointLogs.page + 1}`} className={pointLogs.hasNextPage ? "" : "pointer-events-none opacity-50"}>
                <span className="rounded-full border border-border bg-card px-4 py-2 text-sm">下一页</span>
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ title, value, hint, icon }: { title: string; value: number; hint: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent text-foreground">{icon}</div>
        </div>
        <p className="mt-4 text-3xl font-semibold">{value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

function ProgressItem({ title, current, required, remaining, completed }: { title: string; current: number; required: number; remaining: number; completed: boolean }) {
  const progress = required <= 0 ? 100 : Math.min(100, Math.round((current / required) * 100))

  return (
    <div className="rounded-[24px] border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{title}</p>
        <span className={completed ? "rounded-full bg-emerald-100 px-3 py-1 text-[11px] text-emerald-700" : "rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground"}>
          {completed ? "已满足" : `还差 ${remaining}`}
        </span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">当前 {current} / 目标 {required}</p>
      <div className="mt-3 h-2 rounded-full bg-secondary/70">
        <div className="h-2 rounded-full bg-foreground transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-[22px] border border-border p-4 transition-colors hover:bg-accent/40">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{title}</p>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </Link>
  )
}
