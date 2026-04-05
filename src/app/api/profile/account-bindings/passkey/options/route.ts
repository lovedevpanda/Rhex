import { NextResponse } from "next/server"

import { apiError, apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { clearPasskeyCeremonyState, setPasskeyCeremonyState } from "@/lib/auth-flow-state"
import { createPasskeyRegistrationOptions } from "@/lib/passkey-auth"
import { getServerSiteSettings } from "@/lib/site-settings"
import { getUserDisplayName } from "@/lib/user-display"

export const POST = createUserRouteHandler(async ({ currentUser }) => {
  const settings = await getServerSiteSettings()

  if (!settings.authPasskeyEnabled) {
    apiError(403, "Passkey 登录暂未开放")
  }

  const options = await createPasskeyRegistrationOptions(settings, {
    username: currentUser.username,
    displayName: getUserDisplayName(currentUser),
  })
  const response = NextResponse.json(apiSuccess({ options }, "success"))

  clearPasskeyCeremonyState(response, "connect")
  setPasskeyCeremonyState(response, "connect", {
    flow: "connect",
    challenge: options.challenge,
    connectUserId: currentUser.id,
    displayName: getUserDisplayName(currentUser),
  })

  return response
}, {
  errorMessage: "获取 Passkey 绑定选项失败",
  logPrefix: "[api/profile/account-bindings/passkey/options] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
