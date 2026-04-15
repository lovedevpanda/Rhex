import { apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { sendPasswordChangeVerificationCode } from "@/lib/account-security"
import { getRequestIp } from "@/lib/request-ip"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  return withRequestWriteGuard(createRequestWriteGuardOptions("profile-password-send-code", {
    request,
    input: undefined,
    userId: currentUser.id,
  }), async () => {
    const result = await sendPasswordChangeVerificationCode({
      userId: currentUser.id,
      ip: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
    })

    logRouteWriteSuccess({
      scope: "profile-password-send-code",
      action: "send-verification-code",
    }, {
      userId: currentUser.id,
      targetId: String(currentUser.id),
    })

    return apiSuccess(result, "验证码已发送到已验证邮箱")
  })
}, {
  errorMessage: "验证码发送失败",
  logPrefix: "[api/profile/password/send-code] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
