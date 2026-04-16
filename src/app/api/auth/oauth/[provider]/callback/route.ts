import { NextResponse } from "next/server"

import { clearOAuthFlowState, clearPendingExternalAuthState, readOAuthFlowState, setPendingExternalAuthState } from "@/lib/auth-flow-state"
import { setAccountBindingFlash } from "@/lib/account-binding-flash"
import { getCurrentUser } from "@/lib/auth"
import { attachAuthenticatedSession, connectExternalAuthIdentityToUser, createOAuthIdentity, recordSuccessfulExternalLogin, resolveExternalAuth } from "@/lib/external-auth-service"
import { fetchOAuthUserProfile, isExternalAuthProvider, validateOAuthAuthorizationCode } from "@/lib/auth-provider-config"
import { toAbsoluteSiteUrl } from "@/lib/site-origin"
import { getServerSiteSettings } from "@/lib/site-settings"

interface OAuthProviderRouteProps {
  params: Promise<{
    provider: string
  }>
}

async function buildRedirectUrl(path: string) {
  return new URL(await toAbsoluteSiteUrl(path))
}

export async function GET(request: Request, props: OAuthProviderRouteProps) {
  const params = await props.params

  if (!isExternalAuthProvider(params.provider)) {
    const redirectUrl = await buildRedirectUrl("/login")
    redirectUrl.searchParams.set("authError", "不支持的第三方登录渠道")
    return NextResponse.redirect(redirectUrl)
  }

  const oauthState = await readOAuthFlowState(params.provider)
  const fallbackTarget = oauthState?.mode === "register"
    ? "/register"
    : oauthState?.mode === "connect"
      ? oauthState.redirectTo || "/settings?tab=profile&profileTab=accounts"
      : "/login"
  const searchParams = new URL(request.url).searchParams
  const code = searchParams.get("code")?.trim()
  const state = searchParams.get("state")?.trim()

  if (!oauthState || !code || !state || oauthState.state !== state) {
    const response = NextResponse.redirect(await buildRedirectUrl(fallbackTarget))
    if (fallbackTarget.startsWith("/settings")) {
      setAccountBindingFlash(response, {
        type: "error",
        message: "第三方登录状态已失效，请重新发起登录",
      })
    } else {
      const redirectUrl = await buildRedirectUrl(fallbackTarget)
      redirectUrl.searchParams.set("authError", "第三方登录状态已失效，请重新发起登录")
      return NextResponse.redirect(redirectUrl)
    }
    clearOAuthFlowState(response, params.provider)
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

      const redirectLocation = await buildRedirectUrl(fallbackTarget)
      const response = NextResponse.redirect(redirectLocation)
      setAccountBindingFlash(response, {
        type: "success",
        message: `${identity.providerLabel} 账号已绑定到当前站内账户`,
      })
      clearOAuthFlowState(response, params.provider)
      clearPendingExternalAuthState(response)
      return response
    }
    const result = await resolveExternalAuth(identity, settings, request)

    if (result.kind === "pending") {
      const response = NextResponse.redirect(await buildRedirectUrl("/auth/complete"))
      clearOAuthFlowState(response, params.provider)
      clearPendingExternalAuthState(response)
      await setPendingExternalAuthState(response, result.state)
      return response
    }

    const response = NextResponse.redirect(await buildRedirectUrl("/"))
    clearOAuthFlowState(response, params.provider)
    clearPendingExternalAuthState(response)

    if (!result.created) {
      await recordSuccessfulExternalLogin(request, result.user)
    }

    await attachAuthenticatedSession(response, request, result.user)

    return response
  } catch (error) {
    console.error("[api/auth/oauth/callback] unexpected error", error)
    const response = NextResponse.redirect(await buildRedirectUrl(fallbackTarget))
    if (fallbackTarget.startsWith("/settings")) {
      setAccountBindingFlash(response, {
        type: "error",
        message: error instanceof Error ? error.message : "第三方登录失败",
      })
    } else if (error instanceof Error) {
      const redirectUrl = await buildRedirectUrl(fallbackTarget)
      redirectUrl.searchParams.set("authError", error.message)
      return NextResponse.redirect(redirectUrl)
    } else {
      const redirectUrl = await buildRedirectUrl(fallbackTarget)
      redirectUrl.searchParams.set("authError", "第三方登录失败")
      return NextResponse.redirect(redirectUrl)
    }
    clearOAuthFlowState(response, params.provider)
    return response
  }
}
