import { NextResponse } from "next/server"
import type { RegistrationResponseJSON } from "@simplewebauthn/server"

import { apiError, apiSuccess, createRouteHandler, readJsonBody } from "@/lib/api-route"
import { clearPasskeyCeremonyState, clearPendingExternalAuthState, consumePasskeyCeremonyState, setPendingExternalAuthState } from "@/lib/auth-flow-state"
import { attachAuthenticatedSession, createPasskeyIdentity, recordSuccessfulExternalLogin, resolveExternalAuth } from "@/lib/external-auth-service"
import { findPasskeyCredentialByCredentialId } from "@/lib/external-auth-store"
import { buildPendingPasskeyCredential, verifyPasskeyRegistration } from "@/lib/passkey-auth"
import { getServerSiteSettings } from "@/lib/site-settings"

export const POST = createRouteHandler(async ({ request }) => {
  const settings = await getServerSiteSettings()

  if (!settings.authPasskeyEnabled) {
    apiError(403, "Passkey 登录暂未开放")
  }

  const body = await readJsonBody(request)
  const ceremonyState = await consumePasskeyCeremonyState("register")

  if (!ceremonyState) {
    apiError(410, "Passkey 注册状态已失效，请重新发起")
  }

  const responseJson = body.response
  if (!responseJson || typeof responseJson !== "object" || Array.isArray(responseJson)) {
    apiError(400, "Passkey 响应数据不正确")
  }

  const registrationResponse = responseJson as RegistrationResponseJSON
  const verified = await verifyPasskeyRegistration(settings, registrationResponse, ceremonyState.challenge)

  if (!verified.verified || !verified.registrationInfo) {
    apiError(401, "Passkey 验证失败，请重试")
  }

  const credentialPayload = buildPendingPasskeyCredential({
    credentialId: verified.registrationInfo.credential.id,
    publicKey: verified.registrationInfo.credential.publicKey,
    counter: verified.registrationInfo.credential.counter,
    deviceType: verified.registrationInfo.credentialDeviceType,
    backedUp: verified.registrationInfo.credentialBackedUp,
    transports: registrationResponse.response.transports,
  })

  const existingCredential = await findPasskeyCredentialByCredentialId(credentialPayload.credentialId)
  if (existingCredential) {
    apiError(409, "该 Passkey 已绑定站内账户，请直接使用 Passkey 登录")
  }

  const result = await resolveExternalAuth(createPasskeyIdentity({
    email: ceremonyState.emailCandidate,
    displayName: ceremonyState.displayName,
    usernameCandidate: ceremonyState.usernameCandidate ?? "user",
    credential: credentialPayload,
  }), settings, request)

  if (result.kind === "pending") {
    const response = NextResponse.json(apiSuccess({
      redirectTo: "/auth/complete",
    }, "success"))

    clearPasskeyCeremonyState(response, "register", request)
    clearPendingExternalAuthState(response, request)
    await setPendingExternalAuthState(response, result.state, request)

    return response
  }

  const response = NextResponse.json(apiSuccess({
    redirectTo: "/",
    username: result.user.username,
  }, "success"))

  clearPasskeyCeremonyState(response, "register", request)
  clearPendingExternalAuthState(response, request)

  if (!result.created) {
    await recordSuccessfulExternalLogin(request, result.user)
  }

  await attachAuthenticatedSession(response, request, result.user)

  return response
}, {
  errorMessage: "Passkey 注册失败",
  logPrefix: "[api/auth/passkey/register/verify] unexpected error",
})
