export interface LogContext {
  scope: string
  action?: string
  userId?: number | null
  targetId?: string | null
  metadata?: Record<string, unknown>
}

function shouldEmitInfoLogs() {
  return process.env.NODE_ENV !== "production"
}

function buildPayload(level: "info" | "error", context: LogContext, extra?: Record<string, unknown>) {
  return {
    level,
    scope: context.scope,
    action: context.action ?? null,
    userId: context.userId ?? null,
    targetId: context.targetId ?? null,
    ...(context.metadata ? { metadata: context.metadata } : {}),
    ...(extra ?? {}),
  }
}

export function logInfo(context: LogContext, extra?: Record<string, unknown>) {
  if (!shouldEmitInfoLogs()) {
    return
  }

  console.info(JSON.stringify(buildPayload("info", context, extra)))
}

export function logError(context: LogContext, error: unknown, extra?: Record<string, unknown>) {
  console.error(JSON.stringify(buildPayload("error", context, {
    ...extra,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
    } : String(error),
  })))
}
