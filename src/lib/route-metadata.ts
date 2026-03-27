import { logRequestSucceeded } from "@/lib/request-log"

export interface RouteWriteMetadata {
  scope: string
  action: string
}

export function logRouteWriteSuccess(metadata: RouteWriteMetadata, input: {
  userId?: number | null
  targetId?: string | null
  extra?: Record<string, unknown>
}) {
  logRequestSucceeded({
    scope: metadata.scope,
    action: metadata.action,
    userId: input.userId ?? null,
    targetId: input.targetId ?? null,
  }, input.extra)
}
