const SESSION_COOKIE_NAME = "bbs_session"
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim()

  if (!secret) {
    throw new Error("缺少 SESSION_SECRET 环境变量，请在部署前完成配置")
  }

  return secret
}

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ""

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))

  return new TextDecoder().decode(bytes)
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
}

export async function createSessionToken(username: string) {
  const now = Math.floor(Date.now() / 1000)
  const payloadObject: SessionUser = {
    username,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_SECONDS,
  }
  const payload = encodeBase64Url(JSON.stringify(payloadObject))
  const signature = await sign(payload)

  return `${payload}.${signature}`
}

export async function parseSessionToken(token: string | undefined) {
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


    return parsed
  } catch {
    return null
  }
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME
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
