import { revalidatePath } from "next/cache"

import { apiError, readOptionalNumberField, readOptionalStringField, type JsonObject } from "@/lib/api-route"
import { writeAdminLog } from "@/lib/admin"

export interface AdminActionContext {
  adminUserId: number
  action: string
  targetId: string
  message: string
  requestIp: string | null
  body: JsonObject
}

export interface AdminActionResult<T = unknown> {
  message: string
  data?: T
  revalidatePaths?: string[]
}

export interface AdminActionMetadata {
  targetType: string
  revalidatePaths?: string[]
  buildDetail?: (context: AdminActionContext) => string
}

export interface AdminActionDefinition {
  metadata: AdminActionMetadata
  execute: (context: AdminActionContext) => Promise<AdminActionResult>
}

export type AdminActionExecutor = (context: AdminActionContext) => Promise<AdminActionResult>

export function normalizePositiveUserId(value: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

export function readAdminActionScope(body: JsonObject) {
  const scope = readOptionalStringField(body, "scope").toUpperCase()
  return scope === "GLOBAL" || scope === "ZONE" || scope === "BOARD" ? scope : "NONE"
}

export function requireAdminActionString(body: JsonObject, field: string, message: string) {
  const value = readOptionalStringField(body, field)
  if (!value) {
    apiError(400, message)
  }
  return value
}

export function readAdminActionString(body: JsonObject, field: string) {
  return readOptionalStringField(body, field)
}

export function readAdminActionNumber(body: JsonObject, field: string) {
  return readOptionalNumberField(body, field)
}

function uniquePaths(paths: Array<string | undefined>) {
  return [...new Set(paths.filter(Boolean))] as string[]
}

export function revalidateAdminMutationPaths(extraPaths: string[] = []) {
  const paths = uniquePaths(["/", "/admin", ...extraPaths])
  for (const path of paths) {
    revalidatePath(path)
  }
}

export async function writeAdminActionLog(context: AdminActionContext, metadata: AdminActionMetadata) {
  const detail = context.message || metadata.buildDetail?.(context) || `管理员执行 ${context.action}`
  await writeAdminLog(context.adminUserId, context.action, metadata.targetType, context.targetId, detail, context.requestIp)
}

export function defineAdminAction(metadata: AdminActionMetadata, execute: (context: AdminActionContext) => Promise<AdminActionResult>): AdminActionDefinition {
  return {
    metadata,
    execute,
  }
}
