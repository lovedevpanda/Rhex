import { promises as fs } from "node:fs"
import path from "node:path"

import {
  ADDONS_DIRECTORY_NAME,
  ADDONS_STATE_DIRECTORY_NAME,
  ADDONS_STAGING_DIRECTORY_NAME,
  ADDONS_TRASH_DIRECTORY_NAME,
} from "@/addons-host/runtime/constants"

const ADDON_ID_PATTERN = /^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$/i

export function getAddonsRootDirectory() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), ADDONS_DIRECTORY_NAME)
}

export function getAddonsStateDirectory() {
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    ADDONS_DIRECTORY_NAME,
    ADDONS_STATE_DIRECTORY_NAME,
  )
}

export function getAddonsStagingDirectory() {
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    ADDONS_DIRECTORY_NAME,
    ADDONS_STAGING_DIRECTORY_NAME,
  )
}

export function getAddonsTrashDirectory() {
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    ADDONS_DIRECTORY_NAME,
    ADDONS_TRASH_DIRECTORY_NAME,
  )
}

export function getAddonDirectory(addonId: string) {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), ADDONS_DIRECTORY_NAME, addonId)
}

export function getAddonAssetsDirectory(addonId: string) {
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    ADDONS_DIRECTORY_NAME,
    addonId,
    "assets",
  )
}

export function isValidAddonId(value: string) {
  return ADDON_ID_PATTERN.test(value) && !value.includes("..")
}

export function normalizeMountedAddonPath(value?: string | null) {
  const normalizedValue = typeof value === "string" ? value.trim() : ""
  return normalizedValue
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
}

export async function fileExists(targetPath: string) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

export async function ensureDirectory(targetPath: string) {
  await fs.mkdir(targetPath, { recursive: true })
}

export async function removeDirectoryIfExists(targetPath: string) {
  if (!(await fileExists(targetPath))) {
    return
  }

  await fs.rm(targetPath, { recursive: true, force: true })
}

export async function movePath(sourcePath: string, destinationPath: string) {
  await fs.rename(sourcePath, destinationPath)
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf8")
  return JSON.parse(content) as T
}

export async function resolveSafeAddonChildPath(baseDir: string, relativePath: string) {
  const normalizedRelativePath = normalizeMountedAddonPath(relativePath)
  const resolvedPath = path.resolve(baseDir, normalizedRelativePath)
  const normalizedBaseDir = path.resolve(baseDir)

  if (resolvedPath !== normalizedBaseDir && !resolvedPath.startsWith(`${normalizedBaseDir}${path.sep}`)) {
    throw new Error(`addon path escapes base directory: ${relativePath}`)
  }

  return resolvedPath
}
