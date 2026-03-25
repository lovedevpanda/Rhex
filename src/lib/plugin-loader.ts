import fs from "node:fs/promises"
import path from "node:path"

import { pluginBundleRegistry } from "@/lib/plugin-bundle-registry"
import { markPluginStateError } from "@/lib/plugin-lifecycle"
import type { PluginManifest, PluginPageComponent, PluginServerDefinition } from "@/lib/plugin-types"

export interface DiscoveredPlugin {
  manifest: PluginManifest
  rootDir: string
}

const pluginsRoot = path.join(process.cwd(), "plugins")

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function isPluginManifest(input: unknown): input is PluginManifest {
  if (!input || typeof input !== "object") {
    return false
  }

  const manifest = input as Record<string, unknown>
  return typeof manifest.id === "string"
    && typeof manifest.slug === "string"
    && typeof manifest.packageName === "string"
    && typeof manifest.displayName === "string"
    && typeof manifest.version === "string"
    && typeof manifest.description === "string"
    && typeof manifest.scope === "string"
    && typeof manifest.uninstallStrategy === "string"
    && (typeof manifest.publicDir === "string" || typeof manifest.publicDir === "undefined")
    && !!manifest.entry
    && typeof manifest.entry === "object"
    && !!manifest.capabilities
    && typeof manifest.capabilities === "object"
    && Array.isArray(manifest.configSchema)
}

async function loadManifestFromDir(rootDir: string): Promise<DiscoveredPlugin | null> {
  const manifestPath = path.join(rootDir, "plugin.manifest.json")
  if (!await pathExists(manifestPath)) {
    return null
  }

  const raw = await fs.readFile(manifestPath, "utf8")
  const parsed = JSON.parse(raw) as unknown
  if (!isPluginManifest(parsed)) {
    throw new Error(`插件 manifest 不合法：${manifestPath}`)
  }

  return {
    manifest: parsed,
    rootDir,
  }
}

export async function discoverPlugins(): Promise<DiscoveredPlugin[]> {
  if (!await pathExists(pluginsRoot)) {
    return []
  }

  const entries = await fs.readdir(pluginsRoot, { withFileTypes: true })
  const plugins = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => loadManifestFromDir(path.join(pluginsRoot, entry.name))),
  )

  const resolved = plugins.filter((item): item is DiscoveredPlugin => Boolean(item))
  const pluginIdSet = new Set<string>()
  resolved.forEach((item) => {
    if (pluginIdSet.has(item.manifest.id)) {
      throw new Error(`检测到重复插件 ID：${item.manifest.id}`)
    }
    pluginIdSet.add(item.manifest.id)
  })

  return resolved.sort((left, right) => left.manifest.displayName.localeCompare(right.manifest.displayName, "zh-CN"))
}

export async function loadPluginServer(pluginId: string): Promise<{ manifest: PluginManifest; definition: PluginServerDefinition; rootDir: string } | null> {
  const plugins = await discoverPlugins()
  const plugin = plugins.find((item) => item.manifest.id === pluginId || item.manifest.slug === pluginId)
  if (!plugin) {
    return null
  }

  try {
    const bundled = pluginBundleRegistry[plugin.manifest.id] ?? pluginBundleRegistry[plugin.manifest.slug]
    if (!bundled?.server) {
      throw new Error(`插件未注册到宿主 bundle：${plugin.manifest.id}`)
    }

    return {
      manifest: plugin.manifest,
      definition: bundled.server,
      rootDir: plugin.rootDir,
    }
  } catch (error) {
    await markPluginStateError(plugin.manifest.id, error)
    throw error
  }
}

export async function loadPluginPage(pluginId: string, pageType: "web" | "admin"): Promise<{ manifest: PluginManifest; component: PluginPageComponent } | null> {
  const plugins = await discoverPlugins()
  const plugin = plugins.find((item) => item.manifest.id === pluginId || item.manifest.slug === pluginId)
  if (!plugin) {
    return null
  }

  try {
    const bundled = pluginBundleRegistry[plugin.manifest.id] ?? pluginBundleRegistry[plugin.manifest.slug]
    const component = pageType === "admin" ? bundled?.admin : bundled?.web
    if (!component) {
      return null
    }

    return {
      manifest: plugin.manifest,
      component,
    }
  } catch (error) {
    await markPluginStateError(plugin.manifest.id, error)
    throw error
  }
}

export async function validatePluginManifest(input: unknown) {
  if (!isPluginManifest(input)) {
    throw new Error("插件 manifest 不合法")
  }
  return input
}
