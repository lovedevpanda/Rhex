import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"

import AdmZip from "adm-zip"

import {
  createAddonLifecycleLog,
  deleteAddonRegistryRecord,
  upsertAddonRegistryRecord,
} from "@/db/addon-registry-queries"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
import type { AddonInstallPreviewData } from "@/addons-host/admin-types"
import {
  clearAddonsRuntimeCache,
  findLoadedAddonById,
  loadAddonsRuntimeFresh,
} from "@/addons-host/runtime/loader"
import {
  addonMayUseBackgroundJobs,
  cleanupAddonBackgroundJobs,
} from "@/addons-host/runtime/background-jobs"
import { normalizeAddonManifest } from "@/addons-host/runtime/manifest"
import {
  ensureDirectory,
  fileExists,
  getAddonDirectory,
  getAddonsRootDirectory,
  getAddonsStagingDirectory,
  getAddonsTrashDirectory,
  isValidAddonId,
  movePath,
  removeDirectoryIfExists,
  readJsonFile,
  resolveSafeAddonChildPath,
} from "@/addons-host/runtime/fs"
import {
  importAddonLifecycleTargetFromDirectory,
  runAddonLifecycle,
} from "@/addons-host/runtime/lifecycle"
import { syncAddonRegistryState } from "@/addons-host/management"
import { deleteAddonConfigValues } from "@/addons-host/runtime/config"
import { deleteAddonDataStore } from "@/addons-host/runtime/data"
import { deleteAddonSecretValues } from "@/addons-host/runtime/secrets"

interface InstallAddonFromZipInput {
  zipBuffer: Buffer
  originalName?: string | null
  replaceExisting?: boolean
  enableAfterInstall?: boolean
}

function normalizeZipEntryName(entryName: string) {
  return entryName
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
}

function validateZipEntryName(entryName: string) {
  const normalized = normalizeZipEntryName(entryName)

  if (!normalized || normalized.startsWith("__MACOSX/")) {
    return null
  }

  const segments = normalized.split("/").filter(Boolean)
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`插件压缩包包含非法路径：${entryName}`)
  }

  return normalized
}

function resolveManifestRelativePathFromZip(zip: AdmZip) {
  const candidates = zip
    .getEntries()
    .filter((entry) => !entry.isDirectory)
    .map((entry) => validateZipEntryName(entry.entryName))
    .filter((entryName): entryName is string => Boolean(entryName))
    .filter((entryName) => entryName.endsWith("/addon.json") || entryName === "addon.json")

  if (candidates.length === 0) {
    throw new Error("插件压缩包中缺少 addon.json")
  }

  if (candidates.length > 1) {
    throw new Error("插件压缩包中存在多个 addon.json，无法确定插件根目录")
  }

  return candidates[0]
}

function buildTrashPath(addonId: string) {
  const suffix = `${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`
  return path.join(getAddonsTrashDirectory(), `${addonId}-${suffix}`)
}

async function cleanupAddonPersistentState(addonId: string) {
  await deleteAddonConfigValues(addonId)
  await deleteAddonDataStore(addonId)
  await deleteAddonSecretValues(addonId)
}

async function readAddonManifestFromDirectory(rootDir: string) {
  const manifestPath = await resolveSafeAddonChildPath(rootDir, "addon.json")
  return normalizeAddonManifest(await readJsonFile<unknown>(manifestPath))
}

function classifyInstallPermissionRisk(permission: string) {
  return [
    "secret:read",
    "secret:write",
    "database:sql",
    "database:orm",
    "network:external",
    "auth:integrate",
    "captcha:integrate",
    "payment:integrate",
    "page:admin",
    "api:admin",
    "post:create",
    "post:query",
    "post:like",
    "comment:create",
    "comment:query",
    "comment:like",
    "message:send",
    "notification:create",
    "follow:user",
    "points:adjust",
    "post:tip",
  ].includes(permission)
    ? "sensitive"
    : "normal"
}

export async function inspectAddonZip(input: {
  zipBuffer: Buffer
  replaceExisting?: boolean
  enableAfterInstall?: boolean
}): Promise<AddonInstallPreviewData> {
  if (!input.zipBuffer || input.zipBuffer.byteLength === 0) {
    throw new Error("上传的插件压缩包为空")
  }

  await ensureDirectory(getAddonsStagingDirectory())

  const zip = new AdmZip(input.zipBuffer)
  const manifestRelativePath = resolveManifestRelativePathFromZip(zip)
  const extractedWorkingDir = path.join(getAddonsStagingDirectory(), `inspect-${Date.now()}-${randomUUID().slice(0, 8)}`)
  await ensureDirectory(extractedWorkingDir)

  try {
    zip.extractAllTo(extractedWorkingDir, true)

    const manifestAbsolutePath = await resolveSafeAddonChildPath(extractedWorkingDir, manifestRelativePath)
    const manifestDirectory = path.dirname(manifestAbsolutePath)
    const manifest = normalizeAddonManifest(JSON.parse(await fs.readFile(manifestAbsolutePath, "utf8")))

    if (!isValidAddonId(manifest.id)) {
      throw new Error(`插件标识不合法：${manifest.id}`)
    }

    const serverEntryPath = await resolveSafeAddonChildPath(
      manifestDirectory,
      manifest.entry?.server?.trim() || "dist/server.mjs",
    )
    if (!(await fileExists(serverEntryPath))) {
      throw new Error("插件服务端入口不存在")
    }

    const targetDirectory = getAddonDirectory(manifest.id)
    const targetExists = await fileExists(targetDirectory)
    if (targetExists && !input.replaceExisting) {
      throw new Error(`插件目录已存在：${manifest.id}，如需升级请开启“覆盖安装 / 升级”`)
    }

    const existingVersion = targetExists
      ? (await readAddonManifestFromDirectory(targetDirectory)).version
      : null

    return {
      addonId: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description ?? null,
      permissions: (manifest.permissions ?? []).map((permission) => ({
        key: permission,
        risk: classifyInstallPermissionRisk(permission),
      })),
      installAction: targetExists ? "upgrade" : "install",
      existingVersion,
      replaceExisting: Boolean(input.replaceExisting),
      enableAfterInstall: input.enableAfterInstall !== false,
    }
  } finally {
    await removeDirectoryIfExists(extractedWorkingDir)
  }
}

export async function installAddonFromZip(input: InstallAddonFromZipInput) {
  if (!input.zipBuffer || input.zipBuffer.byteLength === 0) {
    throw new Error("上传的插件压缩包为空")
  }

  await ensureDirectory(getAddonsStagingDirectory())
  await ensureDirectory(getAddonsTrashDirectory())

  const zip = new AdmZip(input.zipBuffer)
  const manifestRelativePath = resolveManifestRelativePathFromZip(zip)
  const extractedWorkingDir = path.join(getAddonsStagingDirectory(), `install-${Date.now()}-${randomUUID().slice(0, 8)}`)
  await ensureDirectory(extractedWorkingDir)

  try {
    zip.extractAllTo(extractedWorkingDir, true)

    const manifestAbsolutePath = await resolveSafeAddonChildPath(extractedWorkingDir, manifestRelativePath)
    const manifestDirectory = path.dirname(manifestAbsolutePath)
    const stagedAddon = await importAddonLifecycleTargetFromDirectory(manifestDirectory)
    const manifest = stagedAddon.manifest

    if (!isValidAddonId(manifest.id)) {
      throw new Error(`插件标识不合法：${manifest.id}`)
    }

    const targetDirectory = getAddonDirectory(manifest.id)
    const targetExists = await fileExists(targetDirectory)
    if (targetExists && !input.replaceExisting) {
      throw new Error(`插件目录已存在：${manifest.id}`)
    }

    const existingAddon = targetExists
      ? await findLoadedAddonById(manifest.id)
      : null
    const previousManifest = targetExists
      ? existingAddon?.manifest ?? await readAddonManifestFromDirectory(targetDirectory)
      : null
    const previousRootDir = targetExists
      ? existingAddon?.rootDir ?? targetDirectory
      : null
    const previousVersion = previousManifest?.version ?? null

    if (targetExists && previousManifest && previousRootDir && previousVersion) {
      await runAddonLifecycle(stagedAddon, {
        action: "upgrade",
        previousManifest,
        previousVersion,
        previousRootDir,
        logAddonId: manifest.id,
        logMetadata: {
          originalName: input.originalName ?? null,
          replaceExisting: true,
        },
      })
    } else {
      try {
        await runAddonLifecycle(stagedAddon, {
          action: "install",
        })
      } catch (error) {
        await cleanupAddonPersistentState(manifest.id)
        throw error
      }
    }

    let replacedTrashPath: string | null = null
    if (targetExists && input.replaceExisting) {
      replacedTrashPath = buildTrashPath(manifest.id)
      await movePath(targetDirectory, replacedTrashPath)
    }

    try {
      await movePath(manifestDirectory, targetDirectory)
    } catch (error) {
      if (
        replacedTrashPath
        && (await fileExists(replacedTrashPath))
        && !(await fileExists(targetDirectory))
      ) {
        await movePath(replacedTrashPath, targetDirectory).catch(() => undefined)
      }

      throw error
    }
    if (manifestDirectory !== extractedWorkingDir) {
      await removeDirectoryIfExists(extractedWorkingDir)
    }

    const now = new Date().toISOString()
    const enableAfterInstall = input.enableAfterInstall !== false
    await upsertAddonRegistryRecord({
      addonId: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description ?? null,
      sourceDir: targetDirectory,
      state: enableAfterInstall ? "ENABLED" : "DISABLED",
      enabled: enableAfterInstall,
      manifestJson: manifest,
      permissionsJson: manifest.permissions ?? [],
      installedAt: new Date(now),
      disabledAt: enableAfterInstall ? null : new Date(now),
      uninstalledAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
    })

    clearAddonsRuntimeCache()
    await syncAddonRegistryState()
    const addons = await loadAddonsRuntimeFresh()
    const installedAddon = addons.find((item) => item.manifest.id === manifest.id) ?? null

    if (installedAddon) {
      await upsertAddonRegistryRecord({
        addonId: installedAddon.manifest.id,
        name: installedAddon.manifest.name,
        version: installedAddon.manifest.version,
        description: installedAddon.manifest.description ?? null,
        sourceDir: installedAddon.rootDir,
        state: enableAfterInstall ? "ENABLED" : "DISABLED",
        enabled: enableAfterInstall,
        manifestJson: installedAddon.manifest,
        permissionsJson: installedAddon.manifest.permissions ?? [],
        installedAt: new Date(now),
        disabledAt: enableAfterInstall ? null : new Date(now),
        uninstalledAt: null,
        lastErrorAt: null,
        lastErrorMessage: null,
      })

      await createAddonLifecycleLog({
        addonId: installedAddon.manifest.id,
        action: targetExists && input.replaceExisting ? "UPGRADE" : "INSTALL",
        status: "SUCCEEDED",
        message: targetExists && input.replaceExisting
          ? `已升级插件 ${installedAddon.manifest.name}`
          : `已安装插件 ${installedAddon.manifest.name}`,
        metadataJson: {
          originalName: input.originalName ?? null,
          replaceExisting: Boolean(input.replaceExisting),
          enableAfterInstall,
          previousVersion,
          nextVersion: installedAddon.manifest.version,
        },
      })

      await executeAddonActionHook("addon.installed.after", {
        addonId: installedAddon.manifest.id,
        version: installedAddon.manifest.version,
      })
    }

    return {
      addonId: manifest.id,
      name: manifest.name,
      version: manifest.version,
      replacedExisting: Boolean(targetExists && input.replaceExisting),
      enabled: enableAfterInstall,
      action: targetExists && input.replaceExisting ? "upgraded" as const : "installed" as const,
    }
  } catch (error) {
    await removeDirectoryIfExists(extractedWorkingDir)
    throw error
  }
}

export async function removeInstalledAddon(addonId: string) {
  const addon = await findLoadedAddonById(addonId)
  if (!addon) {
    throw new Error(`插件不存在：${addonId}`)
  }

  const addonRootDirectory = getAddonsRootDirectory()
  const resolvedAddonDirectory = path.resolve(addon.rootDir)
  const resolvedRootDirectory = path.resolve(addonRootDirectory)

  if (resolvedAddonDirectory !== resolvedRootDirectory && !resolvedAddonDirectory.startsWith(`${resolvedRootDirectory}${path.sep}`)) {
    throw new Error(`插件目录超出 addons 根目录：${resolvedAddonDirectory}`)
  }

  if (!(await fileExists(resolvedAddonDirectory))) {
    throw new Error("插件目录不存在，无法物理卸载")
  }

  const uninstallTarget = await importAddonLifecycleTargetFromDirectory(
    resolvedAddonDirectory,
    addon.state,
  ).catch(() => null)

  if (uninstallTarget) {
    await runAddonLifecycle(uninstallTarget, {
      action: "uninstall",
      currentVersion: addon.manifest.version,
      logAddonId: addonId,
    })
  }

  if (addonMayUseBackgroundJobs(addon)) {
    await cleanupAddonBackgroundJobs(addonId)
  }

  await ensureDirectory(getAddonsTrashDirectory())
  const trashPath = buildTrashPath(addonId)
  await movePath(resolvedAddonDirectory, trashPath)
  if (addonMayUseBackgroundJobs(addon)) {
    await cleanupAddonBackgroundJobs(addonId)
  }
  await cleanupAddonPersistentState(addonId)
  await deleteAddonRegistryRecord(addonId)
  clearAddonsRuntimeCache()

  await executeAddonActionHook("addon.uninstalled.after", {
    addonId,
    version: addon.manifest.version,
  })

  return {
    addonId,
    trashPath,
  }
}
