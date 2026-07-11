import { apiError, apiSuccess, createRouteHandler, readJsonBody, readOptionalStringField, requireStringField } from "@/lib/api-route"
import { normalizeEmailAddress } from "@/lib/email"
import { normalizePhoneNumber } from "@/lib/phone"
import { resetPasswordByEmailCode, resetPasswordByPhoneCode } from "@/lib/password-reset"
import { withPublicWriteGuard } from "@/lib/public-write-guard"

export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const channel = (readOptionalStringField(body, "channel") || "EMAIL").toUpperCase()
  const code = requireStringField(body, "code", "请完整填写邮箱、验证码和新密码")
  const password = requireStringField(body, "password", "请完整填写邮箱、验证码和新密码")
  const confirmPassword = requireStringField(body, "confirmPassword", "请完整填写邮箱、验证码和新密码")

  if (!code || !password || !confirmPassword) {
    apiError(400, "请完整填写账号、验证码和新密码")
  }

  if (password !== confirmPassword) {
    apiError(400, "两次输入的密码不一致")
  }

  return withPublicWriteGuard("auth-forgot-password-reset", { request }, async () => {
    if (channel === "PHONE") {
      const phone = normalizePhoneNumber(requireStringField(body, "phone", "请完整填写手机号、验证码和新密码"))

      await resetPasswordByPhoneCode({
        phone,
        code,
        password,
        request,
      })

      return apiSuccess(undefined, "密码已重置，请使用新密码登录")
    }

    if (channel !== "EMAIL") {
      apiError(400, "找回方式参数不正确")
    }

    const email = normalizeEmailAddress(requireStringField(body, "email", "请完整填写邮箱、验证码和新密码"))

    if (!email) {
      apiError(400, "请完整填写邮箱、验证码和新密码")
    }

    await resetPasswordByEmailCode({
      email,
      code,
      password,
      request,
    })

    return apiSuccess(undefined, "密码已重置，请使用新密码登录")
  })
}, {
  errorMessage: "重置密码失败",
  logPrefix: "[api/auth/forgot-password/reset] unexpected error",
})
