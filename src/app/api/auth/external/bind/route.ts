import { NextResponse } from "next/server"

import { apiSuccess, createRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { attachAuthenticatedSession, completePendingExternalAuthBind, recordSuccessfulExternalLogin } from "@/lib/external-auth-service"
import { clearPendingExternalAuthState, readPendingExternalAuthState } from "@/lib/auth-flow-state"

export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const login = requireStringField(body, "login", "请输入用户名或邮箱")
  const password = requireStringField(body, "password", "请输入密码")
  const pendingState = await readPendingExternalAuthState()

  if (!pendingState) {
    return NextResponse.json({ code: 410, message: "当前待处理认证流程已失效，请重新发起登录" }, { status: 410 })
  }

  const user = await completePendingExternalAuthBind({
    state: pendingState,
    login,
    password,
    request,
  })

  await recordSuccessfulExternalLogin(request, user)

  const response = NextResponse.json(apiSuccess({
    username: user.username,
    redirectTo: "/",
  }, "success"))

  clearPendingExternalAuthState(response)
  await attachAuthenticatedSession(response, request, user)

  return response
}, {
  errorMessage: "绑定已有账户失败",
  logPrefix: "[api/auth/external/bind] unexpected error",
})
