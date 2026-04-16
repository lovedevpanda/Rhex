import { AlipaySdk, type AlipaySdkCommonResult } from "alipay-sdk"

import { findBuiltinPaymentGatewayChannelDefinition } from "@/lib/payment-gateway-registry"
import type {
  PaymentGatewayCheckoutPresentation,
  ServerPaymentGatewayAlipayConfigData,
} from "@/lib/payment-gateway.types"

type AlipayChannelCode = "alipay.page" | "alipay.wap" | "alipay.precreate"

const ALIPAY_CHANNEL_EXECUTION_MAP = {
  "alipay.page": {
    method: "alipay.trade.page.pay",
    productCode: "FAST_INSTANT_TRADE_PAY",
  },
  "alipay.wap": {
    method: "alipay.trade.wap.pay",
    productCode: "QUICK_WAP_WAY",
  },
  "alipay.precreate": {
    method: "alipay.trade.precreate",
    productCode: "QR_CODE_OFFLINE",
  },
} as const

export interface CreateAlipayCheckoutPresentationInput {
  channelCode: AlipayChannelCode
  merchantOrderNo: string
  amountFen: number
  subject: string
  body?: string | null
  notifyUrl: string
  returnUrl: string
  requestIp?: string | null
  timeoutMinutes: number
  config: ServerPaymentGatewayAlipayConfigData
}

export interface CreateAlipayCheckoutPresentationResult {
  presentation: PaymentGatewayCheckoutPresentation
  requestPayload: Record<string, unknown>
  responsePayload: Record<string, unknown>
  providerTradeNo: string | null
  providerTraceId: string | null
}

function formatAmountFen(amountFen: number) {
  return (amountFen / 100).toFixed(2)
}

export function isAlipayConfigRunnable(config: ServerPaymentGatewayAlipayConfigData) {
  if (!config.appId || !config.privateKey) {
    return false
  }

  if (config.signMode === "PUBLIC_KEY") {
    return Boolean(config.alipayPublicKey)
  }

  return Boolean(config.appCertContent && config.alipayPublicCertContent && config.alipayRootCertContent)
}

export function createAlipaySdkClient(config: ServerPaymentGatewayAlipayConfigData) {
  const baseConfig = {
    appId: config.appId,
    privateKey: config.privateKey ?? "",
    signType: "RSA2" as const,
    keyType: config.keyType,
    gateway: config.sandbox
      ? "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
      : "https://openapi.alipay.com/gateway.do",
    charset: "utf-8" as const,
    version: "1.0" as const,
    timeout: 10_000,
  }

  if (config.signMode === "CERT") {
    return new AlipaySdk({
      ...baseConfig,
      appCertContent: config.appCertContent ?? "",
      alipayPublicCertContent: config.alipayPublicCertContent ?? "",
      alipayRootCertContent: config.alipayRootCertContent ?? "",
    })
  }

  return new AlipaySdk({
    ...baseConfig,
    alipayPublicKey: config.alipayPublicKey ?? "",
  })
}

function buildAlipayBusinessParams(requestIp?: string | null) {
  return requestIp ? { mc_create_trade_ip: requestIp } : undefined
}

export async function createAlipayCheckoutPresentation(
  input: CreateAlipayCheckoutPresentationInput,
): Promise<CreateAlipayCheckoutPresentationResult> {
  const definition = findBuiltinPaymentGatewayChannelDefinition(input.channelCode)
  const execution = ALIPAY_CHANNEL_EXECUTION_MAP[input.channelCode]
  if (!definition || definition.providerCode !== "alipay" || !execution) {
    throw new Error("不支持的支付宝通道")
  }

  const sdk = createAlipaySdkClient(input.config)
  const commonBizContent = {
    out_trade_no: input.merchantOrderNo,
    total_amount: formatAmountFen(input.amountFen),
    subject: input.subject,
    timeout_express: `${input.timeoutMinutes}m`,
    ...(input.body ? { body: input.body } : {}),
    ...(input.config.sellerId ? { seller_id: input.config.sellerId } : {}),
  }

  if (input.channelCode === "alipay.page" || input.channelCode === "alipay.wap") {
    const businessParams = buildAlipayBusinessParams(input.requestIp)
    const html = sdk.pageExecute(execution.method, "POST", {
      notifyUrl: input.notifyUrl,
      returnUrl: input.returnUrl,
      bizContent: {
        ...commonBizContent,
        product_code: execution.productCode,
        ...(businessParams ? { business_params: JSON.stringify(businessParams) } : {}),
        ...(input.channelCode === "alipay.wap" ? { quit_url: input.returnUrl } : {}),
      },
    })

    return {
      presentation: {
        type: "HTML_FORM",
        html,
      },
      requestPayload: {
        notifyUrl: input.notifyUrl,
        returnUrl: input.returnUrl,
        bizContent: {
          ...commonBizContent,
          product_code: execution.productCode,
          ...(businessParams ? { business_params: businessParams } : {}),
          ...(input.channelCode === "alipay.wap" ? { quit_url: input.returnUrl } : {}),
        },
      },
      responsePayload: {
        html,
      },
      providerTradeNo: null,
      providerTraceId: null,
    }
  }

  const result = await sdk.exec(execution.method, {
    notifyUrl: input.notifyUrl,
    bizContent: {
      ...commonBizContent,
      product_code: execution.productCode,
      ...(buildAlipayBusinessParams(input.requestIp) ? { business_params: buildAlipayBusinessParams(input.requestIp) } : {}),
    },
  }, {
    validateSign: true,
  })

  if (result.code !== "10000" || !result.qrCode) {
    throw new Error(result.subMsg || result.sub_msg || result.msg || "支付宝预下单失败")
  }

  return {
    presentation: {
      type: "QR_CODE",
      qrCode: String(result.qrCode),
    },
    requestPayload: {
      notifyUrl: input.notifyUrl,
      bizContent: {
        ...commonBizContent,
        product_code: execution.productCode,
        ...(buildAlipayBusinessParams(input.requestIp) ? { business_params: buildAlipayBusinessParams(input.requestIp) } : {}),
      },
    },
    responsePayload: {
      outTradeNo: result.outTradeNo,
      qrCode: result.qrCode,
    },
    providerTradeNo: typeof result.tradeNo === "string" ? result.tradeNo : null,
    providerTraceId: typeof result.traceId === "string" ? result.traceId : null,
  }
}

export async function queryAlipayTradeStatus(params: {
  config: ServerPaymentGatewayAlipayConfigData
  merchantOrderNo: string
}) {
  const sdk = createAlipaySdkClient(params.config)
  const result = await sdk.exec("alipay.trade.query", {
    bizContent: {
      out_trade_no: params.merchantOrderNo,
      query_options: ["fund_bill_list", "voucher_detail_list"],
    },
  }, {
    validateSign: true,
  })

  return result
}

export function verifyAlipayNotifySignature(
  config: ServerPaymentGatewayAlipayConfigData,
  payload: Record<string, string>,
) {
  const sdk = createAlipaySdkClient(config)
  return sdk.checkNotifySignV2(payload)
}

export function readAlipayNotifyTradeStatus(payload: Record<string, string>) {
  const tradeStatus = payload.trade_status?.trim() ?? ""
  return tradeStatus
}

export function readAlipayNotifyTradeTime(payload: Record<string, string>) {
  const source = payload.gmt_payment?.trim() || payload.gmt_close?.trim() || ""
  if (!source) {
    return null
  }

  const parsed = new Date(source.replace(" ", "T"))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function toAlipayResultError(result: AlipaySdkCommonResult) {
  return {
    code: result.subCode ?? result.sub_code ?? result.code ?? "UNKNOWN",
    message: result.subMsg ?? result.sub_msg ?? result.msg ?? "支付宝请求失败",
  }
}
