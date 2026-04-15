import { prisma } from "@/db/client"
import { apiError } from "@/lib/api-route"
import { enqueueBackgroundJob, registerBackgroundJobHandler } from "@/lib/background-jobs"
import {
  canSendEmail,
  sendLoginIpChangeAlertEmail,
  sendPasswordChangeVerificationEmail,
} from "@/lib/mailer"
import { VerificationChannel } from "@/lib/shared/verification-channel"
import { getServerSiteSettings } from "@/lib/site-settings"
import { sendVerificationCode, verifyCode } from "@/lib/verification"

const PASSWORD_CHANGE_VERIFICATION_PURPOSE = "password_change"
const LOGIN_IP_CHANGE_ALERT_JOB_NAME = "security.login-ip-change-email-alert"

function normalizeComparableIp(ip: string | null | undefined) {
  return typeof ip === "string" ? ip.trim() : ""
}

function hasMailerConfig(settings: Awaited<ReturnType<typeof getServerSiteSettings>>) {
  return Boolean(settings.smtpEnabled && settings.smtpHost && settings.smtpPort && settings.smtpUser && settings.smtpPass && settings.smtpFrom)
}

function formatLoginAlertTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString("zh-CN", {
    hour12: false,
  })
}

async function findVerifiedEmailUserById(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      nickname: true,
      email: true,
      emailVerifiedAt: true,
      status: true,
    },
  })
}

export function getPasswordChangeVerificationPurpose() {
  return PASSWORD_CHANGE_VERIFICATION_PURPOSE
}

export async function sendPasswordChangeVerificationCode(input: {
  userId: number
  ip?: string | null
  userAgent?: string | null
}) {
  const smtpReady = await canSendEmail()

  if (!smtpReady) {
    apiError(400, "当前站点未配置邮件发送能力，暂不可通过邮箱验证修改密码")
  }

  const user = await findVerifiedEmailUserById(input.userId)

  if (!user) {
    apiError(404, "用户不存在")
  }

  if (user.status === "BANNED") {
    apiError(403, "当前账号状态不可执行该操作")
  }

  if (user.status === "INACTIVE") {
    apiError(403, "当前账号状态不可执行该操作")
  }

  if (!user.email || !user.emailVerifiedAt) {
    apiError(400, "当前账号尚未绑定并验证邮箱，暂无法通过邮箱验证修改密码")
  }

  const result = await sendVerificationCode({
    channel: VerificationChannel.EMAIL,
    target: user.email,
    ip: input.ip,
    userAgent: input.userAgent,
    userId: user.id,
    purpose: PASSWORD_CHANGE_VERIFICATION_PURPOSE,
  })

  await sendPasswordChangeVerificationEmail({
    to: user.email,
    code: result.code,
    username: user.username,
  })

  return {
    expiresAt: result.expiresAt,
    email: user.email,
  }
}

export async function verifyPasswordChangeVerificationCode(input: {
  userId: number
  code: string
}) {
  const user = await findVerifiedEmailUserById(input.userId)

  if (!user) {
    apiError(404, "用户不存在")
  }

  if (!user.email || !user.emailVerifiedAt) {
    apiError(400, "当前账号尚未绑定并验证邮箱，暂无法通过邮箱验证修改密码")
  }

  await verifyCode({
    channel: VerificationChannel.EMAIL,
    target: user.email,
    code: input.code,
    purpose: PASSWORD_CHANGE_VERIFICATION_PURPOSE,
  })

  return user
}

export async function maybeEnqueueLoginIpChangeAlert(input: {
  userId: number
  previousIp?: string | null
  currentIp?: string | null
  userAgent?: string | null
}) {
  const previousIp = normalizeComparableIp(input.previousIp)
  const currentIp = normalizeComparableIp(input.currentIp)

  if (!previousIp || !currentIp || previousIp === currentIp) {
    return
  }

  const settings = await getServerSiteSettings()

  if (!settings.loginIpChangeEmailAlertEnabled) {
    return
  }

  await enqueueBackgroundJob(LOGIN_IP_CHANGE_ALERT_JOB_NAME, {
    userId: input.userId,
    previousIp,
    currentIp,
    userAgent: input.userAgent ?? null,
    loginAt: new Date().toISOString(),
  })
}

registerBackgroundJobHandler(LOGIN_IP_CHANGE_ALERT_JOB_NAME, async (payload) => {
  const previousIp = normalizeComparableIp(payload.previousIp)
  const currentIp = normalizeComparableIp(payload.currentIp)

  if (!previousIp || !currentIp || previousIp === currentIp) {
    return
  }

  const settings = await getServerSiteSettings()

  if (!settings.loginIpChangeEmailAlertEnabled || !hasMailerConfig(settings)) {
    return
  }

  const user = await findVerifiedEmailUserById(payload.userId)

  if (!user?.email || !user.emailVerifiedAt) {
    return
  }

  await sendLoginIpChangeAlertEmail({
    to: user.email,
    username: user.username,
    displayName: user.nickname,
    previousIp,
    currentIp,
    loginAt: formatLoginAlertTime(payload.loginAt),
    userAgent: payload.userAgent,
  })
})
