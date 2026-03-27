import { compareSync } from "bcryptjs"
import { NextResponse } from "next/server"

import { prisma } from "@/db/client"
import { apiError, createRouteHandler, apiSuccess, readJsonBody, readOptionalStringField } from "@/lib/api-route"
import { verifyBuiltinCaptchaToken } from "@/lib/builtin-captcha"
import { getRequestIp } from "@/lib/request-ip"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { createSessionToken, getSessionCookieName, getSessionCookieOptions } from "@/lib/session"
import { getSiteSettings } from "@/lib/site-settings"
import { verifyTurnstileToken } from "@/lib/turnstile"
import { validateAuthPayload } from "@/lib/validators"

export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const validated = validateAuthPayload(body)

  if (!validated.success || !validated.data) {
    apiError(400, validated.message ?? "参数错误")
  }

  const { username, password } = validated.data
  const captchaToken = readOptionalStringField(body, "captchaToken")
  const builtinCaptchaCode = readOptionalStringField(body, "builtinCaptchaCode")
  const settings = await getSiteSettings()

  if (settings.loginCaptchaMode === "TURNSTILE") {
    if (!settings.turnstileSiteKey || !process.env.TURNSTILE_SECRET_KEY?.trim()) {
      apiError(500, "站点未完成 Turnstile 验证码配置，请联系管理员")
    }

    if (!captchaToken) {
      apiError(400, "请先完成验证码验证")
    }

    await verifyTurnstileToken(captchaToken, getRequestIp(request))
  }

  if (settings.loginCaptchaMode === "BUILTIN") {
    if (!captchaToken || !builtinCaptchaCode) {
      apiError(400, "请先完成图形验证码验证")
    }

    verifyBuiltinCaptchaToken(captchaToken, builtinCaptchaCode)
  }

  const user = await prisma.user.findUnique({
    where: { username },
  })

  if (!user) {
    apiError(401, "用户名或密码错误")
  }

  if (user.status === "BANNED") {
    apiError(403, "该账号已被拉黑，无法登录")
  }

  const isValid = compareSync(password, user.passwordHash)

  if (!isValid) {
    apiError(401, "用户名或密码错误")
  }

  const loginIp = getRequestIp(request)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: loginIp,
      },
    })

    await tx.userLoginLog.create({
      data: {
        userId: user.id,
        ip: loginIp,
        userAgent: request.headers.get("user-agent"),
      },
    })
  })

  const response = NextResponse.json(apiSuccess({ username: user.username }, "success"))
  const sessionToken = await createSessionToken(user.username)
  response.cookies.set(getSessionCookieName(), sessionToken, getSessionCookieOptions())

  logRouteWriteSuccess({
    scope: "auth-login",
    action: "login",
  }, {
    userId: user.id,
    targetId: user.username,
    extra: {
      loginIp,
    },
  })

  return response
}, {
  errorMessage: "登录失败",
  logPrefix: "[api/auth/login] unexpected error",
})
