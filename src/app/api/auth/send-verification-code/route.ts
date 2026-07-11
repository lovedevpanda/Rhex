import { findUserByPhone } from "@/db/password-reset-queries"
import { getSessionActorFromRequest } from "@/lib/auth"
import { sendSmsVerificationCodeWithAddonProviders } from "@/lib/addon-sms-verification"
import { apiError, apiSuccess, createRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { isEmailInWhitelist, normalizeEmailAddress } from "@/lib/email"
import { canSendBusinessEmail, sendRegisterVerificationEmail } from "@/lib/mailer"
import { isValidMainlandPhone, normalizePhoneNumber } from "@/lib/phone"
import { getRequestIp } from "@/lib/request-ip"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { isVerificationChannel, VerificationChannel } from "@/lib/shared/verification-channel"
import { getServerSiteSettings } from "@/lib/site-settings"
import { canSendSms } from "@/lib/sms"
import { verifySmsSendCaptcha } from "@/lib/sms-send-captcha"
import { SMS_CODE_COOLDOWN_MS, SMS_CODE_COOLDOWN_SECONDS } from "@/lib/sms-verification"
import { sendVerificationCode } from "@/lib/verification"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidPhone(value: string) {
  return isValidMainlandPhone(value)
}

function normalizePurpose(value: unknown) {
  const purpose = typeof value === "string" ? value.trim().toLowerCase() : ""

  if (!purpose) {
    return undefined
  }

  if (purpose === "register" || purpose === "login") {
    return purpose
  }

  apiError(400, "验证码用途参数不正确")
}

export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const rawChannel = requireStringField(body, "channel", "缺少验证码参数").toUpperCase()
  const channel = isVerificationChannel(rawChannel) ? rawChannel : ""
  const purpose = normalizePurpose((body as Record<string, unknown>).purpose)
  const target = channel === VerificationChannel.EMAIL
    ? normalizeEmailAddress(requireStringField(body, "target", "缺少验证码参数"))
    : normalizePhoneNumber(requireStringField(body, "target", "缺少验证码参数"))
  let smsSettings: Awaited<ReturnType<typeof getServerSiteSettings>> | null = null

  if (!channel || !target) {
    apiError(400, "缺少验证码参数")
  }

  if (channel === VerificationChannel.EMAIL && !isValidEmail(target)) {
    apiError(400, "邮箱格式不正确")
  }

  if (channel === VerificationChannel.EMAIL) {
    const settings = await getServerSiteSettings()

    if (settings.registerEmailWhitelistEnabled && !isEmailInWhitelist(target, settings.registerEmailWhitelistDomains)) {
      apiError(400, "该邮箱后缀不在注册白名单内")
    }
  }

  if (channel === VerificationChannel.PHONE && !isValidPhone(target)) {
    apiError(400, "手机号格式不正确")
  }

  if (channel === VerificationChannel.PHONE) {
    smsSettings = await getServerSiteSettings()

    if (!(await canSendSms())) {
      apiError(400, "当前站点未配置短信发送能力")
    }
  }

  const guardOptions = createRequestWriteGuardOptions("auth-send-verification-code", {
    request,
    input: {
      channel,
      target,
      purpose,
    },
  })
  const smsGuardOptions = channel === VerificationChannel.PHONE
    ? {
        ...guardOptions,
        cooldownMs: SMS_CODE_COOLDOWN_MS,
        cooldownMessage: `短信验证码已发送，请 ${SMS_CODE_COOLDOWN_SECONDS} 秒后再试`,
      }
    : guardOptions

  return withRequestWriteGuard(smsGuardOptions, async () => {
    let smsUserId: number | null = null
    let phoneLoginAccountUnavailable = false

    if (channel === VerificationChannel.PHONE) {
      await verifySmsSendCaptcha({
        body,
        request,
        settings: smsSettings ?? await getServerSiteSettings(),
      })

      if (purpose === "login") {
        const user = await findUserByPhone(target)
        phoneLoginAccountUnavailable = !user
          || user.status === "BANNED"
          || user.status === "INACTIVE"
          || !user.phoneVerifiedAt
        smsUserId = user?.id ?? null
      } else {
        const requestUser = await getSessionActorFromRequest(request)
        smsUserId = requestUser?.id ?? null
      }

      if (phoneLoginAccountUnavailable) {
        return apiSuccess({
          expiresAt: null,
          cooldownSeconds: SMS_CODE_COOLDOWN_SECONDS,
        }, "如该手机号已绑定可用账号，验证码将发送到手机")
      }
    }

    if (channel === VerificationChannel.EMAIL && !(await canSendBusinessEmail("registerVerification"))) {
      apiError(400, "当前站点未配置邮件发送能力或已关闭注册验证码邮件")
    }

    const requestIp = getRequestIp(request)
    const userAgent = request.headers.get("user-agent")
    let expiresAt: string | null | undefined = null

    if (channel === VerificationChannel.EMAIL) {
      const result = await sendVerificationCode({
        channel,
        target,
        ip: requestIp,
        userAgent,
        purpose,
      })

      await sendRegisterVerificationEmail({
        to: target,
        code: result.code,
      })

      expiresAt = result.expiresAt
    } else {
      const result = await sendSmsVerificationCodeWithAddonProviders({
        request,
        phone: target,
        purpose,
        requestIp,
        userAgent,
        userId: smsUserId,
      })

      expiresAt = result.expiresAt
    }

    logRouteWriteSuccess({
      scope: "auth-send-verification-code",
      action: "send-verification-code",
    }, {
      targetId: target,
      extra: {
        channel,
      },
    })

    return apiSuccess({
      expiresAt: channel === VerificationChannel.PHONE && purpose === "login" ? null : expiresAt,
      ...(channel === VerificationChannel.PHONE ? { cooldownSeconds: SMS_CODE_COOLDOWN_SECONDS } : {}),
    }, channel === VerificationChannel.PHONE && purpose === "login"
      ? "如该手机号已绑定可用账号，验证码将发送到手机"
      : channel === VerificationChannel.EMAIL ? "验证码已发送到邮箱" : "验证码已发送到手机")
  })
}, {
  errorMessage: "验证码发送失败",
  logPrefix: "[api/auth/send-verification-code] unexpected error",
})
