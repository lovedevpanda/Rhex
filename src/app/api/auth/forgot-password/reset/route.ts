import { apiError, apiSuccess, createRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { normalizeEmailAddress } from "@/lib/email"
import { resetPasswordByEmailCode } from "@/lib/password-reset"

export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const email = normalizeEmailAddress(requireStringField(body, "email", "请完整填写邮箱、验证码和新密码"))
  const code = requireStringField(body, "code", "请完整填写邮箱、验证码和新密码")
  const password = requireStringField(body, "password", "请完整填写邮箱、验证码和新密码")
  const confirmPassword = requireStringField(body, "confirmPassword", "请完整填写邮箱、验证码和新密码")

  if (!email || !code || !password || !confirmPassword) {
    apiError(400, "请完整填写邮箱、验证码和新密码")
  }

  if (password !== confirmPassword) {
    apiError(400, "两次输入的密码不一致")
  }

  await resetPasswordByEmailCode({
    email,
    code,
    password,
    request,
  })

  return apiSuccess(undefined, "密码已重置，请使用新密码登录")
}, {
  errorMessage: "重置密码失败",
  logPrefix: "[api/auth/forgot-password/reset] unexpected error",
})
