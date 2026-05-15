import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AdminAnnouncementManager } from "@/components/admin/admin-announcement-manager"
import { AdminAttachmentManager } from "@/components/admin/admin-attachment-manager"
import { AdminModuleSearch } from "@/components/admin/admin-module-search"
import { AdminOverviewDashboard } from "@/components/admin/admin-overview-dashboard"
import { AdminPillTabs } from "@/components/admin/admin-pill-tabs"
import { AdminBadgeManager } from "@/components/admin/admin-badge-manager"
import { AdminCustomPageManager } from "@/components/admin/admin-custom-page-manager"
import { AdminVerificationManager } from "@/components/admin/admin-verification-manager"
import { AdminLevelSettingsForm } from "@/components/admin/admin-level-settings-form"
import { AdminLogCenter } from "@/components/admin/admin-log-center"
import { AdminCommentList } from "@/components/admin/admin-comment-list"
import { AdminPostList } from "@/components/admin/admin-post-list"
import { AdminReportCenter } from "@/components/admin/admin-report-center"
import { AdminSensitiveWordManager } from "@/components/admin/admin-sensitive-word-manager"
import { AdminBoardApplicationManager, StructureManager } from "@/components/admin/admin-structure-forms"
import { AdminShell } from "@/components/admin/admin-shell"
import { AdminUserList } from "@/components/admin/admin-user-list"
import { getAdminComments, getAdminDashboardData, getAdminPosts, getAdminStructureData } from "@/lib/admin"
import { getAdminAnnouncementList } from "@/lib/admin-announcements"
import { getAdminCustomPageList } from "@/lib/admin-custom-pages"
import { getVerificationAdminData } from "@/lib/admin-verification-service"
import {
  adminTabs,
  adminTabLabels,
  getAdminNavigationItem,
  getAllowedAdminTabs,
  type AdminTabKey,
  type AdminVerificationSubTabKey,
} from "@/lib/admin-navigation"
import { resolveAdminSettingsRoute } from "@/lib/admin-settings-navigation"
import { isLocalPostType } from "@/lib/post-types"

import { getAdminLogCenter } from "@/lib/admin-logs"
import { getAdminAttachmentManagement } from "@/lib/admin-attachments"
import { getAdminUsers } from "@/lib/admin-users"
import { getAllBadges, type BadgeEffectRuleItem, type BadgeItem, type BadgeRuleItem } from "@/lib/badges"
import { getLevelDefinitions } from "@/lib/level-system"
import { minuteOfDayToTimeInput } from "@/lib/point-effect-definitions"
import { getAdminReports } from "@/lib/reports"
import { readSearchParam } from "@/lib/search-params"
import { getSensitiveWordPage, getServerSiteSettings } from "@/lib/site-settings"
import { requireAdminActor } from "@/lib/moderator-permissions"

export async function generateMetadata(props: PageProps<"/admin">): Promise<Metadata> {
  const searchParams = await props.searchParams
  const currentTabValue = readSearchParam(searchParams?.tab)
  const currentTab: AdminTabKey = adminTabs.includes((currentTabValue as AdminTabKey) ?? "overview")
    ? ((currentTabValue as AdminTabKey) ?? "overview")
    : "overview"
  const settings = await getServerSiteSettings()

  return {
    title: `${adminTabLabels[currentTab]} - ${settings.siteName}`,
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
  const currentVerificationSubTabValue = readSearchParam(searchParams?.verificationSubTab)
  const currentVerificationSubTab: AdminVerificationSubTabKey = currentVerificationSubTabValue === "reviews" ? "reviews" : "types"

  if (tab === "settings" && admin.role === "ADMIN") {
    redirect(
      resolveAdminSettingsRoute({
        section: readSearchParam(searchParams?.section),
        subTab: readSearchParam(searchParams?.subTab),
      })?.href ?? "/admin/settings/profile/branding"
    )
  }
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
  const currentCommentStatusValue = readSearchParam(searchParams?.status)
  const currentCommentStatus = currentCommentStatusValue === "PENDING" || currentCommentStatusValue === "NORMAL" || currentCommentStatusValue === "HIDDEN" ? currentCommentStatusValue : "ALL"
  const currentCommentBoardSlug = readSearchParam(searchParams?.board) ?? ""
  const currentCommentKeyword = readSearchParam(searchParams?.keyword) ?? ""
  const currentCommentSort = readSearchParam(searchParams?.sort) ?? "newest"
  const currentCommentReview = readSearchParam(searchParams?.review) ?? "ALL"
  const currentCommentType = readSearchParam(searchParams?.type) ?? "ALL"
  const currentCommentPage = readSearchParam(searchParams?.commentPage) ?? "1"
  const currentCommentPageSize = readSearchParam(searchParams?.commentPageSize) ?? "20"
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
  const currentAttachmentKeyword = readSearchParam(searchParams?.attachmentKeyword) ?? ""
  const currentAttachmentBucketType = readSearchParam(searchParams?.attachmentBucketType) ?? "ALL"
  const currentAttachmentReferenceStatus = readSearchParam(searchParams?.attachmentReferenceStatus) ?? "ALL"
  const currentAttachmentPage = readSearchParam(searchParams?.attachmentPage) ?? "1"
  const currentAttachmentPageSize = readSearchParam(searchParams?.attachmentPageSize) ?? "20"

  const [dashboardData, structureData, adminUsers, filteredPosts, filteredComments, levelDefinitions, badges, announcements, customPages, reports, attachments, sensitiveWordResult, logCenter, verificationAdminData] = await Promise.all([
    admin.role === "ADMIN" && tab === "overview"
      ? getAdminDashboardData()
      : Promise.resolve<Awaited<ReturnType<typeof getAdminDashboardData>> | null>(null),
    tab === "structure" || tab === "board-applications"
      ? getAdminStructureData()
      : Promise.resolve<Awaited<ReturnType<typeof getAdminStructureData>> | null>(null),
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
    tab === "comments"
      ? getAdminComments({
        status: currentCommentStatus,
        boardSlug: currentCommentBoardSlug || undefined,
        keyword: currentCommentKeyword || undefined,
        sort: currentCommentSort,
        review: currentCommentReview,
        type: currentCommentType,
        page: Number(currentCommentPage),
        pageSize: Number(currentCommentPageSize),
      })
      : Promise.resolve<Awaited<ReturnType<typeof getAdminComments>> | null>(null),
    admin.role === "ADMIN" && tab === "levels"
      ? getLevelDefinitions()
      : Promise.resolve<Awaited<ReturnType<typeof getLevelDefinitions>>>([]),
    admin.role === "ADMIN" && tab === "badges" ? getAllBadges() : Promise.resolve<Awaited<ReturnType<typeof getAllBadges>>>([]),
    admin.role === "ADMIN" && tab === "announcements" ? getAdminAnnouncementList() : Promise.resolve<Awaited<ReturnType<typeof getAdminAnnouncementList>>>([]),
    admin.role === "ADMIN" && tab === "custom-pages" ? getAdminCustomPageList() : Promise.resolve<Awaited<ReturnType<typeof getAdminCustomPageList>>>([]),
    admin.role === "ADMIN" && tab === "reports"
      ? getAdminReports({ page: Number(currentReportPage), pageSize: Number(currentReportPageSize) })
      : Promise.resolve<Awaited<ReturnType<typeof getAdminReports>> | null>(null),
    admin.role === "ADMIN" && tab === "attachments"
      ? getAdminAttachmentManagement({
        keyword: currentAttachmentKeyword || undefined,
        bucketType: currentAttachmentBucketType,
        referenceStatus: currentAttachmentReferenceStatus,
        page: Number(currentAttachmentPage),
        pageSize: Number(currentAttachmentPageSize),
      })
      : Promise.resolve<Awaited<ReturnType<typeof getAdminAttachmentManagement>> | null>(null),
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
    admin.role === "ADMIN" && tab === "verifications"
      ? getVerificationAdminData()
      : Promise.resolve<Awaited<ReturnType<typeof getVerificationAdminData>> | null>(null),
  ])

  return (
    <AdminShell
      currentKey={tab}
      adminName={admin.nickname ?? admin.username}
      adminRole={admin.role}
      headerDescription={getAdminNavigationItem(tab).description}
      headerSearch={<AdminModuleSearch className="w-full" />}
    >
      <div className="space-y-6">
        {tab === "overview" ? <AdminOverviewDashboard data={dashboardData!} /> : null}

        {admin.role === "ADMIN" && tab === "verifications" ? (
          <div className="rounded-xl border border-border bg-card p-3">
            <AdminPillTabs
              items={[
                { key: "types", label: "认证类型", href: "/admin?tab=verifications&verificationSubTab=types" },
                { key: "reviews", label: "认证审核", href: "/admin?tab=verifications&verificationSubTab=reviews" },
              ]}
              activeKey={currentVerificationSubTab}
              inactiveStyle="outlined"
            />
          </div>
        ) : null}

        {tab === "users" ? <AdminUserList data={adminUsers!} /> : null}
        {tab === "posts" ? <AdminPostList data={filteredPosts!} /> : null}
        {tab === "comments" ? <AdminCommentList data={filteredComments!} /> : null}
        {tab === "structure" ? <StructureManager zones={structureData!.zones} boards={structureData!.boardStatus} permissions={structureData!.permissions} canReviewBoardApplications={structureData!.canReviewBoardApplications} pendingBoardApplicationCount={structureData!.boardApplications.filter((item) => item.status === "PENDING").length} initialFilters={{ keyword: currentStructureKeyword, zoneId: currentStructureZoneId, boardStatus: currentStructureBoardStatus, posting: currentStructurePosting }} /> : null}
        {tab === "board-applications" ? <AdminBoardApplicationManager zones={structureData!.zones} boardApplications={structureData!.boardApplications} canReviewBoardApplications={structureData!.canReviewBoardApplications} /> : null}
        {tab === "levels" ? <AdminLevelSettingsForm initialLevels={levelDefinitions} /> : null}
        {tab === "badges" ? <AdminBadgeManager initialLevelDefinitions={levelDefinitions} initialBadges={badges.map((badge: BadgeItem) => ({
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
        {tab === "verifications" ? <AdminVerificationManager mode={currentVerificationSubTab} initialTypes={verificationAdminData!.types} initialApplications={verificationAdminData!.applications.map((item) => ({
          ...item,
          type: {
            ...item.type,
            iconText: item.type.iconText ?? "✔️",
          },
        }))} /> : null}
        {tab === "announcements" ? <AdminAnnouncementManager initialItems={announcements} /> : null}
        {tab === "custom-pages" ? <AdminCustomPageManager initialItems={customPages} /> : null}
        {tab === "reports" ? <AdminReportCenter data={reports!} /> : null}
        {tab === "attachments" ? <AdminAttachmentManager data={attachments!} /> : null}
        {tab === "logs" ? <AdminLogCenter data={logCenter!} /> : null}
        {tab === "security" ? <AdminSensitiveWordManager data={sensitiveWordResult!} /> : null}
      </div>
    </AdminShell>
  )
}
