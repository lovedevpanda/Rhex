// ============================================================================
// loader.ts — addons runtime 门面
//
// 本文件职责（薄壳）：
//   1. 协调 internal/* 子模块，提供 loadAddonsRuntimeFresh() 扫描落地流程。
//   2. 通过 React `cache` 暴露 loadAddonsRegistry() / loadAddonsRuntime() 等稳定入口。
//   3. 保留对外 API 门面（re-export），保障 execute.ts/hooks.ts/routes.ts 等消费者零改动。
//
// 历史重构（Phase A/B）后，大多数业务细节已下沉到 runtime/internal/*：
//   - manifest-loader / permission-guard / execution-context / data-migrations
//   - route-index / map-utils / board-select / build-api-factory / registry-aggregator
// ============================================================================
import "server-only"

import { promises as fs } from "node:fs"
import path from "node:path"
import { cache } from "react"

import {
  fileExists,
  getAddonsRootDirectory,
  isValidAddonId,
  readJsonFile,
} from "@/addons-host/runtime/fs"
import { runWithAddonExecutionScope } from "@/addons-host/runtime/execution-scope"
import { normalizeAddonManifest } from "@/addons-host/runtime/manifest"
import { readAddonStateMap } from "@/addons-host/runtime/state"
import {
  ADDON_RUNTIME_LOG_DEDUPE_WINDOW_MS,
  createAddonLifecycleLog,
} from "@/db/addon-registry-queries"
import {
  buildAddonRelationCatalog,
  validateAddonManifestRelations,
} from "@/addons-host/runtime/relations"
import type {
  AddonManifest,
  AddonStateRecord,
  LoadedAddonRuntime,
} from "@/addons-host/types"

// ---- 门面 re-export：保持对外 API 稳定 ----------------------------------
export {
  buildLoadedAddonsRegistry,
} from "@/addons-host/runtime/internal/registry-aggregator"
export type {
  IndexedAddonSlotCandidate,
  IndexedAddonSurfaceCandidate,
  IndexedAddonProviderCandidate,
  IndexedAddonActionHookCandidate,
  IndexedAddonWaterfallHookCandidate,
  IndexedAddonAsyncWaterfallHookCandidate,
  LoadedAddonsRegistry,
} from "@/addons-host/runtime/internal/registry-aggregator"
export { createAddonBuildApi } from "@/addons-host/runtime/internal/build-api-factory"
export { buildAddonExecutionContext } from "@/addons-host/runtime/internal/execution-context"

// ---- 内部依赖（loader 主流程自身使用）-----------------------------------
import { buildLoadedAddonsRegistry } from "@/addons-host/runtime/internal/registry-aggregator"
import type { LoadedAddonsRegistry } from "@/addons-host/runtime/internal/registry-aggregator"
import { createAddonBuildApi } from "@/addons-host/runtime/internal/build-api-factory"
import {
  buildAddonRuntimeDescriptor,
  importAddonDefinition,
  resolveAddonServerEntryPath,
} from "@/addons-host/runtime/internal/manifest-loader"
import { buildAddonPermissionCache } from "@/addons-host/runtime/internal/permission-guard"
import { applyAddonDataMigrations } from "@/addons-host/runtime/internal/data-migrations"
import {
  ADDON_TRUST_BOUNDARY_MESSAGE,
  getAddonManifestPermissionDeclarationErrors,
  getAddonTrustedCodeExecutionStatus,
} from "@/addons-host/runtime/permissions"

interface DiscoveredAddonManifestEntry {
  entryName: string
  rootDir: string
  state: AddonStateRecord
  manifest: AddonManifest | null
  manifestError: string | null
}

async function recordAddonLoadError(
  runtime: LoadedAddonRuntime,
  message: string,
  metadata?: Record<string, unknown>,
) {
  runtime.loadError = message
  runtime.state = {
    ...runtime.state,
    lastErrorAt: new Date().toISOString(),
    lastErrorMessage: message,
  }

  await createAddonLifecycleLog({
    addonId: runtime.manifest.id,
    action: "LOAD",
    status: "FAILED",
    message,
    dedupeWindowMs: ADDON_RUNTIME_LOG_DEDUPE_WINDOW_MS,
    metadataJson: {
      entryServerPath: runtime.entryServerPath,
      ...(metadata ?? {}),
    },
  })
}

async function applyAddonRuntimeRelationErrors(runtimes: LoadedAddonRuntime[]) {
  let changed = false

  while (true) {
    const relationCatalog = buildAddonRelationCatalog(
      runtimes.map((runtime) => ({
        manifest: runtime.manifest,
        enabled: runtime.enabled,
        loadError: runtime.loadError,
      })),
    )

    let iterationChanged = false

    for (const runtime of runtimes) {
      if (!runtime.enabled || runtime.loadError) {
        continue
      }

      const relationCheck = validateAddonManifestRelations({
        manifest: runtime.manifest,
        enabled: true,
        catalog: relationCatalog,
        includeDependencyLoadErrors: true,
      })

      if (relationCheck.blockingIssues.length === 0) {
        continue
      }

      await recordAddonLoadError(runtime, relationCheck.blockingIssues.join("；"), {
        relationIssues: relationCheck.blockingIssues,
      })
      iterationChanged = true
      changed = true
    }

    if (!iterationChanged) {
      break
    }
  }

  return changed
}

export async function loadAddonsRuntimeFresh(): Promise<LoadedAddonRuntime[]> {
  const addonsRoot = getAddonsRootDirectory()
  if (!(await fileExists(addonsRoot))) {
    return []
  }

  const [entries, stateMap] = await Promise.all([
    fs.readdir(addonsRoot, { withFileTypes: true }),
    readAddonStateMap(),
  ])

  const discoveredAddons: DiscoveredAddonManifestEntry[] = []

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "zh-CN"))) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue
    }

    const rootDir = path.join(addonsRoot, entry.name)
    const manifestPath = path.join(rootDir, "addon.json")
    if (!(await fileExists(manifestPath))) {
      continue
    }

    try {
      discoveredAddons.push({
        entryName: entry.name,
        rootDir,
        state: stateMap[entry.name] ?? {},
        manifest: normalizeAddonManifest(await readJsonFile<unknown>(manifestPath)),
        manifestError: null,
      })
    } catch (error) {
      discoveredAddons.push({
        entryName: entry.name,
        rootDir,
        state: stateMap[entry.name] ?? {},
        manifest: null,
        manifestError: error instanceof Error ? error.message : "invalid addon manifest",
      })
    }
  }

  const relationCatalog = buildAddonRelationCatalog(
    discoveredAddons.flatMap((item) => {
      if (!item.manifest) {
        return []
      }

      return [{
        manifest: item.manifest,
        enabled: buildAddonRuntimeDescriptor(item.manifest, item.rootDir, item.state).enabled,
      }]
    }),
  )

  const runtimes: LoadedAddonRuntime[] = []

  for (const discoveredAddon of discoveredAddons) {
    if (!discoveredAddon.manifest) {
      const fallbackManifest: AddonManifest = {
        id: discoveredAddon.entryName,
        name: discoveredAddon.entryName,
        version: "0.0.0",
        description: "Invalid addon manifest",
      }
      const descriptor = buildAddonRuntimeDescriptor(
        fallbackManifest,
        discoveredAddon.rootDir,
        discoveredAddon.state,
      )
      const permissionCache = buildAddonPermissionCache(fallbackManifest)
      runtimes.push({
        ...descriptor,
        permissionSet: permissionCache.permissionSet,
        resolvedPermissions: permissionCache.resolvedPermissions,
        entryServerPath: null,
        warnings: [],
        slots: [],
        surfaces: [],
        publicPages: [],
        adminPages: [],
        publicApis: [],
        adminApis: [],
        backgroundJobs: [],
        providers: [],
        actionHooks: [],
        waterfallHooks: [],
        asyncWaterfallHooks: [],
        dataMigrations: [],
        loadError: discoveredAddon.manifestError ?? "invalid addon manifest",
      })
      continue
    }

    const manifest = discoveredAddon.manifest
    const state = stateMap[manifest.id] ?? discoveredAddon.state
    const warnings: string[] = [ADDON_TRUST_BOUNDARY_MESSAGE]
    const permissionDeclarationErrors = getAddonManifestPermissionDeclarationErrors(manifest.permissions)
    warnings.push(...permissionDeclarationErrors)
    const permissionCache = buildAddonPermissionCache(manifest)
    if (!isValidAddonId(manifest.id)) {
      warnings.push(`addon id "${manifest.id}" is not a recommended identifier`)
    }
    if (manifest.id !== discoveredAddon.entryName) {
      warnings.push(`addon folder "${discoveredAddon.entryName}" does not match manifest id "${manifest.id}"`)
    }

    const descriptor = buildAddonRuntimeDescriptor(manifest, discoveredAddon.rootDir, state)
    const relationCheck = validateAddonManifestRelations({
      manifest,
      enabled: descriptor.enabled,
      catalog: relationCatalog,
    })
    warnings.push(...relationCheck.warnings)
    const serverEntryPath = await resolveAddonServerEntryPath(discoveredAddon.rootDir, manifest)
    const runtime: LoadedAddonRuntime = {
      ...descriptor,
      permissionSet: permissionCache.permissionSet,
      resolvedPermissions: permissionCache.resolvedPermissions,
      entryServerPath: serverEntryPath,
      warnings,
      slots: [],
      surfaces: [],
      publicPages: [],
      adminPages: [],
      publicApis: [],
      adminApis: [],
      backgroundJobs: [],
      providers: [],
      actionHooks: [],
      waterfallHooks: [],
      asyncWaterfallHooks: [],
      dataMigrations: [],
      loadError: null,
    }

    if (!runtime.enabled) {
      runtimes.push(runtime)
      continue
    }

    if (relationCheck.blockingIssues.length > 0) {
      await recordAddonLoadError(runtime, relationCheck.blockingIssues.join("；"), {
        relationIssues: relationCheck.blockingIssues,
      })
      runtimes.push(runtime)
      continue
    }

    if (permissionDeclarationErrors.length > 0) {
      await recordAddonLoadError(runtime, permissionDeclarationErrors.join("; "), {
        permissionDeclarationErrors,
        trustModel: "trusted-server-code",
      })
      runtimes.push(runtime)
      continue
    }

    const trustedCodeStatus = getAddonTrustedCodeExecutionStatus()
    if (!trustedCodeStatus.acknowledged) {
      await recordAddonLoadError(runtime, trustedCodeStatus.message, {
        trustModel: "trusted-server-code",
        requiredEnvironmentVariable: trustedCodeStatus.environmentVariable,
        requiredAcknowledgement: trustedCodeStatus.requiredValue,
      })
      runtimes.push(runtime)
      continue
    }

    if (!serverEntryPath) {
      runtime.loadError = "addon server entry not found"
      runtimes.push(runtime)
      continue
    }

    try {
      await createAddonLifecycleLog({
        addonId: runtime.manifest.id,
        action: "TRUST_BOUNDARY",
        status: "ACKNOWLEDGED",
        message: `Addon "${runtime.manifest.id}" is executing under the trusted-server-code model. ${ADDON_TRUST_BOUNDARY_MESSAGE}`,
        dedupeWindowMs: ADDON_RUNTIME_LOG_DEDUPE_WINDOW_MS,
        metadataJson: {
          trustModel: "trusted-server-code",
          permissionsAreSandbox: false,
          resolvedPermissions: runtime.resolvedPermissions,
        },
      })
      const { api, snapshot } = createAddonBuildApi(manifest, warnings)
      const definition = await runWithAddonExecutionScope(runtime, {
        action: "module-import",
      }, () => importAddonDefinition(discoveredAddon.rootDir, serverEntryPath))
      await runWithAddonExecutionScope(runtime, {
        action: "setup",
      }, async () => {
        await definition.setup(api)
      })
      runtime.slots = snapshot.slots
      runtime.surfaces = snapshot.surfaces
      runtime.publicPages = snapshot.publicPages
      runtime.adminPages = snapshot.adminPages
      runtime.publicApis = snapshot.publicApis
      runtime.adminApis = snapshot.adminApis
      runtime.backgroundJobs = snapshot.backgroundJobs
      runtime.providers = snapshot.providers
      runtime.actionHooks = snapshot.actionHooks
      runtime.waterfallHooks = snapshot.waterfallHooks
      runtime.asyncWaterfallHooks = snapshot.asyncWaterfallHooks
      runtime.dataMigrations = snapshot.dataMigrations
      await applyAddonDataMigrations(runtime)
    } catch (error) {
      await recordAddonLoadError(
        runtime,
        error instanceof Error ? error.message : "failed to load addon server entry",
      )
    }

    runtimes.push(runtime)
  }

  await applyAddonRuntimeRelationErrors(runtimes)

  return runtimes
}

let addonsRegistryCacheVersion = 0
let addonsRegistryProcessCache: {
  version: number
  promise: Promise<LoadedAddonsRegistry>
} | null = null

function loadAddonsRegistryProcessCached(cacheVersion: number) {
  if (addonsRegistryProcessCache?.version === cacheVersion) {
    return addonsRegistryProcessCache.promise
  }

  const promise = loadAddonsRuntimeFresh()
    .then((addons) => buildLoadedAddonsRegistry(addons))
    .catch((error) => {
      if (addonsRegistryProcessCache?.version === cacheVersion) {
        addonsRegistryProcessCache = null
      }
      throw error
    })

  addonsRegistryProcessCache = {
    version: cacheVersion,
    promise,
  }

  return promise
}

const loadAddonsRegistryCached = cache(loadAddonsRegistryProcessCached)

export async function loadAddonsRegistry(): Promise<LoadedAddonsRegistry> {
  return loadAddonsRegistryCached(addonsRegistryCacheVersion)
}

export function clearAddonsRuntimeCache() {
  addonsRegistryCacheVersion += 1
  addonsRegistryProcessCache = null
}

export async function loadAddonsRuntime(): Promise<LoadedAddonRuntime[]> {
  return (await loadAddonsRegistry()).addons
}

export async function findLoadedAddonById(addonId: string) {
  return (await loadAddonsRegistry()).addonsById.get(addonId) ?? null
}

export async function findLoadedAddonByIdFresh(addonId: string) {
  const addons = await loadAddonsRuntimeFresh()
  return addons.find((item) => item.manifest.id === addonId) ?? null
}
