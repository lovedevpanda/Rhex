import type {
  AddonAdminDetailData,
  AddonAdminItem,
  AddonsAdminData,
  AddonManagementAction,
} from "@/addons-host/admin-types"
import {
  clearAddonsRuntimeCache,
  loadAddonsRuntimeFresh,
} from "@/addons-host/runtime/loader"
import { revalidateAddonRuntimeCaches } from "@/addons-host/runtime/cache-invalidation"
import {
  buildAddonRelationCatalog,
  collectDependentAddonIssues,
  collectReverseConflictIssues,
  validateAddonManifestRelations,
} from "@/addons-host/runtime/relations"
import {
  addonMayUseBackgroundJobs,
  cleanupAddonBackgroundJobs,
} from "@/addons-host/runtime/background-jobs"
import {
  deleteAddonState,
  writeAddonStateSnapshot,
} from "@/addons-host/runtime/state"
import type { AddonStateRecord, LoadedAddonRuntime } from "@/addons-host/types"
import {
  createAddonLifecycleLog,
  listAddonLifecycleLogs,
  listAddonRegistryRecords,
  upsertAddonRegistryRecord,
} from "@/db/addon-registry-queries"
import { deleteAddonConfigValues } from "@/addons-host/runtime/config"
import { deleteAddonDataStore } from "@/addons-host/runtime/data"
import { deleteAddonSecretValues } from "@/addons-host/runtime/secrets"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
import { assertAddonTrustedCodeExecutionAcknowledged } from "@/addons-host/runtime/permissions"
import { ensureAdminActorPermission } from "@/lib/admin-scope-permissions"
import { requireSiteAdminActor } from "@/lib/moderator-permissions"

async function ensureCanManageAddons() {
  await ensureAdminActorPermission(
    await requireSiteAdminActor(),
    "admin.addons.manage",
    "无权管理插件",
  )
}


function buildAddonStateLabel(addon: LoadedAddonRuntime): AddonAdminItem["stateLabel"] {
  return addon.enabled ? "enabled" : "disabled"
}

function mapAddonAdminItem(addon: LoadedAddonRuntime): AddonAdminItem {
  const stateLabel = buildAddonStateLabel(addon)

  return {
    id: addon.manifest.id,
    name: addon.manifest.name,
    author: addon.manifest.author ?? null,
    version: addon.manifest.version,
    description: addon.manifest.description ?? "暂无描述",
    enabled: addon.enabled,
    stateLabel,
    loadError: addon.loadError,
    warnings: addon.warnings,
    permissions: addon.manifest.permissions ?? [],
    installedAt: addon.state.installedAt ?? null,
    disabledAt: addon.state.disabledAt ?? null,
    lastErrorAt: addon.state.lastErrorAt ?? null,
    lastErrorMessage: addon.state.lastErrorMessage ?? null,
    counts: {
      slots: addon.slots.length,
      surfaces: addon.surfaces.length,
      publicPages: addon.publicPages.length,
      adminPages: addon.adminPages.length,
      publicApis: addon.publicApis.length,
      adminApis: addon.adminApis.length,
      providers: addon.providers.length,
      hooks:
        addon.actionHooks.length
        + addon.waterfallHooks.length
        + addon.asyncWaterfallHooks.length,
    },
    paths: {
      publicPage: addon.publicBaseUrl,
      adminPage: addon.adminBaseUrl,
      publicApiBase: addon.publicApiBaseUrl,
      adminApiBase: addon.adminApiBaseUrl,
      assetBase: addon.assetBaseUrl,
    },
    canEnable: !addon.enabled,
    canDisable: addon.enabled,
    canRemove: true,
  }
}

function resolveStorageMode(databaseRecords: Awaited<ReturnType<typeof listAddonRegistryRecords>>): AddonsAdminData["storageMode"] {
  return databaseRecords ? "database" : "file"
}

interface SyncedAddonRegistrySnapshot {
  addons: LoadedAddonRuntime[]
  storageMode: AddonsAdminData["storageMode"]
}

function ensureAddonStateSnapshot(state: AddonStateRecord | undefined) {
  return {
    enabled: state?.enabled,
    installedAt: state?.installedAt ?? new Date().toISOString(),
    disabledAt: state?.disabledAt ?? null,
    uninstalledAt: state?.uninstalledAt ?? null,
    lastErrorAt: state?.lastErrorAt ?? null,
    lastErrorMessage: state?.lastErrorMessage ?? null,
  } satisfies AddonStateRecord
}

function parseOptionalIsoDate(value?: string | null) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function buildRegistryState(input: {
  enabled: boolean
  uninstalledAt?: string | null
  lastErrorMessage?: string | null
}) {
  if (input.uninstalledAt) {
    return "UNINSTALLED"
  }

  if (input.lastErrorMessage) {
    return "ERROR"
  }

  return input.enabled ? "ENABLED" : "DISABLED"
}

async function persistAddonState(
  addon: LoadedAddonRuntime,
  nextState: AddonStateRecord,
  log?: {
    action: string
    status?: string
    message?: string
    metadata?: unknown
  },
) {
  const effectiveEnabled = !nextState.uninstalledAt && (nextState.enabled ?? addon.manifest.enabled ?? true)
  const normalizedState: AddonStateRecord = {
    enabled: effectiveEnabled,
    installedAt: nextState.installedAt ?? new Date().toISOString(),
    disabledAt: nextState.disabledAt ?? null,
    uninstalledAt: nextState.uninstalledAt ?? null,
    lastErrorAt: nextState.lastErrorAt ?? null,
    lastErrorMessage: nextState.lastErrorMessage ?? addon.loadError ?? null,
  }

  await upsertAddonRegistryRecord({
    addonId: addon.manifest.id,
    name: addon.manifest.name,
    version: addon.manifest.version,
    description: addon.manifest.description ?? null,
    sourceDir: addon.rootDir,
    state: buildRegistryState({
      enabled: effectiveEnabled,
      uninstalledAt: normalizedState.uninstalledAt ?? null,
      lastErrorMessage: normalizedState.lastErrorMessage ?? null,
    }),
    enabled: effectiveEnabled,
    manifestJson: addon.manifest,
    permissionsJson: addon.manifest.permissions ?? [],
    installedAt: parseOptionalIsoDate(normalizedState.installedAt),
    disabledAt: parseOptionalIsoDate(normalizedState.disabledAt),
    uninstalledAt: parseOptionalIsoDate(normalizedState.uninstalledAt),
    lastErrorAt: parseOptionalIsoDate(normalizedState.lastErrorAt),
    lastErrorMessage: normalizedState.lastErrorMessage ?? null,
  })

  await writeAddonStateSnapshot(addon.manifest.id, normalizedState)

  if (log) {
    await createAddonLifecycleLog({
      addonId: addon.manifest.id,
      action: log.action,
      status: log.status ?? "SUCCEEDED",
      message: log.message ?? null,
      metadataJson: log.metadata,
    })
  }
}

async function syncAddonRegistryStateSnapshot(): Promise<SyncedAddonRegistrySnapshot> {
  const addons = await loadAddonsRuntimeFresh()

  for (const addon of addons) {
    const snapshot = ensureAddonStateSnapshot({
      ...addon.state,
      enabled: addon.state.uninstalledAt ? false : addon.enabled,
      lastErrorAt: addon.state.lastErrorAt ?? (addon.loadError ? new Date().toISOString() : null),
      lastErrorMessage: addon.loadError ?? addon.state.lastErrorMessage ?? null,
    })

    await persistAddonState(addon, snapshot)
  }

  const databaseRecords = await listAddonRegistryRecords()
  if (databaseRecords) {
    const loadedAddonIds = new Set(addons.map((addon) => addon.manifest.id))
    const staleAddonIds = databaseRecords
      .map((record) => record.addonId)
      .filter((addonId) => !loadedAddonIds.has(addonId))

    for (const staleAddonId of staleAddonIds) {
      await cleanupAddonBackgroundJobs(staleAddonId)
      await deleteAddonConfigValues(staleAddonId)
      await deleteAddonDataStore(staleAddonId)
      await deleteAddonSecretValues(staleAddonId)
      await deleteAddonState(staleAddonId)
    }
  }

  return {
    addons,
    storageMode: resolveStorageMode(databaseRecords),
  }
}

export async function syncAddonRegistryState() {
  const snapshot = await syncAddonRegistryStateSnapshot()
  return snapshot.addons.length
}

async function clearRecoveredAddonErrors() {
  clearAddonsRuntimeCache()
  const addons = await loadAddonsRuntimeFresh()
  let clearedCount = 0

  for (const addon of addons) {
    if (addon.loadError || (!addon.state.lastErrorAt && !addon.state.lastErrorMessage)) {
      continue
    }

    await persistAddonState(addon, {
      ...ensureAddonStateSnapshot(addon.state),
      enabled: addon.state.uninstalledAt ? false : addon.enabled,
      lastErrorAt: null,
      lastErrorMessage: null,
    })
    clearedCount += 1
  }

  return {
    clearedCount,
    total: addons.length,
  }
}

export async function getAddonsAdminData(): Promise<AddonsAdminData> {
  await ensureCanManageAddons()

  const { addons, storageMode } = await syncAddonRegistryStateSnapshot()
  const items = addons.map(mapAddonAdminItem)

  return {
    storageMode,
    items,
    summary: {
      total: items.length,
      enabled: items.filter((item: AddonAdminItem) => item.stateLabel === "enabled").length,
      disabled: items.filter((item: AddonAdminItem) => item.stateLabel === "disabled").length,
      errored: items.filter((item: AddonAdminItem) => Boolean(item.loadError)).length,
    },
  }
}

export async function getAddonAdminItem(addonId: string) {
  await ensureCanManageAddons()

  const { addons } = await syncAddonRegistryStateSnapshot()
  const addon = addons.find((item) => item.manifest.id === addonId) ?? null
  return addon ? mapAddonAdminItem(addon) : null
}

export async function getAddonAdminDetailData(addonId: string): Promise<AddonAdminDetailData | null> {
  await ensureCanManageAddons()

  const [{ addons, storageMode }, lifecycleLogs] = await Promise.all([
    syncAddonRegistryStateSnapshot(),
    listAddonLifecycleLogs(addonId, 20),
  ])
  const addon = addons.find((item) => item.manifest.id === addonId) ?? null

  if (!addon) {
    return null
  }

  const normalizedLogs = Array.isArray(lifecycleLogs)
    ? lifecycleLogs as Array<{
        id: string
        action: string
        status: string
        message: string | null
        createdAt: Date
      }>
    : []

  return {
    storageMode,
    item: mapAddonAdminItem(addon),
    logs: normalizedLogs.map((log) => ({
      id: log.id,
      action: log.action,
      status: log.status,
      message: log.message ?? null,
      createdAt: log.createdAt.toISOString(),
    })),
  }
}

function refreshAddonRuntime(addonId?: string | null) {
  clearAddonsRuntimeCache()
  revalidateAddonRuntimeCaches(addonId)
}

function buildAddonRelationSnapshot(addons: LoadedAddonRuntime[]) {
  return buildAddonRelationCatalog(
    addons.map((addon) => ({
      manifest: addon.manifest,
      enabled: addon.enabled,
      loadError: addon.loadError,
    })),
  )
}

export async function runAddonManagementAction(action: AddonManagementAction, addonId?: string | null) {
  await ensureCanManageAddons()

  if (action === "sync") {
    refreshAddonRuntime(addonId?.trim() || "")
    const count = await syncAddonRegistryState()
    return {
      data: await getAddonsAdminData(),
      message: `已同步 ${count} 个插件目录`,
    }
  }

  if (action === "clear-cache") {
    clearAddonsRuntimeCache()
    const result = await clearRecoveredAddonErrors()
    refreshAddonRuntime(addonId?.trim() || "")
    return {
      data: await getAddonsAdminData(),
      message:
        result.clearedCount > 0
          ? `已清除插件宿主缓存，并重置 ${result.clearedCount} 个插件的残留错误状态`
          : "已清除插件宿主缓存",
    }
  }

  const resolvedAddonId = addonId?.trim() || ""
  if (!resolvedAddonId) {
    throw new Error("缺少插件标识")
  }

  const addons = await loadAddonsRuntimeFresh()
  const addon = addons.find((item) => item.manifest.id === resolvedAddonId) ?? null
  if (!addon) {
    throw new Error(`插件不存在：${resolvedAddonId}`)
  }

  const ensuredState = ensureAddonStateSnapshot(addon.state)
  const now = new Date().toISOString()
  const relationCatalog = buildAddonRelationSnapshot(addons)

  switch (action) {
    case "enable": {
      // Enabling evaluates server-side addon code in the host process. Fail
      // before persisting state so the admin UI never reports a false success.
      assertAddonTrustedCodeExecutionAcknowledged(addon.manifest.id)

      relationCatalog.set(addon.manifest.id, {
        manifest: addon.manifest,
        enabled: true,
        loadError: null,
      })

      const relationCheck = validateAddonManifestRelations({
        manifest: addon.manifest,
        enabled: true,
        catalog: relationCatalog,
        includeDependencyLoadErrors: true,
      })
      for (const issue of collectReverseConflictIssues({
        manifest: addon.manifest,
        catalog: relationCatalog,
      })) {
        if (!relationCheck.blockingIssues.includes(issue)) {
          relationCheck.blockingIssues.push(issue)
        }
      }

      if (relationCheck.blockingIssues.length > 0) {
        throw new Error(relationCheck.blockingIssues.join("；"))
      }

      await executeAddonActionHook("addon.enabled.before", {
        addonId: resolvedAddonId,
        version: addon.manifest.version,
      }, {
        throwOnError: true,
        pathname: `/__addons/enable/${resolvedAddonId}`,
      })

      await persistAddonState(addon, {
        ...ensuredState,
        enabled: true,
        disabledAt: null,
        uninstalledAt: null,
        lastErrorAt: null,
        lastErrorMessage: null,
      }, {
        action: "ENABLE",
        message: `已启用插件 ${addon.manifest.name}`,
      })
      refreshAddonRuntime(resolvedAddonId)
      await executeAddonActionHook("addon.enabled.after", {
        addonId: resolvedAddonId,
        version: addon.manifest.version,
      })
      return {
        data: await getAddonsAdminData(),
        message: `已启用插件 ${addon.manifest.name}`,
      }
    }
    case "disable": {
      const dependentAddonIssues = collectDependentAddonIssues({
        addonId: resolvedAddonId,
        catalog: relationCatalog,
      })
      if (dependentAddonIssues.length > 0) {
        throw new Error(dependentAddonIssues.join("；"))
      }

      await executeAddonActionHook("addon.disabled.before", {
        addonId: resolvedAddonId,
        version: addon.manifest.version,
      }, {
        throwOnError: true,
        pathname: `/__addons/disable/${resolvedAddonId}`,
      })

      await persistAddonState(addon, {
        ...ensuredState,
        enabled: false,
        disabledAt: now,
      }, {
        action: "DISABLE",
        message: `已禁用插件 ${addon.manifest.name}`,
      })
      refreshAddonRuntime(resolvedAddonId)
      if (addonMayUseBackgroundJobs(addon)) {
        await cleanupAddonBackgroundJobs(resolvedAddonId)
      }
      await executeAddonActionHook("addon.disabled.after", {
        addonId: resolvedAddonId,
        version: addon.manifest.version,
      })
      return {
        data: await getAddonsAdminData(),
        message: `已禁用插件 ${addon.manifest.name}`,
      }
    }
    case "remove": {
      const dependentAddonIssues = collectDependentAddonIssues({
        addonId: resolvedAddonId,
        catalog: relationCatalog,
      })
      if (dependentAddonIssues.length > 0) {
        throw new Error(dependentAddonIssues.join("；"))
      }

      const { removeInstalledAddon } = await import("@/addons-host/installer")
      await removeInstalledAddon(resolvedAddonId)
      refreshAddonRuntime(resolvedAddonId)
      return {
        data: await getAddonsAdminData(),
        message: `已物理卸载插件 ${addon.manifest.name}`,
      }
    }
    default:
      throw new Error(`未知插件操作：${action}`)
  }
}
