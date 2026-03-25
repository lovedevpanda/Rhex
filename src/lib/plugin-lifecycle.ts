import fs from "node:fs/promises"
import path from "node:path"

import { prisma } from "@/db/client"
import { discoverPlugins, loadPluginServer } from "@/lib/plugin-loader"
import { purgePluginMigrations, runPluginMigrations } from "@/lib/plugin-migrations"
import { regeneratePluginBundles } from "@/lib/plugin-regeneration"
import { defaultSiteSettingsCreateInput } from "@/lib/site-settings-defaults"
import type { PluginConfigField, PluginLifecycleRecord, PluginManifest } from "@/lib/plugin-types"


const pluginsRoot = path.join(process.cwd(), "plugins")
const SITE_SETTINGS_SELECT = {
  id: true,
  pluginStateJson: true,
} as const

type PluginStateRecord = PluginLifecycleRecord

type PluginStateMap = Record<string, PluginStateRecord>

type PluginStateView = PluginManifest & PluginLifecycleRecord

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "1", "on"].includes(normalized)) return true
    if (["false", "0", "off"].includes(normalized)) return false
  }
  return fallback
}

function normalizeNumber(value: unknown, field: PluginConfigField) {
  const parsed = Number(value)
  const fallback = Number(field.defaultValue)
  const safeNumber = Number.isFinite(parsed) ? parsed : fallback
  if (typeof field.min === "number" && safeNumber < field.min) return field.min
  if (typeof field.max === "number" && safeNumber > field.max) return field.max
  return safeNumber
}

function normalizeText(value: unknown, field: PluginConfigField) {
  const resolved = String(value ?? field.defaultValue).trim()
  return resolved || String(field.defaultValue)
}

function normalizeFieldValue(field: PluginConfigField, value: unknown) {
  if (field.type === "boolean") return normalizeBoolean(value, Boolean(field.defaultValue))
  if (field.type === "number") return normalizeNumber(value, field)
  return normalizeText(value, field)
}

function sanitizeSegment(input: string) {
  return input.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "plugin"
}

async function pathExists(targetPath: string | null | undefined) {
  if (!targetPath) {
    return false
  }
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function parsePluginState(raw: string | null | undefined): PluginStateMap {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as PluginStateMap
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function serializePluginState(state: PluginStateMap) {
  return JSON.stringify(state)
}

async function getOrCreateSiteSettingsRecord() {
  const existing = await prisma.siteSetting.findFirst({
    orderBy: { createdAt: "asc" },
    select: SITE_SETTINGS_SELECT,
  })

  if (existing) return existing

  return prisma.siteSetting.create({
    data: defaultSiteSettingsCreateInput,
    select: SITE_SETTINGS_SELECT,
  })

}

async function readStateMap() {
  const settings = await getOrCreateSiteSettingsRecord()
  return {
    settings,
    state: parsePluginState(settings.pluginStateJson),
  }
}

async function writeStateMap(siteSettingId: string, state: PluginStateMap) {
  await prisma.siteSetting.update({
    where: { id: siteSettingId },
    data: { pluginStateJson: serializePluginState(state) },
  })
}

async function mergeConfig(pluginId: string, input: Record<string, unknown> | undefined) {
  const loaded = await loadPluginServer(pluginId)
  if (!loaded) {
    throw new Error("插件不存在")
  }

  const defaults = loaded.definition.getDefaultConfig()
  const nextConfig: Record<string, boolean | number | string> = {}
  loaded.manifest.configSchema.forEach((field) => {
    const rawValue = input?.[field.key] ?? defaults[field.key]
    nextConfig[field.key] = normalizeFieldValue(field, rawValue)
  })

  return { manifest: loaded.manifest, rootDir: loaded.rootDir, config: nextConfig }
}

function toPluginStateView(manifest: PluginManifest, saved: PluginStateRecord | undefined, rootDir: string | null, config: Record<string, boolean | number | string>): PluginStateView {
  return {
    ...manifest,
    pluginId: manifest.id,
    enabled: saved?.enabled ?? false,
    installedAt: saved?.installedAt ?? null,
    uninstalledAt: saved?.uninstalledAt ?? null,
    config,
    status: saved?.status ?? (saved?.enabled ? "active" : "discovered"),
    version: manifest.version,
    sourceDir: rootDir,
    lastActivatedAt: saved?.lastActivatedAt ?? null,
    lastErrorAt: saved?.lastErrorAt ?? null,
    lastErrorMessage: saved?.lastErrorMessage ?? null,
    failureCount: saved?.failureCount ?? 0,
  }
}

export async function listPluginStateRecords(): Promise<PluginStateView[]> {
  const [{ state }, plugins] = await Promise.all([
    readStateMap(),
    discoverPlugins(),
  ])

  const records = await Promise.all(plugins.map(async (plugin) => {
    const saved = state[plugin.manifest.id]
    const merged = await mergeConfig(plugin.manifest.id, saved?.config)
    return toPluginStateView(merged.manifest, saved, merged.rootDir, merged.config)
  }))

  return records.sort((left, right) => left.displayName.localeCompare(right.displayName, "zh-CN"))
}

export async function getPluginStateRecord(pluginId: string) {
  const records = await listPluginStateRecords()
  return records.find((item) => item.pluginId === pluginId || item.slug === pluginId) ?? null
}

export async function activatePlugin(pluginId: string) {
  const { settings, state } = await readStateMap()
  const merged = await mergeConfig(pluginId, state[pluginId]?.config)
  await regeneratePluginBundles()
  const migrationResult = await runPluginMigrations(pluginId)

  const now = new Date().toISOString()
  state[pluginId] = {
    pluginId,
    enabled: true,
    installedAt: state[pluginId]?.installedAt ?? now,
    uninstalledAt: null,
    config: merged.config,
    status: "active",
    version: merged.manifest.version,
    sourceDir: merged.rootDir,
    lastActivatedAt: now,
    lastErrorAt: null,
    lastErrorMessage: null,
    failureCount: 0,
  }

  await writeStateMap(settings.id, state)
  return {
    ...state[pluginId],
    migration: migrationResult,
  }
}

export async function disablePlugin(pluginId: string, reason?: string) {
  const { settings, state } = await readStateMap()
  const previous = state[pluginId] ?? {
    pluginId,
    enabled: false,
    installedAt: null,
    uninstalledAt: null,
    config: {},
    status: "disabled" as const,
    version: null,
    sourceDir: null,
    lastActivatedAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    failureCount: 0,
  }

  state[pluginId] = {
    ...previous,
    enabled: false,
    status: "disabled",
    uninstalledAt: new Date().toISOString(),
    lastErrorMessage: reason ?? previous.lastErrorMessage,
  }

  await writeStateMap(settings.id, state)
  return state[pluginId]
}

export async function uninstallPluginWithLifecycle(pluginId: string, options: { mode?: "clean-db" | "delete-files" } = {}) {
  const mode = options.mode ?? "clean-db"
  const plugin = await getPluginStateRecord(pluginId)
  if (!plugin) {
    throw new Error("插件不存在")
  }

  const { settings, state } = await readStateMap()
  const now = new Date().toISOString()

  state[plugin.pluginId] = {
    pluginId: plugin.pluginId,
    enabled: false,
    installedAt: plugin.installedAt,
    uninstalledAt: now,
    config: plugin.config,
    status: "disabled",
    version: plugin.version,
    sourceDir: plugin.sourceDir,
    lastActivatedAt: plugin.lastActivatedAt,
    lastErrorAt: plugin.lastErrorAt,
    lastErrorMessage: plugin.lastErrorMessage,
    failureCount: plugin.failureCount,
  }

  await writeStateMap(settings.id, state)
  const purgeResult = await purgePluginMigrations(plugin.pluginId)

  if (mode === "delete-files") {
    const targetDir = path.join(pluginsRoot, sanitizeSegment(plugin.slug))
    if (await pathExists(targetDir)) {
      await fs.rm(targetDir, { recursive: true, force: true })
    }
    delete state[plugin.pluginId]
    await writeStateMap(settings.id, state)
  }

  await regeneratePluginBundles()

  return mode === "delete-files"
    ? { pluginId: plugin.pluginId, mode: "delete-files" as const, removed: true, migration: purgeResult }
    : { ...state[plugin.pluginId], migration: purgeResult }
}

export async function updatePluginConfigState(pluginId: string, input: Record<string, unknown>) {
  const { settings, state } = await readStateMap()
  const previous = state[pluginId]

  if (!previous?.enabled) {
    throw new Error("插件未激活，不能保存配置")
  }

  const merged = await mergeConfig(pluginId, {
    ...previous.config,
    ...input,
  })

  state[pluginId] = {
    ...previous,
    config: merged.config,
    version: merged.manifest.version,
    sourceDir: merged.rootDir,
  }

  await writeStateMap(settings.id, state)
  return state[pluginId]
}

export async function markPluginStateError(pluginId: string, error: unknown) {
  const { settings, state } = await readStateMap()
  const previous = state[pluginId] ?? {
    pluginId,
    enabled: false,
    installedAt: null,
    uninstalledAt: null,
    config: {},
    status: "disabled" as const,
    version: null,
    sourceDir: null,
    lastActivatedAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    failureCount: 0,
  }

  const message = error instanceof Error ? error.message : String(error)
  const failureCount = (previous.failureCount ?? 0) + 1
  state[pluginId] = {
    ...previous,
    enabled: false,
    status: "error",
    lastErrorAt: new Date().toISOString(),
    lastErrorMessage: message,
    failureCount,
  }

  await writeStateMap(settings.id, state)
  return state[pluginId]
}
