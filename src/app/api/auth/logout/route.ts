import { NextResponse } from "next/server"

import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
import { getCurrentUserRecord } from "@/db/current-user"
import { createRouteHandler } from "@/lib/api-route"
import { getSessionClearedCookieOptions, getSessionCookieName, readSessionTokenFromCookieHeader, revokeSessionToken } from "@/lib/session"

export const POST = createRouteHandler(async ({ request }) => {
  const requestUrl = new URL(request.url)
  const hookCtx = { request, pathname: requestUrl.pathname, searchParams: requestUrl.searchParams }

  const currentUser = await getCurrentUserRecord().catch(() => null)
  if (currentUser) {
    await executeAddonActionHook("auth.logout.before", {
      userId: currentUser.id,
      username: currentUser.username,
    }, hookCtx)
  }

  await revokeSessionToken(readSessionTokenFromCookieHeader(request.headers.get("cookie")))
  const response = NextResponse.json({ code: 0, message: "success" })

  response.cookies.set(getSessionCookieName(), "", getSessionClearedCookieOptions())

  if (currentUser) {
    await executeAddonActionHook("auth.logout.after", {
      userId: currentUser.id,
      username: currentUser.username,
    }, hookCtx)
  }

  return response
}, {
  errorMessage: "退出登录失败",
  logPrefix: "[api/auth/logout] unexpected error",
})
