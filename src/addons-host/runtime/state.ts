import {
  deleteAddonRegistryRecord,
  listAddonRegistryRecords,
  patchAddonRegistryStateRecord,
} from "@/db/addon-registry-queries"
import type { AddonStateRecord } from "@/addons-host/types"

export type AddonStateMap = Record<string, AddonStateRecord>

type AddonRegistryStateRecord = {
  addonId: string
  enabled: boolean
  installedAt: Date | null
  disabledAt: Date | null
  uninstalledAt: Date | null
  lastErrorAt: Date | null
  lastErrorMessage: string | null
}

function mapAddonRegistryRecordToStateRecord(record: AddonRegistryStateRecord): AddonStateRecord {
  return {
    enabled: record.enabled,
    installedAt: record.installedAt?.toISOString() ?? null,
    disabledAt: record.disabledAt?.toISOString() ?? null,
    uninstalledAt: record.uninstalledAt?.toISOString() ?? null,
    lastErrorAt: record.lastErrorAt?.toISOString() ?? null,
    lastErrorMessage: record.lastErrorMessage ?? null,
  }
}

function readAddonStateMapFromDatabaseRecords(records: AddonRegistryStateRecord[]) {
  return Object.fromEntries(
    records.map((record) => [
      record.addonId,
      mapAddonRegistryRecordToStateRecord(record),
    ]),
  ) satisfies AddonStateMap
}

export async function readAddonStateMap(): Promise<AddonStateMap> {
  const databaseRecords = await listAddonRegistryRecords()
  return databaseRecords ? readAddonStateMapFromDatabaseRecords(databaseRecords) : {}
}

export async function updateAddonState(addonId: string, patch: Partial<AddonStateRecord>) {
  const updatedRecord = await patchAddonRegistryStateRecord({
    addonId,
    ...("enabled" in patch ? { enabled: typeof patch.enabled === "boolean" ? patch.enabled : undefined } : {}),
    ...("installedAt" in patch ? { installedAt: parseOptionalIsoDate(patch.installedAt) } : {}),
    ...("disabledAt" in patch ? { disabledAt: parseOptionalIsoDate(patch.disabledAt) } : {}),
    ...("uninstalledAt" in patch ? { uninstalledAt: parseOptionalIsoDate(patch.uninstalledAt) } : {}),
    ...("lastErrorAt" in patch ? { lastErrorAt: parseOptionalIsoDate(patch.lastErrorAt) } : {}),
    ...("lastErrorMessage" in patch
      ? { lastErrorMessage: typeof patch.lastErrorMessage === "string" ? patch.lastErrorMessage : null }
      : {}),
  })

  if (updatedRecord) {
    return mapAddonRegistryRecordToStateRecord(updatedRecord)
  }

  return {
    ...("enabled" in patch ? { enabled: typeof patch.enabled === "boolean" ? patch.enabled : undefined } : {}),
    ...("installedAt" in patch ? { installedAt: typeof patch.installedAt === "string" ? patch.installedAt : patch.installedAt === null ? null : undefined } : {}),
    ...("disabledAt" in patch ? { disabledAt: typeof patch.disabledAt === "string" ? patch.disabledAt : patch.disabledAt === null ? null : undefined } : {}),
    ...("uninstalledAt" in patch ? { uninstalledAt: typeof patch.uninstalledAt === "string" ? patch.uninstalledAt : patch.uninstalledAt === null ? null : undefined } : {}),
    ...("lastErrorAt" in patch ? { lastErrorAt: typeof patch.lastErrorAt === "string" ? patch.lastErrorAt : patch.lastErrorAt === null ? null : undefined } : {}),
    ...("lastErrorMessage"
      in patch
      ? { lastErrorMessage: typeof patch.lastErrorMessage === "string" ? patch.lastErrorMessage : patch.lastErrorMessage === null ? null : undefined }
      : {}),
  }
}

export async function deleteAddonState(addonId: string) {
  const deletedRecord = await deleteAddonRegistryRecord(addonId)
  return Boolean(deletedRecord)
}

function parseOptionalIsoDate(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
