import { hashSync } from "bcryptjs"

import { VerificationChannel } from "@/db/types"

import { findUserByEmail, updateUserPasswordById } from "@/db/password-reset-queries"
import { canSendEmail, sendResetPasswordVerificationEmail } from "@/lib/mailer"
import { sendVerificationCode, verifyCode } from "@/lib/verification"

const PASSWORD_RESET_PURPOSE = "password_reset"

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function ensurePassword(value: string) {
  const password = value.trim()

  if (password.length < 6 || password.length > 64) {
    throw new Error("密码长度需为 6-64 位")
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
  const email = normalizeEmail(input.email)

  if (!email) {
    throw new Error("请输入邮箱")
  }

  const smtpReady = await canSendEmail()

  if (!smtpReady) {
    throw new Error("当前站点未配置邮件发送能力，暂不可找回密码")
  }

  const user = await findUserByEmail(email)

  if (!user) {
    throw new Error("该邮箱未绑定账号")
  }

  if (user.status === "BANNED") {
    throw new Error("该账号已被禁用，无法找回密码")
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
}) {
  const email = normalizeEmail(input.email)
  const password = ensurePassword(input.password)
  const code = input.code.trim()

  if (!email) {
    throw new Error("请输入邮箱")
  }

  if (!/^\d{6}$/.test(code)) {
    throw new Error("验证码格式不正确")
  }

  const user = await findUserByEmail(email)

  if (!user) {
    throw new Error("该邮箱未绑定账号")
  }

  if (user.status === "BANNED") {
    throw new Error("该账号已被禁用，无法重置密码")
  }

  await verifyCode({
    channel: VerificationChannel.EMAIL,
    target: email,
    code,
    purpose: PASSWORD_RESET_PURPOSE,
  })

  return updateUserPasswordById(user.id, hashSync(password, 10))
}
