import { promises as fs } from "node:fs"
import path from "node:path"

import { ensureDirectory, fileExists, getAddonsStateDirectory, readJsonFile } from "@/addons-host/runtime/fs"
import { prisma } from "@/db/client"
import { defaultSiteSettingsCreateInput } from "@/lib/site-settings-defaults"

const ADDONS_SECRETS_FILE_NAME = "addons-secrets.json"
const SITE_SETTINGS_SENSITIVE_KEY = "__siteSensitiveSettings"
const ADDON_SECRETS_STATE_KEY = "__addonSecrets"

interface AddonsSecretsFileShape {
  addons?: Record<string, Record<string, unknown>>
}

let addonSecretsMutationQueue: Promise<void> = Promise.resolve()

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function parseJsonRoot(raw: string | null | undefined) {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function getAddonsSecretsFilePath() {
  return path.join(getAddonsStateDirectory(), ADDONS_SECRETS_FILE_NAME)
}

async function readAddonSecretsFile() {
  const filePath = getAddonsSecretsFilePath()
  if (!(await fileExists(filePath))) {
    return {} as AddonsSecretsFileShape
  }

  try {
    return await readJsonFile<AddonsSecretsFileShape>(filePath)
  } catch {
    return {} as AddonsSecretsFileShape
  }
}

async function writeAddonSecretsFile(payload: AddonsSecretsFileShape) {
  await ensureDirectory(getAddonsStateDirectory())
  await fs.writeFile(getAddonsSecretsFilePath(), JSON.stringify(payload, null, 2), "utf8")
}

function runAddonSecretsMutation<T>(task: () => Promise<T>) {
  const run = addonSecretsMutationQueue.then(task, task)
  addonSecretsMutationQueue = run.then(() => undefined, () => undefined)
  return run
}

function readSensitiveSiteSettingsState(raw: string | null | undefined) {
  const root = parseJsonRoot(raw)
  const state = root[SITE_SETTINGS_SENSITIVE_KEY]
  return isRecord(state) ? state : {}
}

function readAddonSecretsState(raw: string | null | undefined) {
  const state = readSensitiveSiteSettingsState(raw)
  const addonSecrets = state[ADDON_SECRETS_STATE_KEY]
  return isRecord(addonSecrets) ? addonSecrets : {}
}

async function getOrCreateSiteSettingsSensitiveRecord() {
  const existing = await prisma.siteSetting.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      sensitiveStateJson: true,
    },
  })

  if (existing) {
    return existing
  }

  return prisma.siteSetting.create({
    data: defaultSiteSettingsCreateInput,
    select: {
      id: true,
      sensitiveStateJson: true,
    },
  })
}

function mergeAddonSecretState(
  sensitiveStateJson: string | null | undefined,
  addonId: string,
  secretKey: string,
  value: unknown,
) {
  const root = parseJsonRoot(sensitiveStateJson)
  const state = readSensitiveSiteSettingsState(sensitiveStateJson)
  const addonSecrets = readAddonSecretsState(sensitiveStateJson)
  const nextAddonSecretState = {
    ...(addonSecrets[addonId] && isRecord(addonSecrets[addonId]) ? addonSecrets[addonId] as Record<string, unknown> : {}),
    [secretKey]: value,
  }

  root[SITE_SETTINGS_SENSITIVE_KEY] = {
    ...state,
    [ADDON_SECRETS_STATE_KEY]: {
      ...addonSecrets,
      [addonId]: nextAddonSecretState,
    },
  }

  return JSON.stringify(root)
}

function removeAddonSecretState(
  sensitiveStateJson: string | null | undefined,
  addonId: string,
) {
  const root = parseJsonRoot(sensitiveStateJson)
  const state = readSensitiveSiteSettingsState(sensitiveStateJson)
  const addonSecrets = {
    ...readAddonSecretsState(sensitiveStateJson),
  }

  if (addonId in addonSecrets) {
    delete addonSecrets[addonId]
  }

  root[SITE_SETTINGS_SENSITIVE_KEY] = {
    ...state,
    [ADDON_SECRETS_STATE_KEY]: addonSecrets,
  }

  return JSON.stringify(root)
}

export async function readAddonSecretValue<T = unknown>(addonId: string, secretKey: string, fallback?: T) {
  try {
    const databaseRecord = await prisma.siteSetting.findFirst({
      orderBy: { createdAt: "asc" },
      select: {
        sensitiveStateJson: true,
      },
    })

    const sensitiveState = readAddonSecretsState(databaseRecord?.sensitiveStateJson)
    const databaseValue = sensitiveState[addonId] && isRecord(sensitiveState[addonId])
      ? (sensitiveState[addonId] as Record<string, unknown>)[secretKey]
      : undefined

    if (typeof databaseValue !== "undefined") {
      return (databaseValue as T) ?? (fallback as T)
    }
  } catch {
    // Fallback to file-based secret storage when database access is unavailable.
  }

  const filePayload = await readAddonSecretsFile()
  const fileValue = filePayload.addons?.[addonId]?.[secretKey]
  return (typeof fileValue === "undefined" ? fallback : fileValue) as T
}

export async function writeAddonSecretValue<T = unknown>(addonId: string, secretKey: string, value: T) {
  await runAddonSecretsMutation(async () => {
    const filePayload = await readAddonSecretsFile()
    const nextRoot = {
      ...(filePayload.addons ?? {}),
      [addonId]: {
        ...(filePayload.addons?.[addonId] ?? {}),
        [secretKey]: value,
      },
    }

    await writeAddonSecretsFile({
      addons: nextRoot,
    })

    try {
      const record = await getOrCreateSiteSettingsSensitiveRecord()
      await prisma.siteSetting.update({
        where: { id: record.id },
        data: {
          sensitiveStateJson: mergeAddonSecretState(record.sensitiveStateJson, addonId, secretKey, value),
        },
      })
    } catch {
      // Keep file fallback as the source of truth when database write is unavailable.
    }
  })
}

export async function deleteAddonSecretValues(addonId: string) {
  await runAddonSecretsMutation(async () => {
    const filePayload = await readAddonSecretsFile()
    const nextAddons = {
      ...(filePayload.addons ?? {}),
    }

    if (addonId in nextAddons) {
      delete nextAddons[addonId]

      if (Object.keys(nextAddons).length > 0) {
        await writeAddonSecretsFile({ addons: nextAddons })
      } else {
        await writeAddonSecretsFile({})
      }
    }

    try {
      const record = await prisma.siteSetting.findFirst({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          sensitiveStateJson: true,
        },
      })

      if (!record) {
        return
      }

      await prisma.siteSetting.update({
        where: { id: record.id },
        data: {
          sensitiveStateJson: removeAddonSecretState(record.sensitiveStateJson, addonId),
        },
      })
    } catch {
      // Ignore database cleanup failures when no database is available.
    }
  })
}
