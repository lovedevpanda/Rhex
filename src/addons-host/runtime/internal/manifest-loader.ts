/**
 * @file manifest-loader.ts
 * @responsibility addon server entry 动态 import / manifest 归一化为 runtime descriptor
 * @scope Phase B.6 抽自 runtime/loader.ts: importAddonDefinition / resolveAddonServerEntryPath / buildAddonRuntimeDescriptor
 * @depends-on node:crypto, node:fs, node:path, node:url, ../constants, ../fs, ../manifest, ../permissions, @/addons-host/types
 * @exports DEFAULT_SERVER_ENTRY_RELATIVE_PATH, importAddonDefinition, resolveAddonServerEntryPath, buildAddonRuntimeDescriptor
 */

import { createHash } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  ADDON_ADMIN_API_PREFIX,
  ADDON_ADMIN_PAGE_PREFIX,
  ADDON_ASSET_PUBLIC_PREFIX,
  ADDON_PUBLIC_API_PREFIX,
  ADDON_PUBLIC_PAGE_PREFIX,
} from "@/addons-host/runtime/constants"
import {
  ensureDirectory,
  fileExists,
  getAddonsStateDirectory,
  readJsonFile,
  resolveSafeAddonChildPath,
} from "@/addons-host/runtime/fs"
import { normalizeAddonManifest } from "@/addons-host/runtime/manifest"
import {
  assertAddonManifestPermissionDeclarations,
  assertAddonTrustedCodeExecutionAcknowledged,
} from "@/addons-host/runtime/permissions"
import type {
  AddonDefinition,
  AddonManifest,
  AddonStateRecord,
} from "@/addons-host/types"

export const DEFAULT_SERVER_ENTRY_RELATIVE_PATH = "dist/server.mjs"
const ADDON_MODULE_CACHE_DIRNAME = "module-cache"
const EXCLUDED_ADDON_IMPORT_ROOT_SEGMENTS = new Set(["assets"])

async function collectImportableAddonFileFingerprints(
  rootDir: string,
  currentDir = rootDir,
): Promise<string[]> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true })
  const fingerprints: string[] = []

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "zh-CN"))) {
    const absolutePath = path.join(currentDir, entry.name)
    const relativePath = path.relative(rootDir, absolutePath)
    const normalizedRelativePath = relativePath.replaceAll("\\", "/")
    const topLevelSegment = normalizedRelativePath.split("/")[0]

    if (topLevelSegment && EXCLUDED_ADDON_IMPORT_ROOT_SEGMENTS.has(topLevelSegment)) {
      continue
    }

    if (entry.isDirectory()) {
      fingerprints.push(...await collectImportableAddonFileFingerprints(rootDir, absolutePath))
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const stat = await fs.stat(absolutePath)
    fingerprints.push(`${normalizedRelativePath}:${stat.size}:${stat.mtimeMs}`)
  }

  return fingerprints
}

async function resolveVersionedAddonImportRoot(rootDir: string) {
  const fingerprint = createHash("sha1")
    .update((await collectImportableAddonFileFingerprints(rootDir)).join("|"))
    .digest("hex")
    .slice(0, 12)
  const cacheBaseDir = path.join(
    getAddonsStateDirectory(),
    ADDON_MODULE_CACHE_DIRNAME,
    path.basename(rootDir),
  )
  const versionedRootDir = path.join(cacheBaseDir, fingerprint)

  if (!(await fileExists(versionedRootDir))) {
    await ensureDirectory(cacheBaseDir)
    await fs.cp(rootDir, versionedRootDir, {
      recursive: true,
      force: true,
      filter(source) {
        const relativePath = path.relative(rootDir, source)
        if (!relativePath) {
          return true
        }

        const normalizedRelativePath = relativePath.replaceAll("\\", "/")
        const topLevelSegment = normalizedRelativePath.split("/")[0]
        return !EXCLUDED_ADDON_IMPORT_ROOT_SEGMENTS.has(topLevelSegment)
      },
    })
  }

  return versionedRootDir
}

async function assertAddonServerEntryMayExecute(rootDir: string) {
  const manifestPath = await resolveSafeAddonChildPath(rootDir, "addon.json")
  const manifest = normalizeAddonManifest(await readJsonFile<unknown>(manifestPath))

  // Importing an ES module executes its top-level code. Validate before this
  // point so an unacknowledged or misleading addon cannot be evaluated.
  assertAddonManifestPermissionDeclarations(manifest)
  assertAddonTrustedCodeExecutionAcknowledged(manifest.id)

  return manifest
}

export async function importAddonDefinition(
  rootDir: string,
  entryServerPath: string,
): Promise<AddonDefinition> {
  await assertAddonServerEntryMayExecute(rootDir)
  const versionedRootDir = await resolveVersionedAddonImportRoot(rootDir)
  const versionedEntryPath = path.join(
    versionedRootDir,
    path.relative(rootDir, entryServerPath),
  )
  const entryUrl = pathToFileURL(versionedEntryPath).href
  const moduleExports = await import(/* webpackIgnore: true */ entryUrl)
  const candidate = (moduleExports.default ?? moduleExports) as Partial<AddonDefinition> | undefined

  if (!candidate || typeof candidate.setup !== "function") {
    throw new Error("addon server entry must export an object with setup(api)")
  }

  return candidate as AddonDefinition
}

export async function resolveAddonServerEntryPath(rootDir: string, manifest: AddonManifest) {
  const requestedEntry = manifest.entry?.server?.trim() || DEFAULT_SERVER_ENTRY_RELATIVE_PATH
  const resolvedEntry = await resolveSafeAddonChildPath(rootDir, requestedEntry)

  return (await fileExists(resolvedEntry)) ? resolvedEntry : null
}

export function buildAddonRuntimeDescriptor(manifest: AddonManifest, rootDir: string, state: AddonStateRecord) {
  const enabled = !state.uninstalledAt && (state.enabled ?? manifest.enabled ?? true)

  return {
    manifest,
    state,
    enabled,
    rootDir,
    assetRootDir: path.join(rootDir, "assets"),
    assetBaseUrl: `${ADDON_ASSET_PUBLIC_PREFIX}/${manifest.id}`,
    publicBaseUrl: `${ADDON_PUBLIC_PAGE_PREFIX}/${manifest.id}`,
    adminBaseUrl: `${ADDON_ADMIN_PAGE_PREFIX}/${manifest.id}`,
    publicApiBaseUrl: `${ADDON_PUBLIC_API_PREFIX}/${manifest.id}`,
    adminApiBaseUrl: `${ADDON_ADMIN_API_PREFIX}/${manifest.id}`,
  }
}
