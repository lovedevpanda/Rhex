import { findSiteSettingsRecordForUpdate } from "@/db/site-settings-write-queries"

import { invalidateSiteSettingsCache } from "@/lib/site-settings"

export type SiteSettingsRecord = NonNullable<Awaited<ReturnType<typeof findSiteSettingsRecordForUpdate>>>

export interface SiteSettingsSectionUpdateResult {
  settings?: unknown
  message: string
  revalidatePaths?: string[]
}

export function finalizeSiteSettingsUpdate(result: SiteSettingsSectionUpdateResult) {
  invalidateSiteSettingsCache()
  return result
}

