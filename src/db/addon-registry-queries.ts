import { Prisma } from "@prisma/client"

import { prisma } from "@/db/client"

type AddonRegistryState = "ENABLED" | "DISABLED" | "UNINSTALLED" | "ERROR"
const prismaClient = prisma
let addonRegistryTableAvailability: boolean | null = null
let addonLifecycleLogTableAvailability: boolean | null = null

const addonRegistrySelect = {
  addonId: true,
  name: true,
  version: true,
  description: true,
  sourceDir: true,
  state: true,
  enabled: true,
  manifestJson: true,
  permissionsJson: true,
  installedAt: true,
  disabledAt: true,
  uninstalledAt: true,
  lastErrorAt: true,
  lastErrorMessage: true,
  createdAt: true,
  updatedAt: true,
} as const

const addonLifecycleLogSelect = {
  id: true,
  addonId: true,
  action: true,
  status: true,
  message: true,
  metadataJson: true,
  createdAt: true,
} as const

type AddonRegistryUpsertInput = {
  addonId: string
  name: string
  version: string
  description?: string | null
  sourceDir?: string | null
  state: AddonRegistryState
  enabled: boolean
  manifestJson?: unknown
  permissionsJson?: unknown
  installedAt?: Date | null
  disabledAt?: Date | null
  uninstalledAt?: Date | null
  lastErrorAt?: Date | null
  lastErrorMessage?: string | null
}

type AddonRegistryStatePatchInput = {
  addonId: string
  enabled?: boolean
  installedAt?: Date | null
  disabledAt?: Date | null
  uninstalledAt?: Date | null
  lastErrorAt?: Date | null
  lastErrorMessage?: string | null
}

type AddonLifecycleLogInput = {
  addonId: string
  action: string
  status: string
  message?: string | null
  metadataJson?: unknown
}

function isMissingAddonRegistryTableError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && (error.code === "P2021" || error.code === "P2022")
}

function toJsonValue(value: unknown) {
  if (typeof value === "undefined") {
    return undefined
  }

  if (value === null) {
    return Prisma.JsonNull
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function deriveAddonRegistryState(input: {
  enabled: boolean
  uninstalledAt: Date | null
  lastErrorMessage: string | null
}): AddonRegistryState {
  if (input.uninstalledAt) {
    return "UNINSTALLED"
  }

  if (input.lastErrorMessage) {
    return "ERROR"
  }

  return input.enabled ? "ENABLED" : "DISABLED"
}

async function detectTableAvailability(tableName: "addon_registry" | "addon_lifecycle_log") {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS "exists"
  `

  return Boolean(rows[0]?.exists)
}

async function hasAddonRegistryTable() {
  if (addonRegistryTableAvailability === true) {
    return addonRegistryTableAvailability
  }

  try {
    addonRegistryTableAvailability = await detectTableAvailability("addon_registry")
  } catch {
    addonRegistryTableAvailability = false
  }

  return addonRegistryTableAvailability
}

async function hasAddonLifecycleLogTable() {
  if (addonLifecycleLogTableAvailability === true) {
    return addonLifecycleLogTableAvailability
  }

  try {
    addonLifecycleLogTableAvailability = await detectTableAvailability("addon_lifecycle_log")
  } catch {
    addonLifecycleLogTableAvailability = false
  }

  return addonLifecycleLogTableAvailability
}

export async function listAddonRegistryRecords() {
  if (!(await hasAddonRegistryTable())) {
    return null
  }

  try {
    return await prismaClient.addonRegistry.findMany({
      orderBy: [{ addonId: "asc" }],
      select: addonRegistrySelect,
    })
  } catch (error) {
    if (isMissingAddonRegistryTableError(error)) {
      return null
    }

    throw error
  }
}

export async function findAddonRegistryRecord(addonId: string) {
  if (!(await hasAddonRegistryTable())) {
    return null
  }

  try {
    return await prismaClient.addonRegistry.findUnique({
      where: { addonId },
      select: addonRegistrySelect,
    })
  } catch (error) {
    if (isMissingAddonRegistryTableError(error)) {
      return null
    }

    throw error
  }
}

export async function upsertAddonRegistryRecord(input: AddonRegistryUpsertInput) {
  if (!(await hasAddonRegistryTable())) {
    return null
  }

  try {
    return await prismaClient.addonRegistry.upsert({
      where: { addonId: input.addonId },
      create: {
        addonId: input.addonId,
        name: input.name,
        version: input.version,
        description: input.description ?? null,
        sourceDir: input.sourceDir ?? null,
        state: input.state,
        enabled: input.enabled,
        manifestJson: toJsonValue(input.manifestJson),
        permissionsJson: toJsonValue(input.permissionsJson ?? []),
        installedAt: input.installedAt ?? null,
        disabledAt: input.disabledAt ?? null,
        uninstalledAt: input.uninstalledAt ?? null,
        lastErrorAt: input.lastErrorAt ?? null,
        lastErrorMessage: input.lastErrorMessage ?? null,
      },
      update: {
        name: input.name,
        version: input.version,
        description: input.description ?? null,
        sourceDir: input.sourceDir ?? null,
        state: input.state,
        enabled: input.enabled,
        manifestJson: toJsonValue(input.manifestJson),
        permissionsJson: toJsonValue(input.permissionsJson ?? []),
        installedAt: input.installedAt ?? null,
        disabledAt: input.disabledAt ?? null,
        uninstalledAt: input.uninstalledAt ?? null,
        lastErrorAt: input.lastErrorAt ?? null,
        lastErrorMessage: input.lastErrorMessage ?? null,
      },
      select: addonRegistrySelect,
    })
  } catch (error) {
    if (isMissingAddonRegistryTableError(error)) {
      return null
    }

    throw error
  }
}

export async function patchAddonRegistryStateRecord(input: AddonRegistryStatePatchInput) {
  if (!(await hasAddonRegistryTable())) {
    return null
  }

  try {
    const existingRecord = await prismaClient.addonRegistry.findUnique({
      where: { addonId: input.addonId },
      select: addonRegistrySelect,
    })

    if (!existingRecord) {
      return null
    }

    const nextEnabled = typeof input.enabled === "boolean" ? input.enabled : existingRecord.enabled
    const nextInstalledAt = "installedAt" in input ? input.installedAt ?? null : existingRecord.installedAt
    const nextDisabledAt = "disabledAt" in input ? input.disabledAt ?? null : existingRecord.disabledAt
    const nextUninstalledAt = "uninstalledAt" in input ? input.uninstalledAt ?? null : existingRecord.uninstalledAt
    const nextLastErrorAt = "lastErrorAt" in input ? input.lastErrorAt ?? null : existingRecord.lastErrorAt
    const nextLastErrorMessage = "lastErrorMessage" in input
      ? input.lastErrorMessage ?? null
      : existingRecord.lastErrorMessage

    return await prismaClient.addonRegistry.update({
      where: { addonId: input.addonId },
      data: {
        enabled: nextEnabled,
        state: deriveAddonRegistryState({
          enabled: nextEnabled,
          uninstalledAt: nextUninstalledAt,
          lastErrorMessage: nextLastErrorMessage,
        }),
        installedAt: nextInstalledAt,
        disabledAt: nextDisabledAt,
        uninstalledAt: nextUninstalledAt,
        lastErrorAt: nextLastErrorAt,
        lastErrorMessage: nextLastErrorMessage,
      },
      select: addonRegistrySelect,
    })
  } catch (error) {
    if (isMissingAddonRegistryTableError(error)) {
      addonRegistryTableAvailability = false
      return null
    }

    throw error
  }
}

export async function deleteAddonRegistryRecord(addonId: string) {
  if (!(await hasAddonRegistryTable())) {
    return null
  }

  try {
    return await prismaClient.addonRegistry.delete({
      where: { addonId },
      select: addonRegistrySelect,
    })
  } catch (error) {
    if (isMissingAddonRegistryTableError(error)) {
      addonRegistryTableAvailability = false
      return null
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return null
    }

    throw error
  }
}

export async function createAddonLifecycleLog(input: AddonLifecycleLogInput) {
  if (!(await hasAddonLifecycleLogTable())) {
    return null
  }

  try {
    return await prismaClient.addonLifecycleLog.create({
      data: {
        addonId: input.addonId,
        action: input.action,
        status: input.status,
        message: input.message ?? null,
        metadataJson: toJsonValue(input.metadataJson),
      },
      select: addonLifecycleLogSelect,
    })
  } catch (error) {
    if (isMissingAddonRegistryTableError(error)) {
      return null
    }

    throw error
  }
}

export async function listAddonLifecycleLogs(addonId: string, limit = 20) {
  if (!(await hasAddonLifecycleLogTable())) {
    return null
  }

  try {
    return await prismaClient.addonLifecycleLog.findMany({
      where: { addonId },
      orderBy: [{ createdAt: "desc" }],
      take: limit,
      select: addonLifecycleLogSelect,
    })
  } catch (error) {
    if (isMissingAddonRegistryTableError(error)) {
      return null
    }

    throw error
  }
}
