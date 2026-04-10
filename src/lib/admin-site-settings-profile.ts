import {
  updateSiteSettingsHeaderApps,
  updateSiteSettingsMarkdownEmoji,
  updateSiteSettingsRecord,
} from "@/db/site-settings-write-queries"
import { apiError, readOptionalNumberField, readOptionalStringField, type JsonObject } from "@/lib/api-route"
import { finalizeSiteSettingsUpdate, type SiteSettingsRecord } from "@/lib/admin-site-settings-shared"
import { normalizeMarkdownEmojiItems, serializeMarkdownEmojiItems } from "@/lib/markdown-emoji"
import { normalizePostListLoadMode } from "@/lib/post-list-load-mode"
import { normalizePostListDisplayMode } from "@/lib/post-list-display"
import { mergeFooterCopyrightSettings, mergeHomeFeedPostListLoadSettings, mergeHomeSidebarAnnouncementSettings, mergePostPageSizeSettings, resolveFooterCopyrightSettings, resolveHomeFeedPostListLoadSettings, resolveHomeSidebarAnnouncementSettings, resolvePostPageSizeSettings } from "@/lib/site-settings-app-state"
import { normalizeHeaderAppIconName, normalizeSiteHeaderAppLinks } from "@/lib/site-header-app-links"
import { mergeSiteSearchSettings, resolveSiteSearchSettings } from "@/lib/site-search-settings"
import { normalizeFooterLinks } from "@/lib/shared/config-parsers"

export async function updateProfileSiteSettingsSection(existing: SiteSettingsRecord, body: JsonObject, section: string) {
  if (section === "site-profile") {
    const siteName = readOptionalStringField(body, "siteName")
    const siteSlogan = readOptionalStringField(body, "siteSlogan")
    const siteDescription = readOptionalStringField(body, "siteDescription")
    const siteLogoText = readOptionalStringField(body, "siteLogoText")
    const siteLogoPath = readOptionalStringField(body, "siteLogoPath")
    const siteSeoKeywords = readOptionalStringField(body, "siteSeoKeywords").split(/[，,\n]+/).map((item) => item.trim()).filter(Boolean).join(",")
    const analyticsCode = readOptionalStringField(body, "analyticsCode")
    const footerCopyrightText = readOptionalStringField(body, "footerCopyrightText")
    const postLinkDisplayMode = readOptionalStringField(body, "postLinkDisplayMode") === "ID" ? "ID" : "SLUG"
    const homeFeedPostListDisplayMode = normalizePostListDisplayMode(body.homeFeedPostListDisplayMode)
    const homeSidebarStatsCardEnabled = body.homeSidebarStatsCardEnabled === undefined ? existing.homeSidebarStatsCardEnabled : Boolean(body.homeSidebarStatsCardEnabled)
    const existingHomeSidebarAnnouncementSettings = resolveHomeSidebarAnnouncementSettings({
      appStateJson: existing.appStateJson,
      enabledFallback: true,
    })
    const homeSidebarAnnouncementsEnabled = body.homeSidebarAnnouncementsEnabled === undefined
      ? existingHomeSidebarAnnouncementSettings.enabled
      : Boolean(body.homeSidebarAnnouncementsEnabled)
    const existingHomeFeedPostListLoadSettings = resolveHomeFeedPostListLoadSettings({
      appStateJson: existing.appStateJson,
      loadModeFallback: normalizePostListLoadMode(undefined),
    })
    const homeFeedPostListLoadMode = normalizePostListLoadMode(body.homeFeedPostListLoadMode, existingHomeFeedPostListLoadSettings.loadMode)
    const postEditableMinutes = Math.max(0, readOptionalNumberField(body, "postEditableMinutes") ?? 10)
    const commentEditableMinutes = Math.max(0, readOptionalNumberField(body, "commentEditableMinutes") ?? 5)
    const existingSearchSettings = resolveSiteSearchSettings(existing.appStateJson)
    const searchEnabled = body.searchEnabled === undefined ? existingSearchSettings.enabled : Boolean(body.searchEnabled)
    const existingFooterCopyrightSettings = resolveFooterCopyrightSettings({
      appStateJson: existing.appStateJson,
      textFallback: `${siteName} @ ${new Date().getFullYear()}`,
      brandingVisibleFallback: true,
    })
    const footerBrandingVisible = body.footerBrandingVisible === undefined
      ? existingFooterCopyrightSettings.brandingVisible
      : Boolean(body.footerBrandingVisible)
    const existingPostPageSizeSettings = resolvePostPageSizeSettings({
      appStateJson: existing.appStateJson,
      homeFeedFallback: 35,
      zonePostsFallback: 20,
      boardPostsFallback: 20,
      commentsFallback: 15,
      hotTopicsFallback: 5,
      postRelatedTopicsFallback: 5,
    })
    const homeFeedPostPageSize = Math.min(100, Math.max(1, readOptionalNumberField(body, "homeFeedPostPageSize") ?? existingPostPageSizeSettings.homeFeed))
    const zonePostPageSize = Math.min(100, Math.max(1, readOptionalNumberField(body, "zonePostPageSize") ?? existingPostPageSizeSettings.zonePosts))
    const boardPostPageSize = Math.min(100, Math.max(1, readOptionalNumberField(body, "boardPostPageSize") ?? existingPostPageSizeSettings.boardPosts))
    const homeSidebarHotTopicsCount = Math.min(30, Math.max(1, readOptionalNumberField(body, "homeSidebarHotTopicsCount") ?? existingPostPageSizeSettings.hotTopics))
    const postSidebarRelatedTopicsCount = Math.min(30, Math.max(1, readOptionalNumberField(body, "postSidebarRelatedTopicsCount") ?? existingPostPageSizeSettings.postRelatedTopics))

    if (!siteName || !siteDescription) {
      apiError(400, "站点名称和描述不能为空")
    }

    const appStateWithHomeSidebarAnnouncement = mergeHomeSidebarAnnouncementSettings(existing.appStateJson, {
      enabled: homeSidebarAnnouncementsEnabled,
    })

    const appStateWithPostPageSizes = mergePostPageSizeSettings(appStateWithHomeSidebarAnnouncement, {
      homeFeed: homeFeedPostPageSize,
      zonePosts: zonePostPageSize,
      boardPosts: boardPostPageSize,
      comments: existingPostPageSizeSettings.comments,
      hotTopics: homeSidebarHotTopicsCount,
      postRelatedTopics: postSidebarRelatedTopicsCount,
    })

    const appStateWithHomeFeedPostListLoadMode = mergeHomeFeedPostListLoadSettings(appStateWithPostPageSizes, {
      loadMode: homeFeedPostListLoadMode,
    })

    const appStateWithSearch = mergeSiteSearchSettings(appStateWithHomeFeedPostListLoadMode, {
      enabled: searchEnabled,
      externalEngines: existingSearchSettings.externalEngines,
    })

    const appStateJson = mergeFooterCopyrightSettings(appStateWithSearch, {
      text: footerCopyrightText || existingFooterCopyrightSettings.text || `${siteName} @ ${new Date().getFullYear()}`,
      brandingVisible: footerBrandingVisible,
    })

    const settings = await updateSiteSettingsRecord(existing.id, {
      siteName,
      siteSlogan,
      siteDescription,
      siteLogoText: siteLogoText || siteName,
      siteLogoPath: siteLogoPath || null,
      siteSeoKeywords,
      analyticsCode: analyticsCode || null,
      postLinkDisplayMode,
      homeFeedPostListDisplayMode,
      homeSidebarStatsCardEnabled,
      appStateJson,
      postEditableMinutes,
      commentEditableMinutes,
    })

    return finalizeSiteSettingsUpdate({
      settings,
      message: "基础信息已保存",
      revalidatePaths: ["/", "/write", "/admin"],
    })
  }

  if (section === "site-apps") {
    const headerAppLinks = normalizeSiteHeaderAppLinks(body.headerAppLinks)
    const headerAppIconName = normalizeHeaderAppIconName(body.headerAppIconName)

    await updateSiteSettingsHeaderApps(existing.id, JSON.stringify(headerAppLinks), headerAppIconName)

    return finalizeSiteSettingsUpdate({
      settings: undefined,
      message: "应用入口已保存",
      revalidatePaths: ["/", "/admin"],
    })
  }

  if (section === "site-markdown-emoji") {
    const markdownEmojiMap = normalizeMarkdownEmojiItems(body.markdownEmojiMap)
    const markdownEmojiMapJson = serializeMarkdownEmojiItems(markdownEmojiMap)
    const settings = await updateSiteSettingsMarkdownEmoji(existing.id, markdownEmojiMapJson)

    return finalizeSiteSettingsUpdate({
      settings,
      message: "Markdown 表情已保存",
      revalidatePaths: ["/", "/write", "/admin"],
    })
  }

  if (section === "site-footer-links") {
    const footerLinks = normalizeFooterLinks(body.footerLinks)
    const settings = await updateSiteSettingsRecord(existing.id, {
      footerLinksJson: JSON.stringify(footerLinks),
    })

    return finalizeSiteSettingsUpdate({
      settings,
      message: "页脚导航已保存",
    })
  }

  return null
}
