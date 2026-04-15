import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { buildUserLevelThresholdOptions, buildVipLevelThresholdOptions } from "@/lib/access-threshold-options"
import { AdminAppsSettingsForm } from "@/components/admin/admin-apps-settings-form"
import { AdminBasicSettingsForm } from "@/components/admin/admin-basic-settings-form"
import { AdminFooterLinksSettingsForm } from "@/components/admin/admin-footer-links-settings-form"
import { AdminFriendLinksSettingsForm } from "@/components/admin/admin-friend-links-settings-form"
import { AdminMarkdownEmojiSettingsForm } from "@/components/admin/admin-markdown-emoji-settings-form"
import { AdminModuleSearch } from "@/components/admin/admin-module-search"
import { AdminSettingsWorkspace } from "@/components/admin/admin-settings-workspace"
import { AdminShell } from "@/components/admin/admin-shell"
import { AdminUploadSettingsForm } from "@/components/admin/admin-upload-settings-form"
import { AdminVipSettingsForm } from "@/components/admin/admin-vip-settings-form"
import { getInviteCodeList } from "@/lib/invite-codes"
import { getLevelDefinitions } from "@/lib/level-system"
import { getRedeemCodeList } from "@/lib/redeem-codes"
import {
  getAdminSettingsHref,
  getDefaultAdminSettingsHref,
  resolveAdminSettingsRouteFromSegments,
} from "@/lib/admin-settings-navigation"
import { sectionsRequiringSiteSettings } from "@/lib/admin-navigation"
import { getAdminFriendLinkPageData } from "@/lib/friend-links"
import { getServerSiteSettings } from "@/lib/site-settings"
import { requireAdminActor } from "@/lib/moderator-permissions"

interface AdminSettingsPageProps {
  params: Promise<{
    segments?: string[]
  }>
}

function buildSettingsPath(segments?: string[]) {
  return segments && segments.length > 0
    ? `/admin/settings/${segments.join("/")}`
    : "/admin/settings"
}

export async function generateMetadata(
  props: AdminSettingsPageProps
): Promise<Metadata> {
  const params = await props.params
  const resolved = resolveAdminSettingsRouteFromSegments(params.segments)
  const settings = await getServerSiteSettings()

  return {
    title: `${resolved?.subTabLabel ?? resolved?.sectionLabel ?? "站点设置"} - ${settings.siteName}`,
  }
}

export default async function AdminSettingsPage(
  props: AdminSettingsPageProps
) {
  const params = await props.params
  const currentPath = buildSettingsPath(params.segments)
  const admin = await requireAdminActor()

  if (!admin) {
    redirect(`/login?redirect=${currentPath}`)
  }

  if (admin.role !== "ADMIN") {
    redirect("/admin")
  }

  const resolved = resolveAdminSettingsRouteFromSegments(params.segments)
  if (!resolved) {
    notFound()
  }

  if (currentPath !== resolved.href) {
    redirect(resolved.href)
  }

  const [
    siteSettings,
    inviteCodes,
    redeemCodes,
    friendLinks,
    levelDefinitions,
  ] = await Promise.all([
    sectionsRequiringSiteSettings.has(resolved.section)
      ? getServerSiteSettings()
      : Promise.resolve<Awaited<ReturnType<typeof getServerSiteSettings>> | null>(null),
    resolved.section === "registration"
      ? getInviteCodeList()
      : Promise.resolve<Awaited<ReturnType<typeof getInviteCodeList>>>([]),
    resolved.section === "vip"
      ? getRedeemCodeList()
      : Promise.resolve<Awaited<ReturnType<typeof getRedeemCodeList>>>([]),
    resolved.section === "friend-links"
      ? getAdminFriendLinkPageData()
      : Promise.resolve<Awaited<ReturnType<typeof getAdminFriendLinkPageData>> | null>(null),
    resolved.section === "upload"
      ? getLevelDefinitions()
      : Promise.resolve<Awaited<ReturnType<typeof getLevelDefinitions>>>([]),
  ])

  const uploadLevelOptions = buildUserLevelThresholdOptions(levelDefinitions)
  const uploadVipLevelOptions = buildVipLevelThresholdOptions()
  const breadcrumbs: Array<{ label: string; href?: string }> = [
    { label: "后台控制台", href: "/admin" },
    { label: "站点设置", href: getDefaultAdminSettingsHref() },
    { label: resolved.sectionLabel, href: getAdminSettingsHref(resolved.section) },
  ]

  if (resolved.subTabLabel && resolved.subTabLabel !== resolved.sectionLabel) {
    breadcrumbs.push({ label: resolved.subTabLabel })
  }

  return (
    <AdminShell
      currentKey="settings"
      adminName={admin.nickname ?? admin.username}
      adminRole={admin.role}
      headerDescription={resolved.subTabLabel ?? resolved.sectionLabel}
      headerSearch={<AdminModuleSearch className="w-full" />}
      breadcrumbs={breadcrumbs}
    >
      <AdminSettingsWorkspace
        currentSection={resolved.section}
        currentSectionLabel={resolved.sectionLabel}
        currentSubTab={resolved.subTab}
        currentSubTabLabel={resolved.subTabLabel}
      >
        {resolved.section === "profile" ? (
          <AdminBasicSettingsForm
            initialSettings={siteSettings!}
            mode="profile"
            initialSubTab={resolved.subTab}
            subTabRouteSection="profile"
          />
        ) : null}

        {resolved.section === "markdown-emoji" ? (
          <AdminMarkdownEmojiSettingsForm initialItems={siteSettings!.markdownEmojiMap} />
        ) : null}

        {resolved.section === "footer-links" ? (
          <AdminFooterLinksSettingsForm initialLinks={siteSettings!.footerLinks} />
        ) : null}

        {resolved.section === "apps" ? (
          <AdminAppsSettingsForm
            initialLinks={siteSettings!.headerAppLinks}
            initialIconName={siteSettings!.headerAppIconName}
          />
        ) : null}

        {resolved.section === "registration" ? (
          <AdminBasicSettingsForm
            initialSettings={siteSettings!}
            mode="registration"
            initialSubTab={resolved.subTab}
            subTabRouteSection="registration"
            initialInviteCodes={inviteCodes}
          />
        ) : null}

        {resolved.section === "board-applications" ? (
          <AdminBasicSettingsForm
            initialSettings={siteSettings!}
            mode="board-applications"
            initialSubTab={resolved.subTab}
            subTabRouteSection="board-applications"
          />
        ) : null}

        {resolved.section === "interaction" ? (
          <AdminBasicSettingsForm
            initialSettings={siteSettings!}
            mode="interaction"
            initialSubTab={resolved.subTab}
            subTabRouteSection="interaction"
          />
        ) : null}

        {resolved.section === "friend-links" ? (
          <AdminFriendLinksSettingsForm
            initialSettings={friendLinks!.settings}
            items={friendLinks!.items}
            pendingCount={friendLinks!.pendingCount}
          />
        ) : null}

        {resolved.section === "vip" ? (
          <AdminVipSettingsForm
            initialSettings={siteSettings!}
            initialSubTab={resolved.subTab}
            tabRouteSection="vip"
            initialRedeemCodes={redeemCodes}
          />
        ) : null}

        {resolved.section === "upload" ? (
          <AdminUploadSettingsForm
            initialSettings={{
              uploadProvider: siteSettings!.uploadProvider,
              uploadLocalPath: siteSettings!.uploadLocalPath,
              uploadBaseUrl: siteSettings!.uploadBaseUrl,
              uploadOssBucket: siteSettings!.uploadOssBucket,
              uploadOssRegion: siteSettings!.uploadOssRegion,
              uploadOssEndpoint: siteSettings!.uploadOssEndpoint,
              uploadS3CredentialsConfigured: Boolean(siteSettings!.uploadS3AccessKeyId && siteSettings!.uploadS3SecretAccessKey),
              uploadS3ForcePathStyle: Boolean(siteSettings!.uploadS3ForcePathStyle),
              uploadRequireLogin: Boolean(siteSettings!.uploadRequireLogin),
              uploadAllowedImageTypes:
                Array.isArray(siteSettings!.uploadAllowedImageTypes) && siteSettings!.uploadAllowedImageTypes.length > 0
                  ? siteSettings!.uploadAllowedImageTypes
                  : ["jpg", "jpeg", "png", "gif", "webp"],
              uploadMaxFileSizeMb: siteSettings!.uploadMaxFileSizeMb,
              uploadAvatarMaxFileSizeMb: siteSettings!.uploadAvatarMaxFileSizeMb,
              markdownImageUploadEnabled: Boolean(siteSettings!.markdownImageUploadEnabled),
              imageWatermarkEnabled: Boolean(siteSettings!.imageWatermarkEnabled),
              imageWatermarkText: siteSettings!.imageWatermarkText,
              imageWatermarkPosition: siteSettings!.imageWatermarkPosition,
              imageWatermarkTiled: Boolean(siteSettings!.imageWatermarkTiled),
              imageWatermarkOpacity: Number(siteSettings!.imageWatermarkOpacity ?? 22),
              imageWatermarkFontSize: Number(siteSettings!.imageWatermarkFontSize ?? 24),
              imageWatermarkFontFamily: siteSettings!.imageWatermarkFontFamily ?? "",
              imageWatermarkMargin: Number(siteSettings!.imageWatermarkMargin ?? 24),
              imageWatermarkColor: siteSettings!.imageWatermarkColor,
              attachmentUploadEnabled: Boolean(siteSettings!.attachmentUploadEnabled),
              attachmentDownloadEnabled: Boolean(siteSettings!.attachmentDownloadEnabled),
              attachmentMinUploadLevel: Number(siteSettings!.attachmentMinUploadLevel ?? 0),
              attachmentMinUploadVipLevel: Number(siteSettings!.attachmentMinUploadVipLevel ?? 0),
              attachmentAllowedExtensions:
                Array.isArray(siteSettings!.attachmentAllowedExtensions) && siteSettings!.attachmentAllowedExtensions.length > 0
                  ? siteSettings!.attachmentAllowedExtensions
                  : ["zip", "rar", "7z", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"],
              attachmentMaxFileSizeMb: Number(siteSettings!.attachmentMaxFileSizeMb ?? 20),
            }}
            levelOptions={uploadLevelOptions}
            vipLevelOptions={uploadVipLevelOptions}
            initialSubTab={resolved.subTab}
            tabRouteSection="upload"
          />
        ) : null}
      </AdminSettingsWorkspace>
    </AdminShell>
  )
}
