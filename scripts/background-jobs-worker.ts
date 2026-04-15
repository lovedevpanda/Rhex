import "dotenv/config"

import { ensureBackgroundJobRuntimeReady } from "../src/lib/background-jobs"
import { startPostAuctionSettlementRecoveryLoop } from "../src/lib/post-auctions"

const controller = new AbortController()
let shutdownRequested = false

function shutdown(signal: string) {
  if (shutdownRequested) {
    return
  }

  shutdownRequested = true
  console.log(`[background-jobs-worker] received ${signal}, shutting down...`)
  controller.abort()

  setTimeout(() => {
    process.exit(0)
  }, 1_000).unref()
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))

async function main() {
  console.log("[background-jobs-worker] starting runtime")
  await ensureBackgroundJobRuntimeReady()
  console.log("[background-jobs-worker] runtime ready")
  console.log("[background-jobs-worker] starting post auction recovery loop")
  await startPostAuctionSettlementRecoveryLoop({
    signal: controller.signal,
  })
}

void main().catch((error) => {
  console.error("[background-jobs-worker] fatal error", error)
  process.exitCode = 1
})
