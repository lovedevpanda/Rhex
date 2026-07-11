export type UserUploadLimits = {
  /** Maximum number of new upload records a user may create in one UTC day. */
  dailyFileCount: number
  /** Maximum total bytes of new upload records a user may create in one UTC day. */
  dailyBytes: number
  /** Minimum interval between upload attempts, shared by all upload endpoints. */
  minIntervalMs: number
}

export type UserUploadUsage = {
  fileCount: number
  totalBytes: number
}

export class UserUploadQuotaExceededError extends Error {
  readonly kind: "count" | "bytes"

  constructor(kind: "count" | "bytes", message: string) {
    super(message)
    this.name = "UserUploadQuotaExceededError"
    this.kind = kind
  }
}

const MEBIBYTE = 1024 * 1024

// Multipart framing and small text fields are permitted in addition to the
// actual file. The file size is still checked exactly after FormData parsing.
export const UPLOAD_MULTIPART_OVERHEAD_BYTES = MEBIBYTE

export const DEFAULT_USER_UPLOAD_LIMITS: UserUploadLimits = {
  dailyFileCount: 40,
  dailyBytes: 100 * MEBIBYTE,
  minIntervalMs: 2_000,
}

const MAX_DAILY_FILE_COUNT = 10_000
const MAX_DAILY_BYTES = 20 * 1024 * MEBIBYTE
const MAX_INTERVAL_MS = 60 * 60 * 1000

function readBoundedInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  if (!value?.trim()) {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    return fallback
  }

  return parsed
}

/**
 * Runtime configuration intentionally comes from environment variables so that
 * quota changes do not require a schema migration:
 * - RHEX_UPLOAD_DAILY_FILE_COUNT
 * - RHEX_UPLOAD_DAILY_BYTES
 * - RHEX_UPLOAD_MIN_INTERVAL_MS
 *
 * Invalid values fail closed to conservative defaults instead of disabling the
 * protection accidentally.
 */
export function resolveUserUploadLimits(env: Record<string, string | undefined> = process.env): UserUploadLimits {
  return {
    dailyFileCount: readBoundedInteger(
      env.RHEX_UPLOAD_DAILY_FILE_COUNT,
      DEFAULT_USER_UPLOAD_LIMITS.dailyFileCount,
      1,
      MAX_DAILY_FILE_COUNT,
    ),
    dailyBytes: readBoundedInteger(
      env.RHEX_UPLOAD_DAILY_BYTES,
      DEFAULT_USER_UPLOAD_LIMITS.dailyBytes,
      1,
      MAX_DAILY_BYTES,
    ),
    minIntervalMs: readBoundedInteger(
      env.RHEX_UPLOAD_MIN_INTERVAL_MS,
      DEFAULT_USER_UPLOAD_LIMITS.minIntervalMs,
      0,
      MAX_INTERVAL_MS,
    ),
  }
}

export function isUploadRequestContentLengthWithinLimit(
  contentLength: string | null,
  maxFileBytes: number,
) {
  if (!contentLength) return true

  const parsed = Number(contentLength)
  if (!Number.isSafeInteger(parsed) || parsed < 0 || !Number.isFinite(maxFileBytes) || maxFileBytes < 0) {
    return false
  }

  return parsed <= maxFileBytes + UPLOAD_MULTIPART_OVERHEAD_BYTES
}

export function getUtcDayRange(now: Date = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)

  return { start, end }
}

export function getUtcDayLockKey(now: Date = new Date()) {
  return (
    now.getUTCFullYear() * 10_000
    + (now.getUTCMonth() + 1) * 100
    + now.getUTCDate()
  )
}

export function assertUserUploadQuota(input: {
  usage: UserUploadUsage
  incomingBytes: number
  limits: UserUploadLimits
}) {
  const incomingBytes = Math.max(0, Math.floor(input.incomingBytes))
  const nextFileCount = input.usage.fileCount + 1
  const nextTotalBytes = input.usage.totalBytes + incomingBytes

  if (nextFileCount > input.limits.dailyFileCount) {
    throw new UserUploadQuotaExceededError(
      "count",
      `今日最多可上传 ${input.limits.dailyFileCount} 个文件，请明天再试`,
    )
  }

  if (nextTotalBytes > input.limits.dailyBytes) {
    throw new UserUploadQuotaExceededError(
      "bytes",
      `今日上传总量不能超过 ${formatUploadBytes(input.limits.dailyBytes)}`,
    )
  }
}

export function formatUploadBytes(bytes: number) {
  if (bytes >= MEBIBYTE) {
    return `${Math.floor(bytes / MEBIBYTE)}MB`
  }

  if (bytes >= 1024) {
    return `${Math.floor(bytes / 1024)}KB`
  }

  return `${bytes}B`
}