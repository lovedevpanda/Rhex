import "dotenv/config"

import { ensureBackgroundJobRuntimeReady } from "../src/lib/background-jobs"
import { acquireRedisLease, type RedisLease } from "../src/lib/redis-lease"
import { createRedisKey, hasRedisUrl } from "../src/lib/redis"
import { acquireLeaseWithRetry, renewLeaseWithRecovery } from "../src/lib/worker-singleton"
import { startPostViewCountFlushLoop, stopPostViewCountFlushLoop } from "../src/lib/post-view-count-buffer"

const WORKER_SINGLETON_LEASE_KEY = createRedisKey("worker", "singleton")
const WORKER_SINGLETON_LEASE_TTL_MS = 30_000
const WORKER_SINGLETON_LEASE_RENEW_INTERVAL_MS = 10_000
const WORKER_SINGLETON_LEASE_ACQUIRE_RETRY_DELAY_MS = 1_000
const WORKER_SINGLETON_LEASE_RECOVERY_WAIT_MS = 10_000
const WORKER_SINGLETON_LEASE_RECOVERY_RETRY_DELAY_MS = 500

let singletonLease: RedisLease | null = null
let leaseRenewTimer: ReturnType<typeof setInterval> | null = null
let leaseRenewInFlight = false
let shuttingDown = false

async function releaseSingletonLease() {
  if (leaseRenewTimer) {
    clearInterval(leaseRenewTimer)
    leaseRenewTimer = null
  }

  if (singletonLease) {
    try {
      await singletonLease.release()
    } catch {}
    singletonLease = null
  }
}

async function shutdown(signal: string) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  console.log(`[worker] received ${signal}, shutting down...`)
  await stopPostViewCountFlushLoop()
  await releaseSingletonLease()
  process.exit(0)
}

function startLeaseRenewLoop() {
  if (!singletonLease || leaseRenewTimer) {
    return
  }

  leaseRenewTimer = setInterval(async () => {
    if (!singletonLease || leaseRenewInFlight) {
      return
    }

    leaseRenewInFlight = true

    try {
      const activeLease = singletonLease
      const nextLease = await renewLeaseWithRecovery({
        lease: activeLease,
        ttlMs: WORKER_SINGLETON_LEASE_TTL_MS,
        recoveryMaxWaitMs: WORKER_SINGLETON_LEASE_RECOVERY_WAIT_MS,
        recoveryRetryDelayMs: WORKER_SINGLETON_LEASE_RECOVERY_RETRY_DELAY_MS,
        acquireLease: () => acquireWorkerSingletonLease(WORKER_SINGLETON_LEASE_RECOVERY_WAIT_MS),
      })

      if (!nextLease) {
        console.error("[worker] singleton lease lost and could not be reacquired, exiting...")
        await releaseSingletonLease()
        process.exit(1)
        return
      }

      if (nextLease !== activeLease) {
        singletonLease = nextLease
        console.warn("[worker] singleton lease recovered after transient loss")
      }
    } catch (error) {
      console.error("[worker] singleton lease renew failed", error)
    } finally {
      leaseRenewInFlight = false
    }
  }, WORKER_SINGLETON_LEASE_RENEW_INTERVAL_MS)
}

async function acquireWorkerSingletonLease(maxWaitMs = WORKER_SINGLETON_LEASE_TTL_MS + 2_000) {
  return acquireLeaseWithRetry({
    maxWaitMs,
    retryDelayMs: WORKER_SINGLETON_LEASE_ACQUIRE_RETRY_DELAY_MS,
    acquireLease: () => acquireRedisLease({
      key: WORKER_SINGLETON_LEASE_KEY,
      ttlMs: WORKER_SINGLETON_LEASE_TTL_MS,
    }),
  })
}

async function main() {
  if (hasRedisUrl()) {
    singletonLease = await acquireWorkerSingletonLease()

    if (!singletonLease) {
      console.error("[worker] another worker instance is already running")
      process.exitCode = 1
      return
    }

    startLeaseRenewLoop()
    console.log("[worker] singleton lease acquired")
  }

  console.log("[worker] starting background jobs runtime")
  await ensureBackgroundJobRuntimeReady()
  startPostViewCountFlushLoop()
  console.log("[worker] background jobs runtime ready")
}

process.on("SIGINT", () => { void shutdown("SIGINT") })
process.on("SIGTERM", () => { void shutdown("SIGTERM") })
process.on("exit", () => {
  if (leaseRenewTimer) {
    clearInterval(leaseRenewTimer)
  }
})

void main().catch((error) => {
  console.error("[worker] fatal error", error)
  void stopPostViewCountFlushLoop().finally(() => {
    void releaseSingletonLease()
  })
  process.exitCode = 1
})
