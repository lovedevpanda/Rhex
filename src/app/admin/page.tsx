import { redirect } from "next/navigation"
import { AlertTriangle, FileText, Settings2, Shield, Users } from "lucide-react"

import { AdminAnnouncementManager } from "@/components/admin-announcement-manager"
import { AdminInviteCodeManager } from "@/components/admin-invite-code-manager"
import { AdminFooterLinksSettingsForm } from "@/components/admin-footer-links-settings-form"
import { AdminFriendLinksSettingsForm } from "@/components/admin-friend-links-settings-form"
import { AdminBadgeManager } from "@/components/admin-badge-manager"
import { AdminBasicSettingsForm } from "@/components/admin-basic-settings-form"
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
import { getAdminDashboardData, getAdminPosts, requireAdminUser } from "@/lib/admin"
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
import { getSensitiveWordPage, getSiteSettings } from "@/lib/site-settings"

interface AdminPageProps {
  searchParams?: {
    tab?: string
    section?: string
    type?: string
    status?: string
    board?: string
    keyword?: string
    sort?: string
    pin?: string
    featured?: string
    review?: string
    postPage?: string
    postPageSize?: string
    reportPage?: string
    reportPageSize?: string
    securityPage?: string
    securityPageSize?: string
    structureKeyword?: string
    structureZoneId?: string
    structureBoardStatus?: string
    structurePosting?: string
    userKeyword?: string
    userRole?: string
    userStatus?: string
    userVip?: string
    userActivity?: string
    userSort?: string
    userPage?: string
    userPageSize?: string
    logSubTab?: string
    logKeyword?: string
    logAction?: string
    logChangeType?: string
    logBucketType?: string
    logPage?: string
    logPageSize?: string
  }
}

const tabLabels: Record<string, string> = {
  overview: "总览",
  users: "用户管理",
  posts: "帖子管理",
  structure: "版块管理",
  levels: "等级系统",
  badges: "勋章系统",
  announcements: "公告管理",
  reports: "举报中心",

  logs: "日志中心",
  security: "内容安全",
  "site-basic": "站点基础设置",
  "site-vip": "VIP设置",
  "site-upload": "上传设置",
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const admin = await requireAdminUser()

  if (!admin) {
    redirect("/login?redirect=/admin")
  }

  const tab = searchParams?.tab ?? "overview"
  const currentSettingsSection = searchParams?.section ?? "profile"
  const currentPostType = isLocalPostType(searchParams?.type) ? searchParams.type : "ALL"

  const currentPostStatus = searchParams?.status === "PENDING" || searchParams?.status === "NORMAL" || searchParams?.status === "OFFLINE" ? searchParams.status : "ALL"
  const currentBoardSlug = searchParams?.board ?? ""
  const currentKeyword = searchParams?.keyword ?? ""
  const currentPostSort = searchParams?.sort ?? "newest"
  const currentPostPin = searchParams?.pin ?? "ALL"
  const currentPostFeatured = searchParams?.featured ?? "ALL"
  const currentPostReview = searchParams?.review ?? "ALL"
  const currentPostPage = searchParams?.postPage ?? "1"
  const currentPostPageSize = searchParams?.postPageSize ?? "20"
  const currentReportPage = searchParams?.reportPage ?? "1"
  const currentReportPageSize = searchParams?.reportPageSize ?? "20"
  const currentSecurityPage = searchParams?.securityPage ?? "1"
  const currentSecurityPageSize = searchParams?.securityPageSize ?? "20"
  const currentStructureKeyword = searchParams?.structureKeyword ?? ""
  const currentStructureZoneId = searchParams?.structureZoneId ?? ""
  const currentStructureBoardStatus = searchParams?.structureBoardStatus ?? "ALL"
  const currentStructurePosting = searchParams?.structurePosting ?? "ALL"
  const currentUserKeyword = searchParams?.userKeyword ?? ""
  const currentUserRole = searchParams?.userRole ?? "ALL"
  const currentUserStatus = searchParams?.userStatus ?? "ALL"
  const currentUserVip = searchParams?.userVip ?? "ALL"
  const currentUserActivity = searchParams?.userActivity ?? "ALL"
  const currentUserSort = searchParams?.userSort ?? "newest"
  const currentUserPage = searchParams?.userPage ?? "1"
  const currentUserPageSize = searchParams?.userPageSize ?? "20"
  const currentLogSubTab = searchParams?.logSubTab ?? "admin"
  const currentLogKeyword = searchParams?.logKeyword ?? ""
  const currentLogAction = searchParams?.logAction ?? "ALL"
  const currentLogChangeType = searchParams?.logChangeType ?? "ALL"
  const currentLogBucketType = searchParams?.logBucketType ?? "ALL"
  const currentLogPage = searchParams?.logPage ?? "1"
  const currentLogPageSize = searchParams?.logPageSize ?? "20"

  const [data, siteSettings, adminUsers, filteredPosts, levelDefinitions, badges, announcements, inviteCodes, redeemCodes, reports, sensitiveWordResult, logCenter, friendLinks] = await Promise.all([
    getAdminDashboardData(),
    getSiteSettings(),
    getAdminUsers({
      keyword: currentUserKeyword || undefined,
      role: currentUserRole,
      status: currentUserStatus,
      vip: currentUserVip,
      activity: currentUserActivity,
      sort: currentUserSort,
      page: Number(currentUserPage),
      pageSize: Number(currentUserPageSize),
    }),
    getAdminPosts({
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
    }),
    getLevelDefinitions(),
    getAllBadges(),
    getAdminAnnouncementList(),
    getInviteCodeList(),
    getRedeemCodeList(),
    getAdminReports({ page: Number(currentReportPage), pageSize: Number(currentReportPageSize) }),
    getSensitiveWordPage({ page: Number(currentSecurityPage), pageSize: Number(currentSecurityPageSize) }),
    getAdminLogCenter({
      activeTab: currentLogSubTab,
      keyword: currentLogKeyword,
      action: currentLogAction,
      changeType: currentLogChangeType,
      bucketType: currentLogBucketType,
      page: Number(currentLogPage),
      pageSize: Number(currentLogPageSize),
    }),
    getAdminFriendLinkPageData(),
  ])

  return (
    <AdminShell currentTab={tab} adminName={admin.nickname ?? admin.username}>
      <div className="space-y-6">
        <div className="flex items-center gap-3 rounded-[24px] border border-border bg-card px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-foreground">
            <Settings2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">当前模块</p>
            <h2 className="text-lg font-semibold">{tabLabels[tab] ?? "总览"}</h2>
          </div>
        </div>

        {tab === "overview" ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="注册用户" value={data.overview.userCount} icon={<Users className="h-5 w-5" />} hint="查看活跃成员与权限结构" />
            <StatCard title="帖子总数" value={data.overview.postCount} icon={<FileText className="h-5 w-5" />} hint="快速处理置顶、推荐与下线" />
            <StatCard title="待处理举报" value={data.overview.pendingReportCount} icon={<AlertTriangle className="h-5 w-5" />} hint="优先响应社区风险内容" />
            <StatCard title="社区公告" value={data.overview.announcementCount} icon={<Shield className="h-5 w-5" />} hint="维护运营通知与置顶公告" />
          </section>
        ) : null}

        {tab === "overview" ? (
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardHeader>
                <CardTitle>最近帖子</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.recentPosts.map((post: (typeof data.recentPosts)[number]) => (
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
                <CardTitle>结构概览</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[24px] border border-border px-4 py-4">
                  <p className="text-sm text-muted-foreground">分区数量</p>
                  <p className="mt-2 text-3xl font-semibold">{data.zones.length}</p>
                </div>
                <div className="rounded-[24px] border border-border px-4 py-4">
                  <p className="text-sm text-muted-foreground">节点数量</p>
                  <p className="mt-2 text-3xl font-semibold">{data.boardStatus.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {tab === "settings" ? <AdminSettingsTabs currentSection={currentSettingsSection} /> : null}

        {tab === "users" ? <AdminUserList data={adminUsers} /> : null}
        {tab === "posts" ? <AdminPostList data={filteredPosts} /> : null}
        {tab === "structure" ? <StructureManager zones={data.zones} boards={data.boardStatus} initialFilters={{ keyword: currentStructureKeyword, zoneId: currentStructureZoneId, boardStatus: currentStructureBoardStatus, posting: currentStructurePosting }} /> : null}
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
        {tab === "announcements" ? <AdminAnnouncementManager initialItems={announcements} /> : null}
        {tab === "settings" && currentSettingsSection === "profile" ? <AdminBasicSettingsForm initialSettings={siteSettings} mode="profile" /> : null}
        {tab === "settings" && currentSettingsSection === "markdown-emoji" ? <AdminMarkdownEmojiSettingsForm initialItems={siteSettings.markdownEmojiMap} /> : null}
        {tab === "settings" && currentSettingsSection === "footer-links" ? <AdminFooterLinksSettingsForm initialLinks={siteSettings.footerLinks} /> : null}
        {tab === "settings" && currentSettingsSection === "registration" ? <AdminBasicSettingsForm initialSettings={siteSettings} mode="registration" /> : null}
        {tab === "settings" && currentSettingsSection === "interaction" ? <AdminBasicSettingsForm initialSettings={siteSettings} mode="interaction" /> : null}
        {tab === "settings" && currentSettingsSection === "friend-links" ? <AdminFriendLinksSettingsForm initialSettings={friendLinks.settings} items={friendLinks.items} pendingCount={friendLinks.pendingCount} /> : null}
        {tab === "settings" && currentSettingsSection === "invite-codes" ? <AdminInviteCodeManager initialInviteCodes={inviteCodes} /> : null}
        {tab === "settings" && currentSettingsSection === "redeem-codes" ? <AdminRedeemCodeManager initialRedeemCodes={redeemCodes} /> : null}
        {tab === "settings" && currentSettingsSection === "vip" ? <AdminVipSettingsForm initialSettings={siteSettings} /> : null}
        {tab === "settings" && currentSettingsSection === "upload" ? <AdminUploadSettingsForm initialSettings={siteSettings} /> : null}

        {tab === "reports" ? <AdminReportCenter data={reports} /> : null}
        {tab === "logs" ? <AdminLogCenter data={logCenter} /> : null}
        {tab === "security" ? <AdminSensitiveWordManager data={sensitiveWordResult} /> : null}
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
          <p className="mt-2 text-3xl font-semibold">{value}</p>
          <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-foreground">{icon}</div>
      </CardContent>
    </Card>
  )
}
