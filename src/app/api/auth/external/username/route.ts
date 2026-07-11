import { NextResponse } from "next/server"

import { apiSuccess, createRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { attachAuthenticatedSession, completePendingExternalAuthUsername } from "@/lib/external-auth-service"
import { clearPendingExternalAuthState, consumePendingExternalAuthState } from "@/lib/auth-flow-state"
import { normalizeAuthRedirectTarget } from "@/lib/auth-redirect"
import { getSiteSettings } from "@/lib/site-settings"

export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const username = requireStringField(body, "username", "请输入用户名")
  const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode.trim().toUpperCase() : ""
  const pendingState = await consumePendingExternalAuthState()

  if (!pendingState) {
    return NextResponse.json({ code: 410, message: "当前待处理认证流程已失效，请重新发起登录" }, { status: 410 })
  }

  const settings = await getSiteSettings()
  const user = await completePendingExternalAuthUsername({
    state: pendingState,
    username,
    inviteCode,
    siteSettings: settings,
    request,
  })

  const response = NextResponse.json(apiSuccess({
    username: user.username,
    redirectTo: normalizeAuthRedirectTarget(pendingState.redirectTo),
  }, "success"))

  clearPendingExternalAuthState(response, request)
  await attachAuthenticatedSession(response, request, user)

  return response
}, {
  errorMessage: "补充用户名失败",
  logPrefix: "[api/auth/external/username] unexpected error",
})
