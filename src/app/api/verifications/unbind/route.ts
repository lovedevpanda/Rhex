import { apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { unbindCurrentUserVerification } from "@/lib/verifications"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  await withRequestWriteGuard({
    request,
    userId: currentUser.id,
    scope: "verifications-unbind",
    cooldownMs: 1_500,
    dedupeKey: "unbind",
    dedupeWindowMs: 10_000,
    releaseOnError: true,
  }, async () => {
    await unbindCurrentUserVerification(currentUser.id)
  })

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
