import { NextResponse } from "next/server"

import { clearOAuthFlowState, clearPendingExternalAuthState, consumeOAuthFlowState, setPendingExternalAuthState } from "@/lib/auth-flow-state"
import { setAccountBindingFlash } from "@/lib/account-binding-flash"
import { getCurrentUser } from "@/lib/auth"
import { attachAuthenticatedSession, connectExternalAuthIdentityToUser, createOAuthIdentity, recordSuccessfulExternalLogin, resolveExternalAuth } from "@/lib/external-auth-service"
import { fetchOAuthUserProfile, isExternalAuthProvider, requireConfiguredOAuthOrigin, validateOAuthAuthorizationCode } from "@/lib/auth-provider-config"
import { normalizeAuthRedirectTarget } from "@/lib/auth-redirect"
import { getServerSiteSettings } from "@/lib/site-settings"

interface OAuthProviderRouteProps {
  params: Promise<{
    provider: string
  }>
}

function buildRedirectUrl(path: string, siteOrigin: string) {
  return new URL(path, `${siteOrigin}/`)
}

function oauthOriginConfigurationError() {
  return NextResponse.json({
    code: 503,
    message: "\u7b2c\u4e09\u65b9\u767b\u5f55\u6682\u4e0d\u53ef\u7528\uff0c\u8bf7\u8054\u7cfb\u7ba1\u7406\u5458\u914d\u7f6e\u7ad9\u70b9 URL",
  }, { status: 503 })
}

export async function GET(request: Request, props: OAuthProviderRouteProps) {
  let siteOrigin: string
  try {
    siteOrigin = requireConfiguredOAuthOrigin()
  } catch (error) {
    console.error("[api/auth/oauth/callback] missing configured OAuth origin", error)
    return oauthOriginConfigurationError()
  }

  const params = await props.params

  if (!isExternalAuthProvider(params.provider)) {
    const redirectUrl = buildRedirectUrl("/login", siteOrigin)
    redirectUrl.searchParams.set("authError", "不支持的第三方登录渠道")
    return NextResponse.redirect(redirectUrl)
  }

  const oauthState = await consumeOAuthFlowState(params.provider)
  const loginRedirectTarget = normalizeAuthRedirectTarget(oauthState?.redirectTo)
  const fallbackTarget = oauthState?.mode === "register"
    ? "/register"
    : oauthState?.mode === "connect"
      ? oauthState.redirectTo || "/settings?tab=profile&profileTab=accounts"
      : "/login"
  const searchParams = new URL(request.url).searchParams
  const code = searchParams.get("code")?.trim()
  const state = searchParams.get("state")?.trim()

  if (!oauthState || oauthState.provider !== params.provider || !code || !state || oauthState.state !== state) {
    const response = NextResponse.redirect(buildRedirectUrl(fallbackTarget, siteOrigin))
    if (fallbackTarget.startsWith("/settings")) {
      setAccountBindingFlash(response, {
        type: "error",
        message: "第三方登录状态已失效，请重新发起登录",
      }, request)
    } else {
      const redirectUrl = buildRedirectUrl(fallbackTarget, siteOrigin)
      redirectUrl.searchParams.set("authError", "第三方登录状态已失效，请重新发起登录")
      return NextResponse.redirect(redirectUrl)
    }
    clearOAuthFlowState(response, params.provider, request)
    return response
  }

  try {
    const settings = await getServerSiteSettings()
    const tokens = await validateOAuthAuthorizationCode(params.provider, code, oauthState.codeVerifier, settings)
    const profile = await fetchOAuthUserProfile(params.provider, tokens.accessToken())
    const identity = createOAuthIdentity(profile)

    if (oauthState.mode === "connect") {
      const currentUser = await getCurrentUser()

      if (!currentUser || (oauthState.connectUserId && currentUser.id !== oauthState.connectUserId)) {
        throw new Error("当前登录状态已变化，请重新返回设置页发起绑定")
      }

      await connectExternalAuthIdentityToUser({
        identity,
        userId: currentUser.id,
        request,
      })

      const redirectLocation = buildRedirectUrl(fallbackTarget, siteOrigin)
      const response = NextResponse.redirect(redirectLocation)
      setAccountBindingFlash(response, {
        type: "success",
        message: `${identity.providerLabel} 账号已绑定到当前站内账户`,
      }, request)
      clearOAuthFlowState(response, params.provider, request)
      clearPendingExternalAuthState(response, request)
      return response
    }
    const result = await resolveExternalAuth(identity, settings, request)

    if (result.kind === "pending") {
      const response = NextResponse.redirect(buildRedirectUrl("/auth/complete", siteOrigin))
      clearOAuthFlowState(response, params.provider, request)
      clearPendingExternalAuthState(response, request)
      await setPendingExternalAuthState(response, {
        ...result.state,
        redirectTo: loginRedirectTarget,
      }, request)
      return response
    }

    const response = NextResponse.redirect(buildRedirectUrl(loginRedirectTarget, siteOrigin))
    clearOAuthFlowState(response, params.provider, request)
    clearPendingExternalAuthState(response, request)

    if (!result.created) {
      await recordSuccessfulExternalLogin(request, result.user)
    }

    await attachAuthenticatedSession(response, request, result.user)

    return response
  } catch (error) {
    console.error("[api/auth/oauth/callback] unexpected error", error)
    const response = NextResponse.redirect(buildRedirectUrl(fallbackTarget, siteOrigin))
    if (fallbackTarget.startsWith("/settings")) {
      setAccountBindingFlash(response, {
        type: "error",
        message: error instanceof Error ? error.message : "第三方登录失败",
      }, request)
    } else if (error instanceof Error) {
      const redirectUrl = buildRedirectUrl(fallbackTarget, siteOrigin)
      redirectUrl.searchParams.set("authError", error.message)
      return NextResponse.redirect(redirectUrl)
    } else {
      const redirectUrl = buildRedirectUrl(fallbackTarget, siteOrigin)
      redirectUrl.searchParams.set("authError", "第三方登录失败")
      return NextResponse.redirect(redirectUrl)
    }
    clearOAuthFlowState(response, params.provider, request)
    return response
  }
}
