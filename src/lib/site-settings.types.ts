import type { SiteSettingsBaseData } from "@/lib/site-settings.base"
import type { SiteSettingsCommunityData } from "@/lib/site-settings.community"
import type { SiteSettingsContentData } from "@/lib/site-settings.content"
import type { SiteSettingsRegistrationData } from "@/lib/site-settings.registration"
import type { ServerSiteSettingsSensitiveData } from "@/lib/site-settings.server"
import type { SiteSettingsUploadData } from "@/lib/site-settings.upload"
import type { SiteSettingsVipData } from "@/lib/site-settings.vip"

export type { PostLinkDisplayMode } from "@/lib/site-settings.base"
export type { SiteSettingsMarkdownEmojiItem } from "@/lib/site-settings.upload"

export interface SiteSettingsData extends
  SiteSettingsBaseData,
  SiteSettingsCommunityData,
  SiteSettingsVipData,
  SiteSettingsRegistrationData,
  SiteSettingsContentData,
  SiteSettingsUploadData {}

export interface ServerSiteSettingsData extends SiteSettingsData, ServerSiteSettingsSensitiveData {}
