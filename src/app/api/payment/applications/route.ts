import { apiError, apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { withRequestWriteGuard } from "@/lib/write-guard"
import {
  createOwnPaymentApplication,
  rotateOwnPaymentApplicationSecret,
  updateOwnPaymentApplication,
} from "@/lib/payment-applications"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const action = typeof body.action === "string" ? body.action.trim() : ""

  return withRequestWriteGuard({
    request,
    userId: currentUser.id,
    scope: "payment-applications",
    cooldownMs: 1_500,
    dedupeKey: JSON.stringify({
      action,
      id: typeof body.id === "string" ? body.id.trim() : "",
      name: typeof body.name === "string" ? body.name.trim() : "",
      homepageUrl: typeof body.homepageUrl === "string" ? body.homepageUrl.trim() : "",
      callbackUrl: typeof body.callbackUrl === "string" ? body.callbackUrl.trim() : "",
    }),
    dedupeWindowMs: 10_000,
    releaseOnError: true,
  }, async () => {
  if (action === "create") {
    const result = await createOwnPaymentApplication({
      ownerId: currentUser.id,
      name: body.name,
      description: body.description,
      homepageUrl: body.homepageUrl,
      callbackUrl: body.callbackUrl,
    })

    return apiSuccess(result, "Payment 应用已创建")
  }

  if (action === "update") {
    await updateOwnPaymentApplication({
      ownerId: currentUser.id,
      id: typeof body.id === "string" ? body.id : "",
      name: body.name,
      description: body.description,
      homepageUrl: body.homepageUrl,
      callbackUrl: body.callbackUrl,
    })

    return apiSuccess(undefined, "Payment 应用已更新")
  }

  if (action === "rotate-secret") {
    const result = await rotateOwnPaymentApplicationSecret({
      ownerId: currentUser.id,
      id: typeof body.id === "string" ? body.id : "",
    })

    return apiSuccess(result, "Payment 应用 Secret Key 已重置")
  }

  apiError(400, "Unsupported Payment application action")
  })
}, {
  errorMessage: "处理 Payment 应用失败",
  logPrefix: "[api/payment/applications] unexpected error",
  unauthorizedMessage: "请先登录后再管理 Payment 应用",
  allowStatuses: ["ACTIVE"],
})
