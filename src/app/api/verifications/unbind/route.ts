import { apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { unbindCurrentUserVerification } from "@/lib/verifications"

export const POST = createUserRouteHandler(async ({ currentUser }) => {
  await unbindCurrentUserVerification(currentUser.id)

  logRouteWriteSuccess({
    scope: "verifications-unbind",
    action: "unbind-verification",
  }, {
    userId: currentUser.id,
    targetId: String(currentUser.id),
  })

  return apiSuccess(undefined, "认证已解除绑定，你现在可以重新申请其它认证")
}, {
  errorMessage: "解除绑定失败",
  logPrefix: "[api/verifications/unbind] unexpected error",
  unauthorizedMessage: "请先登录后再操作",
  allowStatuses: ["ACTIVE", "MUTED"],
})
