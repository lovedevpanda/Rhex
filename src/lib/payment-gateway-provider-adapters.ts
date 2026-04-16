import { PaymentOrderStatus } from "@prisma/client"

import { runWithAddonExecutionScope } from "@/addons-host/runtime/execution-scope"
import { findAddonPaymentProviderByCode } from "@/lib/payment-gateway-registry"
import type { PaymentGatewayCheckoutPresentation } from "@/lib/payment-gateway.types"

export interface AddonPaymentProviderCheckoutInput {
  merchantOrderNo: string
  channelCode: string
  amountFen: number
  subject: string
  body?: string | null
  notifyUrl: string
  returnUrl: string
  requestIp?: string | null
  timeoutMinutes: number
}

export interface AddonPaymentProviderCheckoutResult {
  presentation: PaymentGatewayCheckoutPresentation
  requestPayload: Record<string, unknown> | null
  responsePayload: Record<string, unknown> | null
  providerTradeNo: string | null
  providerTraceId: string | null
  redirectUrl: string | null
}

export interface AddonPaymentProviderQueryInput {
  merchantOrderNo: string
  currentStatus: PaymentOrderStatus
}

export interface AddonPaymentProviderQueryResult {
  ok: boolean
  orderStatus: PaymentOrderStatus | null
  tradeStatus: string | null
  paidAt: Date | null
  closedAt: Date | null
  providerTradeNo: string | null
  providerBuyerId: string | null
  providerTraceId: string | null
  errorCode: string | null
  errorMessage: string | null
  responsePayload: Record<string, unknown> | null
}

export interface AddonPaymentProviderNotificationResult {
  verified: boolean
  merchantOrderNo: string | null
  providerTradeNo: string | null
  providerBuyerId: string | null
  tradeStatus: string | null
  orderStatus: PaymentOrderStatus | null
  notifyId: string | null
  notifyType: string | null
  channelCode: string | null
  amountFen: number | null
  paidAt: Date | null
  closedAt: Date | null
  errorMessage: string | null
  payload: Record<string, string>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null
}

function normalizeOptionalDate(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value.trim())
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return null
}

function normalizeOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function normalizeOrderStatus(value: unknown) {
  return Object.values(PaymentOrderStatus).includes(value as PaymentOrderStatus)
    ? value as PaymentOrderStatus
    : null
}

function normalizeStringRecord(value: unknown) {
  if (!isRecord(value)) {
    return null
  }

  const next: Record<string, string> = {}

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      next[key] = entry
    }
  }

  return next
}

function normalizeUnknownRecord(value: unknown) {
  return isRecord(value) ? value : null
}

function normalizeCheckoutPresentation(value: unknown): PaymentGatewayCheckoutPresentation | null {
  if (!isRecord(value)) {
    return null
  }

  const type = value.type === "HTML_FORM" || value.type === "QR_CODE"
    ? value.type
    : null

  if (!type) {
    return null
  }

  return {
    type,
    html: typeof value.html === "string" ? value.html : undefined,
    qrCode: typeof value.qrCode === "string" ? value.qrCode : undefined,
  }
}

async function requireAddonPaymentProvider(providerCode: string) {
  const provider = await findAddonPaymentProviderByCode(providerCode)
  if (!provider) {
    throw new Error(`未找到支付提供方 ${providerCode}`)
  }

  return provider
}

export async function isAddonPaymentProviderRunnable(providerCode: string) {
  const provider = await requireAddonPaymentProvider(providerCode)
  if (typeof provider.runtime?.isRunnable !== "function") {
    return true
  }

  const output = await runWithAddonExecutionScope(provider.addon, {
    action: `provider:payment:${provider.provider.code}:isRunnable`,
    request: provider.context.request,
  }, async () => provider.runtime!.isRunnable!({
    addon: provider.addon,
    provider: provider.provider,
    context: provider.context,
  }))

  if (typeof output === "boolean") {
    return output
  }

  if (isRecord(output) && typeof output.ok === "boolean") {
    return output.ok
  }

  return Boolean(output)
}

export async function getAddonPaymentProviderDefaultPaths(providerCode: string) {
  const provider = await requireAddonPaymentProvider(providerCode)

  const notifyPath = typeof provider.runtime?.getDefaultNotifyPath === "function"
    ? normalizeOptionalString(await runWithAddonExecutionScope(provider.addon, {
        action: `provider:payment:${provider.provider.code}:getDefaultNotifyPath`,
        request: provider.context.request,
      }, async () => provider.runtime!.getDefaultNotifyPath!({
        addon: provider.addon,
        provider: provider.provider,
        context: provider.context,
      })))
    : null

  const returnPath = typeof provider.runtime?.getDefaultReturnPath === "function"
    ? normalizeOptionalString(await runWithAddonExecutionScope(provider.addon, {
        action: `provider:payment:${provider.provider.code}:getDefaultReturnPath`,
        request: provider.context.request,
      }, async () => provider.runtime!.getDefaultReturnPath!({
        addon: provider.addon,
        provider: provider.provider,
        context: provider.context,
      })))
    : null

  return {
    notifyPath,
    returnPath,
  }
}

export async function createAddonPaymentCheckout(providerCode: string, input: AddonPaymentProviderCheckoutInput): Promise<AddonPaymentProviderCheckoutResult> {
  const provider = await requireAddonPaymentProvider(providerCode)
  if (typeof provider.runtime?.createCheckout !== "function") {
    throw new Error(`支付提供方 ${providerCode} 未实现下单能力`)
  }

  const output = await runWithAddonExecutionScope(provider.addon, {
    action: `provider:payment:${provider.provider.code}:createCheckout`,
    request: provider.context.request,
  }, async () => provider.runtime!.createCheckout!({
    addon: provider.addon,
    provider: provider.provider,
    context: provider.context,
    ...input,
  }))

  if (!isRecord(output)) {
    throw new Error(`支付提供方 ${providerCode} 返回了无效的下单结果`)
  }

  const presentation = normalizeCheckoutPresentation(output.presentation)
  if (!presentation) {
    throw new Error(`支付提供方 ${providerCode} 没有返回可识别的支付展示结果`)
  }

  return {
    presentation,
    requestPayload: normalizeUnknownRecord(output.requestPayload),
    responsePayload: normalizeUnknownRecord(output.responsePayload),
    providerTradeNo: normalizeOptionalString(output.providerTradeNo),
    providerTraceId: normalizeOptionalString(output.providerTraceId),
    redirectUrl: normalizeOptionalString(output.redirectUrl),
  }
}

export async function queryAddonPaymentOrder(providerCode: string, input: AddonPaymentProviderQueryInput): Promise<AddonPaymentProviderQueryResult> {
  const provider = await requireAddonPaymentProvider(providerCode)
  if (typeof provider.runtime?.queryOrder !== "function") {
    throw new Error(`支付提供方 ${providerCode} 未实现查单能力`)
  }

  const output = await runWithAddonExecutionScope(provider.addon, {
    action: `provider:payment:${provider.provider.code}:queryOrder`,
    request: provider.context.request,
  }, async () => provider.runtime!.queryOrder!({
    addon: provider.addon,
    provider: provider.provider,
    context: provider.context,
    ...input,
  }))

  if (!isRecord(output)) {
    throw new Error(`支付提供方 ${providerCode} 返回了无效的查单结果`)
  }

  return {
    ok: typeof output.ok === "boolean" ? output.ok : Boolean(output.orderStatus),
    orderStatus: normalizeOrderStatus(output.orderStatus),
    tradeStatus: normalizeOptionalString(output.tradeStatus),
    paidAt: normalizeOptionalDate(output.paidAt),
    closedAt: normalizeOptionalDate(output.closedAt),
    providerTradeNo: normalizeOptionalString(output.providerTradeNo),
    providerBuyerId: normalizeOptionalString(output.providerBuyerId),
    providerTraceId: normalizeOptionalString(output.providerTraceId),
    errorCode: normalizeOptionalString(output.errorCode),
    errorMessage: normalizeOptionalString(output.errorMessage),
    responsePayload: normalizeUnknownRecord(output.responsePayload),
  }
}

export async function handleAddonPaymentNotification(providerCode: string, request: Request): Promise<AddonPaymentProviderNotificationResult> {
  const provider = await requireAddonPaymentProvider(providerCode)
  if (typeof provider.runtime?.handleNotification !== "function") {
    throw new Error(`支付提供方 ${providerCode} 未实现回调处理能力`)
  }

  const output = await runWithAddonExecutionScope(provider.addon, {
    action: `provider:payment:${provider.provider.code}:handleNotification`,
    request,
  }, async () => provider.runtime!.handleNotification!({
    addon: provider.addon,
    provider: provider.provider,
    context: provider.context,
    request,
  }))

  if (!isRecord(output)) {
    throw new Error(`支付提供方 ${providerCode} 返回了无效的回调结果`)
  }

  const payload = normalizeStringRecord(output.payload)
  if (!payload) {
    throw new Error(`支付提供方 ${providerCode} 没有返回可持久化的回调参数`)
  }

  return {
    verified: typeof output.verified === "boolean" ? output.verified : false,
    merchantOrderNo: normalizeOptionalString(output.merchantOrderNo),
    providerTradeNo: normalizeOptionalString(output.providerTradeNo),
    providerBuyerId: normalizeOptionalString(output.providerBuyerId),
    tradeStatus: normalizeOptionalString(output.tradeStatus),
    orderStatus: normalizeOrderStatus(output.orderStatus),
    notifyId: normalizeOptionalString(output.notifyId),
    notifyType: normalizeOptionalString(output.notifyType),
    channelCode: normalizeOptionalString(output.channelCode),
    amountFen: normalizeOptionalNumber(output.amountFen),
    paidAt: normalizeOptionalDate(output.paidAt),
    closedAt: normalizeOptionalDate(output.closedAt),
    errorMessage: normalizeOptionalString(output.errorMessage),
    payload,
  }
}
