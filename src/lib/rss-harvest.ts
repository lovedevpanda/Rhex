import { revalidateTag, unstable_cache } from "next/cache"

import { prisma } from "@/db/client"
import { resolvePagination, type PaginationResult } from "@/db/helpers"
import type { Prisma, RssLogLevel, RssTriggerType } from "@/db/types"
import {
  countRssEntriesForSource,
  countPendingRssSourceApplications,
  createManyRssEntries,
  createRssSourceRecord,
  findRssSourceByFeedUrl,
  findRssSourceById,
  getOrCreateRssSettingRecord,
  listRssSourcesForAdmin,
  updateRssSettingRecord,
  updateRssSourceRecord,
  type RssSettingRecord,
  type RssSourceAdminRecord,
} from "@/db/rss-harvest-queries"
import { apiError } from "@/lib/api-route"
import { ensureAdminActorPermission } from "@/lib/admin-scope-permissions"
import {
  cancelDelayedBackgroundJob,
  ensureDelayedBackgroundJob,
  findDelayedBackgroundJob,
  type DelayedBackgroundJobState,
} from "@/lib/background-job-scheduler"
import {
  registerBackgroundJobHandler,
  parseBackgroundJobEnvelopeString,
  type BackgroundJobEnvelope,
} from "@/lib/background-jobs"
import { getBackgroundJobDelayedSetKey } from "@/lib/background-job-redis"
import { formatDateTime } from "@/lib/formatters"
import { logError, logInfo } from "@/lib/logger"
import {
  fetchFeedXml,
  parseFeedXml,
  resolveRssHarvestErrorMessage,
  type FetchFeedResult,
  type ParsedFeed,
} from "@/lib/rss-harvest-feed"
import {
  claimPendingRssQueueRecord,
  clearRssQueueHistory,
  clearRssQueueHistoryBySource,
  countRssExecutionItems,
  countRssExecutionItemsBySource,
  countRssQueueSummary,
  countRssQueueItemsBySource,
  createRssQueueRecord,
  findRssQueueWithSourceById,
  listCompletedRssQueueIds,
  listCompletedRssQueueIdsBySource,
  listRssExecutionItemsPage,
  listRssExecutionItemsPageBySource,
  listRssQueueItemsBySource,
  listRssQueueItemsPageBySource,
  updateRssQueueRecord,
  type RssQueueRecord,
  type RssQueueWithSourceRecord,
} from "@/lib/rss-harvest-queue-store"
import { acquireRedisLease, type RedisLease } from "@/lib/redis-lease"
import { connectRedisClient, createRedisKey, getRedis } from "@/lib/redis"
import {
  clearRssExecutionLogs,
  deleteRssExecutionLogsByRunIds,
  findRssExecutionLogsForRunIds,
  getRssExecutionLogPage,
  persistRssExecutionLogBatch,
  type RssExecutionLogRecord,
} from "@/lib/rss-harvest-log-store"
import {
  getRssSourceRuntimeState,
  listRssSourceRuntimeStates,
  updateRssSourceRuntimeState,
  type RssSourceRuntimeState,
} from "@/lib/rss-harvest-source-state"
import { sleep } from "@/lib/shared/async"
import { addMinutes, addSeconds, toIsoString } from "@/lib/shared/date"
import { normalizeBoolean, normalizeNumber, normalizeText, normalizeTrimmedText } from "@/lib/shared/normalizers"
import { toPrismaJsonValue } from "@/lib/shared/prisma-json"
import { requireSiteAdminActor } from "@/lib/moderator-permissions"

export const RSS_SETTINGS_CACHE_TAG = "rss-settings"

const RSS_SOURCE_PAGE_SIZE = 10
const RSS_MODAL_PAGE_SIZE = 20
const RSS_PROCESS_QUEUE_BACKGROUND_JOB_NAME = "rss-harvest.process-queue-item" as const
const RSS_PROCESSING_SLOT_TTL_MS = 60_000
const RSS_PROCESSING_SLOT_RENEW_INTERVAL_MS = 20_000
const RSS_PROCESSING_SLOT_WAIT_MS = 1_000
const RSS_DELAYED_JOB_CLEANUP_BATCH_SIZE = 100
const RSS_DELAYED_JOB_CLEANUP_SCAN_LIMIT = 500
const MIN_INTERVAL_MINUTES = 1
const MAX_INTERVAL_MINUTES = 24 * 60
const MIN_TIMEOUT_MS = 3_000
const MAX_TIMEOUT_MS = 60_000
const MIN_RETRY_COUNT = 0
const MAX_RETRY_COUNT = 10
const MIN_RESPONSE_BYTES = 32 * 1024
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024
const MIN_REDIRECTS = 0
const MAX_REDIRECTS = 5
const MIN_CONCURRENCY = 1
const MAX_CONCURRENCY = 10
const MIN_FAILURE_PAUSE_THRESHOLD = 1
const MAX_FAILURE_PAUSE_THRESHOLD = 20
const MIN_HOME_PAGE_SIZE = 1
const MAX_HOME_PAGE_SIZE = 100

async function ensureCanManageRssAdmin() {
  await ensureAdminActorPermission(
    await requireSiteAdminActor(),
    "admin.apps.manage",
    "无权限访问 RSS 抓取后台",
  )
}

type LogBufferItem = {
  level: RssLogLevel
  stage: string
  message: string
  detailJson?: Prisma.InputJsonValue
}

export interface RssAdminData {
  settings: {
    id: string
    maxConcurrentJobs: number
    maxRetryCount: number
    retryBackoffSec: number
    fetchTimeoutMs: number
    maxResponseBytes: number
    maxRedirects: number
    failurePauseThreshold: number
    homeDisplayEnabled: boolean
    homePageSize: number
    userAgent: string
  }
  schedulerStatus: {
    scheduled: boolean
    stateLabel: string
    location: string
    locationLabel: string
    jobId: string | null
    enqueuedAt: string | null
    availableAt: string | null
    detail: string
  }
  queueSummary: {
    pending: number
    processing: number
    failed: number
  }
  sourcePagination: RssPaginationMeta
  sources: Array<{
    id: string
    siteName: string
    description: string | null
    feedUrl: string
    logoPath: string | null
    intervalMinutes: number
    requiresReview: boolean
    status: string
    requestTimeoutMs: number | null
    maxRetryCount: number | null
    nextRunAt: string | null
    lastRunAt: string | null
    lastSuccessAt: string | null
    lastErrorAt: string | null
    lastErrorMessage: string | null
    failureCount: number
    lastRunDurationMs: number | null
    createdAt: string
    updatedAt: string
    runCount: number
    entryCount: number
    queueCount: number
    queuePreview: Array<{
      id: string
      status: string
      triggerType: string
      attemptCount: number
      maxAttempts: number
      scheduledAt: string
      startedAt: string | null
      errorMessage: string | null
    }>
    recentRuns: Array<{
      id: string
      status: string
      triggerType: string
      startedAt: string
      finishedAt: string | null
      durationMs: number | null
      fetchedCount: number
      insertedCount: number
      duplicateCount: number
      httpStatus: number | null
      errorMessage: string | null
    }>
  }>
  pendingSourceApplicationCount: number
  recentRunsPagination: RssPaginationMeta
  recentRuns: Array<{
    id: string
    sourceId: string
    sourceName: string
    status: string
    triggerType: string
    startedAt: string
    finishedAt: string | null
    durationMs: number | null
    fetchedCount: number
    insertedCount: number
    duplicateCount: number
    httpStatus: number | null
    errorMessage: string | null
  }>
  recentLogsPagination: RssPaginationMeta
  recentLogs: Array<{
    id: string
    runId: string
    sourceId: string
    sourceName: string
    level: string
    stage: string
    message: string
    detailText: string | null
    createdAt: string
  }>
}

export interface RssPaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export interface RssSourceQueuePageData {
  sourceId: string
  sourceName: string
  items: RssAdminData["sources"][number]["queuePreview"]
  pagination: RssPaginationMeta
}

export interface RssSourceRunPageData {
  sourceId: string
  sourceName: string
  items: RssAdminData["sources"][number]["recentRuns"]
  pagination: RssPaginationMeta
}

export interface RssGlobalRunPageData {
  items: RssAdminData["recentRuns"]
  pagination: RssPaginationMeta
}

export interface RssGlobalLogPageData {
  items: RssAdminData["recentLogs"]
  pagination: RssPaginationMeta
}

function getRssProcessingSlotKey(slotIndex: number) {
  return createRedisKey("rss-harvest", "processing-slot", slotIndex)
}

async function acquireRedisRssProcessingLease(limit: number): Promise<RedisLease> {
  const effectiveLimit = Math.max(1, limit)

  while (true) {
    for (let slotIndex = 0; slotIndex < effectiveLimit; slotIndex += 1) {
      const lease = await acquireRedisLease({
        key: getRssProcessingSlotKey(slotIndex),
        ttlMs: RSS_PROCESSING_SLOT_TTL_MS,
      })

      if (lease) {
        return lease
      }
    }

    await sleep(RSS_PROCESSING_SLOT_WAIT_MS)
  }
}

async function withRssProcessingSlot<T>(limit: number, callback: () => Promise<T>) {
  const lease = await acquireRedisRssProcessingLease(limit)
  const renewTimer = setInterval(() => {
    void lease.renew(RSS_PROCESSING_SLOT_TTL_MS).catch(() => false)
  }, RSS_PROCESSING_SLOT_RENEW_INTERVAL_MS)

  try {
    return await callback()
  } finally {
    clearInterval(renewTimer)
    await lease.release().catch(() => false)
  }
}

function resolveScheduledAtFromState(
  state: DelayedBackgroundJobState,
  fallback: Date,
) {
  if (!state.nextRunAt) {
    return fallback
  }

  const nextRunAt = new Date(state.nextRunAt)
  return Number.isNaN(nextRunAt.getTime())
    ? fallback
    : nextRunAt
}

function createRssQueueJobState(queueItem: Pick<RssQueueRecord, "backgroundJobId" | "scheduledAt">): DelayedBackgroundJobState {
  return {
    jobId: queueItem.backgroundJobId ?? "",
    nextRunAt: queueItem.scheduledAt.toISOString(),
  }
}

function readRssQueueIdFromBackgroundJobPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("queueId" in payload)) {
    return null
  }

  const queueId = (payload as { queueId?: unknown }).queueId
  return typeof queueId === "string" && queueId.trim()
    ? queueId.trim()
    : null
}

async function cleanupStaleRssDelayedJobs(options?: {
  queueId?: string
  sourceId?: string
}) {
  const targetQueueId = typeof options?.queueId === "string" && options.queueId.trim()
    ? options.queueId.trim()
    : null
  const targetSourceId = typeof options?.sourceId === "string" && options.sourceId.trim()
    ? options.sourceId.trim()
    : null
  const redis = getRedis()
  let removedCount = 0
  let scannedCount = 0

  await connectRedisClient(redis)
  const delayedSetKey = getBackgroundJobDelayedSetKey()
  let start = 0

  while (scannedCount < RSS_DELAYED_JOB_CLEANUP_SCAN_LIMIT) {
    const stop = Math.min(
      start + RSS_DELAYED_JOB_CLEANUP_BATCH_SIZE - 1,
      RSS_DELAYED_JOB_CLEANUP_SCAN_LIMIT - 1,
    )
    const members = await redis.zrange(delayedSetKey, start, stop).catch(() => [])
    if (members.length === 0) {
      break
    }

    let pageRemovedCount = 0
    for (const member of members) {
      const job = parseBackgroundJobEnvelopeString(String(member))
      if (!job || job.name !== RSS_PROCESS_QUEUE_BACKGROUND_JOB_NAME) {
        continue
      }

      const queueId = readRssQueueIdFromBackgroundJobPayload(job.payload)
      if (!queueId) {
        continue
      }

      if (targetQueueId && queueId !== targetQueueId) {
        continue
      }

      const queueRecord = await findRssQueueWithSourceById(queueId)
      if (targetSourceId && queueRecord?.sourceId !== targetSourceId) {
        continue
      }

      const isCurrentPendingJob = queueRecord?.status === "PENDING" && queueRecord.backgroundJobId === job.id
      if (isCurrentPendingJob) {
        continue
      }

      const removed = await redis.zrem(delayedSetKey, member)
      const removedNumber = Number(removed)
      removedCount += removedNumber
      pageRemovedCount += removedNumber
    }

    scannedCount += members.length
    if (members.length < RSS_DELAYED_JOB_CLEANUP_BATCH_SIZE) {
      break
    }
    start += Math.max(0, members.length - pageRemovedCount)
  }

  if (scannedCount >= RSS_DELAYED_JOB_CLEANUP_SCAN_LIMIT) {
    logInfo({
      scope: "rss-harvest",
      action: "cleanup-stale-delayed-jobs-truncated",
      metadata: {
        scannedCount,
        scanLimit: RSS_DELAYED_JOB_CLEANUP_SCAN_LIMIT,
        queueId: targetQueueId,
        sourceId: targetSourceId,
      },
    })
  }

  return { removedCount }
}

function hasSameScheduledAt(left: Date, right: Date) {
  return Math.abs(left.getTime() - right.getTime()) < 1_000
}

async function syncPendingRssQueueBackgroundJob(
  queueItem: RssQueueRecord,
  scheduledAt: Date,
  options?: {
    forceReschedule?: boolean
  },
) {
  const trackedJob = queueItem.backgroundJobId
    ? await findDelayedBackgroundJob(queueItem.backgroundJobId)
    : null

  if (
    !options?.forceReschedule
    && trackedJob
    && trackedJob.name === RSS_PROCESS_QUEUE_BACKGROUND_JOB_NAME
  ) {
    const trackedState = {
      jobId: trackedJob.id,
      nextRunAt: trackedJob.availableAt ?? queueItem.scheduledAt.toISOString(),
    } satisfies DelayedBackgroundJobState
    const trackedScheduledAt = resolveScheduledAtFromState(trackedState, queueItem.scheduledAt)

    if (
      queueItem.backgroundJobId !== trackedState.jobId
      || !hasSameScheduledAt(queueItem.scheduledAt, trackedScheduledAt)
    ) {
      await updateRssQueueRecord(queueItem.id, {
        backgroundJobId: trackedState.jobId,
        scheduledAt: trackedScheduledAt,
      })
    }

    if (hasSameScheduledAt(trackedScheduledAt, scheduledAt)) {
      return {
        synced: false,
        reason: "already-scheduled",
        jobId: trackedState.jobId,
        scheduledAt: trackedScheduledAt,
      } as const
    }
  }

  await cleanupStaleRssDelayedJobs({
    queueId: queueItem.id,
  })

  const ensuredJob = await ensureDelayedBackgroundJob(createRssQueueJobState(queueItem), {
    enabled: true,
    jobName: RSS_PROCESS_QUEUE_BACKGROUND_JOB_NAME,
    payload: {
      queueId: queueItem.id,
    },
    scheduledAt,
    maxAttempts: 1,
  })

  if (!ensuredJob.scheduled || !ensuredJob.job) {
    apiError(500, "RSS 延迟任务同步失败")
  }

  const nextScheduledAt = resolveScheduledAtFromState(ensuredJob.state, scheduledAt)
  await updateRssQueueRecord(queueItem.id, {
    backgroundJobId: ensuredJob.state.jobId,
    scheduledAt: nextScheduledAt,
  })

  return {
    synced: true,
    reason: trackedJob ? "rescheduled" : "created",
    jobId: ensuredJob.state.jobId,
    scheduledAt: nextScheduledAt,
  } as const
}

async function cancelPendingRssSourceQueueItems(sourceId: string, reason: string) {
  const items = await listRssQueueItemsBySource(sourceId)
  let count = 0

  for (const item of items) {
    if (item.status !== "PENDING") {
      continue
    }

    await cancelDelayedBackgroundJob(createRssQueueJobState(item))
    await cleanupStaleRssDelayedJobs({
      queueId: item.id,
      sourceId,
    })
    await updateRssQueueRecord(item.id, {
      backgroundJobId: null,
      status: "CANCELLED",
      finishedAt: new Date(),
      errorMessage: reason,
      leaseExpiresAt: null,
      workerId: null,
    })
    count += 1
  }

  return { count }
}

function resolveNextScheduledAtForUpdatedSource(
  runtimeState: RssSourceRuntimeState,
  nextEnabled: boolean,
  nextIntervalMinutes: number,
  options?: {
    forceRecompute?: boolean
  },
) {
  if (!nextEnabled) {
    return null
  }

  const now = new Date()
  if (!options?.forceRecompute) {
    return now
  }

  if (!runtimeState.enabled) {
    return now
  }

  if (!runtimeState.lastRunAt) {
    return now
  }

  const nextRunAt = addMinutes(runtimeState.lastRunAt, nextIntervalMinutes)
  return nextRunAt.getTime() > now.getTime()
    ? nextRunAt
    : now
}

function isActiveQueueStatus(status: RssQueueRecord["status"]) {
  return status === "PENDING" || status === "PROCESSING"
}

function isAutomaticQueueItem(item: RssQueueRecord) {
  return item.triggerType !== "MANUAL"
}

async function listActiveQueueItemsForSource(sourceId: string) {
  const items = await listRssQueueItemsBySource(sourceId, 20)
  return items.filter((item) => isActiveQueueStatus(item.status))
}

async function findAutomaticQueueItemForSource(sourceId: string) {
  const items = await listActiveQueueItemsForSource(sourceId)
  return items.find((item) => isAutomaticQueueItem(item)) ?? null
}

async function listEnabledRssSources() {
  const sources = await listRssSourcesForAdmin()
  const runtimeStates = await listRssSourceRuntimeStates(sources.map((item) => item.id))

  return sources
    .filter((source) => runtimeStates.get(source.id)?.enabled)
    .sort((left, right) => {
      const leftState = runtimeStates.get(left.id) ?? null
      const rightState = runtimeStates.get(right.id) ?? null
      const leftTime = leftState?.lastRunAt?.getTime() ?? 0
      const rightTime = rightState?.lastRunAt?.getTime() ?? 0
      return rightTime - leftTime
    })
}

async function ensureRssSourceScheduled(source: RssSourceAdminRecord, options?: {
  scheduledAt?: Date
  forceReschedule?: boolean
  runtimeState?: RssSourceRuntimeState
}) {
  const runtimeState = options?.runtimeState ?? await getRssSourceRuntimeState(source.id)
  if (!runtimeState.enabled) {
    return {
      scheduled: false,
      reason: "inactive",
    } as const
  }

  const scheduledAt = options?.scheduledAt ?? new Date()
  const existing = await findAutomaticQueueItemForSource(source.id)
  if (existing) {
    if (existing.status === "PENDING") {
      const syncResult = await syncPendingRssQueueBackgroundJob(existing, scheduledAt, {
        forceReschedule: options?.forceReschedule,
      })

      return {
        scheduled: syncResult.synced,
        reason: syncResult.reason,
        scheduledAt: syncResult.scheduledAt,
        queueId: existing.id,
        jobId: syncResult.jobId,
        status: existing.status,
      } as const
    }

    return {
      scheduled: false,
      reason: "processing",
      scheduledAt: existing.scheduledAt,
      queueId: existing.id,
      status: existing.status,
    } as const
  }

  const result = await enqueueRssSourceJobInternal({
    source,
    triggerType: "SCHEDULED",
    priority: 0,
    scheduledAt,
  })

  if (!result.queued) {
    return {
      scheduled: false,
      reason: "queue-rejected",
      message: result.message,
    } as const
  }

  return {
    scheduled: true,
    reason: "created",
    scheduledAt,
  } as const
}

async function getRssSchedulerStatus() {
  const activeSources = await listEnabledRssSources()
  const states = await Promise.all(activeSources.map(async (source) => {
    const queueItem = await findAutomaticQueueItemForSource(source.id)
    const backgroundJob = queueItem?.status === "PENDING"
      && queueItem.backgroundJobId
      ? await findDelayedBackgroundJob(queueItem.backgroundJobId)
      : null
    return {
      source,
      queueItem,
      backgroundJob,
    }
  }))

  const scheduledItems = states.filter((item) =>
    item.queueItem
    && (item.queueItem.status !== "PENDING" || item.backgroundJob),
  )
  const missingItems = states.filter((item) =>
    !item.queueItem
    || (item.queueItem.status === "PENDING" && !item.backgroundJob),
  )
  const nextScheduledItem = scheduledItems
    .map((item) => item.queueItem)
    .filter((item): item is RssQueueRecord => item !== null)
    .filter((item) => item.status === "PENDING")
    .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())[0] ?? null
  const latestActiveItem = scheduledItems
    .map((item) => item.queueItem)
    .filter((item): item is RssQueueRecord => Boolean(item))
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0] ?? null

  if (activeSources.length === 0) {
    return {
      scheduled: true,
      stateLabel: "无活跃源",
      location: "idle",
      locationLabel: "无需调度",
      jobId: null,
      enqueuedAt: null,
      availableAt: null,
      detail: "当前没有启用中的 RSS 源，因此没有需要挂起的独立定时任务。",
    }
  }

  if (missingItems.length > 0) {
    return {
      scheduled: false,
      stateLabel: "缺失",
      location: "per-source",
      locationLabel: `${scheduledItems.length}/${activeSources.length} 已挂起`,
      jobId: nextScheduledItem?.id ?? latestActiveItem?.id ?? null,
      enqueuedAt: nextScheduledItem
        ? nextScheduledItem.createdAt.toISOString()
        : latestActiveItem
          ? latestActiveItem.createdAt.toISOString()
          : null,
      availableAt: nextScheduledItem ? nextScheduledItem.scheduledAt.toISOString() : null,
      detail: `共有 ${missingItems.length} 个活跃 RSS 源缺少各自的下次执行任务，可手动重建独立调度。`,
    }
  }

  return {
    scheduled: true,
    stateLabel: "正常",
    location: "per-source",
    locationLabel: `${scheduledItems.length}/${activeSources.length} 已挂起`,
    jobId: nextScheduledItem?.id ?? latestActiveItem?.id ?? null,
    enqueuedAt: nextScheduledItem
      ? nextScheduledItem.createdAt.toISOString()
      : latestActiveItem
        ? latestActiveItem.createdAt.toISOString()
        : null,
    availableAt: nextScheduledItem ? nextScheduledItem.scheduledAt.toISOString() : null,
    detail: nextScheduledItem
      ? `所有活跃 RSS 源都已独立挂起，下一个任务计划于 ${formatDateTime(nextScheduledItem.scheduledAt)} 执行。`
      : "所有活跃 RSS 源当前都由执行中的任务承接，完成后会继续独立续挂。",
  }
}

export async function repairRssSchedulerJob() {
  await ensureCanManageRssAdmin()

  await cleanupStaleRssDelayedJobs()
  const activeSources = await listEnabledRssSources()
  let createdCount = 0
  let skippedCount = 0

  for (const source of activeSources) {
    const runtimeState = await getRssSourceRuntimeState(source.id)
    const result = await ensureRssSourceScheduled(source, {
      scheduledAt: new Date(),
      runtimeState,
    })

    if (result.scheduled) {
      createdCount += 1
    } else {
      skippedCount += 1
    }
  }

  logInfo({
    scope: "rss-harvest",
    action: "scheduler-repair",
    metadata: {
      activeSourceCount: activeSources.length,
      createdCount,
      skippedCount,
      mode: "per-source",
    },
  })

  return {
    scheduled: createdCount > 0,
    message: createdCount > 0
      ? `已重建 ${createdCount} 个 RSS 源的独立调度`
      : activeSources.length > 0
        ? "当前所有活跃 RSS 源都已经挂起独立调度，无需重建"
        : "当前没有活跃 RSS 源，无需重建调度",
  }
}

function assertPositiveInteger(value: number, min: number, max: number, message: string) {
  if (!Number.isInteger(value) || value < min || value > max) {
    apiError(400, message)
  }
}

function normalizeAbsoluteHttpUrl(rawValue: unknown, fieldLabel: string) {
  const value = normalizeText(rawValue)
  if (!value) {
    apiError(400, `${fieldLabel}不能为空`)
  }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    apiError(400, `${fieldLabel}格式不正确`)
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    apiError(400, `${fieldLabel}只支持 http 或 https`)
  }

  if (parsed.username || parsed.password) {
    apiError(400, `${fieldLabel}不允许包含账号密码`)
  }

  parsed.hash = ""

  return parsed.toString()
}

function normalizeSettingsInput(input: Record<string, unknown>) {
  const maxConcurrentJobs = Math.trunc(normalizeNumber(input.maxConcurrentJobs, 2, { min: MIN_CONCURRENCY, max: MAX_CONCURRENCY }))
  const maxRetryCount = Math.trunc(normalizeNumber(input.maxRetryCount, 3, { min: MIN_RETRY_COUNT, max: MAX_RETRY_COUNT }))
  const retryBackoffSec = Math.trunc(normalizeNumber(input.retryBackoffSec, 300, { min: 10, max: 3600 }))
  const fetchTimeoutMs = Math.trunc(normalizeNumber(input.fetchTimeoutMs, 15_000, { min: MIN_TIMEOUT_MS, max: MAX_TIMEOUT_MS }))
  const maxResponseBytes = Math.trunc(normalizeNumber(input.maxResponseBytes, 1_048_576, { min: MIN_RESPONSE_BYTES, max: MAX_RESPONSE_BYTES }))
  const maxRedirects = Math.trunc(normalizeNumber(input.maxRedirects, 3, { min: MIN_REDIRECTS, max: MAX_REDIRECTS }))
  const failurePauseThreshold = Math.trunc(normalizeNumber(input.failurePauseThreshold, 5, { min: MIN_FAILURE_PAUSE_THRESHOLD, max: MAX_FAILURE_PAUSE_THRESHOLD }))
  const homePageSize = Math.trunc(normalizeNumber(input.homePageSize, 20, { min: MIN_HOME_PAGE_SIZE, max: MAX_HOME_PAGE_SIZE }))
  const userAgent = normalizeTrimmedText(input.userAgent, 180, "bbs-rss-worker/1.0")

  return {
    maxConcurrentJobs,
    maxRetryCount,
    retryBackoffSec,
    fetchTimeoutMs,
    maxResponseBytes,
    maxRedirects,
    failurePauseThreshold,
    homeDisplayEnabled: normalizeBoolean(input.homeDisplayEnabled, false),
    homePageSize,
    userAgent,
  }
}

function normalizeSourceInput(input: Record<string, unknown>) {
  const siteName = normalizeTrimmedText(input.siteName, 80)
  if (!siteName) {
    apiError(400, "站点名称不能为空")
  }

  const feedUrl = normalizeAbsoluteHttpUrl(input.feedUrl, "RSS 地址")
  const description = normalizeTrimmedText(input.description, 240) || null
  const intervalMinutes = Math.trunc(normalizeNumber(input.intervalMinutes, 30, { min: MIN_INTERVAL_MINUTES, max: MAX_INTERVAL_MINUTES }))
  assertPositiveInteger(intervalMinutes, MIN_INTERVAL_MINUTES, MAX_INTERVAL_MINUTES, `抓取频率必须在 ${MIN_INTERVAL_MINUTES} 到 ${MAX_INTERVAL_MINUTES} 分钟之间`)

  const timeoutValue = input.requestTimeoutMs === "" || input.requestTimeoutMs === null || typeof input.requestTimeoutMs === "undefined"
    ? null
    : Math.trunc(normalizeNumber(input.requestTimeoutMs, 15_000, { min: MIN_TIMEOUT_MS, max: MAX_TIMEOUT_MS }))
  const retryValue = input.maxRetryCount === "" || input.maxRetryCount === null || typeof input.maxRetryCount === "undefined"
    ? null
    : Math.trunc(normalizeNumber(input.maxRetryCount, 3, { min: MIN_RETRY_COUNT, max: MAX_RETRY_COUNT }))

  return {
    siteName,
    description,
    feedUrl,
    logoPath: normalizeTrimmedText(input.logoPath, 300) || null,
    intervalMinutes,
    requiresReview: normalizeBoolean(input.requiresReview, true),
    enabled: normalizeBoolean(input.enabled, true),
    requestTimeoutMs: timeoutValue,
    maxRetryCount: retryValue,
  }
}

function serializeSettings(record: RssSettingRecord) {
  return {
    id: record.id,
    maxConcurrentJobs: record.maxConcurrentJobs,
    maxRetryCount: record.maxRetryCount,
    retryBackoffSec: record.retryBackoffSec,
    fetchTimeoutMs: record.fetchTimeoutMs,
    maxResponseBytes: record.maxResponseBytes,
    maxRedirects: record.maxRedirects,
    failurePauseThreshold: record.failurePauseThreshold,
    homeDisplayEnabled: record.homeDisplayEnabled,
    homePageSize: record.homePageSize,
    userAgent: record.userAgent,
  }
}

function serializeRunRecord(run: RssQueueRecord, sourceName: string) {
  const startedAt = run.startedAt ?? run.createdAt
  return {
    id: run.id,
    sourceId: run.sourceId,
    sourceName,
    status: run.status,
    triggerType: run.triggerType,
    startedAt: startedAt.toISOString(),
    finishedAt: toIsoString(run.finishedAt),
    durationMs: run.durationMs ?? (run.finishedAt ? run.finishedAt.getTime() - startedAt.getTime() : null),
    fetchedCount: run.fetchedCount,
    insertedCount: run.insertedCount,
    duplicateCount: run.duplicateCount,
    httpStatus: run.httpStatus,
    errorMessage: run.errorMessage,
  }
}

function serializePagination(pagination: PaginationResult): RssPaginationMeta {
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: pagination.total,
    totalPages: pagination.totalPages,
    hasPrevPage: pagination.hasPrevPage,
    hasNextPage: pagination.hasNextPage,
  }
}

function serializeQueuePreviewItem(item: Awaited<ReturnType<typeof listRssQueueItemsBySource>>[number]) {
  return {
    id: item.id,
    status: item.status,
    triggerType: item.triggerType,
    attemptCount: item.attemptCount,
    maxAttempts: item.maxAttempts,
    scheduledAt: item.scheduledAt.toISOString(),
    startedAt: toIsoString(item.startedAt),
    errorMessage: item.errorMessage,
  }
}

async function buildSourceAdminItem(
  source: RssSourceAdminRecord,
  runtimeState: RssSourceRuntimeState,
  input: {
    entryCount: number
    queueCount: number
    queueItemsPreviewWindow: RssQueueRecord[]
    runCount: number
    recentRuns: RssQueueRecord[]
  },
) {
  const queueItemsPreviewWindow = input.queueItemsPreviewWindow
  const queuePreview = queueItemsPreviewWindow.slice(0, 1)
  const automaticActiveItem = queueItemsPreviewWindow.find((item) => isAutomaticQueueItem(item) && isActiveQueueStatus(item.status)) ?? null

  return {
    id: source.id,
    siteName: source.siteName,
    description: source.description ?? null,
    feedUrl: source.feedUrl,
    logoPath: source.logoPath ?? null,
    intervalMinutes: source.intervalMinutes,
    requiresReview: source.requiresReview,
    status: runtimeState.enabled ? "ACTIVE" : "PAUSED",
    requestTimeoutMs: source.requestTimeoutMs,
    maxRetryCount: source.maxRetryCount,
    nextRunAt: toIsoString(automaticActiveItem?.scheduledAt ?? null),
    lastRunAt: toIsoString(runtimeState.lastRunAt),
    lastSuccessAt: toIsoString(runtimeState.lastSuccessAt),
    lastErrorAt: toIsoString(runtimeState.lastErrorAt),
    lastErrorMessage: runtimeState.lastErrorMessage,
    failureCount: runtimeState.failureCount,
    lastRunDurationMs: runtimeState.lastRunDurationMs,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
    runCount: input.runCount,
    entryCount: input.entryCount,
    queueCount: input.queueCount,
    queuePreview: queuePreview.map(serializeQueuePreviewItem),
    recentRuns: input.recentRuns.map((run) => {
      const serialized = serializeRunRecord(run, source.siteName)
      return {
        id: serialized.id,
        status: serialized.status,
        triggerType: serialized.triggerType,
        startedAt: serialized.startedAt,
        finishedAt: serialized.finishedAt,
        durationMs: serialized.durationMs,
        fetchedCount: serialized.fetchedCount,
        insertedCount: serialized.insertedCount,
        duplicateCount: serialized.duplicateCount,
        httpStatus: serialized.httpStatus,
        errorMessage: serialized.errorMessage,
      }
    }),
  }
}

function serializeLogRecord(log: RssExecutionLogRecord) {
  return {
    id: log.id,
    runId: log.runId,
    sourceId: log.sourceId,
    sourceName: log.sourceName,
    level: log.level,
    stage: log.stage,
    message: log.message,
    detailText: log.detailText,
    createdAt: log.createdAt,
  }
}

export async function getRssAdminData(options?: {
  sourcePage?: number
  recentRunsPage?: number
  recentLogsPage?: number
}): Promise<RssAdminData> {
  await ensureCanManageRssAdmin()

  const [
    settings,
    schedulerStatus,
    allSources,
    recentLogsPage,
    queueSummaryCounts,
    recentRunTotal,
    pendingSourceApplicationCount,
  ] = await Promise.all([
    getOrCreateRssSettingRecord(),
    getRssSchedulerStatus(),
    listRssSourcesForAdmin(),
    getRssExecutionLogPage({
      page: options?.recentLogsPage,
      pageSize: RSS_MODAL_PAGE_SIZE,
    }),
    countRssQueueSummary(),
    countRssExecutionItems(),
    countPendingRssSourceApplications(),
  ])
  const [pending, processing, failed] = queueSummaryCounts
  const queueSummary = {
    pending,
    processing,
    failed,
  }

  const sourceRuntimeStates = await listRssSourceRuntimeStates(allSources.map((item) => item.id))
  const sortedSources = [...allSources].sort((left, right) => {
    const leftEnabled = sourceRuntimeStates.get(left.id)?.enabled ? 1 : 0
    const rightEnabled = sourceRuntimeStates.get(right.id)?.enabled ? 1 : 0
    if (leftEnabled !== rightEnabled) {
      return rightEnabled - leftEnabled
    }

    const updatedDiff = right.updatedAt.getTime() - left.updatedAt.getTime()
    if (updatedDiff !== 0) {
      return updatedDiff
    }

    return right.id.localeCompare(left.id)
  })

  const sourcePagination = resolvePagination({ page: options?.sourcePage, pageSize: RSS_SOURCE_PAGE_SIZE }, sortedSources.length, [RSS_SOURCE_PAGE_SIZE], RSS_SOURCE_PAGE_SIZE)
  const recentRunsPagination = resolvePagination({ page: options?.recentRunsPage, pageSize: RSS_MODAL_PAGE_SIZE }, recentRunTotal, [RSS_MODAL_PAGE_SIZE], RSS_MODAL_PAGE_SIZE)

  const pagedSources = sortedSources.slice(sourcePagination.skip, sourcePagination.skip + sourcePagination.pageSize)
  const recentRuns = await listRssExecutionItemsPage(recentRunsPagination.skip, recentRunsPagination.pageSize)

  const sourceItems = await Promise.all(pagedSources.map(async (source) => {
    const [
      entryCount,
      queueCount,
      queueItemsPreviewWindow,
      runCount,
      sourceRecentRuns,
    ] = await Promise.all([
      countRssEntriesForSource(source.id),
      countRssQueueItemsBySource(source.id),
      listRssQueueItemsBySource(source.id, 20),
      countRssExecutionItemsBySource(source.id),
      listRssExecutionItemsPageBySource(source.id, 0, 1),
    ])

    return buildSourceAdminItem(
      source,
      sourceRuntimeStates.get(source.id) ?? {
        sourceId: source.id,
        enabled: false,
        lastRunAt: null,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastErrorMessage: null,
        failureCount: 0,
        lastRunDurationMs: null,
        updatedAt: new Date(0),
      },
      {
        entryCount,
        queueCount,
        queueItemsPreviewWindow,
        runCount,
        recentRuns: sourceRecentRuns,
      },
    )
  }))
  const recentRunSourceIds = Array.from(new Set(recentRuns.map((run) => run.sourceId)))
  const recentRunSources = recentRunSourceIds.length > 0
    ? await prisma.rssSource.findMany({
      where: {
        id: {
          in: recentRunSourceIds,
        },
      },
      select: {
        id: true,
        siteName: true,
      },
    })
    : []
  const recentRunSourceMap = new Map(recentRunSources.map((source) => [source.id, source.siteName]))

  return {
    settings: serializeSettings(settings),
    schedulerStatus,
    queueSummary,
    sourcePagination: serializePagination(sourcePagination),
    sources: sourceItems,
    pendingSourceApplicationCount,
    recentRunsPagination: serializePagination(recentRunsPagination),
    recentRuns: recentRuns.map((run) => serializeRunRecord(run, recentRunSourceMap.get(run.sourceId) ?? run.sourceId)),
    recentLogsPagination: {
      page: recentLogsPage.page,
      pageSize: recentLogsPage.pageSize,
      total: recentLogsPage.total,
      totalPages: recentLogsPage.totalPages,
      hasPrevPage: recentLogsPage.hasPrevPage,
      hasNextPage: recentLogsPage.hasNextPage,
    },
    recentLogs: recentLogsPage.items.map(serializeLogRecord),
  }
}

export async function getRssSourceQueuePage(sourceId: string, options?: { page?: number }): Promise<RssSourceQueuePageData> {
  await ensureCanManageRssAdmin()

  const source = await findRssSourceById(sourceId)
  if (!source) {
    apiError(404, "RSS 任务不存在")
  }

  const total = await countRssQueueItemsBySource(sourceId)
  const pagination = resolvePagination({ page: options?.page, pageSize: RSS_MODAL_PAGE_SIZE }, total, [RSS_MODAL_PAGE_SIZE], RSS_MODAL_PAGE_SIZE)
  const items = await listRssQueueItemsPageBySource(sourceId, pagination.skip, pagination.pageSize)

  return {
    sourceId: source.id,
    sourceName: source.siteName,
    items: items.map(serializeQueuePreviewItem),
    pagination: serializePagination(pagination),
  }
}

export async function getRssSourceRunPage(sourceId: string, options?: { page?: number }): Promise<RssSourceRunPageData> {
  await ensureCanManageRssAdmin()

  const source = await findRssSourceById(sourceId)
  if (!source) {
    apiError(404, "RSS 任务不存在")
  }

  const total = await countRssExecutionItemsBySource(sourceId)
  const pagination = resolvePagination({ page: options?.page, pageSize: RSS_MODAL_PAGE_SIZE }, total, [RSS_MODAL_PAGE_SIZE], RSS_MODAL_PAGE_SIZE)
  const items = await listRssExecutionItemsPageBySource(sourceId, pagination.skip, pagination.pageSize)

  return {
    sourceId: source.id,
    sourceName: source.siteName,
    items: items.map((run) => {
      const serialized = serializeRunRecord(run, source.siteName)
      return {
        id: serialized.id,
        status: serialized.status,
        triggerType: serialized.triggerType,
        startedAt: serialized.startedAt,
        finishedAt: serialized.finishedAt,
        durationMs: serialized.durationMs,
        fetchedCount: serialized.fetchedCount,
        insertedCount: serialized.insertedCount,
        duplicateCount: serialized.duplicateCount,
        httpStatus: serialized.httpStatus,
        errorMessage: serialized.errorMessage,
      }
    }),
    pagination: serializePagination(pagination),
  }
}

export async function getRssRecentRunPage(options?: { page?: number }): Promise<RssGlobalRunPageData> {
  await ensureCanManageRssAdmin()

  const total = await countRssExecutionItems()
  const pagination = resolvePagination({ page: options?.page, pageSize: RSS_MODAL_PAGE_SIZE }, total, [RSS_MODAL_PAGE_SIZE], RSS_MODAL_PAGE_SIZE)
  const items = await listRssExecutionItemsPage(pagination.skip, pagination.pageSize)
  const sourceIds = Array.from(new Set(items.map((item) => item.sourceId)))
  const sources = sourceIds.length > 0
    ? await prisma.rssSource.findMany({
      where: {
        id: {
          in: sourceIds,
        },
      },
      select: {
        id: true,
        siteName: true,
      },
    })
    : []
  const sourceMap = new Map(sources.map((source) => [source.id, source.siteName]))

  return {
    items: items.map((run) => serializeRunRecord(run, sourceMap.get(run.sourceId) ?? run.sourceId)),
    pagination: serializePagination(pagination),
  }
}

export async function getRssRecentLogPage(options?: { page?: number }): Promise<RssGlobalLogPageData> {
  await ensureCanManageRssAdmin()

  const page = await getRssExecutionLogPage({
    page: options?.page,
    pageSize: RSS_MODAL_PAGE_SIZE,
  })

  return {
    items: page.items.map(serializeLogRecord),
    pagination: {
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages,
      hasPrevPage: page.hasPrevPage,
      hasNextPage: page.hasNextPage,
    },
  }
}

export async function saveRssSettings(input: Record<string, unknown>) {
  await ensureCanManageRssAdmin()

  const current = await getOrCreateRssSettingRecord()
  const normalized = normalizeSettingsInput(input)

  const updated = await updateRssSettingRecord(current.id, normalized)
  revalidateRssSettingsCache()
  return updated
}

function revalidateRssSettingsCache() {
  try {
    revalidateTag(RSS_SETTINGS_CACHE_TAG, "max")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      message.startsWith("Invariant: static generation store missing in revalidateTag")
      || message.includes('used "revalidateTag ')
    ) {
      return
    }

    throw error
  }
}

async function readRssHomeDisplaySettings() {
  const settings = await getOrCreateRssSettingRecord()

  return {
    homeDisplayEnabled: settings.homeDisplayEnabled,
    homePageSize: settings.homePageSize,
  }
}

const getPersistentRssHomeDisplaySettings = unstable_cache(
  readRssHomeDisplaySettings,
  ["rss-settings:home-display"],
  {
    tags: [RSS_SETTINGS_CACHE_TAG],
    revalidate: 60,
  },
)

export async function getRssHomeDisplaySettings() {
  return getPersistentRssHomeDisplaySettings()
}

export async function testRssSourceConnection(input: Record<string, unknown>) {
  await ensureCanManageRssAdmin()

  const settings = await getOrCreateRssSettingRecord()
  const feedUrl = normalizeAbsoluteHttpUrl(input.feedUrl, "RSS 地址")
  const fetchTimeoutMs = input.requestTimeoutMs === "" || input.requestTimeoutMs === null || typeof input.requestTimeoutMs === "undefined"
    ? settings.fetchTimeoutMs
    : Math.trunc(normalizeNumber(input.requestTimeoutMs, settings.fetchTimeoutMs, { min: MIN_TIMEOUT_MS, max: MAX_TIMEOUT_MS }))

  const fetchResult = await fetchFeedXml({
    feedUrl,
    fetchTimeoutMs,
    maxResponseBytes: settings.maxResponseBytes,
    maxRedirects: settings.maxRedirects,
    userAgent: settings.userAgent,
    onLog: () => {},
  })
  const feed = parseFeedXml(fetchResult.body, fetchResult.finalUrl)
  const firstItem = feed.items[0]

  return {
    feedUrl,
    finalUrl: fetchResult.finalUrl,
    httpStatus: fetchResult.httpStatus,
    contentType: fetchResult.contentType,
    responseBytes: fetchResult.responseBytes,
    feedTitle: feed.title,
    itemCount: feed.items.length,
    firstItemTitle: firstItem?.title ?? null,
    message: `测试成功：抓取到 ${feed.items.length} 条，源标题 ${feed.title ?? "未提供"}。`,
  }
}

export async function createRssSource(input: Record<string, unknown>) {
  await ensureCanManageRssAdmin()

  const normalized = normalizeSourceInput(input)
  const existing = await findRssSourceByFeedUrl(normalized.feedUrl)

  if (existing) {
    apiError(400, "该 RSS 地址已经存在")
  }

  const created = await createRssSourceRecord({
    siteName: normalized.siteName,
    description: normalized.description,
    feedUrl: normalized.feedUrl,
    logoPath: normalized.logoPath,
    intervalMinutes: normalized.intervalMinutes,
    requiresReview: normalized.requiresReview,
    requestTimeoutMs: normalized.requestTimeoutMs,
    maxRetryCount: normalized.maxRetryCount,
  })

  const runtimeState = await updateRssSourceRuntimeState(created.id, {
    enabled: normalized.enabled,
    lastRunAt: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    failureCount: 0,
    lastRunDurationMs: null,
  })

  if (runtimeState.enabled) {
    await ensureRssSourceScheduled(created, {
      scheduledAt: new Date(),
      runtimeState,
    })
  }

  return created
}

export async function updateRssSource(id: string, input: Record<string, unknown>) {
  await ensureCanManageRssAdmin()

  const source = await findRssSourceById(id)
  if (!source) {
    apiError(404, "RSS 任务不存在")
  }

  const normalized = normalizeSourceInput(input)
  const duplicate = await findRssSourceByFeedUrl(normalized.feedUrl)
  if (duplicate && duplicate.id !== source.id) {
    apiError(400, "该 RSS 地址已经存在")
  }

  const runtimeState = await getRssSourceRuntimeState(id)
  const wasActive = runtimeState.enabled
  const intervalChanged = normalized.intervalMinutes !== source.intervalMinutes
  const shouldForceReschedule = !wasActive || intervalChanged
  const nextScheduledAt = resolveNextScheduledAtForUpdatedSource(
    runtimeState,
    normalized.enabled,
    normalized.intervalMinutes,
    {
      forceRecompute: shouldForceReschedule,
    },
  )

  const updated = await updateRssSourceRecord(id, {
    siteName: normalized.siteName,
    description: normalized.description,
    feedUrl: normalized.feedUrl,
    logoPath: normalized.logoPath,
    intervalMinutes: normalized.intervalMinutes,
    requiresReview: normalized.requiresReview,
    requestTimeoutMs: normalized.requestTimeoutMs,
    maxRetryCount: normalized.maxRetryCount,
  })

  const nextRuntimeState = await updateRssSourceRuntimeState(updated.id, {
    enabled: normalized.enabled,
  })

  if (!nextRuntimeState.enabled) {
    await cancelPendingRssSourceQueueItems(updated.id, "任务已由管理员停止")
  } else {
    await ensureRssSourceScheduled(updated, {
      scheduledAt: nextScheduledAt ?? new Date(),
      forceReschedule: shouldForceReschedule,
      runtimeState: nextRuntimeState,
    })
  }

  await cleanupStaleRssDelayedJobs({
    sourceId: updated.id,
  })

  return updated
}

async function enqueueRssSourceJobInternal(params: {
  source: RssSourceAdminRecord
  triggerType: RssTriggerType
  priority: number
  scheduledAt: Date
}) {
  const settings = await getOrCreateRssSettingRecord()
  const activeItems = await listActiveQueueItemsForSource(params.source.id)
  const processingItem = activeItems.find((item) => item.status === "PROCESSING") ?? null

  if (processingItem) {
    return {
      queued: false,
      message: "当前任务正在执行中，请等待本轮完成",
    }
  }

  if (params.triggerType === "MANUAL") {
    const pendingManualItem = activeItems.find((item) => item.status === "PENDING" && item.triggerType === "MANUAL")
    if (pendingManualItem) {
      return {
        queued: false,
        message: "当前已经有手动任务在等待执行",
      }
    }
  } else {
    const pendingAutomaticItem = activeItems.find((item) => item.status === "PENDING" && isAutomaticQueueItem(item))
    if (pendingAutomaticItem) {
      return {
        queued: false,
        message: "当前任务已经挂起了下一次自动执行",
      }
    }
  }

  const queueItem = await createRssQueueRecord({
    sourceId: params.source.id,
    triggerType: params.triggerType,
    priority: params.priority,
    scheduledAt: params.scheduledAt,
    maxAttempts: params.source.maxRetryCount ?? settings.maxRetryCount,
  })

  try {
    const ensuredJob = await ensureDelayedBackgroundJob(createRssQueueJobState(queueItem), {
      enabled: true,
      jobName: RSS_PROCESS_QUEUE_BACKGROUND_JOB_NAME,
      payload: {
        queueId: queueItem.id,
      },
      scheduledAt: params.scheduledAt,
      maxAttempts: 1,
    })

    if (!ensuredJob.scheduled || !ensuredJob.job) {
      apiError(500, "RSS 延迟任务创建失败")
    }

    await updateRssQueueRecord(queueItem.id, {
      backgroundJobId: ensuredJob.state.jobId,
      scheduledAt: resolveScheduledAtFromState(ensuredJob.state, params.scheduledAt),
    })
  } catch (error) {
    await updateRssQueueRecord(queueItem.id, {
      backgroundJobId: null,
      status: "FAILED",
      finishedAt: new Date(),
      errorMessage: `统一任务队列入队失败：${resolveRssHarvestErrorMessage(error)}`,
    })
    throw error
  }

  return {
    queued: true,
    message: "任务已加入抓取队列",
  }
}

export async function enqueueRssSourceRunNow(sourceId: string) {
  await ensureCanManageRssAdmin()

  const source = await findRssSourceById(sourceId)
  if (!source) {
    apiError(404, "RSS 任务不存在")
  }

  return enqueueRssSourceJobInternal({
    source,
    triggerType: "MANUAL",
    priority: 100,
    scheduledAt: new Date(),
  })
}

export async function startRssSource(sourceId: string) {
  await ensureCanManageRssAdmin()

  const source = await findRssSourceById(sourceId)
  if (!source) {
    apiError(404, "RSS 任务不存在")
  }

  const runtimeState = await updateRssSourceRuntimeState(sourceId, {
    enabled: true,
  })

  await ensureRssSourceScheduled(source, {
    scheduledAt: new Date(),
    runtimeState,
  })

  await cleanupStaleRssDelayedJobs({
    sourceId,
  })

  return source
}

export async function stopRssSource(sourceId: string) {
  await ensureCanManageRssAdmin()

  const source = await findRssSourceById(sourceId)
  if (!source) {
    apiError(404, "RSS 任务不存在")
  }

  await Promise.all([
    updateRssSourceRuntimeState(sourceId, {
      enabled: false,
    }),
    cancelPendingRssSourceQueueItems(sourceId, "任务已由管理员停止"),
  ])

  await cleanupStaleRssDelayedJobs({
    sourceId,
  })

  return { id: sourceId }
}

export async function clearRssLogsHistory() {
  await ensureCanManageRssAdmin()

  const result = await clearRssExecutionLogs()
  return {
    count: result.count,
  }
}

export async function clearRssSourceQueueHistory(sourceId: string) {
  await ensureCanManageRssAdmin()

  const source = await findRssSourceById(sourceId)
  if (!source) {
    apiError(404, "RSS 任务不存在")
  }

  const result = await clearRssQueueHistoryBySource(sourceId)
  return {
    sourceId,
    sourceName: source.siteName,
    count: result.count,
  }
}

export async function clearRssSourceRunHistory(sourceId: string) {
  await ensureCanManageRssAdmin()

  const source = await findRssSourceById(sourceId)
  if (!source) {
    apiError(404, "RSS 任务不存在")
  }

  const queueIds = await listCompletedRssQueueIdsBySource(sourceId)
  const result = await clearRssQueueHistoryBySource(sourceId)
  await deleteRssExecutionLogsByRunIds(queueIds.map((item) => item.id))
  return {
    sourceId,
    sourceName: source.siteName,
    count: result.count,
  }
}

export async function clearRssRunHistoryRecords() {
  await ensureCanManageRssAdmin()

  const queueIds = await listCompletedRssQueueIds()
  const result = await clearRssQueueHistory()
  await deleteRssExecutionLogsByRunIds(queueIds.map((item) => item.id))
  return {
    count: result.count,
  }
}

async function createRunLogBuffer(runId: string, sourceId: string, sourceName: string) {
  const buffer: LogBufferItem[] = []

  function push(level: RssLogLevel, stage: string, message: string, detail?: unknown) {
    buffer.push({
      level,
      stage,
      message,
      detailJson: toPrismaJsonValue(detail),
    })
  }

  async function flush() {
    await persistRssExecutionLogBatch(buffer.map((item) => ({
      runId,
      sourceId,
      sourceName,
      level: item.level,
      stage: item.stage,
      message: item.message,
      detailJson: item.detailJson,
    })))
  }

  return {
    push,
    flush,
  }
}

async function handleProcessSuccess(params: {
  item: RssQueueWithSourceRecord
  logs: Awaited<ReturnType<typeof createRunLogBuffer>>
  feed: ParsedFeed
  fetchResult: FetchFeedResult
  startedAt: Date
}) {
  const finishedAt = new Date()
  const currentSource = await findRssSourceById(params.item.sourceId) ?? params.item.source
  const runtimeState = await getRssSourceRuntimeState(params.item.sourceId)
  const inserted = await createManyRssEntries(params.feed.items.map((item) => ({
    sourceId: params.item.sourceId,
    guid: item.guid,
    linkUrl: item.linkUrl,
    title: item.title,
    author: item.author,
    summary: item.summary,
    contentHtml: item.contentHtml,
    contentText: item.contentText,
    publishedAt: item.publishedAt,
    reviewStatus: params.item.source.requiresReview ? "PENDING" : "APPROVED",
    reviewNote: null,
    reviewedById: null,
    reviewedAt: params.item.source.requiresReview ? null : finishedAt,
    dedupeKey: item.dedupeKey,
    rawJson: item.rawJson,
  })))

  const durationMs = finishedAt.getTime() - params.startedAt.getTime()
  const duplicateCount = Math.max(0, params.feed.items.length - inserted.count)
  const existingAutomaticItem = runtimeState.enabled
    ? params.item.triggerType === "MANUAL"
      ? await findAutomaticQueueItemForSource(params.item.sourceId)
      : null
    : null
  const nextRunAt = runtimeState.enabled
    ? existingAutomaticItem?.scheduledAt ?? addMinutes(finishedAt, currentSource.intervalMinutes)
    : null

  params.logs.push("INFO", "store", "RSS 数据已写入数据库", {
    sourceTitle: params.feed.title,
    fetchedCount: params.feed.items.length,
    insertedCount: inserted.count,
    duplicateCount,
    nextRunAt: nextRunAt?.toISOString() ?? null,
  })
  await params.logs.flush()

  await Promise.all([
    updateRssQueueRecord(params.item.id, {
      backgroundJobId: null,
      status: "SUCCEEDED",
      leaseExpiresAt: null,
      finishedAt,
      errorMessage: null,
      durationMs,
      httpStatus: params.fetchResult.httpStatus,
      contentType: params.fetchResult.contentType,
      responseBytes: params.fetchResult.responseBytes,
      fetchedCount: params.feed.items.length,
      insertedCount: inserted.count,
      duplicateCount,
    }),
    updateRssSourceRuntimeState(params.item.sourceId, {
      lastRunAt: params.startedAt,
      lastSuccessAt: finishedAt,
      lastErrorAt: null,
      lastErrorMessage: null,
      failureCount: 0,
      lastRunDurationMs: durationMs,
    }),
  ])

  if (runtimeState.enabled) {
    const nextSource = await findRssSourceById(params.item.sourceId)
    if (nextSource) {
      try {
        await ensureRssSourceScheduled(nextSource, {
          scheduledAt: nextRunAt ?? addMinutes(finishedAt, nextSource.intervalMinutes),
        })
      } catch (error) {
        logError({
          scope: "rss-harvest",
          action: "schedule-next-source-run",
          targetId: params.item.sourceId,
        }, error)
      }
    }
  }
}

async function handleProcessFailure(params: {
  item: RssQueueWithSourceRecord
  settings: RssSettingRecord
  logs: Awaited<ReturnType<typeof createRunLogBuffer>>
  startedAt: Date
  error: unknown
}) {
  const finishedAt = new Date()
  const runtimeState = await getRssSourceRuntimeState(params.item.sourceId)
  const durationMs = finishedAt.getTime() - params.startedAt.getTime()
  const errorMessage = resolveRssHarvestErrorMessage(params.error)
  const failureCount = runtimeState.failureCount + 1
  const shouldPauseSource = runtimeState.enabled && failureCount >= params.settings.failurePauseThreshold
  const canRetry = !shouldPauseSource && runtimeState.enabled && params.item.attemptCount < params.item.maxAttempts

  params.logs.push("ERROR", "run", "RSS 抓取执行失败", {
    errorMessage,
    shouldRetry: canRetry,
    shouldPauseSource,
    attemptCount: params.item.attemptCount,
    maxAttempts: params.item.maxAttempts,
  })
  await params.logs.flush()

  const retryScheduledAt = addSeconds(finishedAt, params.settings.retryBackoffSec)
  let shouldRetry = false
  let retryJobState: DelayedBackgroundJobState | null = null

  if (canRetry) {
    try {
      const ensuredRetryJob = await ensureDelayedBackgroundJob({
        jobId: "",
        nextRunAt: retryScheduledAt.toISOString(),
      }, {
        enabled: true,
        jobName: RSS_PROCESS_QUEUE_BACKGROUND_JOB_NAME,
        payload: {
          queueId: params.item.id,
        },
        scheduledAt: retryScheduledAt,
        maxAttempts: 1,
      })
      retryJobState = ensuredRetryJob.state
      shouldRetry = true
    } catch (enqueueError) {
      logError({
        scope: "rss-harvest",
        action: "retry-enqueue",
        targetId: params.item.id,
      }, enqueueError)
    }
  }

  const queueUpdate = shouldRetry
    ? updateRssQueueRecord(params.item.id, {
        backgroundJobId: retryJobState?.jobId ?? null,
        status: "PENDING",
        scheduledAt: resolveScheduledAtFromState(retryJobState ?? {
          jobId: "",
          nextRunAt: retryScheduledAt.toISOString(),
        }, retryScheduledAt),
        leaseExpiresAt: null,
        startedAt: null,
        finishedAt: null,
        workerId: null,
        errorMessage,
        durationMs: null,
        httpStatus: null,
        contentType: null,
        responseBytes: null,
        fetchedCount: 0,
        insertedCount: 0,
        duplicateCount: 0,
      })
    : updateRssQueueRecord(params.item.id, {
        backgroundJobId: null,
        status: "FAILED",
        leaseExpiresAt: null,
        finishedAt,
        errorMessage,
        durationMs,
        httpStatus: null,
        contentType: null,
        responseBytes: null,
        fetchedCount: 0,
        insertedCount: 0,
        duplicateCount: 0,
      })

  await Promise.all([
    queueUpdate,
    updateRssSourceRuntimeState(params.item.sourceId, {
      enabled: shouldPauseSource ? false : runtimeState.enabled,
      lastRunAt: params.startedAt,
      lastErrorAt: finishedAt,
      lastErrorMessage: errorMessage,
      failureCount,
      lastRunDurationMs: durationMs,
    }),
  ])

  if (shouldPauseSource) {
    await cancelPendingRssSourceQueueItems(params.item.sourceId, "任务连续失败，已自动暂停")
  }

  if (!shouldPauseSource && runtimeState.enabled) {
    const nextSource = await findRssSourceById(params.item.sourceId)
    if (nextSource) {
      const automaticQueueItem = await findAutomaticQueueItemForSource(params.item.sourceId)
      try {
        await ensureRssSourceScheduled(nextSource, {
          scheduledAt: automaticQueueItem?.scheduledAt ?? addMinutes(finishedAt, nextSource.intervalMinutes),
        })
      } catch (scheduleError) {
        logError({
          scope: "rss-harvest",
          action: "schedule-next-source-run",
          targetId: params.item.sourceId,
        }, scheduleError)
      }
    }
  }
}

export async function processRssQueueItem(item: RssQueueWithSourceRecord, settings: RssSettingRecord) {
  const startedAt = item.startedAt ?? new Date()
  const logs = await createRunLogBuffer(item.id, item.sourceId, item.source.siteName)

  try {
    logs.push("INFO", "run", "开始执行 RSS 抓取任务", {
      sourceId: item.sourceId,
      sourceName: item.source.siteName,
      triggerType: item.triggerType,
      workerId: item.workerId,
      attemptCount: item.attemptCount,
      maxAttempts: item.maxAttempts,
    })

    const fetchTimeoutMs = item.source.requestTimeoutMs ?? settings.fetchTimeoutMs
    const fetchResult = await fetchFeedXml({
      feedUrl: item.source.feedUrl,
      fetchTimeoutMs,
      maxResponseBytes: settings.maxResponseBytes,
      maxRedirects: settings.maxRedirects,
      userAgent: settings.userAgent,
      onLog: logs.push,
    })

    const feed = parseFeedXml(fetchResult.body, fetchResult.finalUrl)
    logs.push("INFO", "parse", "RSS 文档解析完成", {
      finalUrl: fetchResult.finalUrl,
      itemCount: feed.items.length,
      feedTitle: feed.title,
    })

    await handleProcessSuccess({
      item,
      logs,
      feed,
      fetchResult,
      startedAt,
    })
  } catch (error) {
    logError({
      scope: "rss-harvest",
      action: "process-queue-item",
      targetId: item.id,
      metadata: {
        sourceId: item.sourceId,
        sourceName: item.source.siteName,
      },
    }, error)

    await handleProcessFailure({
      item,
      settings,
      logs,
      startedAt,
      error,
    })
  }
}

async function executeRssProcessQueueJob(
  queueId: string,
  job: BackgroundJobEnvelope<typeof RSS_PROCESS_QUEUE_BACKGROUND_JOB_NAME>,
) {
  const settings = await getOrCreateRssSettingRecord()
  const queueItem = await findRssQueueWithSourceById(queueId)
  if (!queueItem) {
    return
  }

  if (queueItem.status !== "PENDING") {
    return
  }

  if (queueItem.scheduledAt.getTime() > Date.now()) {
    return
  }

  if (
    queueItem.triggerType !== "MANUAL"
    && !(await getRssSourceRuntimeState(queueItem.sourceId)).enabled
  ) {
    await updateRssQueueRecord(queueId, {
      backgroundJobId: null,
      status: "CANCELLED",
      finishedAt: new Date(),
      errorMessage: "RSS 源已暂停，任务已取消",
      workerId: `bg:${job.id}`,
      leaseExpiresAt: null,
    })
    return
  }

  await withRssProcessingSlot(settings.maxConcurrentJobs, async () => {
    const latestQueueItem = await findRssQueueWithSourceById(queueId)
    if (!latestQueueItem || latestQueueItem.status !== "PENDING") {
      return
    }

    if (latestQueueItem.scheduledAt.getTime() > Date.now()) {
      return
    }

    if (
      latestQueueItem.triggerType !== "MANUAL"
      && !(await getRssSourceRuntimeState(latestQueueItem.sourceId)).enabled
    ) {
      await updateRssQueueRecord(queueId, {
        backgroundJobId: null,
        status: "CANCELLED",
        finishedAt: new Date(),
        errorMessage: "RSS 源已暂停，任务已取消",
        workerId: `bg:${job.id}`,
        leaseExpiresAt: null,
      })
      return
    }

    const startedAt = new Date()
    const claimedItem = await claimPendingRssQueueRecord(queueId, {
      workerId: `bg:${job.id}`,
      startedAt,
    })

    if (!claimedItem) {
      return
    }

    await processRssQueueItem({
      ...claimedItem,
      source: latestQueueItem.source,
    }, settings)
  })
}

registerBackgroundJobHandler(
  RSS_PROCESS_QUEUE_BACKGROUND_JOB_NAME,
  async (payload, job) => {
    await executeRssProcessQueueJob(payload.queueId, job)
  },
)

export async function formatRssRunLogs(runIds: string[]) {
  const logs = await findRssExecutionLogsForRunIds(runIds)
  return logs.map((log) => `${formatDateTime(log.createdAt)} [${log.level}] ${log.stage}: ${log.message}`)
}
