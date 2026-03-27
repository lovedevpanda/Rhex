import { VerificationChannel } from "@/db/types"

import { apiError, apiSuccess, createRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { sendRegisterVerificationEmail } from "@/lib/mailer"
import { getRequestIp } from "@/lib/request-ip"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { sendVerificationCode } from "@/lib/verification"
import { withRequestWriteGuard } from "@/lib/write-guard"


function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidPhone(value: string) {
  return /^1\d{10}$/.test(value)
}

export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const rawChannel = requireStringField(body, "channel", "缺少验证码参数").toUpperCase()
  const target = requireStringField(body, "target", "缺少验证码参数")
  const channel = rawChannel === VerificationChannel.EMAIL || rawChannel === VerificationChannel.PHONE ? rawChannel : ""


  if (!channel || !target) {
    apiError(400, "缺少验证码参数")
  }

  if (channel === VerificationChannel.EMAIL && !isValidEmail(target)) {
    apiError(400, "邮箱格式不正确")
  }

  if (channel === VerificationChannel.PHONE && !isValidPhone(target)) {
    apiError(400, "手机号格式不正确")
  }

  if (channel === VerificationChannel.PHONE) {
    apiError(400, "当前暂未接入短信通道，请先关闭手机验证码或后续接入短信服务")
  }

  return withRequestWriteGuard({
    request,
    scope: "auth-send-verification-code",
    cooldownMs: 60_000,
    cooldownMessage: "验证码发送过于频繁，请稍后再试",
    dedupeKey: `${channel}:${target}`,
    dedupeWindowMs: 60_000,
  }, async () => {
    const result = await sendVerificationCode({
      channel,
      target,
      ip: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
    })

    await sendRegisterVerificationEmail({
      to: target,
      code: result.code,
    })

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
      expiresAt: result.expiresAt,
    }, "验证码已发送到邮箱")

  })
}, {
  errorMessage: "验证码发送失败",
  logPrefix: "[api/auth/send-verification-code] unexpected error",
})
