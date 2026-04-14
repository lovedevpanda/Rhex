import { apiError, apiSuccess, createRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { isVerificationChannel } from "@/lib/shared/verification-channel"
import { verifyCode } from "@/lib/verification"

export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const rawChannel = requireStringField(body, "channel", "缺少校验参数").toUpperCase()
  const target = requireStringField(body, "target", "缺少校验参数")
  const code = requireStringField(body, "code", "缺少校验参数")
  const channel = isVerificationChannel(rawChannel) ? rawChannel : ""

  if (!channel) {
    apiError(400, "缺少校验参数")
  }

  await verifyCode({ channel, target, code })
  return apiSuccess(undefined, "验证码校验通过")
}, {
  errorMessage: "验证码校验失败",
  logPrefix: "[api/auth/verify-code] unexpected error",
})
