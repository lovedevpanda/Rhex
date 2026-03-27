import { logError, logInfo } from "@/lib/logger"

export interface RequestLogContext {
  scope: string
  action?: string
  userId?: number | null
  targetId?: string | null
}

export function logRequestStarted(context: RequestLogContext, metadata?: Record<string, unknown>) {
  logInfo({
    scope: "request",
    action: context.action,
    userId: context.userId,
    targetId: context.targetId,
    metadata: {
      phase: "started",
      requestScope: context.scope,
      ...(metadata ?? {}),
    },
  })
}

export function logRequestSucceeded(context: RequestLogContext, metadata?: Record<string, unknown>) {
  logInfo({
    scope: "request",
    action: context.action,
    userId: context.userId,
    targetId: context.targetId,
    metadata: {
      phase: "succeeded",
      requestScope: context.scope,
      ...(metadata ?? {}),
    },
  })
}

export function logRequestFailed(context: RequestLogContext, error: unknown, metadata?: Record<string, unknown>) {
  logError({
    scope: "request",
    action: context.action,
    userId: context.userId,
    targetId: context.targetId,
    metadata: {
      phase: "failed",
      requestScope: context.scope,
      ...(metadata ?? {}),
    },
  }, error)
}
