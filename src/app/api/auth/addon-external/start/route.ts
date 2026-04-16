import { randomUUID } from "node:crypto"

import { NextResponse } from "next/server"

import {
  isAddonExternalAuthBridgeAuthorized,
  normalizeAddonExternalAuthMode,
  normalizeAddonExternalAuthProviderCode,
  normalizeAddonExternalAuthRedirectTo,
} from "@/lib/addon-external-auth-bridge"
import { setOAuthFlowState } from "@/lib/auth-flow-state"
import { getCurrentUser } from "@/lib/auth"

function createErrorResponse(status: number, message: string) {
  return NextResponse.json(
    {
      code: status,
      message,
    },
    {
      status,
    },
  )
}

export async function POST(request: Request) {
  let body: Record<string, unknown>

  try {
    body = await request.json()
  } catch {
    return createErrorResponse(400, "请求体必须为 JSON")
  }

  const addonId = typeof body.addonId === "string" ? body.addonId.trim() : ""
  const provider = normalizeAddonExternalAuthProviderCode(body.provider)
  const mode = normalizeAddonExternalAuthMode(body.mode)

  if (!addonId || !provider) {
    return createErrorResponse(400, "缺少 addonId 或 provider")
  }

  if (!(await isAddonExternalAuthBridgeAuthorized(addonId, request))) {
    return createErrorResponse(403, "插件外部登录桥接鉴权失败")
  }

  const currentUser = mode === "connect" ? await getCurrentUser() : null
  if (mode === "connect" && !currentUser) {
    return createErrorResponse(401, "请先登录后再绑定第三方账号")
  }

  const response = NextResponse.json({
    code: 0,
    message: "ok",
  })

  await setOAuthFlowState(response, provider, {
    provider,
    state: randomUUID(),
    mode,
    redirectTo:
      mode === "connect"
        ? normalizeAddonExternalAuthRedirectTo(body.redirectTo)
        : null,
    connectUserId: mode === "connect" ? currentUser?.id : undefined,
  })

  return response
}
