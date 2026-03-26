import { createHash, randomInt } from "crypto"

import { VerificationChannel } from "@/db/types"

import { consumeVerificationCode, createVerificationCodeRecord, expireActiveVerificationCodes, findLatestPendingVerificationCode, findRecentConsumedVerificationCode, updateVerificationAttempts } from "@/db/verification-queries"
import { PublicRouteError } from "@/lib/public-route-error"


const EXPIRE_MINUTES = 10
const PURPOSE_REGISTER = "register"

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function normalizeTarget(channel: VerificationChannel, target: string) {
  const normalized = target.trim()
  return channel === VerificationChannel.EMAIL ? normalized.toLowerCase() : normalized
}

function createCode() {
  return String(randomInt(100000, 1000000))
}

export function getRegisterVerificationPurpose() {
  return PURPOSE_REGISTER
}

export async function sendVerificationCode(input: {
  channel: VerificationChannel
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

  await expireActiveVerificationCodes(input.channel, target, purpose, now)

  await createVerificationCodeRecord({
    channel: input.channel,
    target,
    codeHash,
    purpose,
    expiresAt,
    sentByIp: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    userId: input.userId ?? null,
  })



  return {
    expiresAt: expiresAt.toISOString(),
    code,
  }
}

export async function verifyCode(input: {
  channel: VerificationChannel
  target: string
  code: string
  purpose?: string
}) {
  const target = normalizeTarget(input.channel, input.target)
  const purpose = input.purpose ?? PURPOSE_REGISTER
  const record = await findLatestPendingVerificationCode(input.channel, target, purpose)


  if (!record) {
    throw new PublicRouteError("请先获取验证码")
  }

  if (record.expiresAt.getTime() < Date.now()) {
    throw new PublicRouteError("验证码已过期，请重新获取")
  }

  if (record.attempts >= record.maxAttempts) {
    throw new PublicRouteError("验证码尝试次数过多，请重新获取")
  }

  const nextAttempts = record.attempts + 1
  const matched = sha256(input.code.trim()) === record.codeHash

  if (!matched) {
    await updateVerificationAttempts(record.id, nextAttempts)

    throw new PublicRouteError("验证码错误")
  }

  const consumed = await consumeVerificationCode(record.id, nextAttempts, new Date())


  return consumed
}

export async function hasRecentVerifiedCode(input: {
  channel: VerificationChannel
  target: string
  purpose?: string
  withinMinutes?: number
}) {
  const target = normalizeTarget(input.channel, input.target)
  const purpose = input.purpose ?? PURPOSE_REGISTER
  const withinMinutes = input.withinMinutes ?? EXPIRE_MINUTES
  const since = new Date(Date.now() - withinMinutes * 60 * 1000)

  const record = await findRecentConsumedVerificationCode(input.channel, target, purpose, since)


  return Boolean(record)
}
