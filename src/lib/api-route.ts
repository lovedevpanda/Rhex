import { NextResponse } from "next/server"

import { UserRole } from "@/db/types"

import { getCurrentSessionActor } from "@/lib/auth"

import { requireAdminUser } from "@/lib/admin"
import { ContentSafetyError } from "@/lib/content-safety"
import { PublicRouteError, isPublicRouteError } from "@/lib/public-route-error"

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
}

export interface AuthenticatedApiRouteContext extends ApiRouteContext {
  currentUser: NonNullable<Awaited<ReturnType<typeof getCurrentSessionActor>>>
}

export interface CustomApiRouteContext<TContext> extends ApiRouteContext {
  context: TContext
}

export interface AdminApiRouteContext extends ApiRouteContext {
  adminUser: NonNullable<Awaited<ReturnType<typeof requireAdminUser>>>
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

export function requireNumberField(body: JsonObject, field: string, message: string) {
  const value = typeof body[field] === "number" ? body[field] : Number(body[field])

  if (!Number.isFinite(value)) {
    apiError(400, message)
  }

  return value
}

export function readOptionalNumberField(body: JsonObject, field: string) {
  const rawValue = body[field]

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return undefined
  }

  const value = typeof rawValue === "number" ? rawValue : Number(rawValue)
  return Number.isFinite(value) ? value : undefined
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
    message: error instanceof Error && error.message ? error.message : fallbackMessage,
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
  options?: { errorMessage?: string; logPrefix?: string; buildContext?: (request: Request) => Promise<C> },
) {
  return async function routeHandler(request: Request) {
    try {
      const context = options?.buildContext
        ? await options.buildContext(request)
        : ({ request } as C)
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
    forbiddenMessages?: Partial<Record<"MUTED" | "BANNED", string>>
    allowStatuses?: Array<"ACTIVE" | "MUTED" | "BANNED" | "INACTIVE">
  },
) {
  return createRouteHandler(handler, {
    errorMessage: options?.errorMessage,
    logPrefix: options?.logPrefix,
    buildContext: async (request) => {
      const currentUser = await getCurrentSessionActor()


      if (!currentUser) {
        apiError(401, options?.unauthorizedMessage ?? "请先登录")
      }

      const allowStatuses = options?.allowStatuses ?? ["ACTIVE"]
      if (!allowStatuses.includes(currentUser.status)) {
        if (currentUser.status === "MUTED") {
          apiError(403, options?.forbiddenMessages?.MUTED ?? "当前账号状态不可执行该操作")
        }

        if (currentUser.status === "BANNED") {
          apiError(403, options?.forbiddenMessages?.BANNED ?? "当前账号状态不可执行该操作")
        }

        apiError(403, "当前账号状态不可执行该操作")
      }

      return { request, currentUser }
    },
  })
}

export function createAdminRouteHandler<T = unknown>(
  handler: ApiRouteHandler<T, AdminApiRouteContext>,
  options?: { errorMessage?: string; logPrefix?: string; unauthorizedMessage?: string },
) {
  return createRouteHandler(handler, {
    errorMessage: options?.errorMessage,
    logPrefix: options?.logPrefix,
    buildContext: async (request) => {
      const adminUser = await requireAdminUser()

      if (!adminUser || (adminUser.role !== UserRole.ADMIN && adminUser.role !== UserRole.MODERATOR)) {
        apiError(403, options?.unauthorizedMessage ?? "无权操作")
      }

      return { request, adminUser }
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
    buildContext: async (request) => ({
      request,
      context: await options.buildContext(request),
    }),
  })
}
