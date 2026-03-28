import { createHash } from "crypto"

import { Prisma } from "@/db/types"

import { createRequestControl, purgeExpiredRequestControls } from "@/db/write-guard-queries"
import { apiError } from "@/lib/api-route"


import { logRequestFailed, logRequestStarted, logRequestSucceeded } from "@/lib/request-log"
import { getRequestIp } from "@/lib/request-ip"



export interface WriteGuardIdentity {
  userId?: number | null
  ip?: string | null
}

export interface WriteGuardOptions {
  scope: string
  identity?: WriteGuardIdentity
  cooldownMs?: number
  cooldownMessage?: string
  dedupeKey?: string | null
  dedupeWindowMs?: number
}



const DEFAULT_COOLDOWN_MS = 3_000
const DEFAULT_DEDUPE_WINDOW_MS = 5_000
const RATE_LIMIT_KIND = "rate"
const DEDUPE_KIND = "dedupe"


function normalizeIdentity(identity?: WriteGuardIdentity) {
  if (identity?.userId) {
    return `user:${identity.userId}`
  }

  if (identity?.ip) {
    return `ip:${identity.ip}`
  }

  return "anonymous"
}

function createStableHash(input: string) {
  return createHash("sha256").update(input).digest("hex")
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

async function createRequestControlRecord(params: {
  scope: string
  identity: string
  kind: string
  fingerprint?: string | null
  expiresAt: Date
  message: string
}) {
  try {
    await purgeExpiredRequestControls(new Date())

    await createRequestControl({
      scope: params.scope,
      identity: params.identity,
      kind: params.kind,
      fingerprint: params.fingerprint ?? null,
      expiresAt: params.expiresAt,
    })


  } catch (error) {
    if (isUniqueConstraintError(error)) {
      apiError(params.kind === RATE_LIMIT_KIND ? 429 : 409, params.message)
    }
    throw error
  }
}

export async function withWriteGuard<T>(options: WriteGuardOptions, task: () => Promise<T>): Promise<T> {
  const identity = normalizeIdentity(options.identity)
  const now = Date.now()
  const cooldownMs = Math.max(0, options.cooldownMs ?? DEFAULT_COOLDOWN_MS)
  const dedupeWindowMs = Math.max(0, options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS)

  logRequestStarted({
    scope: options.scope,
    userId: options.identity?.userId ?? null,
  }, {
    identity,
  })

  try {
    if (cooldownMs > 0) {
      await createRequestControlRecord({
        scope: options.scope,
        identity,
        kind: RATE_LIMIT_KIND,
        expiresAt: new Date(now + cooldownMs),
        message: options.cooldownMessage ?? "操作过于频繁，请稍后再试",
      })
    }

    if (options.dedupeKey) {
      await createRequestControlRecord({
        scope: options.scope,
        identity,
        kind: DEDUPE_KIND,
        fingerprint: createStableHash(options.dedupeKey),
        expiresAt: new Date(now + dedupeWindowMs),
        message: "请求重复，请勿重复提交",
      })
    }

    const result = await task()
    logRequestSucceeded({
      scope: options.scope,
      userId: options.identity?.userId ?? null,
    }, {
      identity,
    })
    return result
  } catch (error) {
    logRequestFailed({
      scope: options.scope,
      userId: options.identity?.userId ?? null,
    }, error, {
      identity,
    })
    throw error
  }
}


export async function withRequestWriteGuard<T>(options: Omit<WriteGuardOptions, "identity"> & { request: Request; userId?: number | null }, task: () => Promise<T>) {
  return withWriteGuard({
    ...options,
    identity: {
      userId: options.userId ?? null,
      ip: getRequestIp(options.request),
    },
  }, task)
}
