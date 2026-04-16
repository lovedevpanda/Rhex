import { handleAddonPaymentProviderNotification } from "@/lib/payment-gateway"

export const dynamic = "force-dynamic"

interface PaymentNotifyRouteContext {
  params: Promise<{
    providerCode: string
  }>
}

function buildCallbackResponse(success: boolean) {
  return new Response(success ? "success" : "failure", {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  })
}

async function handleProviderNotification(request: Request, context: PaymentNotifyRouteContext) {
  try {
    const { providerCode } = await context.params
    const normalizedProviderCode = providerCode.trim()

    if (!normalizedProviderCode || normalizedProviderCode === "alipay") {
      return buildCallbackResponse(false)
    }

    const success = await handleAddonPaymentProviderNotification(normalizedProviderCode, request)
    return buildCallbackResponse(success)
  } catch (error) {
    console.error("[api/payments/notify/[providerCode]] unexpected error", error)
    return buildCallbackResponse(false)
  }
}

export async function GET(request: Request, context: PaymentNotifyRouteContext) {
  return handleProviderNotification(request, context)
}

export async function POST(request: Request, context: PaymentNotifyRouteContext) {
  return handleProviderNotification(request, context)
}
