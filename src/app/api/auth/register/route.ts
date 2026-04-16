import { NextResponse } from "next/server"

import { apiSuccess, createRouteHandler, readJsonBody, readOptionalStringField } from "@/lib/api-route"
import { createRegisterFlow } from "@/lib/auth-register-service"
import { normalizeEmailAddress } from "@/lib/email"
import { getRequestIp } from "@/lib/request-ip"
import { revalidateHomeSidebarStatsCache } from "@/lib/home-sidebar-stats"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { createSessionToken, getSessionCookieName, getSessionCookieOptions } from "@/lib/session"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"

export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  return withRequestWriteGuard(createRequestWriteGuardOptions("auth-register", {
    request,
    input: {
      username: readOptionalStringField(body, "username"),
      nickname: readOptionalStringField(body, "nickname"),
      inviterUsername: readOptionalStringField(body, "inviterUsername"),
      inviteCode: readOptionalStringField(body, "inviteCode").toUpperCase(),
      email: normalizeEmailAddress(readOptionalStringField(body, "email")),
      emailCode: readOptionalStringField(body, "emailCode"),
      phone: readOptionalStringField(body, "phone"),
      phoneCode: readOptionalStringField(body, "phoneCode"),
      gender: readOptionalStringField(body, "gender"),
      captchaToken: readOptionalStringField(body, "captchaToken"),
      builtinCaptchaCode: readOptionalStringField(body, "builtinCaptchaCode"),
      powNonce: readOptionalStringField(body, "powNonce"),
    },
  }), async () => {
    const result = await createRegisterFlow({ request, body })
    const responseMessage = result.successMessage ?? "注册成功"
    const requestUrl = new URL(request.url)
    revalidateHomeSidebarStatsCache()

    const response = NextResponse.json(apiSuccess(
      { username: result.user.username, autoLogin: true },
      responseMessage,
    ))

    try {
      const sessionToken = await createSessionToken(result.user.username, getRequestIp(request))
      response.cookies.set(getSessionCookieName(), sessionToken, getSessionCookieOptions())
    } catch (error) {
      console.error("[api/auth/register] auto login failed after successful registration", {
        error,
        userId: result.user.id,
        username: result.user.username,
      })

      try {
        logRouteWriteSuccess({
          scope: "auth-register",
          action: "register",
        }, {
          userId: result.user.id,
          targetId: result.user.username,
          extra: {
            registerIp: result.registerIp,
            invited: result.invited,
            autoLoginFailed: true,
          },
        })
      } catch (logError) {
        console.error("[api/auth/register] success logging failed after auto login failure", {
          error: logError,
          userId: result.user.id,
          username: result.user.username,
        })
      }

      await executeAddonActionHook("auth.register.after", {
        userId: result.user.id,
        username: result.user.username,
        registerIp: result.registerIp,
        invited: result.invited,
        autoLogin: false,
      }, {
        request,
        pathname: requestUrl.pathname,
        searchParams: requestUrl.searchParams,
      })

      return NextResponse.json(apiSuccess(
        { username: result.user.username, autoLogin: false },
        "注册成功，但自动登录失败，请前往登录页登录",
      ))
    }

    try {
      logRouteWriteSuccess({
        scope: "auth-register",
        action: "register",
      }, {
        userId: result.user.id,
        targetId: result.user.username,
        extra: {
          registerIp: result.registerIp,
          invited: result.invited,
        },
      })
    } catch (logError) {
      console.error("[api/auth/register] success logging failed after successful registration", {
        error: logError,
        userId: result.user.id,
        username: result.user.username,
      })
    }

    await executeAddonActionHook("auth.register.after", {
      userId: result.user.id,
      username: result.user.username,
      registerIp: result.registerIp,
      invited: result.invited,
      autoLogin: true,
    }, {
      request,
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
    })

    return response
  })
}, {
  errorMessage: "注册失败",
  logPrefix: "[api/auth/register] unexpected error",
})
