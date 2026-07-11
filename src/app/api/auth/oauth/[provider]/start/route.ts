import { NextResponse } from "next/server"

import { clearOAuthFlowState, setOAuthFlowState } from "@/lib/auth-flow-state"
import { createOAuthAuthorizationRequest, isExternalAuthProvider, isExternalAuthProviderEnabled, requireConfiguredOAuthOrigin } from "@/lib/auth-provider-config"
import { setAccountBindingFlash } from "@/lib/account-binding-flash"
import { getCurrentUser } from "@/lib/auth"
import { normalizeAuthRedirectTarget } from "@/lib/auth-redirect"
import { getServerSiteSettings } from "@/lib/site-settings"

interface OAuthProviderRouteProps {
  params: Promise<{
    provider: string
  }>
}

function redirectWithError(request: Request, siteOrigin: string, targetPath: string, message: string) {
  const url = new URL(targetPath, `${siteOrigin}/`)
  const response = NextResponse.redirect(url)

  if (targetPath.startsWith("/settings")) {
    setAccountBindingFlash(response, {
      type: "error",
      message,
    }, request)
  } else {
    url.searchParams.set("authError", message)
    return NextResponse.redirect(url)
  }

  return response
}

export async function GET(request: Request, props: OAuthProviderRouteProps) {
  let siteOrigin: string
  try {
    siteOrigin = requireConfiguredOAuthOrigin()
  } catch (error) {
    console.error("[api/auth/oauth/start] missing configured OAuth origin", error)
    return NextResponse.json({
      code: 503,
      message: "\u7b2c\u4e09\u65b9\u767b\u5f55\u6682\u4e0d\u53ef\u7528\uff0c\u8bf7\u8054\u7cfb\u7ba1\u7406\u5458\u914d\u7f6e\u7ad9\u70b9 URL",
    }, { status: 503 })
  }

  const params = await props.params
  const requestUrl = new URL(request.url)
  const requestedMode = requestUrl.searchParams.get("mode")
  const mode = requestedMode === "register"
    ? "register"
    : requestedMode === "connect"
      ? "connect"
      : "login"
  const redirectTo = requestUrl.searchParams.get("redirectTo")?.trim()
  const safeConnectRedirectTo = redirectTo?.startsWith("/") ? redirectTo : "/settings?tab=profile&profileTab=accounts"
  const safeLoginRedirectTo = normalizeAuthRedirectTarget(redirectTo)

  if (!isExternalAuthProvider(params.provider)) {
    return redirectWithError(request, siteOrigin, "/login", "不支持的第三方登录渠道")
  }

  const settings = await getServerSiteSettings()
  if (!isExternalAuthProviderEnabled(settings, params.provider)) {
    return redirectWithError(request, siteOrigin, mode === "connect" ? safeConnectRedirectTo : "/login", "该第三方登录暂未开放")
  }

  try {
    const currentUser = mode === "connect" ? await getCurrentUser() : null
    if (mode === "connect" && !currentUser) {
      return redirectWithError(request, siteOrigin, `/login?redirect=${encodeURIComponent("/settings?tab=profile&profileTab=accounts")}`, "请先登录后再绑定第三方账号")
    }

    const authorization = await createOAuthAuthorizationRequest(params.provider, settings)
    const response = NextResponse.redirect(authorization.url)

    clearOAuthFlowState(response, params.provider, request)
    await setOAuthFlowState(response, params.provider, {
      provider: params.provider,
      state: authorization.state,
      codeVerifier: authorization.codeVerifier,
      mode,
      redirectTo: mode === "connect" ? safeConnectRedirectTo : mode === "login" ? safeLoginRedirectTo : null,
      connectUserId: mode === "connect" ? currentUser?.id : undefined,
    }, request)

    return response
  } catch (error) {
    console.error("[api/auth/oauth/start] unexpected error", error)
    return redirectWithError(request, siteOrigin, mode === "connect" ? safeConnectRedirectTo : "/login", error instanceof Error ? error.message : "第三方登录初始化失败，请检查后台配置")
  }
}
