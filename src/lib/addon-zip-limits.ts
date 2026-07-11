export type AddonZipLimits = {
  maxArchiveBytes: number
  maxEntries: number
  maxUncompressedBytes: number
  maxFileBytes: number
  maxCompressionRatio: number
}

export type AddonZipEntryMetadata = {
  entryName: string
  isDirectory: boolean
  compressedSize: number
  uncompressedSize: number
  encrypted?: boolean
}

const MEBIBYTE = 1024 * 1024

export const DEFAULT_ADDON_ZIP_LIMITS: AddonZipLimits = {
  maxArchiveBytes: 16 * MEBIBYTE,
  maxEntries: 256,
  maxUncompressedBytes: 64 * MEBIBYTE,
  maxFileBytes: 16 * MEBIBYTE,
  maxCompressionRatio: 100,
}

function readBoundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  if (!value?.trim()) return fallback

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return fallback

  return parsed
}

/**
 * Canonicalizes a ZIP entry name before it is used as a filesystem path.
 * ZIP names are required to be relative POSIX paths. Rejecting ambiguous
 * Windows and absolute forms avoids archive metadata being interpreted
 * differently by validation and extraction on different hosts.
 */
export function normalizeAddonZipEntryPath(entryName: string) {
  if (typeof entryName !== "string" || !entryName || entryName.includes("\0")) {
    throw new Error(`Plugin archive contains an invalid path: ${String(entryName)}`)
  }

  // macOS metadata is not addon content and may be ignored safely.
  if (entryName.startsWith("__MACOSX/")) {
    return null
  }

  if (entryName.startsWith("/") || entryName.includes("\\")) {
    throw new Error(`Plugin archive contains an invalid path: ${entryName}`)
  }

  const withoutTrailingSlash = entryName.endsWith("/")
    ? entryName.slice(0, -1)
    : entryName
  if (!withoutTrailingSlash || withoutTrailingSlash.endsWith("/")) {
    throw new Error(`Plugin archive contains an invalid path: ${entryName}`)
  }

  const segments = withoutTrailingSlash.split("/")
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`Plugin archive contains an invalid path: ${entryName}`)
  }

  // `C:relative` and `C:/absolute` have host-specific resolution behavior on
  // Windows, so reject either instead of trying to normalize them.
  if (/^[A-Za-z]:/.test(withoutTrailingSlash)) {
    throw new Error(`Plugin archive contains an invalid path: ${entryName}`)
  }

  return withoutTrailingSlash
}

/**
 * Environment overrides are intentionally bounded, so a typo cannot silently
 * remove archive safety limits:
 * - RHEX_ADDON_ZIP_MAX_ARCHIVE_BYTES
 * - RHEX_ADDON_ZIP_MAX_ENTRIES
 * - RHEX_ADDON_ZIP_MAX_UNCOMPRESSED_BYTES
 * - RHEX_ADDON_ZIP_MAX_FILE_BYTES
 * - RHEX_ADDON_ZIP_MAX_COMPRESSION_RATIO
 */
export function resolveAddonZipLimits(env: Record<string, string | undefined> = process.env): AddonZipLimits {
  return {
    maxArchiveBytes: readBoundedInteger(env.RHEX_ADDON_ZIP_MAX_ARCHIVE_BYTES, DEFAULT_ADDON_ZIP_LIMITS.maxArchiveBytes, 1, 128 * MEBIBYTE),
    maxEntries: readBoundedInteger(env.RHEX_ADDON_ZIP_MAX_ENTRIES, DEFAULT_ADDON_ZIP_LIMITS.maxEntries, 1, 10_000),
    maxUncompressedBytes: readBoundedInteger(env.RHEX_ADDON_ZIP_MAX_UNCOMPRESSED_BYTES, DEFAULT_ADDON_ZIP_LIMITS.maxUncompressedBytes, 1, 512 * MEBIBYTE),
    maxFileBytes: readBoundedInteger(env.RHEX_ADDON_ZIP_MAX_FILE_BYTES, DEFAULT_ADDON_ZIP_LIMITS.maxFileBytes, 1, 128 * MEBIBYTE),
    maxCompressionRatio: readBoundedInteger(env.RHEX_ADDON_ZIP_MAX_COMPRESSION_RATIO, DEFAULT_ADDON_ZIP_LIMITS.maxCompressionRatio, 1, 10_000),
  }
}

export function assertAddonZipArchiveSize(archiveBytes: number, limits = resolveAddonZipLimits()) {
  if (!Number.isSafeInteger(archiveBytes) || archiveBytes <= 0) {
    throw new Error("上传的插件压缩包为空或不合法")
  }

  if (archiveBytes > limits.maxArchiveBytes) {
    throw new Error(`插件压缩包不能超过 ${formatBytes(limits.maxArchiveBytes)}`)
  }
}

export function assertAddonZipEntryLimits(
  entries: readonly AddonZipEntryMetadata[],
  limits = resolveAddonZipLimits(),
) {
  if (entries.length > limits.maxEntries) {
    throw new Error(`插件压缩包最多包含 ${limits.maxEntries} 个条目`)
  }

  let totalUncompressedBytes = 0

  for (const entry of entries) {
    if (entry.encrypted) {
      throw new Error(`插件压缩包不支持加密条目：${entry.entryName}`)
    }

    if (!Number.isSafeInteger(entry.compressedSize) || entry.compressedSize < 0
      || !Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0) {
      throw new Error(`插件压缩包条目大小不合法：${entry.entryName}`)
    }

    if (entry.isDirectory) continue

    if (entry.uncompressedSize > limits.maxFileBytes) {
      throw new Error(`插件压缩包单个文件不能超过 ${formatBytes(limits.maxFileBytes)}：${entry.entryName}`)
    }

    totalUncompressedBytes += entry.uncompressedSize
    if (totalUncompressedBytes > limits.maxUncompressedBytes) {
      throw new Error(`插件压缩包解压后总大小不能超过 ${formatBytes(limits.maxUncompressedBytes)}`)
    }

    const ratio = entry.uncompressedSize === 0
      ? 1
      : entry.compressedSize === 0
        ? Number.POSITIVE_INFINITY
        : entry.uncompressedSize / entry.compressedSize
    if (ratio > limits.maxCompressionRatio) {
      throw new Error(`插件压缩包压缩比超过 ${limits.maxCompressionRatio}:1：${entry.entryName}`)
    }
  }

  return { totalUncompressedBytes }
}

/**
 * Tracks bytes emitted by the extractor itself. ZIP central-directory metadata
 * is untrusted, so extraction must enforce the same file and aggregate limits
 * against the bytes actually produced, not only the advertised sizes.
 */
export function createAddonZipExtractionBudget(limits = resolveAddonZipLimits()) {
  let totalUncompressedBytes = 0

  return {
    consume(entryName: string, actualBytes: number) {
      if (!Number.isSafeInteger(actualBytes) || actualBytes < 0) {
        throw new Error(`插件压缩包条目实际大小不合法ï¼${entryName}`)
      }

      if (actualBytes > limits.maxFileBytes) {
        throw new Error(`插件压缩包单个文件不能超过 ${formatBytes(limits.maxFileBytes)}ï¼${entryName}`)
      }

      totalUncompressedBytes += actualBytes
      if (!Number.isSafeInteger(totalUncompressedBytes) || totalUncompressedBytes > limits.maxUncompressedBytes) {
        throw new Error(`插件压缩包解压后总大小不能超过 ${formatBytes(limits.maxUncompressedBytes)}`)
      }

      return { totalUncompressedBytes }
    },
  }
}

export function formatBytes(bytes: number) {
  if (bytes >= MEBIBYTE) return `${Math.floor(bytes / MEBIBYTE)}MB`
  if (bytes >= 1024) return `${Math.floor(bytes / 1024)}KB`
  return `${bytes}B`
}