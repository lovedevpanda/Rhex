import assert from "node:assert/strict"
import test from "node:test"

import {
  assertAddonZipArchiveSize,
  assertAddonZipEntryLimits,
  createAddonZipExtractionBudget,
  normalizeAddonZipEntryPath,
  resolveAddonZipLimits,
} from "../src/lib/addon-zip-limits"
import {
  assertUserUploadQuota,
  getUtcDayLockKey,
  getUtcDayRange,
  isUploadRequestContentLengthWithinLimit,
  resolveUserUploadLimits,
  UserUploadQuotaExceededError,
} from "../src/lib/upload-limit-policy"

test("user upload limits use bounded environment overrides and safe defaults", () => {
  assert.deepEqual(resolveUserUploadLimits({
    RHEX_UPLOAD_DAILY_FILE_COUNT: "7",
    RHEX_UPLOAD_DAILY_BYTES: "4096",
    RHEX_UPLOAD_MIN_INTERVAL_MS: "250",
  }), {
    dailyFileCount: 7,
    dailyBytes: 4096,
    minIntervalMs: 250,
  })

  const limits = resolveUserUploadLimits({
    RHEX_UPLOAD_DAILY_FILE_COUNT: "0",
    RHEX_UPLOAD_DAILY_BYTES: "unlimited",
    RHEX_UPLOAD_MIN_INTERVAL_MS: "-1",
  })
  assert.equal(limits.dailyFileCount, 40)
  assert.equal(limits.dailyBytes, 100 * 1024 * 1024)
  assert.equal(limits.minIntervalMs, 2_000)
})

test("user upload quota rejects both count and byte overages before storage", () => {
  const limits = { dailyFileCount: 2, dailyBytes: 100, minIntervalMs: 1 }

  assert.doesNotThrow(() => assertUserUploadQuota({
    usage: { fileCount: 1, totalBytes: 50 },
    incomingBytes: 50,
    limits,
  }))

  assert.throws(() => assertUserUploadQuota({
    usage: { fileCount: 2, totalBytes: 0 },
    incomingBytes: 1,
    limits,
  }), UserUploadQuotaExceededError)

  assert.throws(() => assertUserUploadQuota({
    usage: { fileCount: 0, totalBytes: 99 },
    incomingBytes: 2,
    limits,
  }), UserUploadQuotaExceededError)
})

test("user upload request content length reserves only bounded multipart overhead", () => {
  assert.equal(isUploadRequestContentLengthWithinLimit("2048", 1024), true)
  assert.equal(isUploadRequestContentLengthWithinLimit(String(1024 + 1024 * 1024 + 1), 1024), false)
  assert.equal(isUploadRequestContentLengthWithinLimit("invalid", 1024), false)
  assert.equal(isUploadRequestContentLengthWithinLimit(null, 1024), true)
})

test("user upload usage is bucketed by UTC day", () => {
  const now = new Date("2026-07-10T23:59:59.000Z")
  const { start, end } = getUtcDayRange(now)
  assert.equal(start.toISOString(), "2026-07-10T00:00:00.000Z")
  assert.equal(end.toISOString(), "2026-07-11T00:00:00.000Z")
  assert.equal(getUtcDayLockKey(now), 20260710)
})

test("addon zip limits reject archive bombs by entry count, file size, total size, and compression ratio", () => {
  const limits = {
    maxArchiveBytes: 100,
    maxEntries: 2,
    maxUncompressedBytes: 50,
    maxFileBytes: 30,
    maxCompressionRatio: 5,
  }

  assert.doesNotThrow(() => assertAddonZipArchiveSize(100, limits))
  assert.throws(() => assertAddonZipArchiveSize(101, limits), /不能超过/)
  assert.throws(() => assertAddonZipEntryLimits([
    { entryName: "a", isDirectory: false, compressedSize: 1, uncompressedSize: 1 },
    { entryName: "b", isDirectory: false, compressedSize: 1, uncompressedSize: 1 },
    { entryName: "c", isDirectory: false, compressedSize: 1, uncompressedSize: 1 },
  ], limits), /最多包含/)
  assert.throws(() => assertAddonZipEntryLimits([
    { entryName: "large.mjs", isDirectory: false, compressedSize: 10, uncompressedSize: 31 },
  ], limits), /单个文件/)
  assert.throws(() => assertAddonZipEntryLimits([
    { entryName: "first", isDirectory: false, compressedSize: 10, uncompressedSize: 25 },
    { entryName: "second", isDirectory: false, compressedSize: 10, uncompressedSize: 26 },
  ], limits), /总大小/)
  assert.throws(() => assertAddonZipEntryLimits([
    { entryName: "bomb", isDirectory: false, compressedSize: 5, uncompressedSize: 26 },
  ], limits), /压缩比/)
})

test("addon zip entry paths are canonical relative POSIX paths", () => {
  assert.equal(normalizeAddonZipEntryPath("addon.json"), "addon.json")
  assert.equal(normalizeAddonZipEntryPath("dist/client/"), "dist/client")
  assert.equal(normalizeAddonZipEntryPath("__MACOSX/._addon.json"), null)

  for (const entryName of [
    "/addon.json",
    String.raw`\\server\share\addon.json`,
    String.raw`C:\addons\addon.json`,
    "C:relative/addon.json",
    String.raw`dist\server.mjs`,
    "dist//server.mjs",
    "./addon.json",
    "dist/../addon.json",
    "dist//",
    "addon.json\0hidden",
  ]) {
    assert.throws(() => normalizeAddonZipEntryPath(entryName), /invalid path/)
  }
})

test("addon zip extraction budget enforces actual emitted bytes", () => {
  const budget = createAddonZipExtractionBudget({
    maxArchiveBytes: 100,
    maxEntries: 2,
    maxUncompressedBytes: 50,
    maxFileBytes: 30,
    maxCompressionRatio: 5,
  })

  assert.equal(budget.consume("first", 25).totalUncompressedBytes, 25)
  assert.throws(() => budget.consume("second", 26), /\u603b\u5927\u5c0f/)
})

test("addon zip environment settings remain bounded", () => {
  const limits = resolveAddonZipLimits({
    RHEX_ADDON_ZIP_MAX_ARCHIVE_BYTES: "2048",
    RHEX_ADDON_ZIP_MAX_ENTRIES: "3",
    RHEX_ADDON_ZIP_MAX_UNCOMPRESSED_BYTES: "4096",
    RHEX_ADDON_ZIP_MAX_FILE_BYTES: "1024",
    RHEX_ADDON_ZIP_MAX_COMPRESSION_RATIO: "4",
  })
  assert.equal(limits.maxArchiveBytes, 2048)
  assert.equal(limits.maxEntries, 3)
  assert.equal(limits.maxUncompressedBytes, 4096)
  assert.equal(limits.maxFileBytes, 1024)
  assert.equal(limits.maxCompressionRatio, 4)
})