import { hashSync } from "bcryptjs"

import { VerificationChannel } from "@/lib/shared/verification-channel"

import { findUserByEmail, updateUserPasswordById } from "@/db/password-reset-queries"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
import { apiError } from "@/lib/api-route"
import { normalizeEmailAddress } from "@/lib/email"
import { canSendEmail, sendResetPasswordVerificationEmail } from "@/lib/mailer"
import { sendVerificationCode, verifyCode } from "@/lib/verification"


const PASSWORD_RESET_PURPOSE = "password_reset"

function ensurePassword(value: string) {
  const password = value.trim()

  if (password.length < 6 || password.length > 64) {
    apiError(400, "密码长度需为 6-64 位")
  }

  return password
}


export function getPasswordResetPurpose() {
  return PASSWORD_RESET_PURPOSE
}

export async function sendPasswordResetCode(input: {
  email: string
  ip?: string | null
  userAgent?: string | null
}) {
  const email = normalizeEmailAddress(input.email)

  if (!email) {
    apiError(400, "请输入邮箱")
  }

  const smtpReady = await canSendEmail()

  if (!smtpReady) {
    apiError(400, "当前站点未配置邮件发送能力，暂不可找回密码")
  }

  const user = await findUserByEmail(email)

  if (!user) {
    apiError(404, "该邮箱未绑定账号")
  }

  if (user.status === "BANNED") {
    apiError(403, "该账号已被禁用，无法找回密码")
  }

  if (user.status === "INACTIVE") {
    apiError(403, "该账号未激活，无法找回密码")
  }


  const result = await sendVerificationCode({
    channel: VerificationChannel.EMAIL,
    target: email,
    ip: input.ip,
    userAgent: input.userAgent,
    userId: user.id,
    purpose: PASSWORD_RESET_PURPOSE,
  })

  await sendResetPasswordVerificationEmail({
    to: email,
    code: result.code,
    username: user.username,
  })

  return {
    expiresAt: result.expiresAt,
    username: user.username,
  }
}

export async function resetPasswordByEmailCode(input: {
  email: string
  code: string
  password: string
  request?: Request
}) {
  const email = normalizeEmailAddress(input.email)
  const password = ensurePassword(input.password)
  const code = input.code.trim()

  if (!email) {
    apiError(400, "请输入邮箱")
  }

  if (!/^\d{6}$/.test(code)) {
    apiError(400, "验证码格式不正确")
  }

  const user = await findUserByEmail(email)

  if (!user) {
    apiError(404, "该邮箱未绑定账号")
  }

  if (user.status === "BANNED") {
    apiError(403, "该账号已被禁用，无法重置密码")
  }

  if (user.status === "INACTIVE") {
    apiError(403, "该账号未激活，无法重置密码")
  }


  await verifyCode({
    channel: VerificationChannel.EMAIL,
    target: email,
    code,
    purpose: PASSWORD_RESET_PURPOSE,
  })

  const hookInput = (() => {
    if (!input.request) {
      return { throwOnError: true }
    }

    const requestUrl = new URL(input.request.url)
    return {
      request: input.request,
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
      throwOnError: true,
    }
  })()

  await executeAddonActionHook("auth.password.reset.before", {
    userId: user.id,
    username: user.username,
    email: user.email,
  }, hookInput)

  const updatedUser = await updateUserPasswordById(user.id, hashSync(password, 10))

  await executeAddonActionHook("auth.password.reset.after", {
    userId: updatedUser.id,
    username: updatedUser.username,
    email: updatedUser.email,
  }, input.request
    ? {
        request: input.request,
        pathname: new URL(input.request.url).pathname,
        searchParams: new URL(input.request.url).searchParams,
      }
    : undefined)

  return updatedUser
}
