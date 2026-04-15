import type { PostListDisplayMode } from "@/lib/post-list-display"
import type { PostListLoadMode } from "@/lib/post-list-load-mode"
import type { FooterLinkItem } from "@/lib/shared/config-parsers"
import type { LeftSidebarDisplayMode, PostSlugGenerationMode } from "@/lib/site-settings-app-state"
import type { SiteSearchSettings } from "@/lib/site-search-settings"
import type { SiteHeaderAppLinkItem } from "@/lib/site-header-app-links"

export type PostLinkDisplayMode = "SLUG" | "ID"

export interface SiteSettingsBaseData {
  siteName: string
  siteSlogan: string
  siteDescription: string
  siteLogoText: string
  siteLogoPath?: string | null
  siteIconPath?: string | null
  siteSeoKeywords: string[]
  pointName: string
  redeemCodeHelpEnabled: boolean
  redeemCodeHelpTitle: string
  redeemCodeHelpUrl: string
  postLinkDisplayMode: PostLinkDisplayMode
  homeFeedPostListDisplayMode: PostListDisplayMode
  homeFeedPostListLoadMode: PostListLoadMode
  homeFeedPostPageSize: number
  zonePostPageSize: number
  boardPostPageSize: number
  commentPageSize: number
  postTitleMinLength: number
  postTitleMaxLength: number
  postContentMinLength: number
  postContentMaxLength: number
  commentContentMinLength: number
  commentContentMaxLength: number
  homeSidebarHotTopicsCount: number
  postSidebarRelatedTopicsCount: number
  homeHotRecentWindowHours: number
  homeSidebarStatsCardEnabled: boolean
  homeSidebarAnnouncementsEnabled: boolean
  leftSidebarDisplayMode: LeftSidebarDisplayMode
  postSlugGenerationMode: PostSlugGenerationMode
  footerCopyrightText: string
  footerBrandingVisible: boolean
  footerLinks: FooterLinkItem[]
  headerAppLinks: SiteHeaderAppLinkItem[]
  headerAppIconName: string
  search: SiteSearchSettings
  analyticsCode?: string | null
  friendLinksEnabled: boolean
  friendLinkApplicationEnabled: boolean
  friendLinkAnnouncement: string
}
