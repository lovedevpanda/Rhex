import type { JsonObject } from "@/lib/api-route"

import { createSiteSettingsRecordWithFullData, findSiteSettingsRecordForUpdate } from "@/db/site-settings-write-queries"
import { updateBoardApplicationSiteSettingsSection } from "@/lib/admin-site-settings-board-applications"
import { defaultSiteSettingsCreateInput } from "@/lib/site-settings-defaults"
import { updateInteractionSiteSettingsSection } from "@/lib/admin-site-settings-interaction"
import { updateProfileSiteSettingsSection } from "@/lib/admin-site-settings-profile"
import { updateRegistrationSiteSettingsSection } from "@/lib/admin-site-settings-registration"
import { updateUploadSiteSettingsSection } from "@/lib/admin-site-settings-upload"
import { updateVipSiteSettingsSection } from "@/lib/admin-site-settings-vip"
import { apiError, readOptionalStringField } from "@/lib/api-route"

export async function getOrCreateSiteSettings() {
  const existing = await findSiteSettingsRecordForUpdate()
  if (existing) {
    return existing
  }

  return createSiteSettingsRecordWithFullData(defaultSiteSettingsCreateInput)
}

export async function updateSiteSettingsBySection(body: JsonObject) {
  const section = readOptionalStringField(body, "section") || "site-profile"
  const existing = await getOrCreateSiteSettings()

  const handlers = [
    updateProfileSiteSettingsSection,
    updateRegistrationSiteSettingsSection,
    updateBoardApplicationSiteSettingsSection,
    updateInteractionSiteSettingsSection,
    updateVipSiteSettingsSection,
    updateUploadSiteSettingsSection,
  ]

  for (const handler of handlers) {
    const result = await handler(existing, body, section)
    if (result) {
      return result
    }
  }

  apiError(400, "不支持的设置分组")
}
