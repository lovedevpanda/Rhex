import {
  getInMemoryBackgroundJobConcurrency,
  getInMemoryBackgroundJobDeadLetterMaxLength,
  readBackgroundJobWebRuntimeMode,
} from "@/lib/background-job-config"
import {
  BackgroundJobPermanentError,
  createBackgroundJobDeadLetterRecord,
  createBackgroundJobLogMetadata,
  createBackgroundJobRetryEnvelope,
  isBackgroundJobRetryableError,
  normalizeBackgroundJobEnvelope,
  normalizeBackgroundJobThrownError,
} from "@/lib/background-job-envelope"
import {
  dedupeBackgroundJobsById,
  matchesBackgroundJob,
} from "@/lib/background-job-helpers"
import type { NotificationType, RelatedType } from "@/db/types"
import type { UserNotificationDeliveryJobPayload } from "@/lib/user-notification-delivery"
import { logError, logInfo } from "@/lib/logger"

export {
  BackgroundJobPermanentError,
  createBackgroundJobDeadLetterRecord,
  createBackgroundJobLogMetadata,
  createBackgroundJobRetryEnvelope,
  normalizeBackgroundJobEnvelope,
  parseBackgroundJobEnvelopeString,
  resolveBackgroundJobMaxAttempts,
  resolveBackgroundJobRetryDelayMs,
  serializeBackgroundJobError,
} from "@/lib/background-job-envelope"

export interface BackgroundJobPayloadMap {
  "notification.create": {
    userId: number
    type: NotificationType
    senderId?: number | null
    relatedType: RelatedType
    relatedId: string
    title: string
    content: string
  }
  "notification.create-many": {
    notifications: Array<{
      userId: number
      type: NotificationType
      senderId?: number | null
      relatedType: RelatedType
      relatedId: string
      title: string
      content: string
    }>
  }
  "notification.dispatch-webhook": UserNotificationDeliveryJobPayload
  "notification.dispatch-email": UserNotificationDeliveryJobPayload
  "follow.notify-new-post": {
    postId: string
  }
  "follow.notify-post-comment": {
    commentId: string
    excludeUserIds?: number[]
  }
  "follow.notify-user-followed": {
    userId: number
    followerUserId: number
    followerName: string
  }
  "level.evaluate-user-progress": {
    userId: number
    notifyOnUpgrade: boolean
  }
  "level.sync-user-received-likes": {
    userId: number
    notifyOnUpgrade: boolean
  }
  "level.refresh-all-users": Record<string, never>
  "check-in.refresh-all-streaks": {
    includeMakeUps: boolean
  }
  "interaction.dispatch-post-like-effects": {
    postId: string
    userId: number
    targetUserId: number | null
    liked: boolean
  }
  "interaction.dispatch-post-favorite-effects": {
    postId: string
    userId: number
    favored: boolean
  }
  "interaction.dispatch-comment-create-effects": {
    postId: string
    userId: number
    commentId: string
  }
  "post-auction.recovery": {
    reason?: string
  }
  "post-auction.settle": {
    auctionId: string
  }
  "ai-reply.process": {
    taskId: string
  }
  "rss-harvest.process-queue-item": {
    queueId: string
  }
  "addon.background-job.run": {
    addonId: string
    jobKey: string
    payload: unknown
  }
  "security.login-ip-change-email-alert": {
    userId: number
    previousIp: string
    currentIp: string
    userAgent?: string | null
    loginAt: string
  }
  "payment-gateway.order-success-email": {
    merchantOrderNo: string
    bizScene: string
    orderSubject: string
    amountFen: number
    currency: string
    providerCode: string
    channelCode: string
    paidAt: string
    username: string
    pointName?: string | null
    points?: number | null
    bonusPoints?: number | null
    totalPoints?: number | null
  }
}

export type BackgroundJobName = keyof BackgroundJobPayloadMap

export interface BackgroundJobEnvelope<Name extends BackgroundJobName = BackgroundJobName> {
  id: string
  name: Name
  payload: BackgroundJobPayloadMap[Name]
  enqueuedAt: string
  attempt: number
  maxAttempts: number
  availableAt?: string
  idempotencyKey?: string
}

type BackgroundJobHandler<Name extends BackgroundJobName> = (
  payload: BackgroundJobPayloadMap[Name],
  job: BackgroundJobEnvelope<Name>,
) => Promise<void>

export type BackgroundJobDeleteLocation =
  | "memory-queue"
  | "stream"
  | "delayed"
  | "dead-letter"

export interface BackgroundJobEnqueueResult<Name extends BackgroundJobName = BackgroundJobName> {
  job: BackgroundJobEnvelope<Name>
}

export interface BackgroundJobDeleteOptions {
  match?: (job: BackgroundJobEnvelope) => boolean
}

export interface BackgroundJobFindOptions {
  match?: (job: BackgroundJobEnvelope) => boolean
}

export interface BackgroundJobDeleteResult {
  id: string
  removed: boolean
  removedFrom: BackgroundJobDeleteLocation[]
}

export interface BackgroundJobTransport {
  enqueue<Name extends BackgroundJobName>(job: BackgroundJobEnvelope<Name>): Promise<BackgroundJobEnqueueResult<Name>>
  findById?: (
    jobId: string,
    options?: BackgroundJobFindOptions,
  ) => Promise<BackgroundJobEnvelope | null>
  list?: (
    options?: BackgroundJobFindOptions,
  ) => Promise<BackgroundJobEnvelope[]>
  deleteById?: (
    jobId: string,
    options?: BackgroundJobDeleteOptions,
  ) => Promise<BackgroundJobDeleteResult>
}

export interface EnqueueBackgroundJobOptions {
  delayMs?: number
  maxAttempts?: number
}

export interface BackgroundJobRunFailure {
  ok: false
  error: unknown
  retryable: boolean
}

export type BackgroundJobRunResult = {
  ok: true
} | BackgroundJobRunFailure

export interface BackgroundJobDeadLetterRecord {
  job: BackgroundJobEnvelope
  failedAt: string
  retryable: boolean
  error: {
    name: string
    message: string
  }
}

type GlobalBackgroundJobState = {
  __bbsInMemoryBackgroundJobDeadLetters?: BackgroundJobDeadLetterRecord[]
}

const globalForBackgroundJobs = globalThis as typeof globalThis & GlobalBackgroundJobState

const backgroundJobHandlers = new Map<BackgroundJobName, (payload: unknown, job: BackgroundJobEnvelope) => Promise<void>>()

function getInMemoryBackgroundJobDeadLetterStore() {
  globalForBackgroundJobs.__bbsInMemoryBackgroundJobDeadLetters ??= []
  return globalForBackgroundJobs.__bbsInMemoryBackgroundJobDeadLetters
}

function rememberInMemoryBackgroundJobDeadLetter(record: BackgroundJobDeadLetterRecord) {
  const store = getInMemoryBackgroundJobDeadLetterStore()
  store.unshift(record)
  store.splice(getInMemoryBackgroundJobDeadLetterMaxLength())
}

export function getInMemoryBackgroundJobDeadLetters() {
  return [...getInMemoryBackgroundJobDeadLetterStore()]
}

export async function runRegisteredBackgroundJob(job: BackgroundJobEnvelope): Promise<BackgroundJobRunResult> {
  const handler = backgroundJobHandlers.get(job.name)

  if (!handler) {
    return {
      ok: false,
      retryable: false,
      error: new BackgroundJobPermanentError(`Missing background job handler: ${job.name}`),
    }
  }

  try {
    await handler(job.payload, job)
    return { ok: true }
  } catch (error) {
    const normalizedError = normalizeBackgroundJobThrownError(error)

    return {
      ok: false,
      error: normalizedError,
      retryable: isBackgroundJobRetryableError(error),
    }
  }
}

export interface BackgroundJobOutcomeHooks {
  /** Extra fields merged into every log entry's metadata (e.g. transport, workerId). */
  baseMetadata: Record<string, unknown>
  /** Optional log targetId (e.g. Redis stream entry id). */
  targetId?: string
  /** Enqueue a retry envelope when the job failed with a retryable error. */
  enqueueRetry: (retryJob: BackgroundJobEnvelope) => Promise<unknown> | unknown
  /** Persist the dead-letter record when the job can no longer be retried. */
  persistDeadLetter: (record: BackgroundJobDeadLetterRecord) => Promise<void> | void
}

/**
 * Run a job through `runRegisteredBackgroundJob` and emit the standard
 * start/success/retry/dead-letter log sequence, delegating the transport-
 * specific enqueue/persist side effects through {@link BackgroundJobOutcomeHooks}.
 *
 * Consolidates the duplicated outcome handling previously replicated in the
 * in-memory pump and the Redis stream worker. See R3 in `REDIS_AUDIT_REPORT.md`.
 */
export async function executeBackgroundJobWithOutcome(
  job: BackgroundJobEnvelope,
  hooks: BackgroundJobOutcomeHooks,
): Promise<BackgroundJobRunResult> {
  const { baseMetadata, targetId, enqueueRetry, persistDeadLetter } = hooks
  const targetIdFields = targetId === undefined ? {} : { targetId }

  logInfo({
    scope: "background-job",
    action: "start",
    ...targetIdFields,
    metadata: createBackgroundJobLogMetadata(job, baseMetadata),
  })

  const startedAtMs = Date.now()
  const result = await runRegisteredBackgroundJob(job)
  const durationMs = Date.now() - startedAtMs

  if (result.ok) {
    logInfo({
      scope: "background-job",
      action: "success",
      ...targetIdFields,
      metadata: createBackgroundJobLogMetadata(job, { ...baseMetadata, durationMs }),
    })
    return result
  }

  const errorMetadata = createBackgroundJobLogMetadata(job, { ...baseMetadata, durationMs })
  const retryJob = result.retryable ? createBackgroundJobRetryEnvelope(job) : null

  if (retryJob) {
    logError({
      scope: "background-job",
      action: "run",
      ...targetIdFields,
      metadata: errorMetadata,
    }, result.error)
    await enqueueRetry(retryJob)
    logInfo({
      scope: "background-job",
      action: "retry",
      ...targetIdFields,
      metadata: createBackgroundJobLogMetadata(job, {
        ...baseMetadata,
        durationMs,
        nextAttempt: retryJob.attempt,
        availableAt: retryJob.availableAt ?? null,
      }),
    })
    return result
  }

  await persistDeadLetter(createBackgroundJobDeadLetterRecord(job, result.error, result.retryable))
  logError({
    scope: "background-job",
    action: "dead-letter",
    ...targetIdFields,
    metadata: errorMetadata,
  }, result.error)
  return result
}

export function resolveBackgroundJobConcurrency() {
  return getInMemoryBackgroundJobConcurrency()
}

class InMemoryBackgroundJobTransport implements BackgroundJobTransport {
  private readonly concurrency: number
  private readonly queue: BackgroundJobEnvelope[] = []
  private readonly delayedQueue = new Map<string, {
    job: BackgroundJobEnvelope
    timer: ReturnType<typeof setTimeout>
  }>()
  private readonly idempotencyIndex = new Map<string, string>()
  private activeCount = 0
  private pumpScheduled = false

  constructor(concurrency = resolveBackgroundJobConcurrency()) {
    this.concurrency = concurrency
  }

  enqueue<Name extends BackgroundJobName>(job: BackgroundJobEnvelope<Name>) {
    const normalizedJob = normalizeBackgroundJobEnvelope(job)
    const availableAt = normalizedJob.availableAt ? new Date(normalizedJob.availableAt).getTime() : 0

    if (availableAt > Date.now()) {
      const delayMs = Math.max(0, availableAt - Date.now())
      const timer = setTimeout(() => {
        this.delayedQueue.delete(normalizedJob.id)
        this.queue.push(normalizedJob)
        this.schedulePump()
      }, delayMs)
      this.delayedQueue.set(normalizedJob.id, {
        job: normalizedJob,
        timer,
      })

      return Promise.resolve({
        job: normalizedJob,
      })
    }

    this.queue.push(normalizedJob)
    this.schedulePump()

    return Promise.resolve({
      job: normalizedJob,
    })
  }

  async deleteById(
    jobId: string,
    options?: BackgroundJobDeleteOptions,
  ): Promise<BackgroundJobDeleteResult> {
    const removedFrom: BackgroundJobDeleteLocation[] = []
    const delayedEntry = this.delayedQueue.get(jobId)

    if (delayedEntry && matchesBackgroundJob(delayedEntry.job, options)) {
      clearTimeout(delayedEntry.timer)
      this.delayedQueue.delete(jobId)
      removedFrom.push("delayed")
    }

    const retainedQueue: BackgroundJobEnvelope[] = []
    for (const job of this.queue) {
      if (job.id === jobId && matchesBackgroundJob(job, options)) {
        if (!removedFrom.includes("memory-queue")) {
          removedFrom.push("memory-queue")
        }
        continue
      }

      retainedQueue.push(job)
    }
    this.queue.splice(0, this.queue.length, ...retainedQueue)

    const deadLetters = getInMemoryBackgroundJobDeadLetterStore()
    for (let index = deadLetters.length - 1; index >= 0; index -= 1) {
      const record = deadLetters[index]
      if (record.job.id !== jobId || !matchesBackgroundJob(record.job, options)) {
        continue
      }

      deadLetters.splice(index, 1)
      if (!removedFrom.includes("dead-letter")) {
        removedFrom.push("dead-letter")
      }
      break
    }

    return {
      id: jobId,
      removed: removedFrom.length > 0,
      removedFrom,
    }
  }

  async findById(
    jobId: string,
    options?: BackgroundJobFindOptions,
  ): Promise<BackgroundJobEnvelope | null> {
    const delayedEntry = this.delayedQueue.get(jobId)
    if (delayedEntry && matchesBackgroundJob(delayedEntry.job, options)) {
      return delayedEntry.job
    }

    for (const job of this.queue) {
      if (job.id === jobId && matchesBackgroundJob(job, options)) {
        return job
      }
    }

    for (const record of getInMemoryBackgroundJobDeadLetterStore()) {
      if (record.job.id === jobId && matchesBackgroundJob(record.job, options)) {
        return record.job
      }
    }

    return null
  }

  async list(
    options?: BackgroundJobFindOptions,
  ): Promise<BackgroundJobEnvelope[]> {
    const jobs = [
      ...this.queue,
      ...[...this.delayedQueue.values()].map((entry) => entry.job),
      ...getInMemoryBackgroundJobDeadLetterStore().map((record) => record.job),
    ].filter((job) => matchesBackgroundJob(job, options))

    return dedupeBackgroundJobsById(jobs)
  }

  private schedulePump() {
    if (this.pumpScheduled) {
      return
    }

    this.pumpScheduled = true

    const run = () => {
      this.pumpScheduled = false
      this.pump()
    }

    if (typeof setImmediate === "function") {
      setImmediate(run)
    } else {
      setTimeout(run, 0)
    }
  }

  private pump() {
    while (this.activeCount < this.concurrency && this.queue.length > 0) {
      const nextJob = this.queue.shift()

      if (!nextJob) {
        return
      }

      if (nextJob.idempotencyKey) {
        const existing = this.idempotencyIndex.get(nextJob.idempotencyKey)
        if (existing && existing !== nextJob.id) {
          logInfo({
            scope: "background-job",
            action: "idempotent-skip",
            metadata: createBackgroundJobLogMetadata(nextJob, {
              transport: "in-memory",
              existingJobId: existing,
            }),
          })
          continue
        }
        this.idempotencyIndex.set(nextJob.idempotencyKey, nextJob.id)
      }

      this.activeCount += 1

      void executeBackgroundJobWithOutcome(nextJob, {
        baseMetadata: { transport: "in-memory" },
        enqueueRetry: (retryJob) => this.enqueue(retryJob),
        persistDeadLetter: rememberInMemoryBackgroundJobDeadLetter,
      })
        .catch((error) => {
          logError({
            scope: "background-job",
            action: "transport-run",
            metadata: {
              jobId: nextJob.id,
              jobName: nextJob.name,
              enqueuedAt: nextJob.enqueuedAt,
            },
          }, error)
        })
        .finally(() => {
          this.activeCount -= 1

          if (this.queue.length > 0) {
            this.schedulePump()
          }
        })
    }
  }
}

let backgroundJobTransport: BackgroundJobTransport = new InMemoryBackgroundJobTransport()
let backgroundJobHandlersReadyPromise: Promise<void> | null = null
let backgroundJobRuntimeReadyPromise: Promise<void> | null = null

function detectBackgroundJobProcessRole() {
  const entrypoint = process.argv[1]?.replace(/\\/g, "/").toLowerCase() ?? ""

  if (entrypoint.includes("/worker.ts")) {
    return "worker"
  }

  if (entrypoint.includes("next")) {
    return "web"
  }

  return process.env.NODE_ENV === "production" ? "app" : "dev"
}

function shouldStartBackgroundJobWorkerInProcess() {
  const processRole = detectBackgroundJobProcessRole()

  // Dedicated worker entrypoints must always consume jobs, regardless of the
  // web runtime mode. `BACKGROUND_JOB_WEB_RUNTIME=worker-only` only disables
  // job consumption inside the web process.
  if (processRole === "worker") {
    return true
  }

  const mode = readBackgroundJobWebRuntimeMode()

  if (mode === "1" || mode === "true" || mode === "on" || mode === "enabled" || mode === "hybrid") {
    return true
  }

  if (mode === "0" || mode === "false" || mode === "off" || mode === "disabled" || mode === "worker-only") {
    return false
  }

  return process.env.NODE_ENV !== "production"
}

export function registerBackgroundJobHandler<Name extends BackgroundJobName>(
  name: Name,
  handler: BackgroundJobHandler<Name>,
) {
  backgroundJobHandlers.set(name, handler as (payload: unknown, job: BackgroundJobEnvelope) => Promise<void>)
}

export function setBackgroundJobTransport(transport: BackgroundJobTransport) {
  backgroundJobTransport = transport
}

export function getBackgroundJobTransport() {
  return backgroundJobTransport
}

export async function ensureBackgroundJobHandlersRegistered() {
  backgroundJobHandlersReadyPromise ??= import("@/lib/background-job-handlers")
    .then(({ registerDefaultBackgroundJobHandlers }) => registerDefaultBackgroundJobHandlers())

  return backgroundJobHandlersReadyPromise
}

export async function ensureBackgroundJobRuntimeReady() {
  await ensureBackgroundJobHandlersRegistered()

  backgroundJobRuntimeReadyPromise ??= import("@/lib/redis-background-jobs")
    .then(async ({ ensureRedisBackgroundJobWorkerRunning, getRedisBackgroundJobTransport }) => {
      setBackgroundJobTransport(await getRedisBackgroundJobTransport())

      if (shouldStartBackgroundJobWorkerInProcess()) {
        await ensureRedisBackgroundJobWorkerRunning()
      }
    })
    .catch((error) => {
      backgroundJobRuntimeReadyPromise = null
      throw error
    })

  return backgroundJobRuntimeReadyPromise
}

export async function deleteBackgroundJobById(
  jobId: string,
  options?: BackgroundJobDeleteOptions,
) {
  await ensureBackgroundJobRuntimeReady()

  if (typeof backgroundJobTransport.deleteById !== "function") {
    return {
      id: jobId,
      removed: false,
      removedFrom: [],
    } satisfies BackgroundJobDeleteResult
  }

  return backgroundJobTransport.deleteById(jobId, options)
}

export async function findBackgroundJobById(
  jobId: string,
  options?: BackgroundJobFindOptions,
) {
  await ensureBackgroundJobRuntimeReady()

  if (typeof backgroundJobTransport.findById !== "function") {
    return null
  }

  return backgroundJobTransport.findById(jobId, options)
}

export async function listBackgroundJobs(
  options?: BackgroundJobFindOptions,
) {
  await ensureBackgroundJobRuntimeReady()

  if (typeof backgroundJobTransport.list !== "function") {
    return []
  }

  return backgroundJobTransport.list(options)
}

export function enqueueBackgroundJob<Name extends BackgroundJobName>(
  name: Name,
  payload: BackgroundJobPayloadMap[Name],
  options?: EnqueueBackgroundJobOptions,
) {
  const delayMs = Math.max(0, options?.delayMs ?? 0)
  const availableAt = delayMs > 0
    ? new Date(Date.now() + delayMs).toISOString()
    : undefined

  return ensureBackgroundJobRuntimeReady().then(() => backgroundJobTransport.enqueue(normalizeBackgroundJobEnvelope({
    name,
    payload,
    enqueuedAt: new Date().toISOString(),
    maxAttempts: options?.maxAttempts,
    ...(availableAt ? { availableAt } : {}),
  })))
}
