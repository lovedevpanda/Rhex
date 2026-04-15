import { prisma } from "@/db/client"
import { PostAuctionStatus, type Prisma } from "@/db/types"
import {
  getInMemoryBackgroundJobDeadLetters,
  parseBackgroundJobEnvelopeString,
  resolveBackgroundJobConcurrency,
  resolveBackgroundJobMaxAttempts,
  resolveBackgroundJobRetryDelayMs,
  type BackgroundJobEnvelope,
  type BackgroundJobDeadLetterRecord,
} from "@/lib/background-jobs"
import {
  getBackgroundJobExecutionLogPage,
  type BackgroundJobExecutionLogRecord,
} from "@/lib/background-job-log-store"
import {
  getBackgroundJobConsumerGroupName,
  getBackgroundJobDeadLetterKey,
  getBackgroundJobDelayedSetKey,
  getBackgroundJobStreamKey,
} from "@/lib/background-job-redis"
import { serializeDateTime } from "@/lib/formatters"
import { connectRedisClient, createRedisConnection, hasRedisUrl } from "@/lib/redis"

type UnknownRecord = Record<string, unknown>

type RedisQueueSnapshot = {
  streamLength: number | null
  pendingCount: number | null
  delayedCount: number | null
  delayedPagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
  deadLetterPagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
  deadLetterCount: number
  liveWorkers: Array<{
    name: string
    processRole: string
    pid: string
    connectionRole: string
    address: string | null
    idleSeconds: number | null
  }>
  delayedJobs: Array<{
    scoreMs: number
    job: BackgroundJobEnvelope
  }>
  deadLetters: BackgroundJobDeadLetterRecord[]
}

export interface BackgroundWorkerAdminData {
  runtime: {
    transport: "redis" | "in-memory"
    transportLabel: string
    redisEnabled: boolean
    webRuntimeMode: string
    webConsumesJobs: boolean
    concurrency: number
    maxAttempts: number
    retryBaseDelayMs: number
  }
  queue: {
    streamLength: number | null
    pendingCount: number | null
    delayedCount: number | null
    deadLetterCount: number
    liveWorkerCount: number | null
    liveWorkers: RedisQueueSnapshot["liveWorkers"]
    delayedJobs: {
      items: Array<{
        id: string
        jobName: string
        attempt: number
        maxAttempts: number
        enqueuedAt: string
        availableAt: string | null
        delayRemainingMs: number | null
        payloadSummary: string
        payloadPreview: string
      }>
      pagination: RedisQueueSnapshot["delayedPagination"]
    }
  }
  executionLogs: {
    items: Array<{
      id: string
      occurredAt: string
      level: "info" | "error"
      action: string
      jobName: string | null
      attempt: number | null
      maxAttempts: number | null
      summary: string
      payloadSummary: string | null
      metadataPreview: string | null
      errorName: string | null
      errorMessage: string | null
    }>
    pagination: {
      page: number
      pageSize: number
      total: number
      totalPages: number
      hasPrevPage: boolean
      hasNextPage: boolean
    }
  }
  deadLetters: {
    items: Array<{
      id: string
      failedAt: string
      retryable: boolean
      jobName: string
      attempt: number
      maxAttempts: number
      errorName: string
      errorMessage: string
      auction: {
        id: string
        postId: string
        postSlug: string
        postTitle: string
        status: string
      } | null
    }>
    pagination: RedisQueueSnapshot["deadLetterPagination"]
  }
  auctionSettlement: {
    settlingCount: number
    pendingEntryCount: number
    items: Array<{
      auctionId: string
      postId: string
      postSlug: string
      postTitle: string
      sellerName: string
      participantCount: number
      processedCount: number
      remainingCount: number
      progressPercent: number
      endsAt: string
      updatedAt: string
      winnerReady: boolean
      finalPriceReady: boolean
    }>
  }
}

function normalizeRequestedWorkerLogPage(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1
  }

  return Math.max(1, Math.trunc(value))
}

function buildPagination(total: number, requestedPage: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
  }
}

function resolveBackgroundJobWebRuntimeMode() {
  return process.env.BACKGROUND_JOB_WEB_RUNTIME?.trim().toLowerCase() || "auto"
}

function resolveBackgroundJobWebConsumesJobs() {
  const mode = resolveBackgroundJobWebRuntimeMode()

  if (mode === "1" || mode === "true" || mode === "on" || mode === "enabled" || mode === "hybrid") {
    return true
  }

  if (mode === "0" || mode === "false" || mode === "off" || mode === "disabled" || mode === "worker-only") {
    return false
  }

  return process.env.NODE_ENV !== "production"
}

function serializeOptionalDateTime(input: Date | string | null | undefined) {
  if (!input) {
    return null
  }

  return serializeDateTime(input) ?? (input instanceof Date ? input.toISOString() : input)
}

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function formatDurationMs(value: number | null) {
  if (value === null) {
    return null
  }

  if (value >= 10_000) {
    return `${Math.round(value / 1_000)}s`
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}s`
  }

  return `${Math.round(value)}ms`
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}

function stringifyJsonPreview(value: unknown, maxLength = 480) {
  try {
    const serialized = JSON.stringify(value, null, 2)
    return truncateText(serialized ?? String(value), maxLength)
  } catch {
    return truncateText(String(value), maxLength)
  }
}

function summarizePrimitiveValue(value: unknown) {
  if (typeof value === "string") {
    return truncateText(value, 36)
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  if (Array.isArray(value)) {
    return `${value.length} items`
  }

  return null
}

function summarizeBackgroundJobPayload(payload: unknown) {
  if (!isUnknownRecord(payload)) {
    return summarizePrimitiveValue(payload) ?? "无负载"
  }

  if (typeof payload.auctionId === "string") {
    return `auctionId ${payload.auctionId}`
  }

  if (typeof payload.taskId === "string") {
    return `taskId ${payload.taskId}`
  }

  if (typeof payload.postId === "string") {
    return `postId ${payload.postId}`
  }

  if (typeof payload.commentId === "string") {
    return `commentId ${payload.commentId}`
  }

  if (typeof payload.userId === "number") {
    return `userId ${payload.userId}`
  }

  if (Array.isArray(payload.notifications)) {
    return `${payload.notifications.length} 条通知`
  }

  const fragments = Object.entries(payload)
    .flatMap(([key, value]) => {
      const summary = summarizePrimitiveValue(value)
      return summary ? [`${key}=${summary}`] : []
    })
    .slice(0, 3)

  if (fragments.length > 0) {
    return fragments.join(" · ")
  }

  const keys = Object.keys(payload)
  return keys.length > 0 ? `${keys.length} 个字段` : "空负载"
}

function parseRedisZRangeWithScores(values: unknown) {
  if (!Array.isArray(values)) {
    return [] as Array<{ member: string; scoreMs: number }>
  }

  const items: Array<{ member: string; scoreMs: number }> = []

  for (let index = 0; index < values.length; index += 2) {
    const member = values[index]
    const scoreRaw = values[index + 1]
    const scoreMs = Number(scoreRaw)

    if (typeof member === "undefined" || !Number.isFinite(scoreMs)) {
      continue
    }

    items.push({
      member: String(member),
      scoreMs,
    })
  }

  return items
}

function summarizeExecutionLog(record: BackgroundJobExecutionLogRecord) {
  const metadata = record.metadata ?? null
  const extra = record.extra ?? null
  const durationText = formatDurationMs(readFiniteNumber(metadata?.durationMs ?? extra?.durationMs))

  switch (record.action) {
    case "start":
      return "开始执行任务"
    case "success":
      return durationText ? `任务执行完成，耗时 ${durationText}` : "任务执行完成"
    case "retry": {
      const nextAttempt = readFiniteNumber(metadata?.nextAttempt)
      const availableAt = typeof metadata?.availableAt === "string"
        ? serializeOptionalDateTime(metadata.availableAt) ?? metadata.availableAt
        : null
      return nextAttempt !== null
        ? `执行失败，已安排第 ${nextAttempt} 次重试${availableAt ? `，计划于 ${availableAt}` : ""}`
        : "执行失败，已安排重试"
    }
    case "dead-letter":
      return "任务执行失败，已进入死信队列"
    case "run":
      return "任务执行失败"
    case "decode":
      return "任务解码失败，已直接确认"
    case "promote-delayed": {
      const promoted = readFiniteNumber(metadata?.promoted)
      return promoted !== null ? `提升 ${promoted} 个到期延迟任务` : "执行了延迟任务提升"
    }
    case "worker-start": {
      const concurrency = readFiniteNumber(metadata?.concurrency)
      return concurrency !== null ? `worker 启动，并发 ${concurrency}` : "worker 已启动"
    }
    case "worker-lane-restart": {
      const restartDelayMs = readFiniteNumber(metadata?.restartDelayMs)
      return restartDelayMs !== null ? `lane 异常，${formatDurationMs(restartDelayMs)} 后重启` : "lane 异常后重启"
    }
    case "worker-lane":
      return "worker lane 运行异常"
    case "stale-claim-compat":
      return "切换为 XPENDING + XCLAIM 兼容模式"
    default:
      return record.action ?? "worker 事件"
  }
}

function getUserDisplayName(user: { username: string; nickname?: string | null }) {
  return user.nickname?.trim() || user.username
}

function buildAuctionPendingSettlementWhere(
  auctionId: string,
  winnerUserId: number,
  finalPrice: number,
): Prisma.PostAuctionEntryWhereInput {
  return {
    auctionId,
    OR: [
      {
        userId: {
          not: winnerUserId,
        },
        frozenAmount: {
          gt: 0,
        },
      },
      {
        userId: winnerUserId,
        frozenAmount: {
          gt: finalPrice,
        },
      },
    ],
  }
}

function parseRedisClientListEntry(line: string) {
  const fields = new Map<string, string>()

  for (const token of line.split(" ")) {
    const separatorIndex = token.indexOf("=")
    if (separatorIndex <= 0) {
      continue
    }

    const key = token.slice(0, separatorIndex)
    const value = token.slice(separatorIndex + 1)
    fields.set(key, value)
  }

  return fields
}

function parseRedisDeadLetter(value: string): BackgroundJobDeadLetterRecord | null {
  try {
    const parsed = JSON.parse(value) as BackgroundJobDeadLetterRecord
    if (
      !parsed
      || typeof parsed !== "object"
      || !parsed.job
      || typeof parsed.job.name !== "string"
      || typeof parsed.failedAt !== "string"
      || typeof parsed.retryable !== "boolean"
      || !parsed.error
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

async function readRedisQueueSnapshot(options?: {
  delayedPage?: number
  delayedPageSize?: number
  deadLetterPage?: number
  deadLetterPageSize?: number
}): Promise<RedisQueueSnapshot> {
  const redis = createRedisConnection("background-job:admin")
  const requestedDelayedPage = normalizeRequestedWorkerLogPage(options?.delayedPage)
  const delayedPageSize = Math.max(1, Math.trunc(options?.delayedPageSize ?? 10))
  const requestedDeadLetterPage = normalizeRequestedWorkerLogPage(options?.deadLetterPage)
  const deadLetterPageSize = Math.max(1, Math.trunc(options?.deadLetterPageSize ?? 10))

  try {
    await connectRedisClient(redis)

    const [streamLengthRaw, delayedCountRaw, deadLetterCountRaw, clientListRaw] = await Promise.all([
      redis.xlen(getBackgroundJobStreamKey()).catch(() => null),
      redis.zcard(getBackgroundJobDelayedSetKey()).catch(() => null),
      redis.llen(getBackgroundJobDeadLetterKey()).catch(() => 0),
      redis.client("LIST").catch(() => ""),
    ])

    const pendingSummaryRaw = await redis.call(
      "XPENDING",
      getBackgroundJobStreamKey(),
      getBackgroundJobConsumerGroupName(),
    ).catch(() => null)

    const pendingCount = Array.isArray(pendingSummaryRaw)
      ? Number(pendingSummaryRaw[0] ?? 0)
      : null

    const liveWorkers = String(clientListRaw)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseRedisClientListEntry)
      .map((fields) => {
        const name = fields.get("name") ?? ""
        const parts = name.split(":")
        const processRole = parts[1] ?? "unknown"
        const pid = parts[2] ?? "-"
        const connectionRole = parts.slice(3).join(":")

        return {
          name,
          processRole,
          pid,
          connectionRole,
          address: fields.get("addr") ?? null,
          idleSeconds: fields.get("idle") ? Number(fields.get("idle")) : null,
        }
      })
      .filter((item) => item.connectionRole.startsWith("background-job:") && item.connectionRole !== "background-job:admin")
      .sort((left, right) => left.name.localeCompare(right.name))

    const delayedTotal = delayedCountRaw === null ? 0 : Number(delayedCountRaw)
    const delayedPagination = buildPagination(delayedTotal, requestedDelayedPage, delayedPageSize)
    const delayedStart = Math.max(0, (delayedPagination.page - 1) * delayedPagination.pageSize)
    const delayedStop = delayedStart + delayedPagination.pageSize - 1
    const delayedItemsRaw = await redis.zrange(getBackgroundJobDelayedSetKey(), delayedStart, delayedStop, "WITHSCORES").catch(() => [])
    const delayedJobs = parseRedisZRangeWithScores(delayedItemsRaw)
      .map((item) => {
        const job = parseBackgroundJobEnvelopeString(item.member)
        return job ? { scoreMs: item.scoreMs, job } : null
      })
      .filter((item): item is RedisQueueSnapshot["delayedJobs"][number] => Boolean(item))
    const deadLetterTotal = Number(deadLetterCountRaw ?? 0)
    const deadLetterPagination = buildPagination(deadLetterTotal, requestedDeadLetterPage, deadLetterPageSize)
    const deadLetterStart = Math.max(0, (deadLetterPagination.page - 1) * deadLetterPagination.pageSize)
    const deadLetterStop = deadLetterStart + deadLetterPagination.pageSize - 1
    const deadLetterItems = await redis.lrange(getBackgroundJobDeadLetterKey(), deadLetterStart, deadLetterStop).catch(() => [])

    return {
      streamLength: streamLengthRaw === null ? null : Number(streamLengthRaw),
      pendingCount,
      delayedCount: delayedCountRaw === null ? null : delayedTotal,
      delayedPagination,
      deadLetterPagination,
      deadLetterCount: deadLetterTotal,
      liveWorkers,
      delayedJobs,
      deadLetters: Array.isArray(deadLetterItems)
        ? deadLetterItems
          .map((item) => parseRedisDeadLetter(String(item)))
          .filter((item): item is BackgroundJobDeadLetterRecord => Boolean(item))
        : [],
    }
  } finally {
    redis.disconnect()
  }
}

async function readDeadLetterSnapshot(options?: {
  delayedPage?: number
  delayedPageSize?: number
  deadLetterPage?: number
  deadLetterPageSize?: number
}) {
  if (hasRedisUrl()) {
    return readRedisQueueSnapshot(options)
  }

  const deadLetterPageSize = Math.max(1, Math.trunc(options?.deadLetterPageSize ?? 10))
  const delayedPageSize = Math.max(1, Math.trunc(options?.delayedPageSize ?? 10))
  const delayedPagination = buildPagination(0, normalizeRequestedWorkerLogPage(options?.delayedPage), delayedPageSize)
  const allDeadLetters = getInMemoryBackgroundJobDeadLetters()
  const deadLetterPagination = buildPagination(
    allDeadLetters.length,
    normalizeRequestedWorkerLogPage(options?.deadLetterPage),
    deadLetterPageSize,
  )
  const deadLetterStart = Math.max(0, (deadLetterPagination.page - 1) * deadLetterPagination.pageSize)
  const deadLetters = allDeadLetters.slice(deadLetterStart, deadLetterStart + deadLetterPagination.pageSize)
  return {
    streamLength: null,
    pendingCount: null,
    delayedCount: null,
    delayedPagination,
    deadLetterPagination,
    deadLetterCount: allDeadLetters.length,
    liveWorkers: [],
    delayedJobs: [],
    deadLetters,
  } satisfies RedisQueueSnapshot
}

export async function getBackgroundWorkerAdminData(options?: {
  logPage?: number
  delayedPage?: number
  deadLetterPage?: number
}): Promise<BackgroundWorkerAdminData> {
  const requestedLogPage = normalizeRequestedWorkerLogPage(options?.logPage)
  const requestedDelayedPage = normalizeRequestedWorkerLogPage(options?.delayedPage)
  const requestedDeadLetterPage = normalizeRequestedWorkerLogPage(options?.deadLetterPage)

  const [queueSnapshot, executionLogPage, settlingAuctions] = await Promise.all([
    readDeadLetterSnapshot({
      delayedPage: requestedDelayedPage,
      delayedPageSize: 10,
      deadLetterPage: requestedDeadLetterPage,
      deadLetterPageSize: 10,
    }),
    getBackgroundJobExecutionLogPage({
      page: requestedLogPage,
      pageSize: 10,
    }),
    prisma.postAuction.findMany({
      where: {
        status: PostAuctionStatus.SETTLING,
      },
      select: {
        id: true,
        postId: true,
        participantCount: true,
        endsAt: true,
        updatedAt: true,
        winnerUserId: true,
        finalPrice: true,
        post: {
          select: {
            slug: true,
            title: true,
          },
        },
        seller: {
          select: {
            username: true,
            nickname: true,
          },
        },
      },
      orderBy: {
        updatedAt: "asc",
      },
      take: 20,
    }),
  ])

  const settlementItems = await Promise.all(settlingAuctions.map(async (auction) => {
    const remainingCount = auction.winnerUserId !== null && auction.finalPrice !== null
      ? await prisma.postAuctionEntry.count({
        where: buildAuctionPendingSettlementWhere(
          auction.id,
          auction.winnerUserId,
          auction.finalPrice,
        ),
      })
      : await prisma.postAuctionEntry.count({
        where: {
          auctionId: auction.id,
        },
      })

    const processedCount = Math.max(0, auction.participantCount - remainingCount)
    const progressPercent = auction.participantCount > 0
      ? Math.min(100, Math.round((processedCount / auction.participantCount) * 100))
      : 100

    return {
      auctionId: auction.id,
      postId: auction.postId,
      postSlug: auction.post.slug,
      postTitle: auction.post.title,
      sellerName: getUserDisplayName(auction.seller),
      participantCount: auction.participantCount,
      processedCount,
      remainingCount,
      progressPercent,
      endsAt: serializeOptionalDateTime(auction.endsAt) ?? auction.endsAt.toISOString(),
      updatedAt: serializeOptionalDateTime(auction.updatedAt) ?? auction.updatedAt.toISOString(),
      winnerReady: auction.winnerUserId !== null,
      finalPriceReady: auction.finalPrice !== null,
    }
  }))

  const deadLetterAuctionIds = Array.from(new Set(queueSnapshot.deadLetters
    .map((item) => {
      const payload = item.job.payload
      return payload && typeof payload === "object" && "auctionId" in payload && typeof payload.auctionId === "string"
        ? payload.auctionId
        : null
    })
    .filter((item): item is string => Boolean(item))))

  const deadLetterAuctions = deadLetterAuctionIds.length > 0
    ? await prisma.postAuction.findMany({
      where: {
        id: {
          in: deadLetterAuctionIds,
        },
      },
      select: {
        id: true,
        status: true,
        postId: true,
        post: {
          select: {
            slug: true,
            title: true,
          },
        },
      },
    })
    : []

  const deadLetterAuctionMap = new Map(deadLetterAuctions.map((item) => [item.id, item]))
  const pendingEntryCount = settlementItems.reduce((total, item) => total + item.remainingCount, 0)
  const nowMs = Date.now()
  const delayedJobs = queueSnapshot.delayedJobs.map((item, index) => {
    const availableAt = item.job.availableAt ?? new Date(item.scoreMs).toISOString()

    return {
      id: `${item.scoreMs}:${item.job.name}:${index}`,
      jobName: item.job.name,
      attempt: item.job.attempt,
      maxAttempts: item.job.maxAttempts,
      enqueuedAt: serializeOptionalDateTime(item.job.enqueuedAt) ?? item.job.enqueuedAt,
      availableAt: serializeOptionalDateTime(availableAt) ?? availableAt,
      delayRemainingMs: Math.max(0, item.scoreMs - nowMs),
      payloadSummary: summarizeBackgroundJobPayload(item.job.payload),
      payloadPreview: stringifyJsonPreview(item.job.payload),
    }
  })
  const serializedExecutionLogs = executionLogPage.items.map((item) => {
    const metadata = item.metadata ?? null
    const extra = item.extra ?? null
    const payload = metadata?.payload
    const mergedPreviewSource = {
      ...(metadata ?? {}),
      ...(extra ?? {}),
    }

    return {
      id: item.id,
      occurredAt: serializeOptionalDateTime(item.occurredAt) ?? item.occurredAt,
      level: item.level,
      action: item.action ?? "event",
      jobName: typeof metadata?.jobName === "string" ? metadata.jobName : null,
      attempt: readFiniteNumber(metadata?.attempt),
      maxAttempts: readFiniteNumber(metadata?.maxAttempts),
      summary: summarizeExecutionLog(item),
      payloadSummary: typeof payload === "undefined" ? null : summarizeBackgroundJobPayload(payload),
      metadataPreview: Object.keys(mergedPreviewSource).length > 0 ? stringifyJsonPreview(mergedPreviewSource) : null,
      errorName: item.error?.name ?? null,
      errorMessage: item.error?.message ?? null,
    }
  })

  return {
    runtime: {
      transport: hasRedisUrl() ? "redis" : "in-memory",
      transportLabel: hasRedisUrl() ? "Redis 持久化队列" : "进程内内存队列",
      redisEnabled: hasRedisUrl(),
      webRuntimeMode: resolveBackgroundJobWebRuntimeMode(),
      webConsumesJobs: resolveBackgroundJobWebConsumesJobs(),
      concurrency: resolveBackgroundJobConcurrency(),
      maxAttempts: resolveBackgroundJobMaxAttempts(),
      retryBaseDelayMs: resolveBackgroundJobRetryDelayMs(1),
    },
    queue: {
      streamLength: queueSnapshot.streamLength,
      pendingCount: queueSnapshot.pendingCount,
      delayedCount: queueSnapshot.delayedCount,
      deadLetterCount: queueSnapshot.deadLetterCount,
      liveWorkerCount: hasRedisUrl() ? queueSnapshot.liveWorkers.length : null,
      liveWorkers: queueSnapshot.liveWorkers,
      delayedJobs: {
        items: delayedJobs,
        pagination: queueSnapshot.delayedPagination,
      },
    },
    executionLogs: {
      items: serializedExecutionLogs,
      pagination: {
        page: executionLogPage.page,
        pageSize: executionLogPage.pageSize,
        total: executionLogPage.total,
        totalPages: executionLogPage.totalPages,
        hasPrevPage: executionLogPage.hasPrevPage,
        hasNextPage: executionLogPage.hasNextPage,
      },
    },
    deadLetters: {
      items: queueSnapshot.deadLetters.map((item, index) => {
        const payload = item.job.payload
        const auctionId = payload && typeof payload === "object" && "auctionId" in payload && typeof payload.auctionId === "string"
          ? payload.auctionId
          : null
        const auction = auctionId ? deadLetterAuctionMap.get(auctionId) ?? null : null

        return {
          id: `${item.failedAt}:${item.job.name}:${index}`,
          failedAt: item.failedAt,
          retryable: item.retryable,
          jobName: item.job.name,
          attempt: item.job.attempt,
          maxAttempts: item.job.maxAttempts,
          errorName: item.error.name,
          errorMessage: item.error.message,
          auction: auction
            ? {
              id: auction.id,
              postId: auction.postId,
              postSlug: auction.post.slug,
              postTitle: auction.post.title,
              status: auction.status,
            }
            : null,
        }
      }),
      pagination: queueSnapshot.deadLetterPagination,
    },
    auctionSettlement: {
      settlingCount: settlementItems.length,
      pendingEntryCount,
      items: settlementItems,
    },
  }
}
