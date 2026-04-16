import type {
  AddonExecutionContextBase,
  AddonProviderRegistration,
  LoadedAddonRuntime,
} from "@/addons-host/types"
import { runWithAddonExecutionScope } from "@/addons-host/runtime/execution-scope"
import {
  listAddonProviderRuntimeItems,
} from "@/lib/addon-provider-registry"
import type {
  PaymentGatewayChannelDefinition,
  PaymentGatewayPresentationType,
  PaymentGatewayProviderAdminEntry,
} from "@/lib/payment-gateway.types"
import { PAYMENT_GATEWAY_CLIENT_TYPES, type PaymentGatewayClientType } from "@/lib/payment-gateway.types"

interface AddonPaymentProviderRuntimeHooks {
  listChannels?: (input: AddonPaymentProviderRuntimeInput) => unknown
  isRunnable?: (input: AddonPaymentProviderRuntimeInput) => unknown
  getDefaultNotifyPath?: (input: AddonPaymentProviderRuntimeInput) => unknown
  getDefaultReturnPath?: (input: AddonPaymentProviderRuntimeInput) => unknown
  createCheckout?: (input: AddonPaymentProviderRuntimeInput & Record<string, unknown>) => unknown
  queryOrder?: (input: AddonPaymentProviderRuntimeInput & Record<string, unknown>) => unknown
  handleNotification?: (input: AddonPaymentProviderRuntimeInput & Record<string, unknown>) => unknown
}

export interface AddonPaymentProviderRuntimeInput {
  addon: LoadedAddonRuntime
  provider: AddonProviderRegistration
  context: AddonExecutionContextBase
}

export interface LoadedAddonPaymentProvider {
  addon: LoadedAddonRuntime
  provider: AddonProviderRegistration
  context: AddonExecutionContextBase
  settingsHref: string | null
  settingsLabel: string | null
  runtime: AddonPaymentProviderRuntimeHooks | null
}

const PAYMENT_GATEWAY_PRESENTATION_TYPES = [
  "HTML_FORM",
  "QR_CODE",
] as const satisfies readonly PaymentGatewayPresentationType[]

const BUILTIN_PAYMENT_GATEWAY_CHANNEL_DEFINITIONS = [
  {
    channelCode: "alipay.page",
    providerCode: "alipay",
    label: "支付宝 PC 网页",
    description: "电脑浏览器跳转支付宝收银台，适合桌面 Web 站点。",
    clientTypes: ["WEB_DESKTOP"],
    presentationType: "HTML_FORM",
  },
  {
    channelCode: "alipay.wap",
    providerCode: "alipay",
    label: "支付宝 H5",
    description: "移动浏览器唤起支付宝 App 或 H5 收银台，适合手机网页。",
    clientTypes: ["WEB_MOBILE"],
    presentationType: "HTML_FORM",
  },
  {
    channelCode: "alipay.precreate",
    providerCode: "alipay",
    label: "支付宝 扫码预下单",
    description: "服务端生成二维码，适合桌面端展示或线下扫码收款。",
    clientTypes: ["QR_CODE", "WEB_DESKTOP", "WEB_MOBILE"],
    presentationType: "QR_CODE",
  },
] as const satisfies readonly PaymentGatewayChannelDefinition[]

const BUILTIN_PAYMENT_GATEWAY_PROVIDER_ENTRIES = [
  {
    code: "alipay",
    label: "支付宝",
    description: "内置支付宝接口，支持网页、H5 与扫码预下单。",
    source: "builtin",
    settingsHref: "/admin/apps/payment-gateway/alipay",
    settingsLabel: "打开接口配置",
  },
] as const satisfies readonly PaymentGatewayProviderAdminEntry[]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeClientTypes(value: unknown) {
  const values = Array.isArray(value) ? value : []
  const next = values
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item): item is PaymentGatewayClientType => PAYMENT_GATEWAY_CLIENT_TYPES.includes(item as PaymentGatewayClientType))

  return next.length > 0 ? next : null
}

function normalizePresentationType(value: unknown) {
  return PAYMENT_GATEWAY_PRESENTATION_TYPES.includes(value as PaymentGatewayPresentationType)
    ? value as PaymentGatewayPresentationType
    : null
}

function normalizeAddonChannelDefinition(
  value: unknown,
  fallbackProviderCode: string,
): PaymentGatewayChannelDefinition | null {
  if (!isRecord(value)) {
    return null
  }

  const channelCode = normalizeOptionalString(value.channelCode)
  const label = normalizeOptionalString(value.label)
  const description = normalizeOptionalString(value.description)
  const providerCode = normalizeOptionalString(value.providerCode) || fallbackProviderCode
  const clientTypes = normalizeClientTypes(value.clientTypes)
  const presentationType = normalizePresentationType(value.presentationType)

  if (!channelCode || !label || !clientTypes || !presentationType) {
    return null
  }

  return {
    channelCode,
    providerCode,
    label,
    description,
    clientTypes,
    presentationType,
  }
}

function readAddonPaymentProviderRuntimeHooks(provider: AddonProviderRegistration) {
  const data = isRecord(provider.data) ? provider.data : null
  const runtime = data && isRecord(data.runtime) ? data.runtime as AddonPaymentProviderRuntimeHooks : null

  return {
    settingsHref: data ? normalizeOptionalString(data.settingsHref) || null : null,
    settingsLabel: data ? normalizeOptionalString(data.settingsLabel) || null : null,
    runtime,
  }
}

export function listBuiltinPaymentGatewayChannelDefinitions() {
  return [...BUILTIN_PAYMENT_GATEWAY_CHANNEL_DEFINITIONS]
}

export function findBuiltinPaymentGatewayChannelDefinition(channelCode: string) {
  return BUILTIN_PAYMENT_GATEWAY_CHANNEL_DEFINITIONS.find((item) => item.channelCode === channelCode) ?? null
}

export async function listAddonPaymentProviders(): Promise<LoadedAddonPaymentProvider[]> {
  const addons = await listAddonProviderRuntimeItems<AddonPaymentProviderRuntimeHooks>("payment")
  const providers: LoadedAddonPaymentProvider[] = []

  for (const addon of addons) {
    const metadata = readAddonPaymentProviderRuntimeHooks(addon.provider)
    providers.push({
      addon: addon.addon,
      provider: addon.provider,
      context: addon.context,
      settingsHref: metadata.settingsHref,
      settingsLabel: metadata.settingsLabel,
      runtime: metadata.runtime,
    })
  }

  return providers.sort((left, right) => {
    const byLabel = left.provider.label.localeCompare(right.provider.label, "zh-CN")
    if (byLabel !== 0) {
      return byLabel
    }

    return left.provider.code.localeCompare(right.provider.code, "zh-CN")
  })
}

export async function findAddonPaymentProviderByCode(providerCode: string) {
  const normalizedCode = providerCode.trim()
  if (!normalizedCode || normalizedCode === "alipay") {
    return null
  }

  const providers = await listAddonPaymentProviders()
  return providers.find((item) => item.provider.code === normalizedCode) ?? null
}

export async function listPaymentGatewayProviderAdminEntries(): Promise<PaymentGatewayProviderAdminEntry[]> {
  const addonProviders = await listAddonPaymentProviders()
  const entries: PaymentGatewayProviderAdminEntry[] = [...BUILTIN_PAYMENT_GATEWAY_PROVIDER_ENTRIES]
  const existingCodes = new Set(entries.map((item) => item.code))

  for (const item of addonProviders) {
    if (existingCodes.has(item.provider.code)) {
      continue
    }

    entries.push({
      code: item.provider.code,
      label: item.provider.label,
      description: item.provider.description?.trim() || item.addon.manifest.description || `${item.provider.label} 提供方`,
      source: "addon",
      addonId: item.addon.manifest.id,
      settingsHref: item.settingsHref,
      settingsLabel: item.settingsLabel || "打开插件配置",
    })
    existingCodes.add(item.provider.code)
  }

  return entries
}

export async function listPaymentGatewayChannelDefinitions(): Promise<PaymentGatewayChannelDefinition[]> {
  const definitions: PaymentGatewayChannelDefinition[] = [...BUILTIN_PAYMENT_GATEWAY_CHANNEL_DEFINITIONS]
  const existingCodes = new Set(definitions.map((item) => item.channelCode))
  const addonProviders = await listAddonPaymentProviders()

  for (const item of addonProviders) {
    if (typeof item.runtime?.listChannels !== "function") {
      continue
    }

    try {
      const output = await runWithAddonExecutionScope(item.addon, {
        action: `provider:payment:${item.provider.code}:listChannels`,
        request: item.context.request,
      }, async () => item.runtime!.listChannels!({
          addon: item.addon,
          provider: item.provider,
          context: item.context,
        }))
      const channelDefinitions = Array.isArray(output) ? output : []

      for (const channelDefinition of channelDefinitions) {
        const normalized = normalizeAddonChannelDefinition(channelDefinition, item.provider.code)
        if (!normalized || existingCodes.has(normalized.channelCode)) {
          continue
        }

        definitions.push(normalized)
        existingCodes.add(normalized.channelCode)
      }
    } catch (error) {
      console.error("[payment-gateway-registry] failed to read addon payment channels", item.provider.code, error)
    }
  }

  return definitions.sort((left, right) => {
    const byProvider = left.providerCode.localeCompare(right.providerCode, "zh-CN")
    if (byProvider !== 0) {
      return byProvider
    }

    return left.label.localeCompare(right.label, "zh-CN")
  })
}

export async function findPaymentGatewayChannelDefinition(channelCode: string) {
  const normalizedCode = channelCode.trim()
  if (!normalizedCode) {
    return null
  }

  if (normalizedCode.startsWith("alipay.")) {
    return findBuiltinPaymentGatewayChannelDefinition(normalizedCode)
  }

  const definitions = await listPaymentGatewayChannelDefinitions()
  return definitions.find((item) => item.channelCode === normalizedCode) ?? null
}
