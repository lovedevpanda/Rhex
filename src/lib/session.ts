import { randomUUID } from "crypto"

import { normalizeIp } from "@/lib/request-ip"
import { persistSessionRecord, readPersistedSessionRecord, revokePersistedSession } from "@/lib/session-store"
import { getServerSiteSettings } from "@/lib/site-settings"

const SESSION_COOKIE_NAME = "bbs_session"
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
const SESSION_RENEW_THRESHOLD_SECONDS = 60 * 60 * 24 * 3

async function isSessionIpMismatchLogoutEnabled() {
  try {
    const settings = await getServerSiteSettings()
    return settings.sessionIpMismatchLogoutEnabled
  } catch {
    return true
  }
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim()

  if (!secret) {
    throw new Error("缺少 SESSION_SECRET 环境变量，请在部署前完成配置")
  }

  return secret
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url")
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}

async function importSigningKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false
  }

  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return diff === 0
}

async function sign(payload: string) {
  const key = await importSigningKey()
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
  return toHex(signature)
}

export interface SessionUser {
  username: string
  issuedAt: number
  expiresAt: number
  sessionId?: string
  ip?: string
}

interface ParseSessionTokenOptions {
  requestIp?: string | null
}

async function readSignedSessionPayload(token: string | undefined): Promise<SessionUser | null> {
  if (!token) {
    return null
  }

  const [payload, signature] = token.split(".")

  if (!payload || !signature) {
    return null
  }

  const expectedSignature = await sign(payload)

  if (!constantTimeEqual(signature, expectedSignature)) {
    return null
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as SessionUser

    if (!parsed.username || typeof parsed.issuedAt !== "number" || typeof parsed.expiresAt !== "number") {
      return null
    }

    if (!Number.isInteger(parsed.issuedAt) || !Number.isInteger(parsed.expiresAt)) {
      return null
    }

    if (parsed.issuedAt <= 0 || parsed.expiresAt <= parsed.issuedAt) {
      return null
    }

    if (parsed.expiresAt - parsed.issuedAt > SESSION_TTL_SECONDS) {
      return null
    }

    const now = Math.floor(Date.now() / 1000)
    if (parsed.expiresAt <= now) {
      return null
    }

    const sessionIp = typeof parsed.ip === "undefined" ? null : normalizeIp(parsed.ip)
    if (typeof parsed.ip !== "undefined" && !sessionIp) {
      return null
    }

    const sessionId = typeof parsed.sessionId === "string" ? parsed.sessionId.trim() : ""

    return {
      username: parsed.username,
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
      ...(sessionId ? { sessionId } : {}),
      ...(sessionIp ? { ip: sessionIp } : {}),
    }
  } catch {
    return null
  }
}

export async function createSessionToken(username: string, ip?: string | null) {
  const now = Math.floor(Date.now() / 1000)
  const normalizedIp = normalizeIp(ip ?? null)
  const sessionId = randomUUID()
  const payloadObject: SessionUser = {
    username,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_SECONDS,
    sessionId,
    ...(normalizedIp ? { ip: normalizedIp } : {}),
  }
  const payload = encodeBase64Url(JSON.stringify(payloadObject))
  const signature = await sign(payload)

  await persistSessionRecord({
    sessionId,
    username,
    issuedAt: payloadObject.issuedAt,
    expiresAt: payloadObject.expiresAt,
    ...(normalizedIp ? { ip: normalizedIp } : {}),
  })

  return `${payload}.${signature}`
}

export async function parseSessionToken(token: string | undefined, options?: ParseSessionTokenOptions) {
  const session = await readSignedSessionPayload(token)

  if (!session) {
    return null
  }

  const requestIp = normalizeIp(options?.requestIp ?? null)
  if (session.ip && requestIp && session.ip !== requestIp) {
    if (await isSessionIpMismatchLogoutEnabled()) {
      return null
    }
  }

  if (session.sessionId) {
    try {
      const persistedSession = await readPersistedSessionRecord(session.sessionId)

      if (!persistedSession) {
        return null
      }

      if (
        persistedSession.username !== session.username
        || persistedSession.issuedAt !== session.issuedAt
        || persistedSession.expiresAt !== session.expiresAt
        || (persistedSession.ip ?? null) !== (session.ip ?? null)
      ) {
        return null
      }
    } catch {
      return null
    }
  }

  return session
}

export async function revokeSessionToken(token: string | undefined) {
  const session = await readSignedSessionPayload(token)

  if (!session?.sessionId) {
    return false
  }

  return revokePersistedSession(session.sessionId)
}

export function shouldRenewSession(session: SessionUser, now = Math.floor(Date.now() / 1000)) {
  return session.expiresAt - now < SESSION_RENEW_THRESHOLD_SECONDS
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME
}

export function readSessionTokenFromCookieHeader(cookieHeader: string | null | undefined) {
  if (!cookieHeader) {
    return undefined
  }

  for (const chunk of cookieHeader.split(/;\s*/)) {
    const [name, ...valueParts] = chunk.split("=")

    if (name === SESSION_COOKIE_NAME && valueParts.length > 0) {
      return valueParts.join("=")
    }
  }

  return undefined
}

export function getSessionMaxAge() {
  return SESSION_TTL_SECONDS
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  }
}

export function getSessionClearedCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  }
}
