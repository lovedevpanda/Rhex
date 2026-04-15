import { apiSuccess, createUserRouteHandler, readJsonBody, type JsonObject } from "@/lib/api-route"
import { createPaymentCheckout, inferCheckoutClientType } from "@/lib/payment-gateway"
import { getRequestIp } from "@/lib/request-ip"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

function readOptionalString(body: JsonObject, key: string) {
  const value = body[key]
  return typeof value === "string" ? value.trim() : ""
}

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const scene = readOptionalString(body, "scene")
  const bizOrderId = readOptionalString(body, "bizOrderId") || null
  const subject = readOptionalString(body, "subject")
  const content = readOptionalString(body, "body") || null
  const amountFen = typeof body.amountFen === "number" ? body.amountFen : Number(body.amountFen)
  const clientType = inferCheckoutClientType(
    request.headers.get("user-agent"),
    readOptionalString(body, "clientType") || null,
  )
  const preferredChannelCode = readOptionalString(body, "preferredChannelCode") || null
  const returnPath = readOptionalString(body, "returnPath") || null
  const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
    ? body.metadata as Record<string, unknown>
    : null

  return withRequestWriteGuard(createRequestWriteGuardOptions("payments-checkout", {
    request,
    userId: currentUser.id,
    input: {
      scene,
      bizOrderId,
      amountFen,
      clientType,
      preferredChannelCode,
    },
  }), async () => {
    const result = await createPaymentCheckout({
      userId: currentUser.id,
      scene,
      bizOrderId,
      subject,
      body: content,
      amountFen,
      clientType,
      preferredChannelCode,
      returnPath,
      metadata,
      requestIp: getRequestIp(request),
    })

    return apiSuccess(result, "支付订单已创建")
  })
}, {
  errorMessage: "创建支付订单失败",
  logPrefix: "[api/payments/checkout] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
