import { compare } from "bcryptjs"
import { NextResponse } from "next/server"

import { prisma } from "@/db/client"
import { findUserLoginCandidate } from "@/db/external-auth-user-queries"
import { readAddonAuthFieldsFromBody } from "@/lib/addon-auth-fields"
import { validateLoginWithAddonProviders } from "@/lib/addon-auth-providers"
import { apiError, createRouteHandler, apiSuccess, readJsonBody, readOptionalStringField } from "@/lib/api-route"
import { maybeEnqueueLoginIpChangeAlert } from "@/lib/account-security"
import { verifyLoginCaptchaWithAddonProviders } from "@/lib/addon-captcha-providers"
import { verifyBuiltinCaptchaToken } from "@/lib/builtin-captcha"
import { verifyPowCaptchaSolution } from "@/lib/pow-captcha"
import { getRequestIp } from "@/lib/request-ip"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { createSessionToken, getSessionCookieName, getSessionCookieOptions } from "@/lib/session"
import { getServerSiteSettings } from "@/lib/site-settings"
import { verifyTurnstileToken } from "@/lib/turnstile"
import { validateLoginPayload } from "@/lib/validators"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"

export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const validated = validateLoginPayload(body)

  if (!validated.success || !validated.data) {
    apiError(400, validated.message ?? "参数错误")
  }

  const { login, password } = validated.data
  const captchaToken = readOptionalStringField(body, "captchaToken")
  const builtinCaptchaCode = readOptionalStringField(body, "builtinCaptchaCode")
  const powNonce = readOptionalStringField(body, "powNonce")
  const addonFields = readAddonAuthFieldsFromBody(body)
  const settings = await getServerSiteSettings()

  return withRequestWriteGuard(createRequestWriteGuardOptions("auth-login", {
    request,
    input: undefined,
  }), async () => {
    if (settings.loginCaptchaMode === "TURNSTILE") {
      if (!settings.turnstileSiteKey || !settings.turnstileSecretKey) {
        apiError(500, "站点未完成 Turnstile 验证码配置，请联系管理员")
      }

      if (!captchaToken) {
        apiError(400, "请先完成验证码验证")
      }

      await verifyTurnstileToken(captchaToken, getRequestIp(request), settings.turnstileSecretKey)
    }

    if (settings.loginCaptchaMode === "BUILTIN") {
      if (!captchaToken || !builtinCaptchaCode) {
        apiError(400, "请先完成图形验证码验证")
      }

      await verifyBuiltinCaptchaToken(captchaToken, builtinCaptchaCode)
    }

    if (settings.loginCaptchaMode === "POW") {
      if (!captchaToken || !powNonce) {
        apiError(400, "请先完成工作量证明验证")
      }

      await verifyPowCaptchaSolution({
        challenge: captchaToken,
        nonce: powNonce,
        scope: "login",
        requestIp: getRequestIp(request),
      })
    }

    await verifyLoginCaptchaWithAddonProviders({
      request,
      username: login,
      addonFields,
    })

    const user = await findUserLoginCandidate(login)

    if (!user) {
      apiError(401, "邮箱/用户名或密码错误")
    }

    if (user.status === "BANNED") {
      apiError(403, "该账号已被拉黑，无法登录")
    }

    if (user.status === "INACTIVE") {
      apiError(403, "该账号未激活，无法登录")
    }

    const isValid = await compare(password, user.passwordHash)

    if (!isValid) {
      apiError(401, "邮箱/用户名或密码错误")
    }

    await validateLoginWithAddonProviders({
      request,
      username: login,
      user: {
        id: user.id,
        username: user.username,
      },
      addonFields,
    })

    const loginIp = getRequestIp(request)
    const requestUrl = new URL(request.url)

    await executeAddonActionHook("auth.login.before", {
      userId: user.id,
      username: user.username,
      loginIp,
      method: "password",
    }, {
      request,
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
      throwOnError: true,
    })

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

    void maybeEnqueueLoginIpChangeAlert({
      userId: user.id,
      previousIp: user.lastLoginIp,
      currentIp: loginIp,
      userAgent: request.headers.get("user-agent"),
    })

    const response = NextResponse.json(apiSuccess({ username: user.username }, "success"))
    const sessionToken = await createSessionToken(user.username, loginIp)
    response.cookies.set(getSessionCookieName(), sessionToken, getSessionCookieOptions())
    await executeAddonActionHook("auth.login.after", {
      userId: user.id,
      username: user.username,
      loginIp,
      method: "password",
    }, {
      request,
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
    })

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
  })
}, {
  errorMessage: "登录失败",
  logPrefix: "[api/auth/login] unexpected error",
})
