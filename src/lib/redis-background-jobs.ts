import { randomUUID } from "node:crypto"

import type Redis from "ioredis"

import {
  createBackgroundJobLogMetadata,
  createBackgroundJobDeadLetterRecord,
  parseBackgroundJobEnvelopeString,
  createBackgroundJobRetryEnvelope,
  type BackgroundJobEnvelope,
  type BackgroundJobTransport,
  resolveBackgroundJobConcurrency,
  runRegisteredBackgroundJob,
} from "@/lib/background-jobs"
import {
  getBackgroundJobConsumerGroupName,
  getBackgroundJobDeadLetterKey,
  getBackgroundJobDelayedSetKey,
  getBackgroundJobStreamKey,
} from "@/lib/background-job-redis"
import { logError, logInfo } from "@/lib/logger"
import { connectRedisClient, createRedisConnection } from "@/lib/redis"

const DEFAULT_STREAM_MAX_LENGTH = 10_000
const DEFAULT_BLOCK_TIMEOUT_MS = 5_000
const DEFAULT_PENDING_IDLE_MS = 15 * 60 * 1_000
const DEFAULT_PENDING_CLAIM_BATCH_SIZE = 20
const DEFAULT_PENDING_SWEEP_INTERVAL_MS = 15_000
const DEFAULT_LANE_RESTART_BASE_DELAY_MS = 1_000
const DEFAULT_LANE_RESTART_MAX_DELAY_MS = 30_000
const DEFAULT_DELAYED_PROMOTION_BATCH_SIZE = 50
const DEFAULT_DEAD_LETTER_MAX_LENGTH = 1_000

type RedisStreamEntry = {
  id: string
  fields: Record<string, string>
}

type RedisPendingEntry = {
  id: string
  idleMs: number
}

type GlobalRedisBackgroundJobState = {
  __bbsRedisBackgroundJobRuntime?: RedisBackgroundJobRuntime
}

const globalForRedisBackgroundJobs = globalThis as typeof globalThis & GlobalRedisBackgroundJobState

function parsePositiveInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, parsed))
}

function getBackgroundJobStreamMaxLength() {
  return parsePositiveInteger(process.env.BACKGROUND_JOB_STREAM_MAX_LENGTH, DEFAULT_STREAM_MAX_LENGTH, 100, 1_000_000)
}

function getBackgroundJobBlockTimeoutMs() {
  return parsePositiveInteger(process.env.BACKGROUND_JOB_BLOCK_TIMEOUT_MS, DEFAULT_BLOCK_TIMEOUT_MS, 250, 60_000)
}

function getBackgroundJobPendingIdleMs() {
  return parsePositiveInteger(process.env.BACKGROUND_JOB_PENDING_IDLE_MS, DEFAULT_PENDING_IDLE_MS, 5_000, 24 * 60 * 60 * 1_000)
}

function getBackgroundJobPendingClaimBatchSize() {
  return parsePositiveInteger(process.env.BACKGROUND_JOB_PENDING_CLAIM_BATCH_SIZE, DEFAULT_PENDING_CLAIM_BATCH_SIZE, 1, 200)
}

function getBackgroundJobPendingSweepIntervalMs() {
  return parsePositiveInteger(process.env.BACKGROUND_JOB_PENDING_SWEEP_INTERVAL_MS, DEFAULT_PENDING_SWEEP_INTERVAL_MS, 1_000, 60_000)
}

function getBackgroundJobDelayedPromotionBatchSize() {
  return parsePositiveInteger(process.env.BACKGROUND_JOB_DELAYED_PROMOTION_BATCH_SIZE, DEFAULT_DELAYED_PROMOTION_BATCH_SIZE, 1, 500)
}

function getBackgroundJobDeadLetterMaxLength() {
  return parsePositiveInteger(process.env.BACKGROUND_JOB_DEAD_LETTER_MAX_LENGTH, DEFAULT_DEAD_LETTER_MAX_LENGTH, 10, 100_000)
}

function getBackgroundJobLaneRestartBaseDelayMs() {
  return parsePositiveInteger(
    process.env.BACKGROUND_JOB_LANE_RESTART_BASE_DELAY_MS,
    DEFAULT_LANE_RESTART_BASE_DELAY_MS,
    250,
    60_000,
  )
}

function getBackgroundJobLaneRestartMaxDelayMs() {
  const baseDelayMs = getBackgroundJobLaneRestartBaseDelayMs()
  return parsePositiveInteger(
    process.env.BACKGROUND_JOB_LANE_RESTART_MAX_DELAY_MS,
    DEFAULT_LANE_RESTART_MAX_DELAY_MS,
    baseDelayMs,
    10 * 60 * 1_000,
  )
}

function computeBackgroundJobLaneRestartDelayMs(consecutiveFailureCount: number) {
  const baseDelayMs = getBackgroundJobLaneRestartBaseDelayMs()
  const maxDelayMs = getBackgroundJobLaneRestartMaxDelayMs()
  const exponent = Math.max(0, Math.trunc(consecutiveFailureCount) - 1)
  const cappedBaseDelayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** exponent)
  const minJitterDelayMs = Math.max(baseDelayMs, Math.floor(cappedBaseDelayMs / 2))

  if (cappedBaseDelayMs <= minJitterDelayMs) {
    return cappedBaseDelayMs
  }

  const jitterRangeMs = cappedBaseDelayMs - minJitterDelayMs
  return minJitterDelayMs + Math.floor(Math.random() * (jitterRangeMs + 1))
}

function normalizeStreamEntries(value: unknown): RedisStreamEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    if (!Array.isArray(entry) || entry.length < 2 || typeof entry[0] !== "string" || !Array.isArray(entry[1])) {
      return []
    }

    const fieldValues = entry[1]
    const fields: Record<string, string> = {}

    for (let index = 0; index < fieldValues.length; index += 2) {
      const key = fieldValues[index]
      const fieldValue = fieldValues[index + 1]

      if (typeof key !== "undefined" && typeof fieldValue !== "undefined") {
        fields[String(key)] = String(fieldValue)
      }
    }

    return [{
      id: entry[0],
      fields,
    }]
  })
}

function normalizeReadGroupEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as RedisStreamEntry[]
  }

  return value.flatMap((streamChunk) => {
    if (!Array.isArray(streamChunk) || streamChunk.length < 2) {
      return []
    }

    return normalizeStreamEntries(streamChunk[1])
  })
}

function normalizeAutoClaimEntries(value: unknown) {
  if (!Array.isArray(value) || value.length < 2) {
    return [] as RedisStreamEntry[]
  }

  return normalizeStreamEntries(value[1])
}

function normalizePendingEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as RedisPendingEntry[]
  }

  return value.flatMap((entry) => {
    if (!Array.isArray(entry) || typeof entry[0] !== "string") {
      return []
    }

    return [{
      id: entry[0],
      idleMs: Number(entry[2] ?? 0),
    }]
  })
}

function isRedisUnknownCommandError(error: unknown, command: string) {
  const message = error instanceof Error ? error.message : String(error)
  const normalizedMessage = message.toUpperCase()
  const normalizedCommand = command.toUpperCase()

  return normalizedMessage.includes("UNKNOWN COMMAND") && normalizedMessage.includes(normalizedCommand)
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function parseBackgroundJobEnvelope(entry: RedisStreamEntry): BackgroundJobEnvelope | null {
  const encodedJob = entry.fields.job

  if (!encodedJob) {
    return null
  }

  return parseBackgroundJobEnvelopeString(encodedJob)
}

class RedisBackgroundJobTransport implements BackgroundJobTransport {
  private readonly redis = createRedisConnection("background-job:transport")
  private groupReadyPromise: Promise<void> | null = null

  async enqueue<Name extends BackgroundJobEnvelope["name"]>(job: BackgroundJobEnvelope<Name>) {
    await this.ensureReady()

    const encodedJob = JSON.stringify(job)
    const availableAt = job.availableAt ? new Date(job.availableAt).getTime() : 0

    if (availableAt > Date.now()) {
      await this.redis.zadd(
        getBackgroundJobDelayedSetKey(),
        String(availableAt),
        encodedJob,
      )
      return
    }

    await this.pushToStream(encodedJob)
  }

  async pushToStream(encodedJob: string) {
    const streamKey = getBackgroundJobStreamKey()
    const streamMaxLength = getBackgroundJobStreamMaxLength()

    await this.redis.call(
      "XADD",
      streamKey,
      "MAXLEN",
      "~",
      String(streamMaxLength),
      "*",
      "job",
      encodedJob,
    )
  }

  async ensureReady() {
    await connectRedisClient(this.redis)
    await this.ensureConsumerGroup()
  }

  async enqueueWithRedis(redis: Redis, job: BackgroundJobEnvelope) {
    const encodedJob = JSON.stringify(job)
    const availableAt = job.availableAt ? new Date(job.availableAt).getTime() : 0

    if (availableAt > Date.now()) {
      await redis.zadd(
        getBackgroundJobDelayedSetKey(),
        String(availableAt),
        encodedJob,
      )
      return
    }

    await this.pushToStreamWithRedis(redis, encodedJob)
  }

  async pushToStreamWithRedis(redis: Redis, encodedJob: string) {
    const streamKey = getBackgroundJobStreamKey()
    const streamMaxLength = getBackgroundJobStreamMaxLength()

    await redis.call(
      "XADD",
      streamKey,
      "MAXLEN",
      "~",
      String(streamMaxLength),
      "*",
      "job",
      encodedJob,
    )
  }

  private async ensureConsumerGroup() {
    this.groupReadyPromise ??= (async () => {
      try {
        await this.redis.call(
          "XGROUP",
          "CREATE",
          getBackgroundJobStreamKey(),
          getBackgroundJobConsumerGroupName(),
          "0",
          "MKSTREAM",
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)

        if (!message.includes("BUSYGROUP")) {
          throw error
        }
      }
    })()

    return this.groupReadyPromise
  }
}

class RedisBackgroundJobRuntime {
  readonly workerId = randomUUID()
  readonly transport = new RedisBackgroundJobTransport()

  private startPromise: Promise<void> | null = null
  private staleEntryClaimStrategy: "xautoclaim" | "xclaim" = "xautoclaim"

  async start() {
    this.startPromise ??= this.startInternal()
    return this.startPromise
  }

  private async startInternal() {
    await this.transport.ensureReady()

    const concurrency = resolveBackgroundJobConcurrency()

    for (let laneIndex = 0; laneIndex < concurrency; laneIndex += 1) {
      void this.runLane(laneIndex)
    }

    logInfo({
      scope: "background-job",
      action: "worker-start",
      metadata: {
        workerId: this.workerId,
        concurrency,
      },
    })
  }

  private async runLane(laneIndex: number) {
    const consumerName = `${this.workerId}:${laneIndex}`
    let nextPendingSweepAt = 0
    let nextDelayedPromotionAt = 0
    let consecutiveFailureCount = 0

    while (true) {
      const redis = createRedisConnection(`background-job:lane:${laneIndex}`)

      try {
        await connectRedisClient(redis)
        await this.transport.ensureReady()

        while (true) {
          if (laneIndex === 0 && Date.now() >= nextDelayedPromotionAt) {
            await this.promoteDueDelayedJobs(redis)
            nextDelayedPromotionAt = Date.now() + getBackgroundJobPendingSweepIntervalMs()
          }

          if (laneIndex === 0 && Date.now() >= nextPendingSweepAt) {
            await this.processStaleEntries(redis, consumerName)
            nextPendingSweepAt = Date.now() + getBackgroundJobPendingSweepIntervalMs()
          }

          const entries = await this.readNewEntries(redis, consumerName)
          consecutiveFailureCount = 0

          if (entries.length === 0) {
            continue
          }

          for (const entry of entries) {
            await this.processEntry(redis, entry, consumerName)
          }
        }
      } catch (error) {
        logError({
          scope: "background-job",
          action: "worker-lane",
          metadata: {
            workerId: this.workerId,
            consumerName,
            consecutiveFailureCount: consecutiveFailureCount + 1,
          },
        }, error)
      } finally {
        redis.disconnect()
      }

      consecutiveFailureCount += 1
      const restartDelayMs = computeBackgroundJobLaneRestartDelayMs(consecutiveFailureCount)
      logInfo({
        scope: "background-job",
        action: "worker-lane-restart",
        metadata: {
          workerId: this.workerId,
          consumerName,
          laneIndex,
          consecutiveFailureCount,
          restartDelayMs,
        },
      })
      await sleep(restartDelayMs)
    }
  }

  private async readNewEntries(redis: Redis, consumerName: string) {
    const response = await redis.call(
      "XREADGROUP",
      "GROUP",
      getBackgroundJobConsumerGroupName(),
      consumerName,
      "COUNT",
      "1",
      "BLOCK",
      String(getBackgroundJobBlockTimeoutMs()),
      "STREAMS",
      getBackgroundJobStreamKey(),
      ">",
    )

    return normalizeReadGroupEntries(response)
  }

  private async processStaleEntries(redis: Redis, consumerName: string) {
    const claimedEntries = this.staleEntryClaimStrategy === "xclaim"
      ? await this.processStaleEntriesWithXClaim(redis, consumerName)
      : await this.processStaleEntriesWithAutoClaim(redis, consumerName)

    for (const entry of claimedEntries) {
      await this.processEntry(redis, entry, consumerName)
    }
  }

  private async processStaleEntriesWithAutoClaim(redis: Redis, consumerName: string) {
    try {
      const response = await redis.call(
        "XAUTOCLAIM",
        getBackgroundJobStreamKey(),
        getBackgroundJobConsumerGroupName(),
        consumerName,
        String(getBackgroundJobPendingIdleMs()),
        "0-0",
        "COUNT",
        String(getBackgroundJobPendingClaimBatchSize()),
      )

      return normalizeAutoClaimEntries(response)
    } catch (error) {
      if (!isRedisUnknownCommandError(error, "XAUTOCLAIM")) {
        throw error
      }

      this.staleEntryClaimStrategy = "xclaim"
      logInfo({
        scope: "background-job",
        action: "stale-claim-compat",
        metadata: {
          workerId: this.workerId,
          strategy: "XPENDING+XCLAIM",
        },
      })

      return this.processStaleEntriesWithXClaim(redis, consumerName)
    }
  }

  private async processStaleEntriesWithXClaim(redis: Redis, consumerName: string) {
    const maxClaimCount = getBackgroundJobPendingClaimBatchSize()
    const minIdleMs = getBackgroundJobPendingIdleMs()
    const scanPageSize = Math.max(2, maxClaimCount)
    const maxScanCount = scanPageSize * 10
    const claimedEntries: RedisStreamEntry[] = []
    let cursor = "-"
    let scannedCount = 0

    while (claimedEntries.length < maxClaimCount && scannedCount < maxScanCount) {
      const pendingEntriesResponse = await redis.call(
        "XPENDING",
        getBackgroundJobStreamKey(),
        getBackgroundJobConsumerGroupName(),
        cursor,
        "+",
        String(scanPageSize),
      )
      let pendingEntries = normalizePendingEntries(pendingEntriesResponse)

      if (pendingEntries.length === 0) {
        break
      }

      // Redis < 6.2 doesn't support exclusive range cursors for XPENDING, so
      // subsequent pages may repeat the previous last entry.
      if (cursor !== "-" && pendingEntries[0]?.id === cursor) {
        pendingEntries = pendingEntries.slice(1)
      }

      if (pendingEntries.length === 0) {
        break
      }

      scannedCount += pendingEntries.length
      cursor = pendingEntries[pendingEntries.length - 1]?.id ?? cursor

      const remainingClaimCount = maxClaimCount - claimedEntries.length
      const stalePendingIds = pendingEntries
        .filter((entry) => entry.idleMs >= minIdleMs)
        .slice(0, remainingClaimCount)
        .map((entry) => entry.id)

      if (stalePendingIds.length === 0) {
        if (pendingEntries.length < scanPageSize) {
          break
        }

        continue
      }

      const response = await redis.call(
        "XCLAIM",
        getBackgroundJobStreamKey(),
        getBackgroundJobConsumerGroupName(),
        consumerName,
        String(minIdleMs),
        ...stalePendingIds,
      )

      claimedEntries.push(...normalizeStreamEntries(response))

      if (pendingEntries.length < scanPageSize) {
        break
      }
    }

    return claimedEntries
  }

  private async promoteDueDelayedJobs(redis: Redis) {
    const movedCount = await redis.eval(
      `
local delayedKey = KEYS[1]
local streamKey = KEYS[2]
local now = ARGV[1]
local limit = tonumber(ARGV[2])
local maxlen = ARGV[3]

local jobs = redis.call("ZRANGEBYSCORE", delayedKey, "-inf", now, "LIMIT", 0, limit)

for _, job in ipairs(jobs) do
  redis.call("ZREM", delayedKey, job)
  redis.call("XADD", streamKey, "MAXLEN", "~", maxlen, "*", "job", job)
end

return #jobs
      `,
      2,
      getBackgroundJobDelayedSetKey(),
      getBackgroundJobStreamKey(),
      String(Date.now()),
      String(getBackgroundJobDelayedPromotionBatchSize()),
      String(getBackgroundJobStreamMaxLength()),
    )

    const promoted = Number(movedCount)

    if (promoted > 0) {
      logInfo({
        scope: "background-job",
        action: "promote-delayed",
        metadata: {
          workerId: this.workerId,
          promoted,
        },
      })
    }
  }

  private async processEntry(redis: Redis, entry: RedisStreamEntry, consumerName: string) {
    const job = parseBackgroundJobEnvelope(entry)

    if (!job) {
      logError({
        scope: "background-job",
        action: "decode",
        targetId: entry.id,
      }, new Error("Invalid background job payload"))

      await this.acknowledgeProcessedEntry(redis, entry.id)
      return
    }

    logInfo({
      scope: "background-job",
      action: "start",
      targetId: entry.id,
      metadata: createBackgroundJobLogMetadata(job, {
        workerId: this.workerId,
        consumerName,
        transport: "redis",
      }),
    })

    const startedAtMs = Date.now()
    const result = await runRegisteredBackgroundJob(job)
    const durationMs = Date.now() - startedAtMs

    if (result.ok) {
      logInfo({
        scope: "background-job",
        action: "success",
        targetId: entry.id,
        metadata: createBackgroundJobLogMetadata(job, {
          workerId: this.workerId,
          consumerName,
          transport: "redis",
          durationMs,
        }),
      })
    }

    if (!result.ok) {
      const errorMetadata = createBackgroundJobLogMetadata(job, {
        workerId: this.workerId,
        consumerName,
        transport: "redis",
        durationMs,
      })
      const retryJob = result.retryable ? createBackgroundJobRetryEnvelope(job) : null

      if (retryJob) {
        logError({
          scope: "background-job",
          action: "run",
          targetId: entry.id,
          metadata: errorMetadata,
        }, result.error)
        await this.transport.enqueueWithRedis(redis, retryJob)
        logInfo({
          scope: "background-job",
          action: "retry",
          targetId: entry.id,
          metadata: createBackgroundJobLogMetadata(job, {
            workerId: this.workerId,
            consumerName,
            transport: "redis",
            durationMs,
            nextAttempt: retryJob.attempt,
            availableAt: retryJob.availableAt ?? null,
          }),
        })
      } else {
        await this.persistDeadLetter(redis, createBackgroundJobDeadLetterRecord(job, result.error, result.retryable))
        logError({
          scope: "background-job",
          action: "dead-letter",
          targetId: entry.id,
          metadata: errorMetadata,
        }, result.error)
      }
    }

    await this.acknowledgeProcessedEntry(redis, entry.id)
  }

  private async persistDeadLetter(redis: Redis, record: ReturnType<typeof createBackgroundJobDeadLetterRecord>) {
    const deadLetterKey = getBackgroundJobDeadLetterKey()
    const deadLetterMaxLength = getBackgroundJobDeadLetterMaxLength()

    await redis.multi()
      .lpush(deadLetterKey, JSON.stringify(record))
      .ltrim(deadLetterKey, 0, deadLetterMaxLength - 1)
      .exec()
  }

  private async acknowledgeProcessedEntry(redis: Redis, entryId: string) {
    await Promise.all([
      redis.call(
        "XACK",
        getBackgroundJobStreamKey(),
        getBackgroundJobConsumerGroupName(),
        entryId,
      ),
      redis.call(
        "XDEL",
        getBackgroundJobStreamKey(),
        entryId,
      ),
    ])
  }
}

function getRedisBackgroundJobRuntime() {
  const runtime = globalForRedisBackgroundJobs.__bbsRedisBackgroundJobRuntime ?? new RedisBackgroundJobRuntime()

  if (!globalForRedisBackgroundJobs.__bbsRedisBackgroundJobRuntime) {
    globalForRedisBackgroundJobs.__bbsRedisBackgroundJobRuntime = runtime
  }

  return runtime
}

export async function getRedisBackgroundJobTransport(): Promise<BackgroundJobTransport> {
  const runtime = getRedisBackgroundJobRuntime()
  await runtime.transport.ensureReady()
  return runtime.transport
}

export async function ensureRedisBackgroundJobWorkerRunning() {
  const runtime = getRedisBackgroundJobRuntime()
  await runtime.start()
}
