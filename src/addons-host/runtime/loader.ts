import "server-only"

import { promises as fs } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { cache } from "react"

import {
  ADDON_ADMIN_API_PREFIX,
  ADDON_ADMIN_PAGE_PREFIX,
  ADDON_ASSET_PUBLIC_PREFIX,
  ADDON_PUBLIC_API_PREFIX,
  ADDON_PUBLIC_PAGE_PREFIX,
} from "@/addons-host/runtime/constants"
import {
  fileExists,
  getAddonAssetsDirectory,
  getAddonsRootDirectory,
  isValidAddonId,
  normalizeMountedAddonPath,
  readJsonFile,
  resolveSafeAddonChildPath,
} from "@/addons-host/runtime/fs"
import { readAddonConfigValue, writeAddonConfigValue } from "@/addons-host/runtime/config"
import {
  cleanupAddonDataCollection,
  ensureAddonDataCollection,
  getAddonDataRecord,
  getAddonDataSchemaVersion,
  putAddonDataRecord,
  queryAddonDataRecords,
  setAddonDataSchemaVersion,
  deleteAddonDataRecord,
} from "@/addons-host/runtime/data"
import { runWithAddonExecutionScope } from "@/addons-host/runtime/execution-scope"
import {
  addonHasPermission,
  assertAddonPermission,
  resolveAddonPermissionSet,
  resolveAddonSensitivePermissionForProviderKind,
  resolveAddonSensitivePermissionForSlot,
} from "@/addons-host/runtime/permissions"
import { readAddonSecretValue, writeAddonSecretValue } from "@/addons-host/runtime/secrets"
import { normalizeAddonManifest } from "@/addons-host/runtime/manifest"
import { readAddonStateMap } from "@/addons-host/runtime/state"
import {
  isKnownAddonActionHookName,
  isKnownAddonAsyncWaterfallHookName,
  isKnownAddonWaterfallHookName,
} from "@/addons-host/hook-catalog"
import { getAddonSurfaceExecutionMode } from "@/addons-host/surface-modes"
import { createAddonLifecycleLog } from "@/db/addon-registry-queries"
import type {
  AddonActionHookRegistration,
  AddonApiRegistration,
  AddonAsyncWaterfallHookRegistration,
  AddonBuildApi,
  AddonDefinition,
  AddonExecutionContextBase,
  AddonHttpMethod,
  AddonManifest,
  AddonPageRegistration,
  AddonProviderRegistration,
  AddonSlotKey,
  AddonSlotProps,
  AddonSurfaceRegistration,
  AddonSurfaceOverrideDescriptor,
  AddonSlotRegistration,
  AddonStateRecord,
  LoadedAddonRuntime,
  AddonDataMigrationRegistration,
  AddonWaterfallHookRegistration,
} from "@/addons-host/types"

const DEFAULT_SERVER_ENTRY_RELATIVE_PATH = "dist/server.mjs"

export interface IndexedAddonSlotCandidate {
  addon: LoadedAddonRuntime
  registration: AddonSlotRegistration
  order: number
}

export interface IndexedAddonSurfaceCandidate<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  addon: LoadedAddonRuntime
  registration: AddonSurfaceRegistration<TProps>
  priority: number
}

export interface IndexedAddonProviderCandidate {
  addon: LoadedAddonRuntime
  provider: AddonProviderRegistration
  order: number
}

export interface IndexedAddonActionHookCandidate {
  addon: LoadedAddonRuntime
  registration: AddonActionHookRegistration
  order: number
}

export interface IndexedAddonWaterfallHookCandidate {
  addon: LoadedAddonRuntime
  registration: AddonWaterfallHookRegistration
  order: number
}

export interface IndexedAddonAsyncWaterfallHookCandidate {
  addon: LoadedAddonRuntime
  registration: AddonAsyncWaterfallHookRegistration
  order: number
}

export interface LoadedAddonsRegistry {
  addons: LoadedAddonRuntime[]
  addonsById: Map<string, LoadedAddonRuntime>
  slotCandidatesBySlot: Map<AddonSlotKey, IndexedAddonSlotCandidate[]>
  surfaceCandidatesBySurface: Map<string, IndexedAddonSurfaceCandidate[]>
  providerCandidatesByKind: Map<string, IndexedAddonProviderCandidate[]>
  actionHookCandidatesByHook: Map<string, IndexedAddonActionHookCandidate[]>
  waterfallHookCandidatesByHook: Map<string, IndexedAddonWaterfallHookCandidate[]>
  asyncWaterfallHookCandidatesByHook: Map<string, IndexedAddonAsyncWaterfallHookCandidate[]>
  surfaceOverrideDescriptors: AddonSurfaceOverrideDescriptor[]
  publicPageRoutesByAddonId: Map<string, Map<string, AddonPageRegistration>>
  adminPageRoutesByAddonId: Map<string, Map<string, AddonPageRegistration>>
  publicApiRoutesByAddonId: Map<string, Map<string, Map<AddonHttpMethod, AddonApiRegistration>>>
  adminApiRoutesByAddonId: Map<string, Map<string, Map<AddonHttpMethod, AddonApiRegistration>>>
}

function getOrCreateMapValue<TKey, TValue>(
  map: Map<TKey, TValue>,
  key: TKey,
  create: () => TValue,
) {
  const existing = map.get(key)
  if (existing) {
    return existing
  }

  const nextValue = create()
  map.set(key, nextValue)
  return nextValue
}

function compareAddonCandidates(
  left: { addon: LoadedAddonRuntime; registrationKey: string },
  right: { addon: LoadedAddonRuntime; registrationKey: string },
) {
  return `${left.addon.manifest.id}:${left.registrationKey}`.localeCompare(
    `${right.addon.manifest.id}:${right.registrationKey}`,
    "zh-CN",
  )
}

function compareOrderedAddonCandidates(
  left: IndexedAddonSlotCandidate,
  right: IndexedAddonSlotCandidate,
) {
  if (left.order !== right.order) {
    return left.order - right.order
  }

  return compareAddonCandidates(
    { addon: left.addon, registrationKey: left.registration.key },
    { addon: right.addon, registrationKey: right.registration.key },
  )
}

function compareOrderedAddonHookCandidates(
  left: Pick<IndexedAddonActionHookCandidate | IndexedAddonWaterfallHookCandidate | IndexedAddonAsyncWaterfallHookCandidate, "order" | "addon" | "registration">,
  right: Pick<IndexedAddonActionHookCandidate | IndexedAddonWaterfallHookCandidate | IndexedAddonAsyncWaterfallHookCandidate, "order" | "addon" | "registration">,
) {
  if (left.order !== right.order) {
    return left.order - right.order
  }

  return compareAddonCandidates(
    { addon: left.addon, registrationKey: left.registration.key },
    { addon: right.addon, registrationKey: right.registration.key },
  )
}

function comparePrioritizedAddonCandidates(
  left: IndexedAddonSurfaceCandidate,
  right: IndexedAddonSurfaceCandidate,
) {
  if (left.priority !== right.priority) {
    return right.priority - left.priority
  }

  return compareAddonCandidates(
    { addon: left.addon, registrationKey: left.registration.key },
    { addon: right.addon, registrationKey: right.registration.key },
  )
}

function compareIndexedAddonProviders(
  left: IndexedAddonProviderCandidate,
  right: IndexedAddonProviderCandidate,
) {
  if (left.order !== right.order) {
    return left.order - right.order
  }

  const byLabel = left.provider.label.localeCompare(
    right.provider.label,
    "zh-CN",
  )
  if (byLabel !== 0) {
    return byLabel
  }

  return left.provider.code.localeCompare(right.provider.code, "zh-CN")
}

function createAddonBuildApi(manifest: AddonManifest, warnings: string[]) {
  const slots: AddonSlotRegistration[] = []
  const surfaces: AddonSurfaceRegistration[] = []
  const publicPages: AddonPageRegistration[] = []
  const adminPages: AddonPageRegistration[] = []
  const publicApis: AddonApiRegistration[] = []
  const adminApis: AddonApiRegistration[] = []
  const providers: AddonProviderRegistration[] = []
  const actionHooks: AddonActionHookRegistration[] = []
  const waterfallHooks: AddonWaterfallHookRegistration[] = []
  const asyncWaterfallHooks: AddonAsyncWaterfallHookRegistration[] = []
  const dataMigrations: AddonDataMigrationRegistration[] = []

  const api: AddonBuildApi = {
    registerSlot<TProps extends AddonSlotProps = AddonSlotProps>(
      registration: AddonSlotRegistration<TProps>,
    ) {
      assertAddonPermission(
        manifest,
        "slot:register",
        `addon "${manifest.id}" is not allowed to register slots`,
      )
      const sensitivePermission = resolveAddonSensitivePermissionForSlot(
        registration.slot,
      )
      if (sensitivePermission) {
        assertAddonPermission(
          manifest,
          sensitivePermission,
          `addon "${manifest.id}" is not allowed to attach to slot "${registration.slot}"`,
        )
      }

      slots.push({
        ...registration,
        key: registration.key.trim(),
        order: registration.order ?? 0,
      } as AddonSlotRegistration)
    },
    registerSurface(registration) {
      assertAddonPermission(
        manifest,
        "surface:register",
        `addon "${manifest.id}" is not allowed to register surfaces`,
      )
      const normalizedSurface = registration.surface.trim()
      const normalizedClientModule = typeof registration.clientModule === "string"
        ? registration.clientModule.trim()
        : ""
      const hasRender = typeof registration.render === "function"
      const surfaceMode = getAddonSurfaceExecutionMode(normalizedSurface)

      if (surfaceMode === "client" && hasRender && !normalizedClientModule) {
        throw new Error(
          `addon "${manifest.id}" surface "${normalizedSurface}" is client-only and requires clientModule`,
        )
      }

      if (!hasRender && !normalizedClientModule) {
        throw new Error(`addon "${manifest.id}" surface "${normalizedSurface}" requires render() or clientModule`)
      }

      if (surfaceMode === "client" && hasRender && normalizedClientModule) {
        warnings.push(
          `surface "${normalizedSurface}" is client-only; addon "${manifest.id}" render() will be ignored and clientModule will be used instead`,
        )
      }

      surfaces.push({
        ...registration,
        key: registration.key.trim(),
        surface: normalizedSurface,
        render: surfaceMode === "client" ? undefined : registration.render,
        clientModule: normalizedClientModule || undefined,
        priority: registration.priority ?? 0,
      } as AddonSurfaceRegistration)
    },
    registerPublicPage(registration) {
      assertAddonPermission(
        manifest,
        "page:public",
        `addon "${manifest.id}" is not allowed to register public pages`,
      )
      publicPages.push({
        ...registration,
        key: registration.key.trim(),
        path: normalizeMountedAddonPath(registration.path),
      })
    },
    registerAdminPage(registration) {
      assertAddonPermission(
        manifest,
        "page:admin",
        `addon "${manifest.id}" is not allowed to register admin pages`,
      )
      adminPages.push({
        ...registration,
        key: registration.key.trim(),
        path: normalizeMountedAddonPath(registration.path),
      })
    },
    registerPublicApi(registration) {
      assertAddonPermission(
        manifest,
        "api:public",
        `addon "${manifest.id}" is not allowed to register public APIs`,
      )
      publicApis.push({
        ...registration,
        key: registration.key.trim(),
        path: normalizeMountedAddonPath(registration.path),
        methods: (registration.methods ?? ["GET"]).map((item) => item.toUpperCase() as typeof item),
      })
    },
    registerAdminApi(registration) {
      assertAddonPermission(
        manifest,
        "api:admin",
        `addon "${manifest.id}" is not allowed to register admin APIs`,
      )
      adminApis.push({
        ...registration,
        key: registration.key.trim(),
        path: normalizeMountedAddonPath(registration.path),
        methods: (registration.methods ?? ["GET"]).map((item) => item.toUpperCase() as typeof item),
      })
    },
    registerProvider(registration) {
      assertAddonPermission(
        manifest,
        "provider:register",
        `addon "${manifest.id}" is not allowed to register providers`,
      )
      const sensitivePermission = resolveAddonSensitivePermissionForProviderKind(
        registration.kind,
      )
      if (sensitivePermission) {
        assertAddonPermission(
          manifest,
          sensitivePermission,
          `addon "${manifest.id}" is not allowed to register provider kind "${registration.kind}"`,
        )
      }

      providers.push({
        ...registration,
        kind: registration.kind.trim(),
        code: registration.code.trim(),
        label: registration.label.trim(),
        order: registration.order ?? 0,
      })
    },
    registerActionHook(registration) {
      assertAddonPermission(
        manifest,
        "hook:register",
        `addon "${manifest.id}" is not allowed to register action hooks`,
      )
      if (!isKnownAddonActionHookName(registration.hook)) {
        throw new Error(`unknown addon action hook "${registration.hook}"`)
      }

      actionHooks.push({
        ...registration,
        key: registration.key.trim(),
        order: registration.order ?? 0,
      })
    },
    registerWaterfallHook(registration) {
      assertAddonPermission(
        manifest,
        "hook:register",
        `addon "${manifest.id}" is not allowed to register waterfall hooks`,
      )
      if (!isKnownAddonWaterfallHookName(registration.hook)) {
        throw new Error(`unknown addon waterfall hook "${registration.hook}"`)
      }

      waterfallHooks.push({
        ...registration,
        key: registration.key.trim(),
        order: registration.order ?? 0,
      })
    },
    registerAsyncWaterfallHook(registration) {
      assertAddonPermission(
        manifest,
        "hook:register",
        `addon "${manifest.id}" is not allowed to register async waterfall hooks`,
      )
      if (!isKnownAddonAsyncWaterfallHookName(registration.hook)) {
        throw new Error(`unknown addon async waterfall hook "${registration.hook}"`)
      }

      asyncWaterfallHooks.push({
        ...registration,
        key: registration.key.trim(),
        order: registration.order ?? 0,
      })
    },
    registerDataMigration(registration) {
      assertAddonPermission(
        manifest,
        "data:migrate",
        `addon "${manifest.id}" is not allowed to register data migrations`,
      )

      dataMigrations.push({
        ...registration,
        version: Math.max(1, Math.floor(registration.version)),
      })
    },
  }

  return {
    api,
    snapshot: {
      slots,
      surfaces,
      publicPages,
      adminPages,
      publicApis,
      adminApis,
      providers,
      actionHooks,
      waterfallHooks,
      asyncWaterfallHooks,
      dataMigrations,
    },
  }
}

async function importAddonDefinition(entryServerPath: string): Promise<AddonDefinition> {
  const entryStat = await fs.stat(entryServerPath)
  const entryUrl = `${pathToFileURL(entryServerPath).href}?v=${entryStat.mtimeMs}`
  const moduleExports = await import(/* webpackIgnore: true */ entryUrl)
  const candidate = (moduleExports.default ?? moduleExports) as Partial<AddonDefinition> | undefined

  if (!candidate || typeof candidate.setup !== "function") {
    throw new Error("addon server entry must export an object with setup(api)")
  }

  return candidate as AddonDefinition
}

async function resolveAddonServerEntryPath(rootDir: string, manifest: AddonManifest) {
  const requestedEntry = manifest.entry?.server?.trim() || DEFAULT_SERVER_ENTRY_RELATIVE_PATH
  const resolvedEntry = await resolveSafeAddonChildPath(rootDir, requestedEntry)

  return (await fileExists(resolvedEntry)) ? resolvedEntry : null
}

function buildAddonRuntimeDescriptor(manifest: AddonManifest, rootDir: string, state: AddonStateRecord) {
  const enabled = !state.uninstalledAt && (state.enabled ?? manifest.enabled ?? true)

  return {
    manifest,
    state,
    enabled,
    rootDir,
    assetRootDir: getAddonAssetsDirectory(manifest.id),
    assetBaseUrl: `${ADDON_ASSET_PUBLIC_PREFIX}/${manifest.id}`,
    publicBaseUrl: `${ADDON_PUBLIC_PAGE_PREFIX}/${manifest.id}`,
    adminBaseUrl: `${ADDON_ADMIN_PAGE_PREFIX}/${manifest.id}`,
    publicApiBaseUrl: `${ADDON_PUBLIC_API_PREFIX}/${manifest.id}`,
    adminApiBaseUrl: `${ADDON_ADMIN_API_PREFIX}/${manifest.id}`,
  }
}

function buildAddonPermissionCache(manifest: AddonManifest) {
  const permissionSet = resolveAddonPermissionSet(manifest.permissions)
  const resolvedPermissions = Object.freeze(
    [...permissionSet.values()].sort((left, right) =>
      left.localeCompare(right, "zh-CN"),
    ),
  )

  return {
    permissionSet,
    resolvedPermissions,
  }
}

export function buildAddonExecutionContext(addon: LoadedAddonRuntime, input?: {
  request?: Request
  pathname?: string
  searchParams?: URLSearchParams
}): AddonExecutionContextBase {
  const permissionSet = addon.permissionSet
  const assertRuntimePermission = (permission: string, message?: string) => {
    if (!addonHasPermission(permissionSet, permission)) {
      void createAddonLifecycleLog({
        addonId: addon.manifest.id,
        action: "PERMISSION_DENIED",
        status: "FAILED",
        message:
          message
          || `addon "${addon.manifest.id}" requires permission "${permission}"`,
        metadataJson: {
          permission,
          pathname: input?.pathname ?? null,
        },
      })

      throw new Error(
        message
          || `addon "${addon.manifest.id}" requires permission "${permission}"`,
      )
    }
  }

  return {
    manifest: addon.manifest,
    state: addon.state,
    enabled: addon.enabled,
    rootDir: addon.rootDir,
    assetRootDir: addon.assetRootDir,
    assetBaseUrl: addon.assetBaseUrl,
    publicBaseUrl: addon.publicBaseUrl,
    adminBaseUrl: addon.adminBaseUrl,
    publicApiBaseUrl: addon.publicApiBaseUrl,
    adminApiBaseUrl: addon.adminApiBaseUrl,
    request: input?.request,
    pathname: input?.pathname,
    searchParams: input?.searchParams,
    permissions: [...addon.resolvedPermissions],
    hasPermission: (permission: string) => addonHasPermission(permissionSet, permission),
    assertPermission: assertRuntimePermission,
    asset: (targetPath = "") => {
      const relativePath = normalizeMountedAddonPath(targetPath)
      return relativePath ? `${addon.assetBaseUrl}/${relativePath}` : addon.assetBaseUrl
    },
    publicPage: (targetPath = "") => {
      const relativePath = normalizeMountedAddonPath(targetPath)
      return relativePath ? `${addon.publicBaseUrl}/${relativePath}` : addon.publicBaseUrl
    },
    adminPage: (targetPath = "") => {
      const relativePath = normalizeMountedAddonPath(targetPath)
      return relativePath ? `${addon.adminBaseUrl}/${relativePath}` : addon.adminBaseUrl
    },
    publicApi: (targetPath = "") => {
      const relativePath = normalizeMountedAddonPath(targetPath)
      return relativePath ? `${addon.publicApiBaseUrl}/${relativePath}` : addon.publicApiBaseUrl
    },
    adminApi: (targetPath = "") => {
      const relativePath = normalizeMountedAddonPath(targetPath)
      return relativePath ? `${addon.adminApiBaseUrl}/${relativePath}` : addon.adminApiBaseUrl
    },
    readAssetText: async (targetPath: string) => {
      const filePath = await resolveSafeAddonChildPath(addon.assetRootDir, targetPath)
      return fs.readFile(filePath, "utf8")
    },
    readAssetJson: async <T = unknown>(targetPath: string) => {
      const filePath = await resolveSafeAddonChildPath(addon.assetRootDir, targetPath)
      return readJsonFile<T>(filePath)
    },
    readConfig: async <T = unknown>(configKey: string, fallback?: T) => {
      assertRuntimePermission(
        "config:read",
        `addon "${addon.manifest.id}" is not allowed to read config`,
      )
      return readAddonConfigValue<T>(addon.manifest.id, configKey, fallback)
    },
    writeConfig: async <T = unknown>(configKey: string, value: T) => {
      assertRuntimePermission(
        "config:write",
        `addon "${addon.manifest.id}" is not allowed to write config`,
      )
      const previousValue = await readAddonConfigValue(
        addon.manifest.id,
        configKey,
      )
      const { executeAddonActionHook } = await import("@/addons-host/runtime/hooks")
      await executeAddonActionHook("addon.config.changed.before", {
        addonId: addon.manifest.id,
        configKey,
        previousValue,
        value,
      }, {
        request: input?.request,
        pathname: input?.pathname,
        searchParams: input?.searchParams,
        throwOnError: true,
      })
      await writeAddonConfigValue(addon.manifest.id, configKey, value)
      await executeAddonActionHook("addon.config.changed.after", {
        addonId: addon.manifest.id,
        configKey,
        previousValue,
        value,
      }, {
        request: input?.request,
        pathname: input?.pathname,
        searchParams: input?.searchParams,
      })
    },
    readSecret: async <T = unknown>(secretKey: string, fallback?: T) => {
      assertRuntimePermission(
        "secret:read",
        `addon "${addon.manifest.id}" is not allowed to read secrets`,
      )
      return readAddonSecretValue<T>(addon.manifest.id, secretKey, fallback)
    },
    writeSecret: async <T = unknown>(secretKey: string, value: T) => {
      assertRuntimePermission(
        "secret:write",
        `addon "${addon.manifest.id}" is not allowed to write secrets`,
      )
      await writeAddonSecretValue(addon.manifest.id, secretKey, value)
    },
    data: {
      ensureCollection: async (definition) => {
        assertRuntimePermission(
          "data:write",
          `addon "${addon.manifest.id}" is not allowed to create or update data collections`,
        )
        return ensureAddonDataCollection(addon.manifest.id, definition)
      },
      get: async (collectionName, recordId) => {
        assertRuntimePermission(
          "data:read",
          `addon "${addon.manifest.id}" is not allowed to read plugin data`,
        )
        return getAddonDataRecord(addon.manifest.id, collectionName, recordId)
      },
      put: async (collectionName, record) => {
        assertRuntimePermission(
          "data:write",
          `addon "${addon.manifest.id}" is not allowed to write plugin data`,
        )
        return putAddonDataRecord(addon.manifest.id, collectionName, record)
      },
      delete: async (collectionName, recordId) => {
        assertRuntimePermission(
          "data:delete",
          `addon "${addon.manifest.id}" is not allowed to delete plugin data`,
        )
        return deleteAddonDataRecord(addon.manifest.id, collectionName, recordId)
      },
      query: async (collectionName, options) => {
        assertRuntimePermission(
          "data:read",
          `addon "${addon.manifest.id}" is not allowed to query plugin data`,
        )
        return queryAddonDataRecords(addon.manifest.id, collectionName, options)
      },
      cleanup: async (collectionName) => {
        assertRuntimePermission(
          "data:delete",
          `addon "${addon.manifest.id}" is not allowed to clean plugin data`,
        )
        return cleanupAddonDataCollection(addon.manifest.id, collectionName)
      },
      getSchemaVersion: async () => {
        assertRuntimePermission(
          "data:read",
          `addon "${addon.manifest.id}" is not allowed to read plugin data schema version`,
        )
        return getAddonDataSchemaVersion(addon.manifest.id)
      },
    },
  }
}

async function applyAddonDataMigrations(addon: LoadedAddonRuntime) {
  if (addon.dataMigrations.length === 0) {
    return
  }

  const sortedMigrations = [...addon.dataMigrations].sort(
    (left, right) => left.version - right.version,
  )
  let currentVersion = await getAddonDataSchemaVersion(addon.manifest.id)

  for (const migration of sortedMigrations) {
    if (migration.version <= currentVersion) {
      continue
    }

    await runWithAddonExecutionScope(addon, {
      action: `data:migration:${migration.version}`,
    }, async () => {
      await migration.migrate(buildAddonExecutionContext(addon))
    })
    await setAddonDataSchemaVersion(addon.manifest.id, migration.version)
    currentVersion = migration.version
  }
}

function resolveAddonClientModuleUrlForRegistry(
  addon: LoadedAddonRuntime,
  input?: string,
) {
  const target = typeof input === "string" ? input.trim() : ""
  if (!target) {
    return ""
  }

  if (/^(https?:)?\/\//i.test(target) || target.startsWith("/")) {
    return target
  }

  return buildAddonExecutionContext(addon).asset(target)
}

function buildAddonRouteIndex(
  registrations: AddonPageRegistration[],
) {
  const routes = new Map<string, AddonPageRegistration>()

  for (const registration of registrations) {
    const mountedPath = normalizeMountedAddonPath(registration.path)
    if (!routes.has(mountedPath)) {
      routes.set(mountedPath, registration)
    }
  }

  return routes
}

function buildAddonApiRouteIndex(
  registrations: AddonApiRegistration[],
) {
  const routes = new Map<string, Map<AddonHttpMethod, AddonApiRegistration>>()

  for (const registration of registrations) {
    const mountedPath = normalizeMountedAddonPath(registration.path)
    const methods = registration.methods ?? ["GET"]
    const routeMethods = getOrCreateMapValue(routes, mountedPath, () => new Map())

    for (const method of methods) {
      if (!routeMethods.has(method)) {
        routeMethods.set(method, registration)
      }
    }
  }

  return routes
}

function buildLoadedAddonsRegistry(
  addons: LoadedAddonRuntime[],
): LoadedAddonsRegistry {
  const addonsById = new Map<string, LoadedAddonRuntime>()
  const slotCandidatesBySlot = new Map<AddonSlotKey, IndexedAddonSlotCandidate[]>()
  const surfaceCandidatesBySurface = new Map<string, IndexedAddonSurfaceCandidate[]>()
  const providerCandidatesByKind = new Map<string, IndexedAddonProviderCandidate[]>()
  const actionHookCandidatesByHook = new Map<string, IndexedAddonActionHookCandidate[]>()
  const waterfallHookCandidatesByHook = new Map<string, IndexedAddonWaterfallHookCandidate[]>()
  const asyncWaterfallHookCandidatesByHook = new Map<string, IndexedAddonAsyncWaterfallHookCandidate[]>()
  const surfaceOverrideDescriptors: AddonSurfaceOverrideDescriptor[] = []
  const publicPageRoutesByAddonId = new Map<string, Map<string, AddonPageRegistration>>()
  const adminPageRoutesByAddonId = new Map<string, Map<string, AddonPageRegistration>>()
  const publicApiRoutesByAddonId = new Map<string, Map<string, Map<AddonHttpMethod, AddonApiRegistration>>>()
  const adminApiRoutesByAddonId = new Map<string, Map<string, Map<AddonHttpMethod, AddonApiRegistration>>>()

  for (const addon of addons) {
    addonsById.set(addon.manifest.id, addon)

    if (!addon.enabled || addon.loadError) {
      continue
    }

    for (const registration of addon.slots) {
      getOrCreateMapValue(slotCandidatesBySlot, registration.slot, () => []).push({
        addon,
        registration,
        order: registration.order ?? 0,
      })
    }

    for (const registration of addon.surfaces) {
      getOrCreateMapValue(surfaceCandidatesBySurface, registration.surface, () => []).push({
        addon,
        registration,
        priority: registration.priority ?? 0,
      })

      const clientModuleUrl = resolveAddonClientModuleUrlForRegistry(
        addon,
        registration.clientModule,
      )
      if (!clientModuleUrl) {
        continue
      }

      surfaceOverrideDescriptors.push({
        addonId: addon.manifest.id,
        clientModuleUrl,
        description: registration.description,
        key: registration.key,
        priority: registration.priority ?? 0,
        surface: registration.surface,
        title: registration.title,
      })
    }

    for (const registration of addon.actionHooks) {
      getOrCreateMapValue(actionHookCandidatesByHook, registration.hook, () => []).push({
        addon,
        registration,
        order: registration.order ?? 0,
      })
    }

    for (const registration of addon.waterfallHooks) {
      getOrCreateMapValue(waterfallHookCandidatesByHook, registration.hook, () => []).push({
        addon,
        registration,
        order: registration.order ?? 0,
      })
    }

    for (const registration of addon.asyncWaterfallHooks) {
      getOrCreateMapValue(asyncWaterfallHookCandidatesByHook, registration.hook, () => []).push({
        addon,
        registration,
        order: registration.order ?? 0,
      })
    }

    for (const provider of addon.providers) {
      getOrCreateMapValue(providerCandidatesByKind, provider.kind, () => []).push({
        addon,
        provider,
        order: typeof provider.order === "number" && Number.isFinite(provider.order)
          ? provider.order
          : 0,
      })
    }

    if (addon.publicPages.length > 0) {
      publicPageRoutesByAddonId.set(
        addon.manifest.id,
        buildAddonRouteIndex(addon.publicPages),
      )
    }

    if (addon.adminPages.length > 0) {
      adminPageRoutesByAddonId.set(
        addon.manifest.id,
        buildAddonRouteIndex(addon.adminPages),
      )
    }

    if (addon.publicApis.length > 0) {
      publicApiRoutesByAddonId.set(
        addon.manifest.id,
        buildAddonApiRouteIndex(addon.publicApis),
      )
    }

    if (addon.adminApis.length > 0) {
      adminApiRoutesByAddonId.set(
        addon.manifest.id,
        buildAddonApiRouteIndex(addon.adminApis),
      )
    }
  }

  for (const candidates of slotCandidatesBySlot.values()) {
    candidates.sort(compareOrderedAddonCandidates)
  }

  for (const candidates of surfaceCandidatesBySurface.values()) {
    candidates.sort(comparePrioritizedAddonCandidates)
  }

  for (const candidates of providerCandidatesByKind.values()) {
    candidates.sort(compareIndexedAddonProviders)
  }

  for (const candidates of actionHookCandidatesByHook.values()) {
    candidates.sort(compareOrderedAddonHookCandidates)
  }

  for (const candidates of waterfallHookCandidatesByHook.values()) {
    candidates.sort(compareOrderedAddonHookCandidates)
  }

  for (const candidates of asyncWaterfallHookCandidatesByHook.values()) {
    candidates.sort(compareOrderedAddonHookCandidates)
  }

  surfaceOverrideDescriptors.sort((left, right) => {
    if (left.priority !== right.priority) {
      return right.priority - left.priority
    }

    return `${left.addonId}:${left.key}`.localeCompare(
      `${right.addonId}:${right.key}`,
      "zh-CN",
    )
  })

  return {
    addons,
    addonsById,
    slotCandidatesBySlot,
    surfaceCandidatesBySurface,
    providerCandidatesByKind,
    actionHookCandidatesByHook,
    waterfallHookCandidatesByHook,
    asyncWaterfallHookCandidatesByHook,
    surfaceOverrideDescriptors,
    publicPageRoutesByAddonId,
    adminPageRoutesByAddonId,
    publicApiRoutesByAddonId,
    adminApiRoutesByAddonId,
  }
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

  const runtimes: LoadedAddonRuntime[] = []

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "zh-CN"))) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue
    }

    const rootDir = path.join(addonsRoot, entry.name)
    const manifestPath = path.join(rootDir, "addon.json")
    if (!(await fileExists(manifestPath))) {
      continue
    }

    let manifest: AddonManifest

    try {
      manifest = normalizeAddonManifest(await readJsonFile<unknown>(manifestPath))
    } catch (error) {
      const fallbackManifest: AddonManifest = {
        id: entry.name,
        name: entry.name,
        version: "0.0.0",
        description: "Invalid addon manifest",
      }
      const state = stateMap[entry.name] ?? {}
      const descriptor = buildAddonRuntimeDescriptor(fallbackManifest, rootDir, state)
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
        providers: [],
        actionHooks: [],
        waterfallHooks: [],
        asyncWaterfallHooks: [],
        dataMigrations: [],
        loadError: error instanceof Error ? error.message : "invalid addon manifest",
      })
      continue
    }

    const state = stateMap[manifest.id] ?? {}
    const warnings: string[] = []
    const permissionCache = buildAddonPermissionCache(manifest)
    if (!isValidAddonId(manifest.id)) {
      warnings.push(`addon id "${manifest.id}" is not a recommended identifier`)
    }
    if (manifest.id !== entry.name) {
      warnings.push(`addon folder "${entry.name}" does not match manifest id "${manifest.id}"`)
    }

    const descriptor = buildAddonRuntimeDescriptor(manifest, rootDir, state)
    const serverEntryPath = await resolveAddonServerEntryPath(rootDir, manifest)
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

    if (!serverEntryPath) {
      runtime.loadError = "addon server entry not found"
      runtimes.push(runtime)
      continue
    }

    try {
      const { api, snapshot } = createAddonBuildApi(manifest, warnings)
      const definition = await importAddonDefinition(serverEntryPath)
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
      runtime.providers = snapshot.providers
      runtime.actionHooks = snapshot.actionHooks
      runtime.waterfallHooks = snapshot.waterfallHooks
      runtime.asyncWaterfallHooks = snapshot.asyncWaterfallHooks
      runtime.dataMigrations = snapshot.dataMigrations
      await applyAddonDataMigrations(runtime)
    } catch (error) {
      runtime.loadError = error instanceof Error ? error.message : "failed to load addon server entry"
      runtime.state = {
        ...runtime.state,
        lastErrorAt: new Date().toISOString(),
        lastErrorMessage: runtime.loadError,
      }
      await createAddonLifecycleLog({
        addonId: runtime.manifest.id,
        action: "LOAD",
        status: "FAILED",
        message: runtime.loadError,
        metadataJson: {
          entryServerPath: runtime.entryServerPath,
        },
      })
    }

    runtimes.push(runtime)
  }

  return runtimes
}

let addonsRegistryCacheVersion = 0

const loadAddonsRegistryCached = cache(async (cacheVersion: number) => {
  void cacheVersion
  const addons = await loadAddonsRuntimeFresh()
  return buildLoadedAddonsRegistry(addons)
})

export async function loadAddonsRegistry(): Promise<LoadedAddonsRegistry> {
  return loadAddonsRegistryCached(addonsRegistryCacheVersion)
}

export function clearAddonsRuntimeCache() {
  addonsRegistryCacheVersion += 1
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
