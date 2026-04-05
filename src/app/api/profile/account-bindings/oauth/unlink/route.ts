import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { disconnectExternalAuthProviderFromUser } from "@/lib/external-auth-service"
import { isExternalAuthProvider } from "@/lib/auth-provider-config"
import { logRouteWriteSuccess } from "@/lib/route-metadata"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const provider = requireStringField(body, "provider", "缺少渠道参数")

  if (!isExternalAuthProvider(provider)) {
    apiError(400, "不支持的第三方渠道")
  }

  await disconnectExternalAuthProviderFromUser(currentUser.id, provider)

  logRouteWriteSuccess({
    scope: "profile-account-bindings",
    action: "unlink-oauth-provider",
  }, {
    userId: currentUser.id,
    targetId: String(currentUser.id),
    extra: { provider },
  })

  return apiSuccess(undefined, "账号绑定已解除")
}, {
  errorMessage: "解除第三方绑定失败",
  logPrefix: "[api/profile/account-bindings/oauth/unlink] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
