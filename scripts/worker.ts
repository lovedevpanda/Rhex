import "dotenv/config"

import { ensureBackgroundJobRuntimeReady } from "../src/lib/background-jobs"
import { startPostAuctionSettlementRecoveryLoop } from "../src/lib/post-auctions"
import { startRssWorkerLoop } from "../src/lib/rss-harvest"

const controller = new AbortController()
let shutdownRequested = false

function shutdown(signal: string) {
  if (shutdownRequested) {
    return
  }

  shutdownRequested = true
  console.log(`[worker] received ${signal}, shutting down...`)
  controller.abort()

  setTimeout(() => {
    process.exit(0)
  }, 1_000).unref()
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))

async function main() {
  console.log("[worker] starting background jobs runtime")
  await ensureBackgroundJobRuntimeReady()
  console.log("[worker] background jobs runtime ready")

  console.log("[worker] starting post auction recovery loop")
  console.log("[worker] starting RSS worker loop")
  await Promise.all([
    startPostAuctionSettlementRecoveryLoop({
      signal: controller.signal,
    }),
    startRssWorkerLoop({
      workerId: process.env.RSS_WORKER_ID?.trim() || process.env.WORKER_ID?.trim() || undefined,
      signal: controller.signal,
    }),
  ])

  console.log("[worker] stopped")
}

void main().catch((error) => {
  console.error("[worker] fatal error", error)
  process.exitCode = 1
})
