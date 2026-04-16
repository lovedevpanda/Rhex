import { ensureBackgroundJobRuntimeReady } from "@/lib/background-jobs"
import { logError } from "@/lib/logger"
import { ensureMessageEventBusRuntimeReady } from "@/lib/message-event-bus"
import { ensureNotificationEventBusRuntimeReady } from "@/lib/notification-event-bus"

type GlobalServerRuntimeState = {
  __bbsServerRuntimeReadyPromise?: Promise<void>
}

const globalForServerRuntime = globalThis as typeof globalThis & GlobalServerRuntimeState

export function ensureServerRuntimeReady() {
  globalForServerRuntime.__bbsServerRuntimeReadyPromise ??= Promise.allSettled([
    ensureBackgroundJobRuntimeReady(),
    ensureMessageEventBusRuntimeReady(),
    ensureNotificationEventBusRuntimeReady(),
  ]).then((results) => {
    for (const result of results) {
      if (result.status === "rejected") {
        logError({
          scope: "server-runtime",
          action: "bootstrap",
        }, result.reason)
      }
    }
  })

  return globalForServerRuntime.__bbsServerRuntimeReadyPromise
}
