import { compare } from "bcryptjs"
import { NextResponse } from "next/server"

import { prisma } from "@/db/client"
import { findUserLoginCandidate } from "@/db/external-auth-user-queries"
import { findUserByPhone } from "@/db/password-reset-queries"
import { readAddonAuthFieldsFromBody } from "@/lib/addon-auth-fields"
import { validateLoginWithAddonProviders } from "@/lib/addon-auth-providers"
import { apiError, createRouteHandler, apiSuccess, readJsonBody, readOptionalStringField } from "@/lib/api-route"
import { maybeEnqueueLoginIpChangeAlert } from "@/lib/account-security"
import { verifyLoginCaptchaWithAddonProviders } from "@/lib/addon-captcha-providers"
import { verifySmsVerificationCodeWithAddonProviders } from "@/lib/addon-sms-verification"
import { verifyBuiltinCaptchaToken } from "@/lib/builtin-captcha"
import { verifyPowCaptchaSolution } from "@/lib/pow-captcha"
import { getRequestIp } from "@/lib/request-ip"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { createSessionToken, getSessionCookieName, getSessionCookieOptions } from "@/lib/session"
import { getServerSiteSettings } from "@/lib/site-settings"
import { canSendSms } from "@/lib/sms"
import { verifyTurnstileToken } from "@/lib/turnstile"
import { resolveEffectiveUserStatus } from "@/lib/user-status"
import { validateLoginPayload } from "@/lib/validators"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"

export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const loginMode = readOptionalStringField(body, "loginMode")
  const phoneCode = readOptionalStringField(body, "phoneCode")
  const validated = loginMode === "phone-code" || phoneCode
    ? {
        success: true,
        data: {
          login: readOptionalStringField(body, "login") || readOptionalStringField(body, "username"),
          password: "",
        },
      }
    : validateLoginPayload(body)

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
    if ((loginMode === "phone-code" || phoneCode) && !(await canSendSms())) {
      apiError(400, "当前站点未配置短信发送能力")
    }

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

    if (loginMode === "phone-code" || phoneCode) {
      if (!login) {
        apiError(400, "请输入手机号")
      }

      if (!/^1\d{10}$/.test(login)) {
        apiError(400, "请输入正确的手机号")
      }

      if (!/^\d{6}$/.test(phoneCode)) {
        apiError(400, "请输入 6 位短信验证码")
      }

      const user = await findUserByPhone(login)

      if (!user) {
        apiError(401, "手机号或验证码错误")
      }

      const effectiveStatus = resolveEffectiveUserStatus(user)

      if (effectiveStatus === "BANNED" || effectiveStatus === "INACTIVE") {
        apiError(401, "手机号或验证码错误")
      }

      if (!user.phoneVerifiedAt) {
        apiError(403, "该手机号尚未完成绑定验证")
      }

      await verifySmsVerificationCodeWithAddonProviders({
        request,
        phone: login,
        code: phoneCode,
        purpose: "login",
        userId: user.id,
      })

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
        method: "phone-code",
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
      response.cookies.set(getSessionCookieName(), sessionToken, getSessionCookieOptions({ request }))
      await executeAddonActionHook("auth.login.after", {
        userId: user.id,
        username: user.username,
        loginIp,
        method: "phone-code",
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
          method: "phone-code",
        },
      })

      return response
    }

    const user = await findUserLoginCandidate(login)

    if (!user) {
      apiError(401, "邮箱/用户名/手机号或密码错误")
    }

    const effectiveStatus = resolveEffectiveUserStatus(user)

    if (effectiveStatus === "BANNED" || effectiveStatus === "INACTIVE") {
      // 与“账号不存在 / 密码错误”保持一致的返回，避免通过差异化响应枚举账号是否存在。
      apiError(401, "邮箱/用户名/手机号或密码错误")
    }

    const isValid = await compare(password, user.passwordHash)

    if (!isValid) {
      apiError(401, "邮箱/用户名/手机号或密码错误")
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
    response.cookies.set(getSessionCookieName(), sessionToken, getSessionCookieOptions({ request }))
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
