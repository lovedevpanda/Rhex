import crypto from "node:crypto"

import { PublicRouteError } from "@/lib/public-route-error"

export function hasBuiltinCaptchaSecret() {
  return Boolean(process.env.CAPTCHA_SECRET_KEY?.trim() || process.env.TURNSTILE_SECRET_KEY?.trim())
}

function resolveSecret() {

  const secret = process.env.CAPTCHA_SECRET_KEY?.trim() || process.env.TURNSTILE_SECRET_KEY?.trim()

  if (!secret) {
    throw new Error("缺少 CAPTCHA_SECRET_KEY 或 TURNSTILE_SECRET_KEY 环境变量，无法校验内建验证码")
  }

  return secret
}


function base64UrlEncode(input: string) {
  return Buffer.from(input).toString("base64url")
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8")
}

export function signCaptchaText(text: string) {
  return crypto.createHmac("sha256", resolveSecret()).update(text).digest("hex")
}

export function createBuiltinCaptchaToken(text: string, expiresAt: number) {
  const payload = JSON.stringify({ text, expiresAt, nonce: crypto.randomUUID() })
  const encodedPayload = base64UrlEncode(payload)
  const signature = crypto.createHmac("sha256", resolveSecret()).update(encodedPayload).digest("base64url")
  return `${encodedPayload}.${signature}`
}

export function verifyBuiltinCaptchaToken(token: string | undefined, input: string) {
  if (!token) {
    throw new PublicRouteError("验证码已失效，请刷新后重试")
  }

  const [encodedPayload, signature] = token.split(".")
  if (!encodedPayload || !signature) {
    throw new PublicRouteError("验证码已失效，请刷新后重试")
  }

  const expectedSignature = crypto.createHmac("sha256", resolveSecret()).update(encodedPayload).digest("base64url")
  if (signature !== expectedSignature) {
    throw new PublicRouteError("验证码已失效，请刷新后重试")
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as { text?: string; expiresAt?: number }
  if (!payload.text || !payload.expiresAt || payload.expiresAt < Date.now()) {
    throw new PublicRouteError("验证码已失效，请刷新后重试")
  }

  if (payload.text.toUpperCase() !== input.trim().toUpperCase()) {
    throw new PublicRouteError("验证码错误")
  }

  return true
}
