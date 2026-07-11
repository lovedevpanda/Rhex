import { NextResponse } from "next/server"

import { UserRole } from "@/db/types"

import { ContentSafetyError } from "@/lib/content-safety"
import type { SessionActor } from "@/db/session-actor-queries"
import { PublicRouteError, isPublicRouteError } from "@/lib/public-route-error"
import type { AdminPermissionKey } from "@/lib/admin-permission-policy"

type AdminRouteActor = {
  id: number
  username: string
  nickname: string | null
  role: "ADMIN" | "MODERATOR"
  status: SessionActor["status"]
  moderatedZoneScopes: Array<{
    zoneId: string
    zoneName: string
    zoneSlug: string
    canEditSettings: boolean
    canWithdrawTreasury: boolean
  }>
  moderatedBoardScopes: Array<{
    boardId: string
    boardName: string
    boardSlug: string
    zoneId: string | null
    zoneName: string | null
    zoneSlug: string | null
    canEditSettings: boolean
    canWithdrawTreasury: boolean
  }>
}

export interface ApiSuccessPayload<T = unknown> {
  code: 0
  message?: string
  data?: T
}

export interface ApiErrorPayload {
  code: number
  message: string
}

export type ApiRouteResult<T = unknown> = Response | ApiSuccessPayload<T>

export type JsonObject = Record<string, unknown>

export interface ApiRouteContext {
  request: Request
  routeContext?: unknown
}

export interface AuthenticatedApiRouteContext extends ApiRouteContext {
  currentUser: SessionActor
}

export interface CustomApiRouteContext<TContext> extends ApiRouteContext {
  context: TContext
}

export interface AdminApiRouteContext extends ApiRouteContext {
  adminUser: AdminRouteActor
}

export type ApiRouteHandler<T = unknown, C extends ApiRouteContext = ApiRouteContext> = (context: C) => Promise<ApiRouteResult<T>>

export function apiSuccess<T>(data?: T, message?: string): ApiSuccessPayload<T> {
  return {
    code: 0,
    ...(message ? { message } : {}),
    ...(typeof data === "undefined" ? {} : { data }),
  }
}

export function apiError(status: number, message: string, code = status): never {
  throw new PublicRouteError(message, code)
}

export async function readJsonBody<TBody extends JsonObject = JsonObject>(request: Request): Promise<TBody> {
  const contentType = request.headers.get("content-type") ?? ""

  if (!contentType.toLowerCase().includes("application/json")) {
    apiError(415, "请求体必须为 JSON")
  }

  try {
    const body = await request.json()

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      apiError(400, "请求体格式不正确")
    }

    return body as TBody
  } catch (error) {
    if (isPublicRouteError(error)) {
      throw error
    }

    apiError(400, "请求体格式不正确")
  }
}

export function requireStringField(body: JsonObject, field: string, message: string) {
  const value = body[field]
  const normalized = typeof value === "string" ? value.trim() : ""

  if (!normalized) {
    apiError(400, message)
  }

  return normalized
}

export function readOptionalStringField(body: JsonObject, field: string) {
  const value = body[field]
  return typeof value === "string" ? value.trim() : ""
}

function parseFiniteNumberField(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined
  }

  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim()
  if (!normalized) {
    return undefined
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function requireNumberField(body: JsonObject, field: string, message: string) {
  const value = parseFiniteNumberField(body[field])

  if (value === undefined) {
    apiError(400, message)
  }

  return value
}

export function readOptionalNumberField(body: JsonObject, field: string) {
  const rawValue = body[field]

  if (rawValue === undefined || rawValue === null) {
    return undefined
  }

  return parseFiniteNumberField(rawValue)
}

export function requirePositiveIntegerField(body: JsonObject, field: string, message: string) {
  const value = requireNumberField(body, field, message)

  if (!Number.isInteger(value) || value <= 0) {
    apiError(400, message)
  }

  return value
}

export function requireSearchParam(request: Request, key: string, message: string) {

  const value = new URL(request.url).searchParams.get(key)?.trim() ?? ""

  if (!value) {
    apiError(400, message)
  }

  return value
}

function normalizeError(error: unknown, fallbackMessage: string): { status: number; message: string } {
  if (error instanceof ContentSafetyError) {
    return { status: error.statusCode, message: error.message }
  }

  if (isPublicRouteError(error)) {
    return { status: error.statusCode, message: error.message }
  }

  return {
    status: 500,
    message: fallbackMessage,
  }
}

function toResponse<T>(result: ApiRouteResult<T>) {
  if (result instanceof Response) {
    return result
  }

  return NextResponse.json(result)
}

export function createRouteHandler<T = unknown, C extends ApiRouteContext = ApiRouteContext>(
  handler: ApiRouteHandler<T, C>,
  options?: { errorMessage?: string; logPrefix?: string; buildContext?: (request: Request, routeContext?: unknown) => Promise<C> },
) {
  return async function routeHandler(request: Request, routeContext?: unknown) {
    try {
      const context = options?.buildContext
        ? await options.buildContext(request, routeContext)
        : ({ request, routeContext } as C)
      const result = await handler(context)
      return toResponse(result)
    } catch (error) {
      const normalized = normalizeError(error, options?.errorMessage ?? "请求处理失败")

      if (normalized.status >= 500) {
        console.error(options?.logPrefix ?? "[api] unexpected error", error)
      }

      return NextResponse.json({ code: normalized.status, message: normalized.message }, { status: normalized.status })
    }
  }
}

export function createUserRouteHandler<T = unknown>(
  handler: ApiRouteHandler<T, AuthenticatedApiRouteContext>,
  options?: {
    errorMessage?: string
    logPrefix?: string
    unauthorizedMessage?: string
    forbiddenMessages?: Partial<Record<"MUTED" | "BANNED" | "INACTIVE", string>>
    allowStatuses?: Array<"ACTIVE" | "MUTED" | "BANNED" | "INACTIVE">
    allowRestrictedStatuses?: Array<"BANNED" | "INACTIVE">
  },
) {
  return createRouteHandler(handler, {
    errorMessage: options?.errorMessage,
    logPrefix: options?.logPrefix,
    buildContext: async (request, routeContext) => {
      const { getCurrentSessionActor } = await import("@/lib/auth")
      const currentUser = await getCurrentSessionActor()


      if (!currentUser) {
        apiError(401, options?.unauthorizedMessage ?? "请先登录")
      }

      const allowStatuses = options?.allowStatuses ?? ["ACTIVE"]
      const allowedRestrictedStatuses = new Set(options?.allowRestrictedStatuses ?? [])
      if (currentUser.status === "BANNED" && !allowedRestrictedStatuses.has("BANNED")) {
        apiError(403, options?.forbiddenMessages?.BANNED ?? "当前账号状态不可执行该操作")
      }

      if (currentUser.status === "INACTIVE" && !allowedRestrictedStatuses.has("INACTIVE")) {
        apiError(403, options?.forbiddenMessages?.INACTIVE ?? "当前账号状态不可执行该操作")
      }

      if (!allowStatuses.includes(currentUser.status)) {
        if (currentUser.status === "MUTED") {
          apiError(403, options?.forbiddenMessages?.MUTED ?? "当前账号状态不可执行该操作")
        }

        if (currentUser.status === "BANNED") {
          apiError(403, options?.forbiddenMessages?.BANNED ?? "当前账号状态不可执行该操作")
        }

        if (currentUser.status === "INACTIVE") {
          apiError(403, options?.forbiddenMessages?.INACTIVE ?? "当前账号状态不可执行该操作")
        }

        apiError(403, "当前账号状态不可执行该操作")
      }

      return { request, currentUser, routeContext }
    },
  })
}

export function createAdminRouteHandler<T = unknown>(
  handler: ApiRouteHandler<T, AdminApiRouteContext>,
  options?: {
    errorMessage?: string
    logPrefix?: string
    unauthorizedMessage?: string
    allowModerator?: boolean
    permission?: AdminPermissionKey
  },
) {
  return createRouteHandler(handler, {
    errorMessage: options?.errorMessage,
    logPrefix: options?.logPrefix,
    buildContext: async (request, routeContext) => {
      const { getCurrentSessionActor } = await import("@/lib/auth")
      const { isSiteAdmin, resolveAdminActorFromSessionUser } = await import("@/lib/moderator-permissions")
      const { isFounderAdmin } = await import("@/lib/admin-founder")
      const { canAdminWithPermissionOverrides } = await import("@/lib/admin-permission-overrides")
      const currentUser = await getCurrentSessionActor()

      if (!currentUser) {
        apiError(401, "请先登录")
      }

      const adminUser = await resolveAdminActorFromSessionUser(currentUser)
      if (!adminUser || (!options?.allowModerator && !isSiteAdmin(adminUser))) {
        apiError(403, options?.unauthorizedMessage ?? "无权操作")
      }

      if (options?.permission) {
        const actorIsFounder = adminUser.role === UserRole.ADMIN ? await isFounderAdmin(adminUser.id) : false
        if (!await canAdminWithPermissionOverrides(adminUser, options.permission, { isFounder: actorIsFounder })) {
          apiError(403, options.unauthorizedMessage ?? "无权操作")
        }
      }

      return { request, adminUser, routeContext }
    },
  })
}

export function createCustomRouteHandler<T = unknown, TContext = unknown>(
  handler: ApiRouteHandler<T, CustomApiRouteContext<TContext>>,
  options: {
    errorMessage?: string
    logPrefix?: string
    buildContext: (request: Request) => Promise<TContext>
  },
) {
  return createRouteHandler<T, CustomApiRouteContext<TContext>>(handler, {
    errorMessage: options.errorMessage,
    logPrefix: options.logPrefix,
    buildContext: async (request, routeContext) => ({
      request,
      routeContext,
      context: await options.buildContext(request),
    }),
  })
}
