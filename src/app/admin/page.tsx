import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { AlertTriangle, Ban, Bookmark, CheckCircle2, Eye, FileText, Heart, Info, LayoutGrid, Megaphone, MessageSquare, Settings2, Shield, TrendingUp, Users } from "lucide-react"

import { cn } from "@/lib/utils"

import { AdminAnnouncementManager } from "@/components/admin-announcement-manager"
import { AdminAppsSettingsForm } from "@/components/admin-apps-settings-form"
import { AdminInviteCodeManager } from "@/components/admin-invite-code-manager"
import { AdminModuleSearch } from "@/components/admin-module-search"
import { AdminFooterLinksSettingsForm } from "@/components/admin-footer-links-settings-form"
import { AdminFriendLinksSettingsForm } from "@/components/admin-friend-links-settings-form"
import { AdminBadgeManager } from "@/components/admin-badge-manager"
import { AdminBasicSettingsForm } from "@/components/admin-basic-settings-form"
import { AdminVerificationManager } from "@/components/admin-verification-manager"
import { AdminLevelSettingsForm } from "@/components/admin-level-settings-form"
import { AdminLogCenter } from "@/components/admin-log-center"
import { AdminMarkdownEmojiSettingsForm } from "@/components/admin-markdown-emoji-settings-form"
import { AdminPostList } from "@/components/admin-post-list"
import { AdminRedeemCodeManager } from "@/components/admin-redeem-code-manager"
import { AdminReportCenter } from "@/components/admin-report-center"
import { AdminSensitiveWordManager } from "@/components/admin-sensitive-word-manager"
import { AdminSettingsTabs } from "@/components/admin-settings-tabs"
import { AdminUploadSettingsForm } from "@/components/admin-upload-settings-form"
import { StructureManager } from "@/components/admin-structure-forms"
import { AdminShell, adminNavigation } from "@/components/admin-shell"
import { AdminUserList } from "@/components/admin-user-list"
import { AdminVipSettingsForm } from "@/components/admin-vip-settings-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAdminDashboardData, getAdminPosts, getAdminStructureData } from "@/lib/admin"
import { getAdminAnnouncementList } from "@/lib/admin-announcements"
import { getVerificationAdminData } from "@/lib/admin-verification-service"
import { isLocalPostType } from "@/lib/post-types"

import { getAdminLogCenter } from "@/lib/admin-logs"
import { getAdminUsers } from "@/lib/admin-users"
import { getAllBadges, type BadgeEffectRuleItem, type BadgeItem, type BadgeRuleItem } from "@/lib/badges"
import { formatMonthDayTime } from "@/lib/formatters"
import { getInviteCodeList } from "@/lib/invite-codes"
import { getLevelDefinitions } from "@/lib/level-system"
import { minuteOfDayToTimeInput } from "@/lib/point-effect-definitions"
import { getRedeemCodeList } from "@/lib/redeem-codes"
import { getAdminReports } from "@/lib/reports"
import { getAdminFriendLinkPageData } from "@/lib/friend-links"
import { readSearchParam } from "@/lib/search-params"
import { getSensitiveWordPage, getServerSiteSettings } from "@/lib/site-settings"
import { requireAdminActor } from "@/lib/moderator-permissions"

type AdminTabKey = "overview" | "users" | "posts" | "structure" | "levels" | "badges" | "verifications" | "announcements" | "reports" | "logs" | "security" | "settings"
type AdminSettingsSectionKey = "profile" | "markdown-emoji" | "footer-links" | "apps" | "registration" | "interaction" | "friend-links" | "invite-codes" | "redeem-codes" | "vip" | "upload"

const adminTabs: AdminTabKey[] = ["overview", "users", "posts", "structure", "levels", "badges", "verifications", "announcements", "reports", "logs", "security", "settings"]
const adminSettingsSections: AdminSettingsSectionKey[] = ["profile", "markdown-emoji", "footer-links", "apps", "registration", "interaction", "friend-links", "invite-codes", "redeem-codes", "vip", "upload"]
const sectionsRequiringSiteSettings = new Set<AdminSettingsSectionKey>(["profile", "markdown-emoji", "footer-links", "apps", "registration", "interaction", "vip", "upload"])

const tabLabels: Record<AdminTabKey, string> = {
  overview: "总览",
  users: "用户管理",
  posts: "帖子管理",
  structure: "版块管理",
  levels: "等级系统",
  badges: "勋章系统",
  verifications: "认证系统",
  announcements: "站点文档",
  reports: "举报中心",
  logs: "日志中心",
  security: "内容安全",
  settings: "站点设置",
}

function getAllowedAdminTabs(role: "ADMIN" | "MODERATOR") {
  return role === "ADMIN"
    ? adminTabs
    : (["posts", "structure"] satisfies AdminTabKey[])
}

export async function generateMetadata(props: PageProps<"/admin">): Promise<Metadata> {
  const searchParams = await props.searchParams
  const currentTabValue = readSearchParam(searchParams?.tab)
  const currentTab: AdminTabKey = adminTabs.includes((currentTabValue as AdminTabKey) ?? "overview")
    ? ((currentTabValue as AdminTabKey) ?? "overview")
    : "overview"
  const settings = await getServerSiteSettings()

  return {
    title: `${tabLabels[currentTab]} - ${settings.siteName}`,
  }
}

export default async function AdminPage(props: PageProps<"/admin">) {
  const searchParams = await props.searchParams;
  const admin = await requireAdminActor()

  if (!admin) {
    redirect("/login?redirect=/admin")
  }

  const allowedTabs = getAllowedAdminTabs(admin.role)
  const currentTabValue = readSearchParam(searchParams?.tab)
  const requestedTab: AdminTabKey = adminTabs.includes((currentTabValue as AdminTabKey) ?? "overview")
    ? ((currentTabValue as AdminTabKey) ?? "overview")
    : "overview"
  const tab = allowedTabs.includes(requestedTab) ? requestedTab : allowedTabs[0]

  if (tab !== requestedTab) {
    redirect(`/admin?tab=${tab}`)
  }
  const currentSettingsSectionValue = readSearchParam(searchParams?.section)
  const currentSettingsSection: AdminSettingsSectionKey = adminSettingsSections.includes((currentSettingsSectionValue as AdminSettingsSectionKey) ?? "profile")
    ? ((currentSettingsSectionValue as AdminSettingsSectionKey) ?? "profile")
    : "profile"
  const currentSettingsSubTab = readSearchParam(searchParams?.subTab) ?? ""
  const currentPostTypeValue = readSearchParam(searchParams?.type)
  const currentPostType = isLocalPostType(currentPostTypeValue) ? currentPostTypeValue : "ALL"
  const currentPostStatusValue = readSearchParam(searchParams?.status)
  const currentPostStatus = currentPostStatusValue === "PENDING" || currentPostStatusValue === "NORMAL" || currentPostStatusValue === "OFFLINE" ? currentPostStatusValue : "ALL"
  const currentBoardSlug = readSearchParam(searchParams?.board) ?? ""
  const currentKeyword = readSearchParam(searchParams?.keyword) ?? ""
  const currentPostSort = readSearchParam(searchParams?.sort) ?? "newest"
  const currentPostPin = readSearchParam(searchParams?.pin) ?? "ALL"
  const currentPostFeatured = readSearchParam(searchParams?.featured) ?? "ALL"
  const currentPostReview = readSearchParam(searchParams?.review) ?? "ALL"
  const currentPostPage = readSearchParam(searchParams?.postPage) ?? "1"
  const currentPostPageSize = readSearchParam(searchParams?.postPageSize) ?? "20"
  const currentReportPage = readSearchParam(searchParams?.reportPage) ?? "1"
  const currentReportPageSize = readSearchParam(searchParams?.reportPageSize) ?? "20"
  const currentSecurityPage = readSearchParam(searchParams?.securityPage) ?? "1"
  const currentSecurityPageSize = readSearchParam(searchParams?.securityPageSize) ?? "20"
  const currentStructureKeyword = readSearchParam(searchParams?.structureKeyword) ?? ""
  const currentStructureZoneId = readSearchParam(searchParams?.structureZoneId) ?? ""
  const currentStructureBoardStatus = readSearchParam(searchParams?.structureBoardStatus) ?? "ALL"
  const currentStructurePosting = readSearchParam(searchParams?.structurePosting) ?? "ALL"
  const currentUserKeyword = readSearchParam(searchParams?.userKeyword) ?? ""
  const currentUserRole = readSearchParam(searchParams?.userRole) ?? "ALL"
  const currentUserStatus = readSearchParam(searchParams?.userStatus) ?? "ALL"
  const currentUserVip = readSearchParam(searchParams?.userVip) ?? "ALL"
  const currentUserActivity = readSearchParam(searchParams?.userActivity) ?? "ALL"
  const currentUserSort = readSearchParam(searchParams?.userSort) ?? "newest"
  const currentUserPage = readSearchParam(searchParams?.userPage) ?? "1"
  const currentUserPageSize = readSearchParam(searchParams?.userPageSize) ?? "20"
  const currentLogSubTab = readSearchParam(searchParams?.logSubTab) ?? "admin"
  const currentLogKeyword = readSearchParam(searchParams?.logKeyword) ?? ""
  const currentLogAction = readSearchParam(searchParams?.logAction) ?? "ALL"
  const currentLogChangeType = readSearchParam(searchParams?.logChangeType) ?? "ALL"
  const currentLogBucketType = readSearchParam(searchParams?.logBucketType) ?? "ALL"
  const currentLogPage = readSearchParam(searchParams?.logPage) ?? "1"
  const currentLogPageSize = readSearchParam(searchParams?.logPageSize) ?? "20"
  const navigationItems = adminNavigation.filter((item) => {
    if (admin.role === "ADMIN") {
      return true
    }

    return item.href === "/admin?tab=posts" || item.href === "/admin?tab=structure"
  })

  const [dashboardData, structureData, siteSettings, adminUsers, filteredPosts, levelDefinitions, badges, announcements, inviteCodes, redeemCodes, reports, sensitiveWordResult, logCenter, friendLinks, verificationAdminData] = await Promise.all([
    admin.role === "ADMIN" && tab === "overview"
      ? getAdminDashboardData()
      : Promise.resolve<Awaited<ReturnType<typeof getAdminDashboardData>> | null>(null),
    tab === "structure"
      ? getAdminStructureData()
      : Promise.resolve<Awaited<ReturnType<typeof getAdminStructureData>> | null>(null),
    admin.role === "ADMIN" && tab === "settings" && sectionsRequiringSiteSettings.has(currentSettingsSection)
      ? getServerSiteSettings()
      : Promise.resolve<Awaited<ReturnType<typeof getServerSiteSettings>> | null>(null),
    admin.role === "ADMIN" && tab === "users"
      ? getAdminUsers({
        keyword: currentUserKeyword || undefined,
        role: currentUserRole,
        status: currentUserStatus,
        vip: currentUserVip,
        activity: currentUserActivity,
        sort: currentUserSort,
        page: Number(currentUserPage),
        pageSize: Number(currentUserPageSize),
      })
      : Promise.resolve<Awaited<ReturnType<typeof getAdminUsers>> | null>(null),
    tab === "posts"
      ? getAdminPosts({
        type: currentPostType,
        status: currentPostStatus,
        boardSlug: currentBoardSlug || undefined,
        keyword: currentKeyword || undefined,
        sort: currentPostSort,
        pin: currentPostPin,
        featured: currentPostFeatured,
        review: currentPostReview,
        page: Number(currentPostPage),
        pageSize: Number(currentPostPageSize),
      })
      : Promise.resolve<Awaited<ReturnType<typeof getAdminPosts>> | null>(null),
    admin.role === "ADMIN" && tab === "levels" ? getLevelDefinitions() : Promise.resolve<Awaited<ReturnType<typeof getLevelDefinitions>>>([]),
    admin.role === "ADMIN" && tab === "badges" ? getAllBadges() : Promise.resolve<Awaited<ReturnType<typeof getAllBadges>>>([]),
    admin.role === "ADMIN" && tab === "announcements" ? getAdminAnnouncementList() : Promise.resolve<Awaited<ReturnType<typeof getAdminAnnouncementList>>>([]),
    admin.role === "ADMIN" && tab === "settings" && currentSettingsSection === "invite-codes"
      ? getInviteCodeList()
      : Promise.resolve<Awaited<ReturnType<typeof getInviteCodeList>>>([]),
    admin.role === "ADMIN" && tab === "settings" && currentSettingsSection === "redeem-codes"
      ? getRedeemCodeList()
      : Promise.resolve<Awaited<ReturnType<typeof getRedeemCodeList>>>([]),
    admin.role === "ADMIN" && tab === "reports"
      ? getAdminReports({ page: Number(currentReportPage), pageSize: Number(currentReportPageSize) })
      : Promise.resolve<Awaited<ReturnType<typeof getAdminReports>> | null>(null),
    admin.role === "ADMIN" && tab === "security"
      ? getSensitiveWordPage({ page: Number(currentSecurityPage), pageSize: Number(currentSecurityPageSize) })
      : Promise.resolve<Awaited<ReturnType<typeof getSensitiveWordPage>> | null>(null),
    admin.role === "ADMIN" && tab === "logs"
      ? getAdminLogCenter({
        activeTab: currentLogSubTab,
        keyword: currentLogKeyword,
        action: currentLogAction,
        changeType: currentLogChangeType,
        bucketType: currentLogBucketType,
        page: Number(currentLogPage),
        pageSize: Number(currentLogPageSize),
      })
      : Promise.resolve<Awaited<ReturnType<typeof getAdminLogCenter>> | null>(null),
    admin.role === "ADMIN" && tab === "settings" && currentSettingsSection === "friend-links"
      ? getAdminFriendLinkPageData()
      : Promise.resolve<Awaited<ReturnType<typeof getAdminFriendLinkPageData>> | null>(null),
    admin.role === "ADMIN" && tab === "verifications"
      ? getVerificationAdminData()
      : Promise.resolve<Awaited<ReturnType<typeof getVerificationAdminData>> | null>(null),
  ])

  return (
    <AdminShell currentTab={tab} adminName={admin.nickname ?? admin.username} navigationItems={navigationItems}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-[24px] border border-border bg-card px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-foreground">
              <Settings2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">当前模块</p>
              <h2 className="text-lg font-semibold">{tabLabels[tab]}</h2>
            </div>
          </div>
          <AdminModuleSearch className="md:ml-auto" />
        </div>

        {tab === "overview" ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
              <CompactStatCard title="注册用户" value={dashboardData!.overview.userCount} icon={<Users className="h-4 w-4" />} hint={`近 7 天 +${formatNumber(dashboardData!.overview.newUserCount7d)}`} />
              <CompactStatCard title="帖子总数" value={dashboardData!.overview.postCount} icon={<FileText className="h-4 w-4" />} hint={`近 7 天 +${formatNumber(dashboardData!.overview.newPostCount7d)}`} tone="emerald" />
              <CompactStatCard title="评论总数" value={dashboardData!.overview.commentCount} icon={<MessageSquare className="h-4 w-4" />} hint={`近 7 天 +${formatNumber(dashboardData!.overview.newCommentCount7d)}`} tone="violet" />
              <CompactStatCard title="活跃用户" value={dashboardData!.overview.activeUserCount7d} icon={<TrendingUp className="h-4 w-4" />} hint="近 7 天登录/发帖/评论活跃" tone="sky" />
              <CompactStatCard title="待处理举报" value={dashboardData!.overview.pendingReportCount} icon={<AlertTriangle className="h-4 w-4" />} hint={`累计 ${formatNumber(dashboardData!.overview.reportCount)} 条`} tone="rose" />
              <CompactStatCard title="待审核帖子" value={dashboardData!.overview.pendingPostCount} icon={<FileText className="h-4 w-4" />} hint={`已下线 ${formatNumber(dashboardData!.overview.offlinePostCount)} 篇`} tone="amber" />
              <CompactStatCard title="节点数量" value={dashboardData!.overview.boardCount} icon={<LayoutGrid className="h-4 w-4" />} hint={`分区 ${formatNumber(dashboardData!.overview.zoneCount)} 个`} />
              <CompactStatCard title="风控用户" value={dashboardData!.overview.mutedUserCount + dashboardData!.overview.bannedUserCount} icon={<Ban className="h-4 w-4" />} hint={`禁言 ${formatNumber(dashboardData!.overview.mutedUserCount)} / 封禁 ${formatNumber(dashboardData!.overview.bannedUserCount)}`} tone="slate" />
            </section>

            <section className="grid gap-3 xl:grid-cols-4">
              <OverviewMetricPanel
                title="内容脉冲"
                description="看新增和产出节奏"
                items={[
                  { label: "今日发帖", value: dashboardData!.overview.todayPostCount, hint: `近 7 天 +${formatNumber(dashboardData!.overview.newPostCount7d)}` },
                  { label: "今日评论", value: dashboardData!.overview.todayCommentCount, hint: `近 7 天 +${formatNumber(dashboardData!.overview.newCommentCount7d)}` },
                  { label: "今日签到", value: dashboardData!.overview.todayCheckInUserCount, hint: "按业务日统计" },
                ]}
              />
              <OverviewMetricPanel
                title="互动规模"
                description="看社区热度和沉淀"
                items={[
                  { label: "总浏览量", value: dashboardData!.overview.totalViewCount, icon: <Eye className="h-3.5 w-3.5" /> },
                  { label: "总点赞量", value: dashboardData!.overview.totalLikeCount, icon: <Heart className="h-3.5 w-3.5" /> },
                  { label: "总收藏量", value: dashboardData!.overview.totalFavoriteCount, icon: <Bookmark className="h-3.5 w-3.5" /> },
                  { label: "节点关注量", value: dashboardData!.overview.totalFollowerCount, icon: <Users className="h-3.5 w-3.5" /> },
                ]}
              />
              <OverviewMetricPanel
                title="风险处置"
                description="看举报流转和内容状态"
                items={[
                  { label: "待处理", value: dashboardData!.overview.pendingReportCount, tone: "rose" },
                  { label: "处理中", value: dashboardData!.overview.processingReportCount, tone: "amber" },
                  { label: "已解决", value: dashboardData!.overview.resolvedReportCount, tone: "emerald" },
                  { label: "下线帖子", value: dashboardData!.overview.offlinePostCount, tone: "slate" },
                ]}
              />
              <OverviewMetricPanel
                title="用户状态"
                description="看可运营用户质量"
                items={[
                  { label: "活跃用户", value: dashboardData!.overview.activeUserCount7d, hint: "近 7 天活跃" },
                  { label: "禁言用户", value: dashboardData!.overview.mutedUserCount, tone: "amber" },
                  { label: "封禁用户", value: dashboardData!.overview.bannedUserCount, tone: "rose" },
                  { label: "今日举报", value: dashboardData!.overview.todayReportCount, tone: "slate" },
                ]}
              />
            </section>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>近 7 天增长趋势</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pb-4">
                  <TrendLegend />
                  <DashboardTrendChart data={dashboardData!.trends} />
                  <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                    <TrendSummaryItem label="新增用户峰值" value={getTrendPeak(dashboardData!.trends, "userCount")} colorClassName="bg-sky-500" />
                    <TrendSummaryItem label="新增帖子峰值" value={getTrendPeak(dashboardData!.trends, "postCount")} colorClassName="bg-emerald-500" />
                    <TrendSummaryItem label="新增评论峰值" value={getTrendPeak(dashboardData!.trends, "commentCount")} colorClassName="bg-violet-500" />
                    <MetricHighlightCard title="今日签到人数" value={dashboardData!.overview.todayCheckInUserCount} description="按业务日统计的签到独立用户" compact />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">运营待办</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 pt-0 sm:grid-cols-2">
                  <PendingReviewCard href="/admin?tab=verifications" title="待认证审核" value={dashboardData!.overview.pendingVerificationCount} description="处理用户身份与资质认证申请" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
                  <PendingReviewCard href="/admin?tab=settings&section=friend-links" title="友情链接审核" value={dashboardData!.overview.pendingFriendLinkCount} description="审核站点互链申请与展示资料" icon={<Shield className="h-3.5 w-3.5" />} />
                  <PendingReviewCard href="/admin/apps/self-serve-ads" title="广告审核" value={dashboardData!.overview.pendingAdOrderCount} description="审核自助推广广告位申请内容" icon={<Megaphone className="h-3.5 w-3.5" />} />
                  <PendingReviewCard href="/admin?tab=reports" title="举报待处理" value={dashboardData!.overview.pendingReportCount} description="社区风险内容与违规行为处置" icon={<AlertTriangle className="h-3.5 w-3.5" />} />
                  <PendingReviewCard href="/admin?tab=posts&status=PENDING" title="待审核帖子" value={dashboardData!.overview.pendingPostCount} description="人工复核待发布内容" icon={<FileText className="h-3.5 w-3.5" />} />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>最近帖子</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {dashboardData!.recentPosts.map((post) => (
                    <div key={post.id} className="border-b border-border/70 py-3 last:border-b-0 last:pb-0 first:pt-0">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{post.boardName}</span>
                        <span>·</span>
                        <span>{post.authorName}</span>
                        <span>·</span>
                        <span>{post.createdAt ? formatMonthDayTime(post.createdAt) : "-"}</span>
                      </div>
                      <h3 className="mt-1.5 line-clamp-1 text-sm font-semibold">{post.title}</h3>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className={getPostStatusBadgeClassName(post.status)}>{post.statusLabel}</span>
                        <span className="rounded-full bg-accent px-2 py-0.5">{post.typeLabel}</span>
                        <span className="text-muted-foreground">评论 {formatNumber(post.commentCount)}</span>
                        <span className="text-muted-foreground">点赞 {formatNumber(post.likeCount)}</span>
                        {post.isPinned ? <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200">置顶</span> : null}
                        {post.isFeatured ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">推荐</span> : null}
                      </div>
                      {post.reviewNote ? <p className="mt-1.5 line-clamp-1 text-[11px] text-muted-foreground">审核备注：{post.reviewNote}</p> : null}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>最近评论</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {dashboardData!.recentComments.map((comment) => (
                    <div key={comment.id} className="border-b border-border/70 py-3 last:border-b-0 last:pb-0 first:pt-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className="line-clamp-1 text-sm font-medium">{comment.postTitle}</p>
                        <span className={getCommentStatusBadgeClassName(comment.status)}>{comment.status}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>评论人：{comment.authorName}</span>
                        <span>·</span>
                        <span>{comment.createdAt ? formatMonthDayTime(comment.createdAt) : "-"}</span>
                        <span>·</span>
                        <span>/posts/{comment.postSlug}</span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[13px] text-foreground/80">{comment.content || "无评论内容"}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}

        {admin.role === "ADMIN" && tab === "settings" ? <AdminSettingsTabs currentSection={currentSettingsSection} /> : null}

        {tab === "users" ? <AdminUserList data={adminUsers!} /> : null}
        {tab === "posts" ? <AdminPostList data={filteredPosts!} /> : null}
        {tab === "structure" ? <StructureManager zones={structureData!.zones} boards={structureData!.boardStatus} permissions={structureData!.permissions} initialFilters={{ keyword: currentStructureKeyword, zoneId: currentStructureZoneId, boardStatus: currentStructureBoardStatus, posting: currentStructurePosting }} /> : null}
        {tab === "levels" ? <AdminLevelSettingsForm initialLevels={levelDefinitions} /> : null}
        {tab === "badges" ? <AdminBadgeManager initialBadges={badges.map((badge: BadgeItem) => ({
          id: badge.id,
          name: badge.name,
          code: badge.code,
          description: badge.description ?? "",
          iconText: badge.iconText ?? "🏅",
          color: badge.color,
          imageUrl: badge.imageUrl ?? "",
          category: badge.category ?? "社区成就",
          sortOrder: badge.sortOrder,
          pointsCost: badge.pointsCost,
          status: badge.status,
          isHidden: badge.isHidden,
          grantedUserCount: badge.grantedUserCount ?? 0,
          rules: badge.rules.map((rule: BadgeRuleItem) => ({
            id: rule.id,
            ruleType: rule.ruleType,
            operator: rule.operator,
            value: rule.value,
            extraValue: rule.extraValue ?? "",
            sortOrder: rule.sortOrder,
          })),
          effects: badge.effects.map((effect: BadgeEffectRuleItem) => ({
            id: effect.id,
            name: effect.name,
            description: effect.description ?? "",
            targetType: effect.targetType,
            scopeKeys: effect.scopeKeys,
            ruleKind: effect.ruleKind,
            direction: effect.direction,
            value: String(effect.value),
            extraValue: effect.extraValue === null || effect.extraValue === undefined ? "" : String(effect.extraValue),
            startMinuteOfDay: minuteOfDayToTimeInput(effect.startMinuteOfDay),
            endMinuteOfDay: minuteOfDayToTimeInput(effect.endMinuteOfDay),
            sortOrder: effect.sortOrder,
            status: effect.status,
          })),
        }))} /> : null}
        {tab === "verifications" ? <AdminVerificationManager initialTypes={verificationAdminData!.types} initialApplications={verificationAdminData!.applications.map((item) => ({
          ...item,
          type: {
            ...item.type,
            iconText: item.type.iconText ?? "✔️",
          },
        }))} /> : null}
        {tab === "announcements" ? <AdminAnnouncementManager initialItems={announcements} /> : null}
        {tab === "settings" && currentSettingsSection === "profile" ? <AdminBasicSettingsForm initialSettings={siteSettings!} mode="profile" initialSubTab={currentSettingsSubTab} /> : null}
        {tab === "settings" && currentSettingsSection === "markdown-emoji" ? <AdminMarkdownEmojiSettingsForm initialItems={siteSettings!.markdownEmojiMap} /> : null}
        {tab === "settings" && currentSettingsSection === "footer-links" ? <AdminFooterLinksSettingsForm initialLinks={siteSettings!.footerLinks} /> : null}
        {tab === "settings" && currentSettingsSection === "apps" ? <AdminAppsSettingsForm initialLinks={siteSettings!.headerAppLinks} initialIconName={siteSettings!.headerAppIconName} /> : null}
        {tab === "settings" && currentSettingsSection === "registration" ? <AdminBasicSettingsForm initialSettings={siteSettings!} mode="registration" initialSubTab={currentSettingsSubTab} /> : null}
        {tab === "settings" && currentSettingsSection === "interaction" ? <AdminBasicSettingsForm initialSettings={siteSettings!} mode="interaction" initialSubTab={currentSettingsSubTab} /> : null}
        {tab === "settings" && currentSettingsSection === "friend-links" ? <AdminFriendLinksSettingsForm initialSettings={friendLinks!.settings} items={friendLinks!.items} pendingCount={friendLinks!.pendingCount} /> : null}
        {tab === "settings" && currentSettingsSection === "invite-codes" ? <AdminInviteCodeManager initialInviteCodes={inviteCodes} /> : null}
        {tab === "settings" && currentSettingsSection === "redeem-codes" ? <AdminRedeemCodeManager initialRedeemCodes={redeemCodes} /> : null}
        {tab === "settings" && currentSettingsSection === "vip" ? <AdminVipSettingsForm initialSettings={siteSettings!} /> : null}
        {tab === "settings" && currentSettingsSection === "upload" ? <AdminUploadSettingsForm initialSettings={siteSettings!} /> : null}

        {tab === "reports" ? <AdminReportCenter data={reports!} /> : null}
        {tab === "logs" ? <AdminLogCenter data={logCenter!} /> : null}
        {tab === "security" ? <AdminSensitiveWordManager data={sensitiveWordResult!} /> : null}
      </div>
    </AdminShell>
  )
}

function CompactStatCard({
  title,
  value,
  icon,
  hint,
  tone = "default",
}: {
  title: string
  value: number
  icon: React.ReactNode
  hint: string
  tone?: "default" | "sky" | "emerald" | "violet" | "rose" | "amber" | "slate"
}) {
  const toneClassName = {
    default: "bg-accent text-foreground",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200",
  }[tone]

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[12px] text-muted-foreground">{title}</p>
          <p className="mt-1.5 text-2xl font-semibold leading-none">{formatNumber(value)}</p>
          <p className="mt-2 line-clamp-1 text-[11px] text-muted-foreground">{hint}</p>
        </div>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", toneClassName)}>{icon}</div>
      </CardContent>
    </Card>
  )
}

function OverviewMetricPanel({
  title,
  description,
  items,
}: {
  title: string
  description: string
  items: Array<{
    label: string
    value: number
    hint?: string
    icon?: React.ReactNode
    tone?: "default" | "rose" | "amber" | "emerald" | "slate"
  }>
}) {
  return (
    <Card>
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="grid gap-2 pt-0">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 rounded-[16px] border border-border/70 bg-accent/20 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[12px] font-medium">{item.label}</p>
              {item.hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{item.hint}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {item.icon ? <span className="text-muted-foreground">{item.icon}</span> : null}
              <span className={getOverviewMetricValueClassName(item.tone)}>{formatNumber(item.value)}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function PendingReviewCard({ href, title, value, description, icon }: { href: string; title: string; value: number; description: string; icon: React.ReactNode }) {
  return (
    <Link href={href} title={description} className="rounded-[16px] border border-border px-3 py-2.5 transition-colors hover:bg-accent/70">
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-[13px] font-medium leading-5">{title}</p>
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/80" aria-label={description}>
              <Info className="h-3 w-3" />
            </span>
          </div>
          <p className="mt-1.5 text-2xl font-semibold leading-none">{formatNumber(value)}</p>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-foreground">{icon}</div>
      </div>
    </Link>
  )
}

function MetricHighlightCard({ title, value, description, compact = false }: { title: string; value: number; description: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-[20px] border border-dashed border-border bg-accent/40", compact ? "px-3.5 py-3.5" : "px-4 py-4")}>
      <p className="text-sm font-medium">{title}</p>
      <p className={cn("mt-2 font-semibold", compact ? "text-2xl" : "text-3xl")}>{formatNumber(value)}</p>
      <p className={cn("text-xs leading-6 text-muted-foreground", compact ? "mt-2" : "mt-3")}>{description}</p>
    </div>
  )
}

function TrendLegend() {
  const items = [
    { label: "用户", colorClassName: "bg-sky-500" },
    { label: "帖子", colorClassName: "bg-emerald-500" },
    { label: "评论", colorClassName: "bg-violet-500" },
    { label: "举报", colorClassName: "bg-rose-500" },
  ]

  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", item.colorClassName)} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

function TrendSummaryItem({ label, value, colorClassName }: { label: string; value: { count: number; dateLabel: string }; colorClassName: string }) {
  return (
    <div className="rounded-[18px] border border-border px-3.5 py-3.5">
      <div className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full", colorClassName)} />
        <p className="text-sm font-medium">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold">{formatNumber(value.count)}</p>
      <p className="mt-1 text-xs text-muted-foreground">峰值日期：{value.dateLabel}</p>
    </div>
  )
}

function DashboardTrendChart({ data }: { data: Array<{ date: string; userCount: number; postCount: number; commentCount: number; reportCount: number }> }) {
  const width = 720
  const height = 220
  const paddingX = 28
  const paddingTop = 16
  const paddingBottom = 24
  const maxValue = Math.max(1, ...data.flatMap((item) => [item.userCount, item.postCount, item.commentCount, item.reportCount]))
  const labels = data.map((item) => formatChartDate(item.date))
  const drawableHeight = height - paddingTop - paddingBottom

  const createPath = (values: number[]) => values.map((value, index) => {
    const x = paddingX + (index * (width - paddingX * 2)) / Math.max(values.length - 1, 1)
    const y = height - paddingBottom - (value / maxValue) * drawableHeight
    return `${index === 0 ? "M" : "L"}${x},${y}`
  }).join(" ")

  const series = [
    { key: "userCount", color: "#0ea5e9", path: createPath(data.map((item) => item.userCount)) },
    { key: "postCount", color: "#10b981", path: createPath(data.map((item) => item.postCount)) },
    { key: "commentCount", color: "#8b5cf6", path: createPath(data.map((item) => item.commentCount)) },
    { key: "reportCount", color: "#f43f5e", path: createPath(data.map((item) => item.reportCount)) },
  ]

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = height - paddingBottom - ratio * drawableHeight
            return <line key={ratio} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="currentColor" strokeOpacity="0.08" />
          })}
          {labels.map((label, index) => {
            const x = paddingX + (index * (width - paddingX * 2)) / Math.max(labels.length - 1, 1)
            return (
              <g key={label}>
                <line x1={x} y1={paddingTop} x2={x} y2={height - paddingBottom} stroke="currentColor" strokeOpacity="0.04" />
                <text x={x} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">{label}</text>
              </g>
            )
          })}
          {series.map((item) => (
            <path key={item.key} d={item.path} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </svg>
      </div>
    </div>
  )
}

function getTrendPeak(data: Array<{ date: string; userCount: number; postCount: number; commentCount: number; reportCount: number }>, key: "userCount" | "postCount" | "commentCount" | "reportCount") {
  const peak = data.reduce((best, current) => (current[key] > best[key] ? current : best), data[0] ?? { date: "", userCount: 0, postCount: 0, commentCount: 0, reportCount: 0 })
  return {
    count: peak[key] ?? 0,
    dateLabel: peak.date ? formatChartDate(peak.date) : "-",
  }
}

function formatChartDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(value))
}

function getOverviewMetricValueClassName(tone: "default" | "rose" | "amber" | "emerald" | "slate" = "default") {
  return {
    default: "text-sm font-semibold text-foreground",
    rose: "text-sm font-semibold text-rose-700 dark:text-rose-200",
    amber: "text-sm font-semibold text-amber-700 dark:text-amber-200",
    emerald: "text-sm font-semibold text-emerald-700 dark:text-emerald-200",
    slate: "text-sm font-semibold text-slate-700 dark:text-slate-200",
  }[tone]
}

function getPostStatusBadgeClassName(status: string) {
  if (status === "PENDING") {
    return "rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
  }
  if (status === "OFFLINE") {
    return "rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200"
  }
  return "rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
}



function getCommentStatusBadgeClassName(status: string) {
  if (status === "NORMAL") {
    return "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
  }
  if (status === "PENDING") {
    return "rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
  }
  if (status === "HIDDEN") {
    return "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 dark:bg-slate-500/15 dark:text-slate-200"
  }
  return "rounded-full bg-rose-100 px-2 py-0.5 text-[11px] text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value)
}
