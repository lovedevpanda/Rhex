import { Prisma } from "@prisma/client"

import { prisma } from "@/db/client"

const prismaClient = prisma
let addonConfigTableAvailability: boolean | null = null

function isMissingAddonConfigTableError(error: unknown) {
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

async function detectAddonConfigTableAvailability() {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'addon_config'
    ) AS "exists"
  `

  return Boolean(rows[0]?.exists)
}

async function hasAddonConfigTable() {
  if (addonConfigTableAvailability === true) {
    return true
  }

  try {
    addonConfigTableAvailability = await detectAddonConfigTableAvailability()
  } catch {
    addonConfigTableAvailability = false
  }

  return addonConfigTableAvailability
}

export async function findAddonConfigRecord(addonId: string, configKey: string) {
  if (!(await hasAddonConfigTable())) {
    return null
  }

  try {
    return await prismaClient.addonConfig.findUnique({
      where: {
        addonId_configKey: {
          addonId,
          configKey,
        },
      },
      select: {
        addonId: true,
        configKey: true,
        valueJson: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  } catch (error) {
    if (isMissingAddonConfigTableError(error)) {
      addonConfigTableAvailability = false
      return null
    }

    throw error
  }
}

export async function listAddonConfigRecords(addonId: string) {
  if (!(await hasAddonConfigTable())) {
    return null
  }

  try {
    return await prismaClient.addonConfig.findMany({
      where: { addonId },
      orderBy: [{ configKey: "asc" }],
      select: {
        addonId: true,
        configKey: true,
        valueJson: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  } catch (error) {
    if (isMissingAddonConfigTableError(error)) {
      addonConfigTableAvailability = false
      return null
    }

    throw error
  }
}

export async function upsertAddonConfigRecord(addonId: string, configKey: string, value: unknown) {
  if (!(await hasAddonConfigTable())) {
    return null
  }

  try {
    return await prismaClient.addonConfig.upsert({
      where: {
        addonId_configKey: {
          addonId,
          configKey,
        },
      },
      create: {
        addonId,
        configKey,
        valueJson: toJsonValue(value),
      },
      update: {
        valueJson: toJsonValue(value),
      },
      select: {
        addonId: true,
        configKey: true,
        valueJson: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  } catch (error) {
    if (isMissingAddonConfigTableError(error)) {
      addonConfigTableAvailability = false
      return null
    }

    throw error
  }
}

export async function deleteAddonConfigRecords(addonId: string) {
  if (!(await hasAddonConfigTable())) {
    return null
  }

  try {
    return await prismaClient.addonConfig.deleteMany({
      where: { addonId },
    })
  } catch (error) {
    if (isMissingAddonConfigTableError(error)) {
      addonConfigTableAvailability = false
      return null
    }

    throw error
  }
}
