import { redirect } from "next/navigation"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, FileText, Info, Megaphone, Settings2, Shield, TrendingUp, Users } from "lucide-react"

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
import { AdminShell } from "@/components/admin-shell"
import { AdminUserList } from "@/components/admin-user-list"
import { AdminVipSettingsForm } from "@/components/admin-vip-settings-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAdminDashboardData, getAdminPosts, getAdminStructureData, requireAdminUser } from "@/lib/admin"
import { getAdminAnnouncementList } from "@/lib/admin-announcements"
import { isLocalPostType } from "@/lib/post-types"

import { getAdminLogCenter } from "@/lib/admin-logs"
import { getAdminUsers } from "@/lib/admin-users"
import { getAllBadges, type BadgeItem, type BadgeRuleItem } from "@/lib/badges"
import { formatMonthDayTime } from "@/lib/formatters"
import { getInviteCodeList } from "@/lib/invite-codes"
import { getLevelDefinitions } from "@/lib/level-system"
import { getRedeemCodeList } from "@/lib/redeem-codes"
import { getAdminReports } from "@/lib/reports"
import { getAdminFriendLinkPageData } from "@/lib/friend-links"
import { readSearchParam } from "@/lib/search-params"
import { getSensitiveWordPage, getServerSiteSettings } from "@/lib/site-settings"
import { prisma } from "@/db/client"

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
  announcements: "公告管理",
  reports: "举报中心",
  logs: "日志中心",
  security: "内容安全",
  settings: "站点设置",
}

function getAdminVerificationTypes() {
  return prisma.verificationType.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      _count: {
        select: {
          applications: true,
        },
      },
    },
  })
}

function getAdminVerificationApplications() {
  return prisma.userVerification.findMany({
    orderBy: [{ submittedAt: "desc" }],
    take: 200,
    include: {
      type: true,
      user: {
        select: {
          id: true,
          username: true,
          nickname: true,
        },
      },
      reviewer: {
        select: {
          id: true,
          username: true,
          nickname: true,
        },
      },
    },
  })
}

export default async function AdminPage(props: PageProps<"/admin">) {
  const searchParams = await props.searchParams;
  const admin = await requireAdminUser()

  if (!admin) {
    redirect("/login?redirect=/admin")
  }

  const currentTabValue = readSearchParam(searchParams?.tab)
  const tab: AdminTabKey = adminTabs.includes((currentTabValue as AdminTabKey) ?? "overview")
    ? ((currentTabValue as AdminTabKey) ?? "overview")
    : "overview"
  const currentSettingsSectionValue = readSearchParam(searchParams?.section)
  const currentSettingsSection: AdminSettingsSectionKey = adminSettingsSections.includes((currentSettingsSectionValue as AdminSettingsSectionKey) ?? "profile")
    ? ((currentSettingsSectionValue as AdminSettingsSectionKey) ?? "profile")
    : "profile"
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

  const [dashboardData, structureData, siteSettings, adminUsers, filteredPosts, levelDefinitions, badges, announcements, inviteCodes, redeemCodes, reports, sensitiveWordResult, logCenter, friendLinks, verificationTypes, verificationApplications] = await Promise.all([
    tab === "overview"
      ? getAdminDashboardData()
      : Promise.resolve<Awaited<ReturnType<typeof getAdminDashboardData>> | null>(null),
    tab === "structure"
      ? getAdminStructureData()
      : Promise.resolve<Awaited<ReturnType<typeof getAdminStructureData>> | null>(null),
    tab === "settings" && sectionsRequiringSiteSettings.has(currentSettingsSection)
      ? getServerSiteSettings()
      : Promise.resolve<Awaited<ReturnType<typeof getServerSiteSettings>> | null>(null),
    tab === "users"
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
    tab === "levels" ? getLevelDefinitions() : Promise.resolve<Awaited<ReturnType<typeof getLevelDefinitions>>>([]),
    tab === "badges" ? getAllBadges() : Promise.resolve<Awaited<ReturnType<typeof getAllBadges>>>([]),
    tab === "announcements" ? getAdminAnnouncementList() : Promise.resolve<Awaited<ReturnType<typeof getAdminAnnouncementList>>>([]),
    tab === "settings" && currentSettingsSection === "invite-codes"
      ? getInviteCodeList()
      : Promise.resolve<Awaited<ReturnType<typeof getInviteCodeList>>>([]),
    tab === "settings" && currentSettingsSection === "redeem-codes"
      ? getRedeemCodeList()
      : Promise.resolve<Awaited<ReturnType<typeof getRedeemCodeList>>>([]),
    tab === "reports"
      ? getAdminReports({ page: Number(currentReportPage), pageSize: Number(currentReportPageSize) })
      : Promise.resolve<Awaited<ReturnType<typeof getAdminReports>> | null>(null),
    tab === "security"
      ? getSensitiveWordPage({ page: Number(currentSecurityPage), pageSize: Number(currentSecurityPageSize) })
      : Promise.resolve<Awaited<ReturnType<typeof getSensitiveWordPage>> | null>(null),
    tab === "logs"
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
    tab === "settings" && currentSettingsSection === "friend-links"
      ? getAdminFriendLinkPageData()
      : Promise.resolve<Awaited<ReturnType<typeof getAdminFriendLinkPageData>> | null>(null),
    tab === "verifications"
      ? getAdminVerificationTypes()
      : Promise.resolve<Awaited<ReturnType<typeof getAdminVerificationTypes>> | null>(null),
    tab === "verifications"
      ? getAdminVerificationApplications()
      : Promise.resolve<Awaited<ReturnType<typeof getAdminVerificationApplications>> | null>(null),
  ])

  return (
    <AdminShell currentTab={tab} adminName={admin.nickname ?? admin.username}>
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
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard title="注册用户" value={dashboardData!.overview.userCount} icon={<Users className="h-5 w-5" />} hint={`近 7 天新增 ${formatNumber(dashboardData!.overview.newUserCount7d)} 人`} />
              <StatCard title="帖子总数" value={dashboardData!.overview.postCount} icon={<FileText className="h-5 w-5" />} hint={`近 7 天新增 ${formatNumber(dashboardData!.overview.newPostCount7d)} 篇`} />
              <StatCard title="活跃用户" value={dashboardData!.overview.activeUserCount7d} icon={<TrendingUp className="h-5 w-5" />} hint="按最近登录、发帖、评论综合统计近 7 天活跃" />
              <StatCard title="待处理举报" value={dashboardData!.overview.pendingReportCount} icon={<AlertTriangle className="h-5 w-5" />} hint={`累计举报 ${formatNumber(dashboardData!.overview.reportCount)} 条，优先处理风险内容`} />
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard title="总浏览量" value={dashboardData!.overview.totalViewCount} description="帖子累计浏览规模" />
              <MetricCard title="总点赞量" value={dashboardData!.overview.totalLikeCount} description="社区内容互动热度" />
              <MetricCard title="总收藏量" value={dashboardData!.overview.totalFavoriteCount} description="用户内容沉淀意愿" />
              <MetricCard title="节点关注量" value={dashboardData!.overview.totalFollowerCount} description="版块关注总规模" />
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Card>
                <CardHeader>
                  <CardTitle>近 7 天增长趋势</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pb-4">
                  <TrendLegend />
                  <DashboardTrendChart data={dashboardData!.trends} />
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <TrendSummaryItem label="新增用户峰值" value={getTrendPeak(dashboardData!.trends, "userCount")} colorClassName="bg-sky-500" />
                    <TrendSummaryItem label="新增帖子峰值" value={getTrendPeak(dashboardData!.trends, "postCount")} colorClassName="bg-emerald-500" />
                    <TrendSummaryItem label="新增评论峰值" value={getTrendPeak(dashboardData!.trends, "commentCount")} colorClassName="bg-violet-500" />
                    <MetricHighlightCard title="今日签到人数" value={dashboardData!.overview.todayCheckInUserCount} description="按业务日统计当日完成签到的独立用户数" compact />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">待审核事项</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2.5 pt-0 sm:grid-cols-2">
                  <PendingReviewCard href="/admin?tab=verifications" title="待认证审核" value={dashboardData!.overview.pendingVerificationCount} description="处理用户身份与资质认证申请" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
                  <PendingReviewCard href="/admin?tab=settings&section=friend-links" title="友情链接审核" value={dashboardData!.overview.pendingFriendLinkCount} description="审核站点互链申请与展示资料" icon={<Shield className="h-3.5 w-3.5" />} />
                  <PendingReviewCard href="/admin/apps/self-serve-ads" title="广告审核" value={dashboardData!.overview.pendingAdOrderCount} description="审核自助推广广告位申请内容" icon={<Megaphone className="h-3.5 w-3.5" />} />
                  <PendingReviewCard href="/admin?tab=reports" title="举报待处理" value={dashboardData!.overview.pendingReportCount} description="社区风险内容与违规行为处置" icon={<AlertTriangle className="h-3.5 w-3.5" />} />
                  <PendingReviewCard href="/admin?tab=posts&status=PENDING" title="待审核帖子" value={dashboardData!.overview.pendingPostCount} description="人工复核待发布内容" icon={<FileText className="h-3.5 w-3.5" />} />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Card>
                <CardHeader>
                  <CardTitle>最近帖子</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dashboardData!.recentPosts.map((post) => (
                    <div key={post.id} className="rounded-[24px] border border-border px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{post.boardName}</span>
                        <span>·</span>
                        <span>{post.authorName}</span>
                        <span>·</span>
                        <span>{post.createdAt ? formatMonthDayTime(post.createdAt) : "-"}</span>
                      </div>
                      <h3 className="mt-2 text-base font-semibold">{post.title}</h3>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-accent px-3 py-1">{post.status}</span>
                        {post.isPinned ? <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-700">已置顶</span> : null}
                        {post.isFeatured ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">已推荐</span> : null}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>最近举报</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dashboardData!.recentReports.map((report) => (
                    <div key={report.id} className="rounded-[24px] border border-border px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{report.reasonType}</p>
                        <span className="rounded-full bg-accent px-3 py-1 text-xs">{report.status}</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">举报人：{report.reporterName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">时间：{report.createdAt ? formatMonthDayTime(report.createdAt) : "-"}</p>
                      {report.reasonDetail ? <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{report.reasonDetail}</p> : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}

        {tab === "settings" ? <AdminSettingsTabs currentSection={currentSettingsSection} /> : null}

        {tab === "users" ? <AdminUserList data={adminUsers!} /> : null}
        {tab === "posts" ? <AdminPostList data={filteredPosts!} /> : null}
        {tab === "structure" ? <StructureManager zones={structureData!.zones} boards={structureData!.boardStatus} initialFilters={{ keyword: currentStructureKeyword, zoneId: currentStructureZoneId, boardStatus: currentStructureBoardStatus, posting: currentStructurePosting }} /> : null}
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
        }))} /> : null}
        {tab === "verifications" ? <AdminVerificationManager initialTypes={verificationTypes!.map((item) => ({
          id: item.id,
          name: item.name,
          slug: item.slug,
          description: item.description ?? "",
          iconText: item.iconText ?? "✔️",
          color: item.color,
          formFields: (() => {
            if (!item.formSchemaJson?.trim()) {
              return []
            }
            try {
              const parsed = JSON.parse(item.formSchemaJson) as Array<Record<string, unknown>>
              if (!Array.isArray(parsed)) {
                return []
              }
              return parsed.map((field, fieldIndex) => ({
                id: String(field.id ?? `field_${fieldIndex + 1}`),
                label: String(field.label ?? "字段"),
                type: (["text", "textarea", "number", "url"].includes(String(field.type ?? "text")) ? String(field.type ?? "text") : "text") as "text" | "textarea" | "number" | "url",
                placeholder: String(field.placeholder ?? "") || undefined,
                required: field.required === true,
                helpText: String(field.helpText ?? "") || undefined,
                sortOrder: Number.isFinite(Number(field.sortOrder)) ? Number(field.sortOrder) : fieldIndex,
              }))
            } catch {
              return []
            }
          })(),
          sortOrder: item.sortOrder,
          status: item.status,
          needRemark: item.needRemark,
          userLimit: item.userLimit,
          allowResubmitAfterReject: item.allowResubmitAfterReject,
          applicationCount: item._count.applications,
        }))} initialApplications={verificationApplications!.map((item) => ({
          id: item.id,
          status: item.status,
          content: item.content,
          formResponseJson: item.formResponseJson,
          note: item.note,
          rejectReason: item.rejectReason,
          submittedAt: item.submittedAt.toISOString(),
          reviewedAt: item.reviewedAt?.toISOString() ?? null,
          user: {
            id: item.user.id,
            username: item.user.username,
            displayName: item.user.nickname?.trim() || item.user.username,
          },
          type: {
            id: item.type.id,
            name: item.type.name,
            iconText: item.type.iconText ?? "✔️",
            color: item.type.color,
          },
          reviewer: item.reviewer ? {
            id: item.reviewer.id,
            username: item.reviewer.username,
            displayName: item.reviewer.nickname?.trim() || item.reviewer.username,
          } : null,
        }))} /> : null}
        {tab === "announcements" ? <AdminAnnouncementManager initialItems={announcements} /> : null}
        {tab === "settings" && currentSettingsSection === "profile" ? <AdminBasicSettingsForm initialSettings={siteSettings!} mode="profile" /> : null}
        {tab === "settings" && currentSettingsSection === "markdown-emoji" ? <AdminMarkdownEmojiSettingsForm initialItems={siteSettings!.markdownEmojiMap} /> : null}
        {tab === "settings" && currentSettingsSection === "footer-links" ? <AdminFooterLinksSettingsForm initialLinks={siteSettings!.footerLinks} /> : null}
        {tab === "settings" && currentSettingsSection === "apps" ? <AdminAppsSettingsForm initialLinks={siteSettings!.headerAppLinks} initialIconName={siteSettings!.headerAppIconName} /> : null}
        {tab === "settings" && currentSettingsSection === "registration" ? <AdminBasicSettingsForm initialSettings={siteSettings!} mode="registration" /> : null}
        {tab === "settings" && currentSettingsSection === "interaction" ? <AdminBasicSettingsForm initialSettings={siteSettings!} mode="interaction" /> : null}
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

function StatCard({ title, value, icon, hint }: { title: string; value: number; icon: React.ReactNode; hint: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold">{formatNumber(value)}</p>
          <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-foreground">{icon}</div>
      </CardContent>
    </Card>
  )
}

function MetricCard({ title, value, description }: { title: string; value: number; description: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-2 text-3xl font-semibold">{formatNumber(value)}</p>
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function PendingReviewCard({ href, title, value, description, icon }: { href: string; title: string; value: number; description: string; icon: React.ReactNode }) {
  return (
    <Link href={href} title={description} className="rounded-[16px] border border-border px-3 py-3 transition-colors hover:bg-accent/70">
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
    <div className={cn("rounded-[24px] border border-dashed border-border bg-accent/40", compact ? "px-4 py-4" : "px-4 py-4")}>
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
    <div className="rounded-[20px] border border-border px-4 py-4">
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value)
}
