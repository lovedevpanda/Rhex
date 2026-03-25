import { compareSync } from "bcryptjs"
import { NextResponse } from "next/server"

import { prisma } from "@/db/client"
import { getRequestIp } from "@/lib/request-ip"
import { createSessionToken, getSessionCookieName, getSessionCookieOptions } from "@/lib/session"
import { getSiteSettings } from "@/lib/site-settings"
import { verifyTurnstileToken } from "@/lib/turnstile"
import { verifyBuiltinCaptchaToken } from "@/lib/builtin-captcha"
import { validateAuthPayload } from "@/lib/validators"

export async function POST(request: Request) {
  const body = await request.json()
  const validated = validateAuthPayload(body)

  if (!validated.success || !validated.data) {
    return NextResponse.json({ code: 400, message: validated.message ?? "参数错误" }, { status: 400 })
  }

  const { username, password } = validated.data
  const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken.trim() : ""
  const builtinCaptchaCode = typeof body.builtinCaptchaCode === "string" ? body.builtinCaptchaCode.trim() : ""

  try {
    const settings = await getSiteSettings()

    if (settings.loginCaptchaMode === "TURNSTILE") {
      if (!settings.turnstileSiteKey || !process.env.TURNSTILE_SECRET_KEY?.trim()) {
        return NextResponse.json({ code: 500, message: "站点未完成 Turnstile 验证码配置，请联系管理员" }, { status: 500 })
      }

      if (!captchaToken) {
        return NextResponse.json({ code: 400, message: "请先完成验证码验证" }, { status: 400 })
      }

      await verifyTurnstileToken(captchaToken, getRequestIp(request))
    }

    if (settings.loginCaptchaMode === "BUILTIN") {
      if (!captchaToken || !builtinCaptchaCode) {
        return NextResponse.json({ code: 400, message: "请先完成图形验证码验证" }, { status: 400 })
      }

      verifyBuiltinCaptchaToken(captchaToken, builtinCaptchaCode)
    }

    const user = await prisma.user.findUnique({
      where: { username },
    })

    if (!user) {
      return NextResponse.json({ code: 401, message: "用户名或密码错误" }, { status: 401 })
    }

    if (user.status === "BANNED") {
      return NextResponse.json({ code: 403, message: "该账号已被拉黑，无法登录" }, { status: 403 })
    }

    const isValid = compareSync(password, user.passwordHash)

    if (!isValid) {
      return NextResponse.json({ code: 401, message: "用户名或密码错误" }, { status: 401 })
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

    const response = NextResponse.json({
      code: 0,
      message: "success",
      data: { username: user.username },
    })

    const sessionToken = await createSessionToken(user.username)
    response.cookies.set(getSessionCookieName(), sessionToken, getSessionCookieOptions())

    return response
  } catch (error) {
    console.error(error)
    return NextResponse.json({ code: 500, message: error instanceof Error ? error.message : "登录失败" }, { status: 500 })
  }
}
