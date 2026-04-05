import { apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { disconnectPasskeyCredentialFromUser } from "@/lib/external-auth-service"
import { logRouteWriteSuccess } from "@/lib/route-metadata"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const credentialId = requireStringField(body, "credentialId", "缺少 Passkey 标识")

  await disconnectPasskeyCredentialFromUser(currentUser.id, credentialId)

  logRouteWriteSuccess({
    scope: "profile-account-bindings",
    action: "unlink-passkey",
  }, {
    userId: currentUser.id,
    targetId: String(currentUser.id),
    extra: { credentialId },
  })

  return apiSuccess(undefined, "Passkey 绑定已解除")
}, {
  errorMessage: "解除 Passkey 绑定失败",
  logPrefix: "[api/profile/account-bindings/passkey/unlink] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
