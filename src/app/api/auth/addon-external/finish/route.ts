import { NextResponse } from "next/server"

import {
  clearOAuthFlowState,
  clearPendingExternalAuthState,
  consumeOAuthFlowState,
  setPendingExternalAuthState,
} from "@/lib/auth-flow-state"
import { setAccountBindingFlash } from "@/lib/account-binding-flash"
import {
  isAddonExternalAuthBridgeAuthorized,
  normalizeAddonExternalAuthMode,
  normalizeAddonExternalAuthProviderCode,
} from "@/lib/addon-external-auth-bridge"
import { getCurrentUser } from "@/lib/auth"
import { requireConfiguredOAuthOrigin } from "@/lib/auth-provider-config"
import {
  attachAuthenticatedSession,
  connectExternalAuthIdentityToUser,
  recordSuccessfulExternalLogin,
  resolveExternalAuth,
} from "@/lib/external-auth-service"
import type { ExternalAuthIdentity } from "@/lib/external-auth-types"
import { getServerSiteSettings } from "@/lib/site-settings"

function normalizeOptionalString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback
}

function normalizeExternalAuthIdentity(
  value: unknown,
): ExternalAuthIdentity | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const source = value as Record<string, unknown>
  const provider = normalizeAddonExternalAuthProviderCode(source.provider)
  const providerLabel = normalizeOptionalString(source.providerLabel)
  const providerAccountId = normalizeOptionalString(source.providerAccountId)

  if (
    normalizeOptionalString(source.method).toLowerCase() !== "oauth"
    || !provider
    || !providerLabel
    || !providerAccountId
  ) {
    return null
  }

  return {
    method: "oauth",
    provider,
    providerLabel,
    providerAccountId,
    providerUsername: normalizeOptionalString(source.providerUsername) || null,
    providerEmail: normalizeOptionalString(source.providerEmail) || null,
    emailVerified: Boolean(source.emailVerified),
    displayName: normalizeOptionalString(source.displayName) || null,
    avatarUrl: normalizeOptionalString(source.avatarUrl) || null,
  }
}

function buildRedirectUrl(path: string, siteOrigin: string) {
  return new URL(path, `${siteOrigin}/`)
}

function redirectWithError(
  request: Request,
  siteOrigin: string,
  targetPath: string,
  provider: string,
  message: string,
) {
  const redirectUrl = buildRedirectUrl(targetPath, siteOrigin)
  let response: NextResponse

  if (targetPath.startsWith("/settings")) {
    response = NextResponse.redirect(redirectUrl)
    setAccountBindingFlash(response, {
      type: "error",
      message,
    }, request)
  } else {
    redirectUrl.searchParams.set("authError", message)
    response = NextResponse.redirect(redirectUrl)
  }

  clearOAuthFlowState(response, provider, request)
  return response
}

export async function POST(request: Request) {
  let body: Record<string, unknown>

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      {
        code: 400,
        message: "请求体必须为 JSON",
      },
      {
        status: 400,
      },
    )
  }

  const addonId = normalizeOptionalString(body.addonId)
  const identity = normalizeExternalAuthIdentity(body.identity)
  const requestedMode = normalizeAddonExternalAuthMode(body.mode)

  if (!addonId || !identity) {
    return NextResponse.json(
      {
        code: 400,
        message: "缺少 addonId 或 identity",
      },
      {
        status: 400,
      },
    )
  }

  if (!(await isAddonExternalAuthBridgeAuthorized(addonId, request))) {
    return NextResponse.json(
      {
        code: 403,
        message: "插件外部登录桥接鉴权失败",
      },
      {
        status: 403,
      },
    )
  }

  let siteOrigin: string
  try {
    siteOrigin = requireConfiguredOAuthOrigin()
  } catch (error) {
    console.error("[api/auth/addon-external/finish] missing configured OAuth origin", error)
    return NextResponse.json({
      code: 503,
      message: "\u7b2c\u4e09\u65b9\u767b\u5f55\u6682\u4e0d\u53ef\u7528\uff0c\u8bf7\u8054\u7cfb\u7ba1\u7406\u5458\u914d\u7f6e\u7ad9\u70b9 URL",
    }, { status: 503 })
  }

  const providerCode = identity.provider ?? ""
  const oauthState = await consumeOAuthFlowState(providerCode)
  const fallbackTarget =
    oauthState?.mode === "register"
      ? "/register"
      : oauthState?.mode === "connect"
        ? oauthState.redirectTo || "/settings?tab=profile&profileTab=accounts"
        : requestedMode === "register"
          ? "/register"
          : "/login"

  if (!oauthState || oauthState.provider !== providerCode) {
    return redirectWithError(
      request,
      siteOrigin,
      fallbackTarget,
      providerCode,
      "第三方登录状态已失效，请重新发起登录",
    )
  }

  try {
    const settings = await getServerSiteSettings()

    if (oauthState.mode === "connect") {
      const currentUser = await getCurrentUser()

      if (
        !currentUser
        || (oauthState.connectUserId
          && currentUser.id !== oauthState.connectUserId)
      ) {
        throw new Error("当前登录状态已变化，请重新发起绑定")
      }

      await connectExternalAuthIdentityToUser({
        identity,
        userId: currentUser.id,
        request,
      })

      const response = NextResponse.redirect(buildRedirectUrl(fallbackTarget, siteOrigin))
      setAccountBindingFlash(response, {
        type: "success",
        message: `${identity.providerLabel} 账号已绑定到当前站内账户`,
      }, request)
      clearOAuthFlowState(response, providerCode, request)
      clearPendingExternalAuthState(response, request)
      return response
    }

    const result = await resolveExternalAuth(identity, settings, request)

    if (result.kind === "pending") {
      const response = NextResponse.redirect(buildRedirectUrl("/auth/complete", siteOrigin))
      clearOAuthFlowState(response, providerCode, request)
      clearPendingExternalAuthState(response, request)
      await setPendingExternalAuthState(response, result.state, request)
      return response
    }

    const response = NextResponse.redirect(buildRedirectUrl("/", siteOrigin))
    clearOAuthFlowState(response, providerCode, request)
    clearPendingExternalAuthState(response, request)

    if (!result.created) {
      await recordSuccessfulExternalLogin(request, result.user)
    }

    await attachAuthenticatedSession(response, request, result.user)
    return response
  } catch (error) {
    return redirectWithError(
      request,
      siteOrigin,
      fallbackTarget,
      providerCode,
      error instanceof Error ? error.message : "第三方登录失败",
    )
  }
}
