import { persistBackgroundJobExecutionLog } from "@/lib/background-job-log-store"

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
  const shouldEmit = shouldEmitInfoLogs()

  void persistBackgroundJobExecutionLog({
    level: "info",
    scope: context.scope,
    action: context.action ?? null,
    userId: context.userId ?? null,
    targetId: context.targetId ?? null,
    metadata: context.metadata ?? null,
    extra: extra ?? null,
  })

  if (!shouldEmit) {
    return
  }

  console.info(JSON.stringify(buildPayload("info", context, extra)))
}

export function logError(context: LogContext, error: unknown, extra?: Record<string, unknown>) {
  const normalizedError = error instanceof Error
    ? {
        name: error.name,
        message: error.message,
      }
    : {
        name: "Error",
        message: String(error),
      }

  void persistBackgroundJobExecutionLog({
    level: "error",
    scope: context.scope,
    action: context.action ?? null,
    userId: context.userId ?? null,
    targetId: context.targetId ?? null,
    metadata: context.metadata ?? null,
    extra: extra ?? null,
    error: normalizedError,
  })

  console.error(JSON.stringify(buildPayload("error", context, {
    ...extra,
    error: normalizedError,
  })))
}
