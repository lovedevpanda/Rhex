type GlobalBackgroundJobHandlerBootstrapState = {
  __bbsBackgroundJobHandlersRegistered?: boolean
}

const globalForBackgroundJobHandlers = globalThis as typeof globalThis & GlobalBackgroundJobHandlerBootstrapState

export async function registerDefaultBackgroundJobHandlers() {
  if (globalForBackgroundJobHandlers.__bbsBackgroundJobHandlersRegistered) {
    return
  }

  // Interaction hooks must be attached before workers can consume their jobs.
  await import("@/lib/background-task")
  await import("@/lib/interaction-side-effects")

  await Promise.all([
    import("@/lib/account-security"),
    import("@/lib/ai/capabilities/auto-categorize"),
    import("@/lib/ai-reply"),
    import("@/lib/admin-attachment-background-jobs"),
    import("@/addons-host/runtime/background-jobs"),
    import("@/lib/rss-harvest"),
    import("@/lib/check-in-streak-service"),
    import("@/lib/follow-notifications"),
    import("@/lib/level-system"),
    import("@/lib/notification-writes"),
    import("@/lib/outbound-delivery"),
    import("@/lib/user-notification-delivery"),
    import("@/lib/post-auctions"),
    import("@/lib/payment-gateway-email-notifications"),
  ])

  globalForBackgroundJobHandlers.__bbsBackgroundJobHandlersRegistered = true
}
