import "server-only"

import {
  deleteAddonConfigRecords,
  findAddonConfigRecord,
  upsertAddonConfigRecord,
} from "@/db/addon-config-queries"

export async function readAddonConfigValue<T = unknown>(addonId: string, configKey: string, fallback?: T) {
  const databaseRecord = await findAddonConfigRecord(addonId, configKey)
  if (!databaseRecord) {
    return fallback as T
  }

  return (databaseRecord.valueJson as T | null | undefined) ?? (fallback as T)
}

export async function writeAddonConfigValue<T = unknown>(addonId: string, configKey: string, value: T) {
  await upsertAddonConfigRecord(addonId, configKey, value)
}

export async function deleteAddonConfigValues(addonId: string) {
  await deleteAddonConfigRecords(addonId)
}
