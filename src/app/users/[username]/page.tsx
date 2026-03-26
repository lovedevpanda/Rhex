import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ForumPostStream } from "@/components/forum-post-stream"
import { LevelBadge } from "@/components/level-badge"
import { LevelIcon } from "@/components/level-icon"
import { ReportDialog } from "@/components/report-dialog"
import { SiteHeader } from "@/components/site-header"
import { UserAvatar } from "@/components/user-avatar"
import { UserStatusBadge } from "@/components/user-status-badge"
import { VipBadge } from "@/components/vip-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { getGrantedBadgesForUser } from "@/lib/badges"
import { getSiteSettings } from "@/lib/site-settings"
import { cn } from "@/lib/utils"
import { getUserProfile, getUserPosts } from "@/lib/users"
import { getVipLevel, isVipActive } from "@/lib/vip-status"

interface UserPageProps {
  params: {
    username: string
  }
}

export async function generateMetadata({ params }: UserPageProps): Promise<Metadata> {
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

export default async function UserPage({ params }: UserPageProps) {
  const [user, settings, currentUser] = await Promise.all([getUserProfile(params.username), getSiteSettings(), getCurrentUser()])

  if (!user) {
    notFound()
  }

  const posts = await getUserPosts(params.username)
  const badgeItems = await getGrantedBadgesForUser(user.id)

  const vipActive = isVipActive(user)
  const vipLevel = getVipLevel(user)
  const canSendMessage = currentUser && currentUser.username !== user.username
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
    user.status === "BANNED" ? { label: "账号封禁中", tone: "danger" as const } : null,
    user.status === "MUTED" ? { label: "账号禁言中", tone: "warning" as const } : null,
    vipActive ? { label: `VIP${vipLevel}`, tone: "vip" as const } : null,
    user.levelName ? { label: user.levelName, tone: "level" as const } : null,
    user.inviterUsername ? { label: `邀请人 @${user.inviterUsername}`, tone: "plain" as const } : null,
    user.inviteCount > 0 ? { label: "邀请达人", tone: "orange" as const } : null,
    user.likeReceivedCount >= 50 ? { label: "高赞用户", tone: "level" as const } : null,
    user.postCount >= 10 ? { label: "活跃创作者", tone: "sky" as const } : null,
  ].filter(Boolean) as Array<{ label: string; tone: "plain" | "vip" | "level" | "orange" | "sky" | "danger" | "warning" }>

  return (
    <div className="min-h-screen  text-foreground dark:bg-[#0f1115]">
      <SiteHeader />
      <main className={cn("mx-auto max-w-[1200px] px-4 py-6 lg:px-6", isRestrictedUser && "grayscale") }>
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <Card className="relative rounded-2xl border border-[#e8e8e8]  shadow-sm">
              <CardContent className="p-5">
                <div className="flex flex-col items-center text-center">
                  {isRestrictedUser ? <UserStatusBadge status={user.status} compact className="absolute right-4 top-4 shadow-sm" /> : null}
                  <UserAvatar name={user.displayName} avatarPath={user.avatarPath} size="lg" />
                  <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">{user.displayName}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">@{user.username}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    {vipActive ? <VipBadge level={vipLevel} compact /> : null}
                    {user.levelName && user.levelColor && user.levelIcon ? <LevelBadge level={user.level} name={user.levelName} color={user.levelColor} icon={user.levelIcon} compact /> : null}
                    {isRestrictedUser ? <UserStatusBadge status={user.status} /> : null}
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

            <Card className="rounded-2xl border border-[#e8e8e8]  shadow-sm">
              <CardContent className="p-4">
                <h2 className="text-sm font-semibold text-foreground">勋章</h2>
                {badgeItems.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-dashed border-[#e8e8e8] px-3 py-6 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.02]">
                    暂无可展示勋章
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {badgeItems.map((badge: (typeof badgeItems)[number]) => (
                      <div key={badge.id} className="rounded-xl p-2 text-center dark:bg-white/[0.02]">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-lg" style={{ backgroundColor: `${badge.color}18`, color: badge.color }}>
                          <LevelIcon icon={badge.iconText} color={badge.color} className="h-5 w-5 text-[18px]" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
                        </div>
                        <p className="mt-2 line-clamp-1 text-xs font-medium" style={{ color: badge.color }}>{badge.name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-[#e8e8e8]  shadow-sm">
              <CardContent className="p-4">
                <h2 className="text-sm font-semibold text-foreground">身份标签</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {identityTags.map((tag) => (
                    <span
                      key={tag.label}
                      className={tag.tone === "vip" ? "rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 dark:bg-violet-400/15 dark:text-violet-200" : tag.tone === "level" ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200" : tag.tone === "orange" ? "rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700 dark:bg-orange-400/15 dark:text-orange-200" : tag.tone === "sky" ? "rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700 dark:bg-sky-400/15 dark:text-sky-200" : tag.tone === "danger" ? "rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-500/15 dark:text-red-200" : tag.tone === "warning" ? "rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-200" : "rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground dark:bg-white/[0.06] dark:text-slate-300"}
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </aside>

          <section className="space-y-4">
            <Card className="rounded-2xl border border-[#e8e8e8]  shadow-sm">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Overview</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-semibold text-foreground">{user.displayName} 的主页</h2>
                      {restrictionLabel ? <UserStatusBadge status={user.status} /> : null}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{restrictionDescription ?? "查看这位成员的公开内容、社区贡献与活跃概况。"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {statItems.map((item) => (
                      <div key={item.label} className="min-w-[88px] rounded-xl  px-4 py-3 text-center dark:bg-white/[0.04]">
                        <p className="text-lg font-semibold text-foreground">{item.value}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-[#e8e8e8]  shadow-sm">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efefef] pb-4 dark:border-white/10">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">最近动态</h2>
                    <p className="mt-1 text-sm text-muted-foreground">最近公开发布的帖子与参与内容。</p>
                  </div>
                  <span className="rounded-full bg-[#f5f5f5] px-3 py-1 text-xs font-medium text-muted-foreground">共 {posts.length} 条内容</span>
                </div>

                <div className="mt-2">
                  {posts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#e8e8e8] px-4 py-12 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.02]">
                      这个用户还没有公开内容。
                    </div>
                  ) : (
                    <ForumPostStream posts={posts} />
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  )
}
