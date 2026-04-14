import { createHash, randomInt } from "crypto"

import { PublicRouteError } from "@/lib/public-route-error"
import { createRedisKey, getRedis } from "@/lib/redis"
import { VerificationChannel, type VerificationChannel as VerificationChannelValue } from "@/lib/shared/verification-channel"


const EXPIRE_MINUTES = 10
const ACTIVE_RECORD_RETENTION_SECONDS = 30 * 60
const RECENT_VERIFIED_MARKER_TTL_SECONDS = 24 * 60 * 60
const MAX_ATTEMPTS = 5
const PURPOSE_REGISTER = "register"
const VERIFY_CODE_SCRIPT = `
local activeKey = KEYS[1]
local recentKey = KEYS[2]
local nowMs = tonumber(ARGV[1])
local inputCodeHash = ARGV[2]
local recentTtlSeconds = tonumber(ARGV[3])

if redis.call("exists", activeKey) == 0 then
  return {"missing"}
end

local record = redis.call("hmget", activeKey, "codeHash", "attempts", "maxAttempts", "expiresAtMs")
local storedCodeHash = record[1]
local attempts = tonumber(record[2] or "0")
local maxAttempts = tonumber(record[3] or "0")
local expiresAtMs = tonumber(record[4] or "0")

if expiresAtMs < nowMs then
  return {"expired"}
end

if attempts >= maxAttempts then
  return {"too_many"}
end

local nextAttempts = attempts + 1

if storedCodeHash ~= inputCodeHash then
  redis.call("hset", activeKey, "attempts", tostring(nextAttempts))
  return {"mismatch", tostring(nextAttempts)}
end

redis.call("del", activeKey)
redis.call("set", recentKey, tostring(nowMs), "EX", recentTtlSeconds)

return {"ok", tostring(nextAttempts), tostring(nowMs)}
`

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function normalizeTarget(channel: VerificationChannelValue, target: string) {
  const normalized = target.trim()
  return channel === VerificationChannel.EMAIL ? normalized.toLowerCase() : normalized
}

function createCode() {
  return String(randomInt(100000, 1000000))
}

function createVerificationFingerprint(channel: VerificationChannelValue, target: string, purpose: string) {
  return sha256([channel, target, purpose].join(":"))
}

function getActiveVerificationRedisKey(channel: VerificationChannelValue, target: string, purpose: string) {
  return createRedisKey("verification-code", "active", createVerificationFingerprint(channel, target, purpose))
}

function getRecentVerifiedRedisKey(channel: VerificationChannelValue, target: string, purpose: string) {
  return createRedisKey("verification-code", "verified", createVerificationFingerprint(channel, target, purpose))
}

function parseVerifyCodeScriptResult(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => (item == null ? "" : String(item)))
    : [String(value)]
}

export function getRegisterVerificationPurpose() {
  return PURPOSE_REGISTER
}

export async function sendVerificationCode(input: {
  channel: VerificationChannelValue
  target: string
  ip?: string | null
  userAgent?: string | null
  userId?: number | null
  purpose?: string
}) {
  const target = normalizeTarget(input.channel, input.target)
  const purpose = input.purpose ?? PURPOSE_REGISTER
  const now = new Date()
  const expiresAt = new Date(now.getTime() + EXPIRE_MINUTES * 60 * 1000)
  const code = createCode()
  const codeHash = sha256(code)
  const activeKey = getActiveVerificationRedisKey(input.channel, target, purpose)
  const redis = getRedis()

  await redis.multi()
    .del(activeKey)
    .hset(
      activeKey,
      "codeHash",
      codeHash,
      "attempts",
      "0",
      "maxAttempts",
      String(MAX_ATTEMPTS),
      "expiresAtMs",
      String(expiresAt.getTime()),
      "channel",
      input.channel,
      "target",
      target,
      "purpose",
      purpose,
      "sentByIp",
      input.ip ?? "",
      "userAgent",
      input.userAgent ?? "",
      "userId",
      input.userId ? String(input.userId) : "",
      "createdAtMs",
      String(now.getTime()),
    )
    .expire(activeKey, ACTIVE_RECORD_RETENTION_SECONDS)
    .exec()

  return {
    expiresAt: expiresAt.toISOString(),
    code,
  }
}

export async function verifyCode(input: {
  channel: VerificationChannelValue
  target: string
  code: string
  purpose?: string
}) {
  const target = normalizeTarget(input.channel, input.target)
  const purpose = input.purpose ?? PURPOSE_REGISTER
  const redis = getRedis()
  const result = parseVerifyCodeScriptResult(await redis.eval(
    VERIFY_CODE_SCRIPT,
    2,
    getActiveVerificationRedisKey(input.channel, target, purpose),
    getRecentVerifiedRedisKey(input.channel, target, purpose),
    String(Date.now()),
    sha256(input.code.trim()),
    String(RECENT_VERIFIED_MARKER_TTL_SECONDS),
  ))
  const status = result[0]

  if (status === "missing") {
    throw new PublicRouteError("请先获取验证码")
  }

  if (status === "expired") {
    throw new PublicRouteError("验证码已过期，请重新获取")
  }

  if (status === "too_many") {
    throw new PublicRouteError("验证码尝试次数过多，请重新获取")
  }

  if (status === "mismatch") {
    throw new PublicRouteError("验证码错误")
  }

  if (status !== "ok") {
    throw new PublicRouteError("验证码校验失败，请稍后重试")
  }

  return {
    consumedAt: new Date(Number(result[2] ?? Date.now())),
  }
}

export async function hasRecentVerifiedCode(input: {
  channel: VerificationChannelValue
  target: string
  purpose?: string
  withinMinutes?: number
}) {
  const target = normalizeTarget(input.channel, input.target)
  const purpose = input.purpose ?? PURPOSE_REGISTER
  const withinMinutes = input.withinMinutes ?? EXPIRE_MINUTES
  const since = new Date(Date.now() - withinMinutes * 60 * 1000)
  const recentMarkerRaw = await getRedis().get(getRecentVerifiedRedisKey(input.channel, target, purpose))
  const recentMarker = Number(recentMarkerRaw)

  return Number.isFinite(recentMarker) && recentMarker >= since.getTime()
}
