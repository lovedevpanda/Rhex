import { randomUUID } from "node:crypto"

import {
  BACKGROUND_JOB_EXECUTION_LOG_KEY_EXPIRE_SECONDS,
  BACKGROUND_JOB_EXECUTION_LOG_RETENTION_MS,
  getBackgroundJobExecutionLogKey,
} from "@/lib/background-job-redis"
import { connectRedisClient, createRedisConnection, getRedis, hasRedisUrl } from "@/lib/redis"

type JsonObject = Record<string, unknown>

export interface BackgroundJobExecutionLogRecord {
  id: string
  occurredAt: string
  level: "info" | "error"
  scope: string
  action: string | null
  userId: number | null
  targetId: string | null
  metadata: JsonObject | null
  extra: JsonObject | null
  error: {
    name: string
    message: string
  } | null
}

interface PersistBackgroundJobExecutionLogInput {
  level: BackgroundJobExecutionLogRecord["level"]
  scope: string
  action?: string | null
  userId?: number | null
  targetId?: string | null
  metadata?: JsonObject | null
  extra?: JsonObject | null
  error?: BackgroundJobExecutionLogRecord["error"]
}

export interface BackgroundJobExecutionLogPage {
  items: BackgroundJobExecutionLogRecord[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

function normalizeRequestedPage(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1
  }

  return Math.max(1, Math.trunc(value))
}

function normalizeRequestedPageSize(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 10
  }

  return Math.max(1, Math.min(100, Math.trunc(value)))
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function parseBackgroundJobExecutionLog(value: string) {
  try {
    const parsed = JSON.parse(value) as Partial<BackgroundJobExecutionLogRecord>

    if (
      !parsed
      || typeof parsed !== "object"
      || typeof parsed.id !== "string"
      || typeof parsed.occurredAt !== "string"
      || (parsed.level !== "info" && parsed.level !== "error")
      || typeof parsed.scope !== "string"
    ) {
      return null
    }

    return {
      id: parsed.id,
      occurredAt: parsed.occurredAt,
      level: parsed.level,
      scope: parsed.scope,
      action: typeof parsed.action === "string" ? parsed.action : null,
      userId: typeof parsed.userId === "number" ? parsed.userId : null,
      targetId: typeof parsed.targetId === "string" ? parsed.targetId : null,
      metadata: isJsonObject(parsed.metadata) ? parsed.metadata : null,
      extra: isJsonObject(parsed.extra) ? parsed.extra : null,
      error: parsed.error
        && typeof parsed.error.name === "string"
        && typeof parsed.error.message === "string"
        ? {
            name: parsed.error.name,
            message: parsed.error.message,
          }
        : null,
    } satisfies BackgroundJobExecutionLogRecord
  } catch {
    return null
  }
}

async function pruneBackgroundJobExecutionLogsWithRedis(redis: ReturnType<typeof getRedis>, nowMs: number) {
  return redis.zremrangebyscore(
    getBackgroundJobExecutionLogKey(),
    "-inf",
    String(nowMs - BACKGROUND_JOB_EXECUTION_LOG_RETENTION_MS),
  )
}

export async function persistBackgroundJobExecutionLog(input: PersistBackgroundJobExecutionLogInput) {
  if (!hasRedisUrl() || input.scope !== "background-job") {
    return
  }

  const redis = getRedis()
  const occurredAt = new Date().toISOString()
  const occurredAtMs = Date.now()
  const record: BackgroundJobExecutionLogRecord = {
    id: randomUUID(),
    occurredAt,
    level: input.level,
    scope: input.scope,
    action: input.action ?? null,
    userId: input.userId ?? null,
    targetId: input.targetId ?? null,
    metadata: input.metadata ?? null,
    extra: input.extra ?? null,
    error: input.error ?? null,
  }

  try {
    await connectRedisClient(redis)
    await redis.multi()
      .zadd(getBackgroundJobExecutionLogKey(), String(occurredAtMs), JSON.stringify(record))
      .zremrangebyscore(
        getBackgroundJobExecutionLogKey(),
        "-inf",
        String(occurredAtMs - BACKGROUND_JOB_EXECUTION_LOG_RETENTION_MS),
      )
      .expire(getBackgroundJobExecutionLogKey(), BACKGROUND_JOB_EXECUTION_LOG_KEY_EXPIRE_SECONDS)
      .exec()
  } catch (error) {
    console.error("[background-job-log] persist failed", error)
  }
}

export async function getBackgroundJobExecutionLogPage(options?: {
  page?: number
  pageSize?: number
}) {
  const requestedPage = normalizeRequestedPage(options?.page)
  const pageSize = normalizeRequestedPageSize(options?.pageSize)

  if (!hasRedisUrl()) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
    } satisfies BackgroundJobExecutionLogPage
  }

  const redis = createRedisConnection("background-job:admin-log")

  try {
    await connectRedisClient(redis)
    await pruneBackgroundJobExecutionLogsWithRedis(redis, Date.now())
    const total = Number(await redis.zcard(getBackgroundJobExecutionLogKey()).catch(() => 0))
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const page = Math.min(requestedPage, totalPages)
    const start = Math.max(0, (page - 1) * pageSize)
    const stop = start + pageSize - 1
    const encodedItems = await redis.zrevrange(getBackgroundJobExecutionLogKey(), start, stop).catch(() => [])

    if (!Array.isArray(encodedItems)) {
      return {
        items: [],
        total,
        page,
        pageSize,
        totalPages,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
      } satisfies BackgroundJobExecutionLogPage
    }

    const items = encodedItems
      .map((item) => parseBackgroundJobExecutionLog(String(item)))
      .filter((item): item is BackgroundJobExecutionLogRecord => Boolean(item))

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    } satisfies BackgroundJobExecutionLogPage
  } finally {
    redis.disconnect()
  }
}
