import { NextResponse } from "next/server"
import type { RegistrationResponseJSON } from "@simplewebauthn/server"

import { apiError, apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { clearPasskeyCeremonyState, readPasskeyCeremonyState } from "@/lib/auth-flow-state"
import { connectExternalAuthIdentityToUser, createPasskeyIdentity } from "@/lib/external-auth-service"
import { findPasskeyCredentialByCredentialId } from "@/lib/external-auth-store"
import { buildPendingPasskeyCredential, verifyPasskeyRegistration } from "@/lib/passkey-auth"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { getServerSiteSettings } from "@/lib/site-settings"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const settings = await getServerSiteSettings()

  if (!settings.authPasskeyEnabled) {
    apiError(403, "Passkey 登录暂未开放")
  }

  const body = await readJsonBody(request)
  const ceremonyState = await readPasskeyCeremonyState("connect")

  if (!ceremonyState || ceremonyState.connectUserId !== currentUser.id) {
    apiError(410, "Passkey 绑定状态已失效，请重新发起")
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
  if (existingCredential && existingCredential.userId !== currentUser.id) {
    apiError(409, "该 Passkey 已绑定其它站内账户")
  }

  await connectExternalAuthIdentityToUser({
    identity: createPasskeyIdentity({
      displayName: ceremonyState.displayName ?? currentUser.nickname?.trim() ?? currentUser.username,
      usernameCandidate: currentUser.username,
      credential: credentialPayload,
    }),
    userId: currentUser.id,
    request,
  })

  logRouteWriteSuccess({
    scope: "profile-account-bindings",
    action: "bind-passkey",
  }, {
    userId: currentUser.id,
    targetId: String(currentUser.id),
  })

  const response = NextResponse.json(apiSuccess(undefined, "Passkey 已绑定到当前账户"))
  clearPasskeyCeremonyState(response, "connect")
  return response
}, {
  errorMessage: "绑定 Passkey 失败",
  logPrefix: "[api/profile/account-bindings/passkey/verify] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
