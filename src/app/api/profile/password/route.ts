import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
import { prisma } from "@/db/client"
import { verifyPasswordChangeVerificationCode } from "@/lib/account-security"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { getSessionClearedCookieOptions, getSessionCookieName, readSessionTokenFromCookieHeader, revokeSessionToken } from "@/lib/session"
import { getSiteSettings } from "@/lib/site-settings"


export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const currentPassword = requireStringField(body, "currentPassword", "缺少必要参数")
  const newPassword = requireStringField(body, "newPassword", "缺少必要参数")
  const emailCode = typeof body.emailCode === "string" ? body.emailCode.trim() : ""
  const requestUrl = new URL(request.url)


  if (!currentPassword || !newPassword) {
    apiError(400, "缺少必要参数")
  }

  if (newPassword.length < 6 || newPassword.length > 64) {
    apiError(400, "新密码长度需为 6-64 位")
  }

  const [settings, user] = await Promise.all([
    getSiteSettings(),
    prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        passwordHash: true,
        email: true,
        emailVerifiedAt: true,
      },
    }),
  ])

  if (!user) {
    apiError(404, "用户不存在")
  }

  const matched = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!matched) {
    apiError(400, "当前密码不正确")
  }

  if (settings.passwordChangeRequireEmailVerification) {
    if (!user.email || !user.emailVerifiedAt) {
      apiError(400, "当前账号尚未绑定并验证邮箱，暂无法通过邮箱验证修改密码")
    }

    if (!emailCode) {
      apiError(400, "请填写邮箱验证码")
    }

    await verifyPasswordChangeVerificationCode({
      userId: user.id,
      code: emailCode,
    })
  }

  await executeAddonActionHook("auth.password.change.before", {
    userId: currentUser.id,
    username: currentUser.username,
    email: user.email,
    requiresEmailVerification: settings.passwordChangeRequireEmailVerification,
  }, {
    request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
    throwOnError: true,
  })

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      sessionInvalidBefore: new Date(),
    },
  })

  await revokeSessionToken(readSessionTokenFromCookieHeader(request.headers.get("cookie")))

  await executeAddonActionHook("auth.password.change.after", {
    userId: currentUser.id,
    username: currentUser.username,
    email: user.email,
    requiresEmailVerification: settings.passwordChangeRequireEmailVerification,
  }, {
    request,
    pathname: requestUrl.pathname,
    searchParams: requestUrl.searchParams,
  })

  logRouteWriteSuccess({
    scope: "profile-password",
    action: "update-password",
  }, {
    userId: currentUser.id,
    targetId: String(currentUser.id),
    extra: {
      emailVerificationRequired: settings.passwordChangeRequireEmailVerification,
    },
  })

  const response = NextResponse.json(apiSuccess(undefined, "密码已更新，请重新登录"))
  response.cookies.set(getSessionCookieName(), "", getSessionClearedCookieOptions())

  return response

}, {
  errorMessage: "修改密码失败",
  logPrefix: "[api/profile/password] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
