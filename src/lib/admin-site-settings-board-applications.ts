import { updateSiteSettingsRecord } from "@/db/site-settings-write-queries"
import { finalizeSiteSettingsUpdate, type SiteSettingsRecord } from "@/lib/admin-site-settings-shared"
import { type JsonObject } from "@/lib/api-route"
import { mergeBoardApplicationSettings, resolveBoardApplicationSettings } from "@/lib/site-settings-app-state"

export async function updateBoardApplicationSiteSettingsSection(existing: SiteSettingsRecord, body: JsonObject, section: string) {
  if (section !== "site-board-applications") {
    return null
  }

  const existingBoardApplicationSettings = resolveBoardApplicationSettings({
    appStateJson: existing.appStateJson,
    enabledFallback: true,
  })
  const boardApplicationEnabled = body.boardApplicationEnabled === undefined
    ? existingBoardApplicationSettings.enabled
    : Boolean(body.boardApplicationEnabled)

  const settings = await updateSiteSettingsRecord(existing.id, {
    appStateJson: mergeBoardApplicationSettings(existing.appStateJson, {
      enabled: boardApplicationEnabled,
    }),
  })

  return finalizeSiteSettingsUpdate({
    settings,
    message: "节点申请设置已保存",
  })
}
