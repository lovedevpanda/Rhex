import { apiError, apiSuccess, createRouteHandler, readJsonBody, readOptionalStringField, requireStringField } from "@/lib/api-route"
import { normalizeEmailAddress } from "@/lib/email"
import { canSendBusinessEmail } from "@/lib/mailer"
import { isValidMainlandPhone, normalizePhoneNumber } from "@/lib/phone"
import { getRequestIp } from "@/lib/request-ip"
import { sendPasswordResetCode, sendPasswordResetPhoneCode } from "@/lib/password-reset"
import { shouldMaskPasswordResetSendError } from "@/lib/public-write-guard"
import { getServerSiteSettings } from "@/lib/site-settings"
import { verifySmsSendCaptcha } from "@/lib/sms-send-captcha"
import { SMS_CODE_COOLDOWN_MS, SMS_CODE_COOLDOWN_SECONDS } from "@/lib/sms-verification"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function passwordResetSendResponse(channel: "EMAIL" | "PHONE") {
  return apiSuccess({
    expiresAt: null,
    ...(channel === "PHONE" ? { cooldownSeconds: SMS_CODE_COOLDOWN_SECONDS } : {}),
  }, channel === "EMAIL"
    ? "如该邮箱已绑定可用账号，验证码将发送到邮箱"
    : "如该手机号已绑定可用账号，验证码将发送到手机")
}

export const POST = createRouteHandler<unknown>(async ({ request }) => {
  const body = await readJsonBody(request)
  const channel = (readOptionalStringField(body, "channel") || "EMAIL").toUpperCase()

  if (channel === "PHONE") {
    const phone = normalizePhoneNumber(requireStringField(body, "phone", "请输入手机号"))

    if (!isValidMainlandPhone(phone)) {
      apiError(400, "手机号格式不正确")
    }

    const settings = await getServerSiteSettings()
    const guardOptions = createRequestWriteGuardOptions("auth-forgot-password-send-code", {
      request,
      input: {
        channel,
        phone,
      },
    })

    return withRequestWriteGuard({
      ...guardOptions,
      cooldownMs: SMS_CODE_COOLDOWN_MS,
      cooldownMessage: `短信验证码已发送，请 ${SMS_CODE_COOLDOWN_SECONDS} 秒后再试`,
    }, async () => {
      await verifySmsSendCaptcha({
        body,
        request,
        settings,
      })

      try {
        await sendPasswordResetPhoneCode({
          phone,
          request,
          ip: getRequestIp(request),
          userAgent: request.headers.get("user-agent"),
        })

        return passwordResetSendResponse("PHONE")
      } catch (error) {
        if (shouldMaskPasswordResetSendError(error)) {
          return passwordResetSendResponse("PHONE")
        }

        throw error
      }
    })
  }

  if (channel !== "EMAIL") {
    apiError(400, "找回方式参数不正确")
  }

  const email = normalizeEmailAddress(requireStringField(body, "email", "请输入邮箱"))

  if (!email) {
    apiError(400, "请输入邮箱")
  }

  if (!isValidEmail(email)) {
    apiError(400, "邮箱格式不正确")
  }

  const smtpReady = await canSendBusinessEmail("resetPasswordVerification")

  if (!smtpReady) {
    apiError(400, "当前站点未配置邮件发送能力或已关闭找回密码验证码邮件，暂不可找回密码")
  }

  return withRequestWriteGuard(createRequestWriteGuardOptions("auth-forgot-password-send-code", {
    request,
    input: {
      email,
    },
  }), async () => {
    try {
      await sendPasswordResetCode({
        email,
        ip: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      })

      return passwordResetSendResponse("EMAIL")
    } catch (error) {
      if (shouldMaskPasswordResetSendError(error)) {
        return passwordResetSendResponse("EMAIL")
      }

      throw error
    }
  })
}, {
  errorMessage: "验证码发送失败",
  logPrefix: "[api/auth/forgot-password/send-code] unexpected error",
})
