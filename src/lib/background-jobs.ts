import type { NotificationType, RelatedType } from "@/db/types"
import { logError, logInfo } from "@/lib/logger"
import { hasRedisUrl } from "@/lib/redis"

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
  "notification.dispatch-system-webhook": {
    id: string
    userId: number
    title: string
    content: string
    relatedType: RelatedType
    relatedId: string
    createdAt: string
    attempt: number
  }
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
  "post-auction.settle": {
    auctionId: string
  }
  "ai-reply.process": {
    taskId: string
  }
}

export type BackgroundJobName = keyof BackgroundJobPayloadMap

export interface BackgroundJobEnvelope<Name extends BackgroundJobName = BackgroundJobName> {
  name: Name
  payload: BackgroundJobPayloadMap[Name]
  enqueuedAt: string
  attempt: number
  maxAttempts: number
  availableAt?: string
}

type BackgroundJobHandler<Name extends BackgroundJobName> = (payload: BackgroundJobPayloadMap[Name]) => Promise<void>

export interface BackgroundJobTransport {
  enqueue<Name extends BackgroundJobName>(job: BackgroundJobEnvelope<Name>): Promise<void>
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

const DEFAULT_BACKGROUND_JOB_MAX_ATTEMPTS = 3
const DEFAULT_BACKGROUND_JOB_RETRY_BASE_MS = 5_000
const DEFAULT_BACKGROUND_JOB_RETRY_MAX_MS = 5 * 60 * 1_000
const DEFAULT_IN_MEMORY_BACKGROUND_JOB_DEAD_LETTER_MAX_LENGTH = 200

export class BackgroundJobPermanentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BackgroundJobPermanentError"
  }
}

const backgroundJobHandlers = new Map<BackgroundJobName, (payload: unknown) => Promise<void>>()
const DEFAULT_IN_MEMORY_BACKGROUND_JOB_CONCURRENCY = 10
const MAX_IN_MEMORY_BACKGROUND_JOB_CONCURRENCY = 32

function parsePositiveInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, parsed))
}

function getInMemoryBackgroundJobDeadLetterStore() {
  globalForBackgroundJobs.__bbsInMemoryBackgroundJobDeadLetters ??= []
  return globalForBackgroundJobs.__bbsInMemoryBackgroundJobDeadLetters
}

function getInMemoryBackgroundJobDeadLetterMaxLength() {
  return parsePositiveInteger(
    process.env.BACKGROUND_JOB_IN_MEMORY_DEAD_LETTER_MAX_LENGTH,
    DEFAULT_IN_MEMORY_BACKGROUND_JOB_DEAD_LETTER_MAX_LENGTH,
    10,
    10_000,
  )
}

function rememberInMemoryBackgroundJobDeadLetter(record: BackgroundJobDeadLetterRecord) {
  const store = getInMemoryBackgroundJobDeadLetterStore()
  store.unshift(record)
  store.splice(getInMemoryBackgroundJobDeadLetterMaxLength())
}

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return Math.max(1, Math.trunc(value))
}

export function serializeBackgroundJobError(error: unknown) {
  return error instanceof Error
    ? {
        name: error.name,
        message: error.message,
      }
    : {
        name: "Error",
        message: String(error),
      }
}

export function resolveBackgroundJobMaxAttempts(value?: number) {
  return normalizePositiveInteger(value, parsePositiveInteger(
    process.env.BACKGROUND_JOB_MAX_ATTEMPTS,
    DEFAULT_BACKGROUND_JOB_MAX_ATTEMPTS,
    1,
    20,
  ))
}

export function resolveBackgroundJobRetryDelayMs(attempt: number) {
  const baseDelayMs = parsePositiveInteger(
    process.env.BACKGROUND_JOB_RETRY_BASE_MS,
    DEFAULT_BACKGROUND_JOB_RETRY_BASE_MS,
    250,
    60 * 60 * 1_000,
  )
  const maxDelayMs = parsePositiveInteger(
    process.env.BACKGROUND_JOB_RETRY_MAX_MS,
    DEFAULT_BACKGROUND_JOB_RETRY_MAX_MS,
    1_000,
    24 * 60 * 60 * 1_000,
  )
  const retryDelayMs = baseDelayMs * Math.max(1, 2 ** Math.max(0, attempt - 1))

  return Math.min(maxDelayMs, retryDelayMs)
}

export function normalizeBackgroundJobEnvelope<Name extends BackgroundJobName>(
  job: Omit<BackgroundJobEnvelope<Name>, "attempt" | "maxAttempts">
    & Partial<Pick<BackgroundJobEnvelope<Name>, "attempt" | "maxAttempts">>,
): BackgroundJobEnvelope<Name> {
  return {
    ...job,
    attempt: normalizePositiveInteger(job.attempt, 1),
    maxAttempts: resolveBackgroundJobMaxAttempts(job.maxAttempts),
  }
}

export function createBackgroundJobRetryEnvelope<Name extends BackgroundJobName>(job: BackgroundJobEnvelope<Name>) {
  if (job.attempt >= job.maxAttempts) {
    return null
  }

  return {
    ...job,
    attempt: job.attempt + 1,
    availableAt: new Date(Date.now() + resolveBackgroundJobRetryDelayMs(job.attempt)).toISOString(),
  } satisfies BackgroundJobEnvelope<Name>
}

export function createBackgroundJobDeadLetterRecord(
  job: BackgroundJobEnvelope,
  error: unknown,
  retryable: boolean,
): BackgroundJobDeadLetterRecord {
  return {
    job,
    failedAt: new Date().toISOString(),
    retryable,
    error: serializeBackgroundJobError(error),
  }
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
    await handler(job.payload)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error,
      retryable: !(error instanceof BackgroundJobPermanentError),
    }
  }
}

export function resolveBackgroundJobConcurrency() {
  const rawValue = process.env.BACKGROUND_JOB_CONCURRENCY?.trim()

  if (!rawValue) {
    return DEFAULT_IN_MEMORY_BACKGROUND_JOB_CONCURRENCY
  }

  const parsed = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_IN_MEMORY_BACKGROUND_JOB_CONCURRENCY
  }

  return Math.min(MAX_IN_MEMORY_BACKGROUND_JOB_CONCURRENCY, parsed)
}

class InMemoryBackgroundJobTransport implements BackgroundJobTransport {
  private readonly concurrency: number
  private readonly queue: BackgroundJobEnvelope[] = []
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
      setTimeout(() => {
        this.queue.push(normalizedJob)
        this.schedulePump()
      }, delayMs)

      return Promise.resolve()
    }

    this.queue.push(normalizedJob)
    this.schedulePump()

    return Promise.resolve()
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

      this.activeCount += 1

      void runRegisteredBackgroundJob(nextJob)
        .then(async (result) => {
          if (result.ok) {
            return
          }

          const errorMetadata = {
            jobName: nextJob.name,
            enqueuedAt: nextJob.enqueuedAt,
            attempt: nextJob.attempt,
            maxAttempts: nextJob.maxAttempts,
          }
          const retryJob = result.retryable ? createBackgroundJobRetryEnvelope(nextJob) : null

          if (retryJob) {
            logError({
              scope: "background-job",
              action: "run",
              metadata: errorMetadata,
            }, result.error)
            await this.enqueue(retryJob)
            logInfo({
              scope: "background-job",
              action: "retry",
              metadata: {
                ...errorMetadata,
                nextAttempt: retryJob.attempt,
                availableAt: retryJob.availableAt ?? null,
              },
            })
            return
          }

          rememberInMemoryBackgroundJobDeadLetter(createBackgroundJobDeadLetterRecord(nextJob, result.error, result.retryable))
          logError({
            scope: "background-job",
            action: "dead-letter",
            metadata: errorMetadata,
          }, result.error)
        })
        .catch((error) => {
          logError({
            scope: "background-job",
            action: "transport-run",
            metadata: {
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

  if (entrypoint.includes("background-jobs-worker")) {
    return "jobs-worker"
  }

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
  if (processRole === "jobs-worker" || processRole === "worker") {
    return true
  }

  const mode = process.env.BACKGROUND_JOB_WEB_RUNTIME?.trim().toLowerCase()

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
  backgroundJobHandlers.set(name, handler as (payload: unknown) => Promise<void>)
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

  if (!hasRedisUrl()) {
    return
  }

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
