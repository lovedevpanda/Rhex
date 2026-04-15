import { apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { createPointTopupCheckout, inferCheckoutClientType } from "@/lib/payment-gateway"
import { getRequestIp } from "@/lib/request-ip"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const packageId = typeof body.packageId === "string" ? body.packageId.trim() : ""
  const customAmountFen = typeof body.customAmountFen === "number" ? body.customAmountFen : Number(body.customAmountFen)
  const preferredChannelCode = typeof body.preferredChannelCode === "string" ? body.preferredChannelCode.trim() : ""
  const clientType = inferCheckoutClientType(
    request.headers.get("user-agent"),
    typeof body.clientType === "string" ? body.clientType.trim() : null,
  )

  if (!packageId && (!Number.isInteger(customAmountFen) || customAmountFen <= 0)) {
    requireStringField(body, "packageId", "缺少充值套餐")
  }

  return withRequestWriteGuard(createRequestWriteGuardOptions("payments-checkout", {
    request,
    userId: currentUser.id,
    input: {
      scene: "points.topup",
      bizOrderId: packageId || "custom",
      amountFen: Number.isInteger(customAmountFen) && customAmountFen > 0 ? customAmountFen : packageId,
      clientType,
      preferredChannelCode: preferredChannelCode || null,
    },
  }), async () => {
    const result = await createPointTopupCheckout({
      userId: currentUser.id,
      packageId: packageId || null,
      customAmountFen: Number.isInteger(customAmountFen) && customAmountFen > 0 ? customAmountFen : null,
      clientType,
      preferredChannelCode: preferredChannelCode || null,
      requestIp: getRequestIp(request),
    })

    return apiSuccess(result, "充值订单已创建")
  })
}, {
  errorMessage: "创建积分充值订单失败",
  logPrefix: "[api/payments/topup] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
