import { NextResponse } from "next/server"
import type { AuthenticationResponseJSON } from "@simplewebauthn/server"

import { apiError, apiSuccess, createRouteHandler, readJsonBody } from "@/lib/api-route"
import { attachAuthenticatedSession, findPasskeyLinkedUserByCredentialId, recordSuccessfulExternalLogin } from "@/lib/external-auth-service"
import { clearPasskeyCeremonyState, consumePasskeyCeremonyState } from "@/lib/auth-flow-state"
import { verifyPasskeyAuthentication } from "@/lib/passkey-auth"
import { updatePasskeyCredentialUsage } from "@/lib/external-auth-store"
import { getServerSiteSettings } from "@/lib/site-settings"

export const POST = createRouteHandler(async ({ request }) => {
  const settings = await getServerSiteSettings()

  if (!settings.authPasskeyEnabled) {
    apiError(403, "Passkey 登录暂未开放")
  }

  const body = await readJsonBody(request)
  const ceremonyState = await consumePasskeyCeremonyState("login")

  if (!ceremonyState) {
    apiError(410, "Passkey 登录状态已失效，请重新发起登录")
  }

  const responseJson = body.response
  if (!responseJson || typeof responseJson !== "object" || Array.isArray(responseJson)) {
    apiError(400, "Passkey 响应数据不正确")
  }

  const authenticationResponse = responseJson as AuthenticationResponseJSON
  const credentialId = typeof authenticationResponse.id === "string"
    ? authenticationResponse.id
    : ""

  if (!credentialId) {
    apiError(400, "Passkey 凭据标识无效")
  }

  const linked = await findPasskeyLinkedUserByCredentialId(credentialId)
  if (!linked) {
    apiError(404, "该 Passkey 尚未绑定站内账户，请先使用 Passkey 创建账户或绑定已有账户")
  }

  const verified = await verifyPasskeyAuthentication(settings, authenticationResponse, linked.credential, ceremonyState.challenge)

  if (!verified.verified) {
    apiError(401, "Passkey 验证失败，请重试")
  }

  await updatePasskeyCredentialUsage({
    id: linked.credential.id,
    counter: verified.authenticationInfo.newCounter,
    deviceType: verified.authenticationInfo.credentialDeviceType,
    backedUp: verified.authenticationInfo.credentialBackedUp,
  })

  await recordSuccessfulExternalLogin(request, linked.user)

  const response = NextResponse.json(apiSuccess({
    redirectTo: "/",
    username: linked.user.username,
  }, "success"))

  clearPasskeyCeremonyState(response, "login", request)
  await attachAuthenticatedSession(response, request, linked.user)

  return response
}, {
  errorMessage: "Passkey 登录失败",
  logPrefix: "[api/auth/passkey/login/verify] unexpected error",
})
