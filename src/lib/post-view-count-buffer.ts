import { randomUUID } from "node:crypto"

import { increasePostViewCount, increasePostViewCounts } from "@/db/post-queries"
import { acquireRedisLease } from "@/lib/redis-lease"
import { connectRedisClient, createRedisKey, getRedis, hasRedisUrl } from "@/lib/redis"
import { logRuntimeError } from "@/lib/runtime-errors"

const POST_VIEW_COUNT_PENDING_KEY = createRedisKey("post-views", "pending")
const POST_VIEW_COUNT_FLUSH_LOCK_KEY = createRedisKey("post-views", "flush-lock")
const DEFAULT_FLUSH_INTERVAL_MS = 30_000
const DEFAULT_FLUSH_LEASE_TTL_MS = 120_000
const MAX_FLUSH_ITEMS = 5_000

const CLAIM_PENDING_VIEWS_LUA = `
if redis.call("exists", KEYS[1]) == 0 then
  return {}
end
redis.call("rename", KEYS[1], KEYS[2])
return redis.call("hgetall", KEYS[2])
`

const RESTORE_PROCESSING_VIEWS_LUA = `
local values = redis.call("hgetall", KEYS[2])
for i = 1, #values, 2 do
  redis.call("hincrby", KEYS[1], values[i], values[i + 1])
end
redis.call("del", KEYS[2])
return #values / 2
`

type GlobalPostViewCountFlushState = {
  __bbsPostViewCountFlushTimer?: ReturnType<typeof setInterval> | null
  __bbsPostViewCountFlushInFlight?: boolean
}

const globalForPostViewCountFlush = globalThis as typeof globalThis & GlobalPostViewCountFlushState

function parsePositiveIntegerEnv(key: string, fallback: number, options: { min: number; max: number }) {
  const raw = process.env[key]?.trim()
  if (!raw) {
    return fallback
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(options.max, Math.max(options.min, Math.trunc(parsed)))
}

function getPostViewCountFlushIntervalMs() {
  return parsePositiveIntegerEnv("POST_VIEW_COUNT_FLUSH_INTERVAL_MS", DEFAULT_FLUSH_INTERVAL_MS, {
    min: 5_000,
    max: 10 * 60_000,
  })
}

function getPostViewCountFlushLeaseTtlMs() {
  return parsePositiveIntegerEnv("POST_VIEW_COUNT_FLUSH_LEASE_TTL_MS", DEFAULT_FLUSH_LEASE_TTL_MS, {
    min: 10_000,
    max: 30 * 60_000,
  })
}

function normalizePostId(postId: string) {
  return postId.trim()
}

function parseClaimedViewCounts(raw: unknown) {
  if (!Array.isArray(raw)) {
    return []
  }

  const items: Array<{ postId: string; count: number }> = []
  for (let index = 0; index < raw.length; index += 2) {
    const postId = String(raw[index] ?? "").trim()
    const count = Number(raw[index + 1])

    if (!postId || !Number.isFinite(count) || count <= 0) {
      continue
    }

    items.push({ postId, count: Math.trunc(count) })
  }

  return items.slice(0, MAX_FLUSH_ITEMS)
}

export async function recordPostViewCount(postId: string) {
  const normalizedPostId = normalizePostId(postId)
  if (!normalizedPostId) {
    return
  }

  if (!hasRedisUrl()) {
    await increasePostViewCount(normalizedPostId)
    return
  }

  try {
    const redis = getRedis()
    await connectRedisClient(redis)
    await redis.hincrby(POST_VIEW_COUNT_PENDING_KEY, normalizedPostId, 1)
  } catch (error) {
    logRuntimeError(error, {
      area: "post-view-count",
      action: "record-buffered-view",
      message: "帖子浏览量写入 Redis 缓冲失败，已回退到数据库自增",
      level: "warn",
      metadata: { postId: normalizedPostId },
    })
    await increasePostViewCount(normalizedPostId)
  }
}

export async function flushPostViewCounts() {
  if (!hasRedisUrl()) {
    return { postCount: 0, viewCount: 0 }
  }

  const lease = await acquireRedisLease({
    key: POST_VIEW_COUNT_FLUSH_LOCK_KEY,
    ttlMs: getPostViewCountFlushLeaseTtlMs(),
  })

  if (!lease) {
    return { postCount: 0, viewCount: 0 }
  }

  const redis = getRedis()
  const processingKey = createRedisKey("post-views", "processing", randomUUID())

  try {
    await connectRedisClient(redis)
    const claimed = parseClaimedViewCounts(await redis.eval(
      CLAIM_PENDING_VIEWS_LUA,
      2,
      POST_VIEW_COUNT_PENDING_KEY,
      processingKey,
    ))

    if (claimed.length === 0) {
      await redis.del(processingKey)
      return { postCount: 0, viewCount: 0 }
    }

    await increasePostViewCounts(claimed)
    await redis.del(processingKey)

    return {
      postCount: claimed.length,
      viewCount: claimed.reduce((total, item) => total + item.count, 0),
    }
  } catch (error) {
    try {
      await redis.eval(
        RESTORE_PROCESSING_VIEWS_LUA,
        2,
        POST_VIEW_COUNT_PENDING_KEY,
        processingKey,
      )
    } catch (restoreError) {
      logRuntimeError(restoreError, {
        area: "post-view-count",
        action: "restore-buffered-views",
        message: "帖子浏览量落库失败后恢复 Redis 缓冲失败",
        level: "error",
      })
    }

    throw error
  } finally {
    await lease.release().catch(() => false)
  }
}

export function startPostViewCountFlushLoop() {
  if (!hasRedisUrl() || globalForPostViewCountFlush.__bbsPostViewCountFlushTimer) {
    return
  }

  const intervalMs = getPostViewCountFlushIntervalMs()
  const flushOnce = async () => {
    if (globalForPostViewCountFlush.__bbsPostViewCountFlushInFlight) {
      return
    }

    globalForPostViewCountFlush.__bbsPostViewCountFlushInFlight = true
    try {
      await flushPostViewCounts()
    } catch (error) {
      logRuntimeError(error, {
        area: "post-view-count",
        action: "flush-buffered-views",
        message: "帖子浏览量批量落库失败",
        level: "warn",
      })
    } finally {
      globalForPostViewCountFlush.__bbsPostViewCountFlushInFlight = false
    }
  }

  globalForPostViewCountFlush.__bbsPostViewCountFlushTimer = setInterval(flushOnce, intervalMs)
  globalForPostViewCountFlush.__bbsPostViewCountFlushTimer.unref?.()
  void flushOnce()
}

export async function stopPostViewCountFlushLoop() {
  const timer = globalForPostViewCountFlush.__bbsPostViewCountFlushTimer
  if (timer) {
    clearInterval(timer)
    globalForPostViewCountFlush.__bbsPostViewCountFlushTimer = null
  }

  await flushPostViewCounts().catch((error) => {
    logRuntimeError(error, {
      area: "post-view-count",
      action: "flush-buffered-views-on-stop",
      message: "停止 worker 时帖子浏览量批量落库失败",
      level: "warn",
    })
  })
}
