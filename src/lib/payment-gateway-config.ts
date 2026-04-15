import { randomUUID } from "node:crypto"

import { prisma } from "@/db/client"
import { apiError, type JsonObject } from "@/lib/api-route"
import { defaultSiteSettingsCreateInput } from "@/lib/site-settings-defaults"
import { findPaymentGatewayChannelDefinition, listPaymentGatewayChannelDefinitions } from "@/lib/payment-gateway-registry"
import {
  PAYMENT_GATEWAY_APP_KEY,
  PAYMENT_GATEWAY_CLIENT_TYPES,
  PAYMENT_GATEWAY_KEY_TYPES,
  PAYMENT_GATEWAY_SENSITIVE_KEY,
  PAYMENT_GATEWAY_SIGN_MODES,
  SITE_SETTINGS_SENSITIVE_KEY,
  type PaymentGatewayChannelToggle,
  type PaymentGatewayClientType,
  type PaymentGatewayConfigData,
  type PaymentGatewayKeyType,
  type PaymentGatewayRouteRule,
  type PaymentGatewaySignMode,
  type PaymentGatewayTopupPackage,
  type ServerPaymentGatewayConfigData,
} from "@/lib/payment-gateway.types"

type PaymentGatewayStateRecord = {
  AppId: string
  enabled: boolean
  installedAt: string | null
  uninstalledAt: string | null
  config: Record<string, unknown>
  status: string
  version: string | null
  sourceDir: string | null
  lastActivatedAt: string | null
  lastErrorAt: string | null
  lastErrorMessage: string | null
  failureCount: number
}

export interface ResolvedPaymentGatewayConfigDraft {
  record: {
    id: string
    appStateJson: string | null
    sensitiveStateJson: string | null
  }
  config: ServerPaymentGatewayConfigData
}

const DEFAULT_CHANNEL_TOGGLES: PaymentGatewayChannelToggle[] = listPaymentGatewayChannelDefinitions().map((item) => ({
  channelCode: item.channelCode,
  enabled: false,
}))

const DEFAULT_ROUTES: PaymentGatewayRouteRule[] = [
  {
    id: "payment-route-desktop-default",
    scene: "*",
    description: "桌面浏览器默认走支付宝 PC 网页支付。",
    clientType: "WEB_DESKTOP",
    providerCode: "alipay",
    channelCode: "alipay.page",
    priority: 100,
    enabled: true,
  },
  {
    id: "payment-route-mobile-default",
    scene: "*",
    description: "移动浏览器默认走支付宝 H5 支付。",
    clientType: "WEB_MOBILE",
    providerCode: "alipay",
    channelCode: "alipay.wap",
    priority: 100,
    enabled: true,
  },
  {
    id: "payment-route-qr-default",
    scene: "*",
    description: "扫码场景默认走支付宝预下单二维码。",
    clientType: "QR_CODE",
    providerCode: "alipay",
    channelCode: "alipay.precreate",
    priority: 100,
    enabled: true,
  },
]

const DEFAULT_SERVER_CONFIG: ServerPaymentGatewayConfigData = {
  enabled: false,
  orderExpireMinutes: 30,
  defaultCurrency: "CNY",
  defaultReturnPath: "/settings",
  paymentSuccessEmailNotificationEnabled: false,
  paymentSuccessEmailRecipient: "",
  topupEnabled: false,
  topupPackages: [
    {
      id: "points-topup-1000",
      title: "新手包",
      amountFen: 1000,
      points: 100,
      bonusPoints: 0,
      enabled: true,
      sortOrder: 10,
    },
    {
      id: "points-topup-3000",
      title: "常用包",
      amountFen: 3000,
      points: 330,
      bonusPoints: 30,
      enabled: true,
      sortOrder: 20,
    },
    {
      id: "points-topup-10000",
      title: "进阶包",
      amountFen: 10000,
      points: 1200,
      bonusPoints: 200,
      enabled: true,
      sortOrder: 30,
    },
  ],
  topupCustomAmountEnabled: false,
  topupCustomMinAmountFen: 1000,
  topupCustomMaxAmountFen: 100000,
  topupCustomPointsPerYuan: 10,
  channels: DEFAULT_CHANNEL_TOGGLES,
  routes: DEFAULT_ROUTES,
  alipay: {
    sandbox: true,
    signMode: "PUBLIC_KEY",
    keyType: "PKCS1",
    appId: "",
    sellerId: "",
    returnPath: "/settings",
    notifyPath: "/api/payments/notify/alipay",
    privateKey: null,
    alipayPublicKey: null,
    appCertContent: null,
    alipayPublicCertContent: null,
    alipayRootCertContent: null,
    privateKeyConfigured: false,
    alipayPublicKeyConfigured: false,
    appCertConfigured: false,
    alipayPublicCertConfigured: false,
    alipayRootCertConfigured: false,
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function parseJsonRoot(raw: string | null | undefined) {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function readPaymentGatewayStateRecord(appStateJson: string | null | undefined): PaymentGatewayStateRecord | null {
  const root = parseJsonRoot(appStateJson)
  const record = root[PAYMENT_GATEWAY_APP_KEY]
  if (!isRecord(record)) {
    return null
  }

  return {
    AppId: typeof record.AppId === "string" ? record.AppId : PAYMENT_GATEWAY_APP_KEY,
    enabled: typeof record.enabled === "boolean" ? record.enabled : Boolean(record.enabled),
    installedAt: typeof record.installedAt === "string" ? record.installedAt : null,
    uninstalledAt: typeof record.uninstalledAt === "string" ? record.uninstalledAt : null,
    config: isRecord(record.config) ? record.config : {},
    status: typeof record.status === "string" ? record.status : "active",
    version: typeof record.version === "string" ? record.version : null,
    sourceDir: typeof record.sourceDir === "string" ? record.sourceDir : null,
    lastActivatedAt: typeof record.lastActivatedAt === "string" ? record.lastActivatedAt : null,
    lastErrorAt: typeof record.lastErrorAt === "string" ? record.lastErrorAt : null,
    lastErrorMessage: typeof record.lastErrorMessage === "string" ? record.lastErrorMessage : null,
    failureCount: typeof record.failureCount === "number" && Number.isFinite(record.failureCount)
      ? Math.max(0, Math.trunc(record.failureCount))
      : 0,
  }
}

function readSensitiveState(raw: string | null | undefined) {
  const root = parseJsonRoot(raw)
  const state = root[SITE_SETTINGS_SENSITIVE_KEY]
  return isRecord(state) ? state : {}
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false
    }
  }

  return fallback
}

function normalizeNullableSecret(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeString(value: unknown, fallback: string, maxLength: number) {
  const resolved = typeof value === "string" ? value.trim() : fallback
  const sliced = resolved.slice(0, maxLength)
  return sliced || fallback
}

function normalizeOptionalString(value: unknown, fallback = "", maxLength = 500) {
  return normalizeString(value, fallback, maxLength)
}

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function normalizeCurrency(value: unknown, fallback: string) {
  const resolved = normalizeString(value, fallback, 8).toUpperCase()
  return resolved || fallback
}

function normalizePathOrUrl(value: unknown, fallback: string) {
  const resolved = normalizeOptionalString(value, fallback, 500)
  if (!resolved) {
    return fallback
  }

  if (/^https?:\/\//i.test(resolved)) {
    return resolved
  }

  return resolved.startsWith("/") ? resolved : `/${resolved}`
}

function normalizeClientType(value: unknown, fallback: PaymentGatewayClientType): PaymentGatewayClientType {
  return PAYMENT_GATEWAY_CLIENT_TYPES.includes(value as PaymentGatewayClientType)
    ? value as PaymentGatewayClientType
    : fallback
}

function normalizeSignMode(value: unknown, fallback: PaymentGatewaySignMode): PaymentGatewaySignMode {
  return PAYMENT_GATEWAY_SIGN_MODES.includes(value as PaymentGatewaySignMode)
    ? value as PaymentGatewaySignMode
    : fallback
}

function normalizeKeyType(value: unknown, fallback: PaymentGatewayKeyType): PaymentGatewayKeyType {
  return PAYMENT_GATEWAY_KEY_TYPES.includes(value as PaymentGatewayKeyType)
    ? value as PaymentGatewayKeyType
    : fallback
}

function normalizeChannelToggles(value: unknown, fallback: PaymentGatewayChannelToggle[]) {
  const source = Array.isArray(value) ? value : []
  const enabledMap = new Map<string, boolean>()

  for (const item of source) {
    if (!isRecord(item)) {
      continue
    }

    const channelCode = typeof item.channelCode === "string" ? item.channelCode.trim() : ""
    if (!findPaymentGatewayChannelDefinition(channelCode)) {
      continue
    }

    enabledMap.set(channelCode, normalizeBoolean(item.enabled, false))
  }

  return listPaymentGatewayChannelDefinitions().map((item) => ({
    channelCode: item.channelCode,
    enabled: enabledMap.has(item.channelCode)
      ? enabledMap.get(item.channelCode) ?? false
      : fallback.find((entry) => entry.channelCode === item.channelCode)?.enabled ?? false,
  }))
}

function normalizeRouteRules(
  value: unknown,
  fallback: PaymentGatewayRouteRule[],
  options?: { allowEmpty?: boolean },
) {
  if (!Array.isArray(value)) {
    return fallback
  }

  const next: PaymentGatewayRouteRule[] = []

  for (const item of value) {
    if (!isRecord(item)) {
      continue
    }

    const channelCode = typeof item.channelCode === "string" ? item.channelCode.trim() : ""
    const channelDefinition = findPaymentGatewayChannelDefinition(channelCode)
    if (!channelDefinition) {
      continue
    }

    next.push({
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `payment-route-${randomUUID()}`,
      scene: normalizeOptionalString(item.scene, "*", 120) || "*",
      description: normalizeOptionalString(item.description, "", 200),
      clientType: normalizeClientType(item.clientType, "ANY"),
      providerCode: channelDefinition.providerCode,
      channelCode: channelDefinition.channelCode,
      priority: typeof item.priority === "number" && Number.isFinite(item.priority)
        ? Math.max(0, Math.min(9999, Math.trunc(item.priority)))
        : 100,
      enabled: normalizeBoolean(item.enabled, true),
    })
  }

  if (next.length === 0 && !options?.allowEmpty) {
    return fallback
  }

  return next
}

function normalizeTopupPackages(
  value: unknown,
  fallback: PaymentGatewayTopupPackage[],
  options?: { allowEmpty?: boolean },
) {
  if (!Array.isArray(value)) {
    return fallback
  }

  const next: PaymentGatewayTopupPackage[] = []

  for (const item of value) {
    if (!isRecord(item)) {
      continue
    }

    const amountFen = typeof item.amountFen === "number" && Number.isFinite(item.amountFen)
      ? Math.max(1, Math.min(100_000_000, Math.trunc(item.amountFen)))
      : 0
    const points = typeof item.points === "number" && Number.isFinite(item.points)
      ? Math.max(1, Math.min(10_000_000, Math.trunc(item.points)))
      : 0
    const bonusPoints = typeof item.bonusPoints === "number" && Number.isFinite(item.bonusPoints)
      ? Math.max(0, Math.min(10_000_000, Math.trunc(item.bonusPoints)))
      : 0

    if (!amountFen || !points) {
      continue
    }

    next.push({
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `topup-${randomUUID()}`,
      title: normalizeOptionalString(item.title, "积分充值", 80) || "积分充值",
      amountFen,
      points,
      bonusPoints,
      enabled: normalizeBoolean(item.enabled, true),
      sortOrder: typeof item.sortOrder === "number" && Number.isFinite(item.sortOrder)
        ? Math.max(0, Math.min(9999, Math.trunc(item.sortOrder)))
        : 100,
    })
  }

  if (next.length === 0 && !options?.allowEmpty) {
    return fallback
  }

  return next.sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder
    }

    return left.id.localeCompare(right.id)
  })
}

function normalizeServerConfig(
  record: PaymentGatewayStateRecord | null,
  sensitiveStateJson: string | null | undefined,
): ServerPaymentGatewayConfigData {
  const config = record?.config ?? {}
  const alipayConfig = isRecord(config.alipay) ? config.alipay : {}
  const sensitiveState = readSensitiveState(sensitiveStateJson)
  const paymentSensitiveState = isRecord(sensitiveState[PAYMENT_GATEWAY_SENSITIVE_KEY])
    ? sensitiveState[PAYMENT_GATEWAY_SENSITIVE_KEY]
    : {}
  const alipaySensitiveConfig = isRecord(paymentSensitiveState.alipay)
    ? paymentSensitiveState.alipay
    : {}

  const privateKey = normalizeNullableSecret(alipaySensitiveConfig.privateKey)
  const alipayPublicKey = normalizeNullableSecret(alipaySensitiveConfig.alipayPublicKey)
  const appCertContent = normalizeNullableSecret(alipaySensitiveConfig.appCertContent)
  const alipayPublicCertContent = normalizeNullableSecret(alipaySensitiveConfig.alipayPublicCertContent)
  const alipayRootCertContent = normalizeNullableSecret(alipaySensitiveConfig.alipayRootCertContent)

  return {
    enabled: normalizeBoolean(record?.enabled, DEFAULT_SERVER_CONFIG.enabled),
    orderExpireMinutes: typeof config.orderExpireMinutes === "number" && Number.isFinite(config.orderExpireMinutes)
      ? Math.max(5, Math.min(1440, Math.trunc(config.orderExpireMinutes)))
      : DEFAULT_SERVER_CONFIG.orderExpireMinutes,
    defaultCurrency: normalizeCurrency(config.defaultCurrency, DEFAULT_SERVER_CONFIG.defaultCurrency),
    defaultReturnPath: normalizePathOrUrl(config.defaultReturnPath, DEFAULT_SERVER_CONFIG.defaultReturnPath),
    paymentSuccessEmailNotificationEnabled: normalizeBoolean(config.paymentSuccessEmailNotificationEnabled, DEFAULT_SERVER_CONFIG.paymentSuccessEmailNotificationEnabled),
    paymentSuccessEmailRecipient: normalizeOptionalString(config.paymentSuccessEmailRecipient, DEFAULT_SERVER_CONFIG.paymentSuccessEmailRecipient, 160),
    topupEnabled: normalizeBoolean(config.topupEnabled, DEFAULT_SERVER_CONFIG.topupEnabled),
    topupPackages: normalizeTopupPackages(config.topupPackages, DEFAULT_SERVER_CONFIG.topupPackages),
    topupCustomAmountEnabled: normalizeBoolean(config.topupCustomAmountEnabled, DEFAULT_SERVER_CONFIG.topupCustomAmountEnabled),
    topupCustomMinAmountFen: typeof config.topupCustomMinAmountFen === "number" && Number.isFinite(config.topupCustomMinAmountFen)
      ? Math.max(100, Math.min(100_000_000, Math.trunc(config.topupCustomMinAmountFen)))
      : DEFAULT_SERVER_CONFIG.topupCustomMinAmountFen,
    topupCustomMaxAmountFen: typeof config.topupCustomMaxAmountFen === "number" && Number.isFinite(config.topupCustomMaxAmountFen)
      ? Math.max(100, Math.min(100_000_000, Math.trunc(config.topupCustomMaxAmountFen)))
      : DEFAULT_SERVER_CONFIG.topupCustomMaxAmountFen,
    topupCustomPointsPerYuan: typeof config.topupCustomPointsPerYuan === "number" && Number.isFinite(config.topupCustomPointsPerYuan)
      ? Math.max(1, Math.min(1_000_000, Math.trunc(config.topupCustomPointsPerYuan)))
      : DEFAULT_SERVER_CONFIG.topupCustomPointsPerYuan,
    channels: normalizeChannelToggles(config.channels, DEFAULT_SERVER_CONFIG.channels),
    routes: normalizeRouteRules(config.routes, DEFAULT_SERVER_CONFIG.routes),
    alipay: {
      sandbox: normalizeBoolean(alipayConfig.sandbox, DEFAULT_SERVER_CONFIG.alipay.sandbox),
      signMode: normalizeSignMode(alipayConfig.signMode, DEFAULT_SERVER_CONFIG.alipay.signMode),
      keyType: normalizeKeyType(alipayConfig.keyType, DEFAULT_SERVER_CONFIG.alipay.keyType),
      appId: normalizeOptionalString(alipayConfig.appId, DEFAULT_SERVER_CONFIG.alipay.appId, 64),
      sellerId: normalizeOptionalString(alipayConfig.sellerId, DEFAULT_SERVER_CONFIG.alipay.sellerId, 64),
      returnPath: normalizePathOrUrl(alipayConfig.returnPath, DEFAULT_SERVER_CONFIG.alipay.returnPath),
      notifyPath: normalizePathOrUrl(alipayConfig.notifyPath, DEFAULT_SERVER_CONFIG.alipay.notifyPath),
      privateKey,
      alipayPublicKey,
      appCertContent,
      alipayPublicCertContent,
      alipayRootCertContent,
      privateKeyConfigured: Boolean(privateKey),
      alipayPublicKeyConfigured: Boolean(alipayPublicKey),
      appCertConfigured: Boolean(appCertContent),
      alipayPublicCertConfigured: Boolean(alipayPublicCertContent),
      alipayRootCertConfigured: Boolean(alipayRootCertContent),
    },
  }
}

function toPublicConfig(config: ServerPaymentGatewayConfigData): PaymentGatewayConfigData {
  return {
    enabled: config.enabled,
    orderExpireMinutes: config.orderExpireMinutes,
    defaultCurrency: config.defaultCurrency,
    defaultReturnPath: config.defaultReturnPath,
    paymentSuccessEmailNotificationEnabled: config.paymentSuccessEmailNotificationEnabled,
    paymentSuccessEmailRecipient: config.paymentSuccessEmailRecipient,
    topupEnabled: config.topupEnabled,
    topupPackages: config.topupPackages,
    topupCustomAmountEnabled: config.topupCustomAmountEnabled,
    topupCustomMinAmountFen: config.topupCustomMinAmountFen,
    topupCustomMaxAmountFen: config.topupCustomMaxAmountFen,
    topupCustomPointsPerYuan: config.topupCustomPointsPerYuan,
    channels: config.channels,
    routes: config.routes,
    alipay: {
      sandbox: config.alipay.sandbox,
      signMode: config.alipay.signMode,
      keyType: config.alipay.keyType,
      appId: config.alipay.appId,
      sellerId: config.alipay.sellerId,
      returnPath: config.alipay.returnPath,
      notifyPath: config.alipay.notifyPath,
      privateKeyConfigured: config.alipay.privateKeyConfigured,
      alipayPublicKeyConfigured: config.alipay.alipayPublicKeyConfigured,
      appCertConfigured: config.alipay.appCertConfigured,
      alipayPublicCertConfigured: config.alipay.alipayPublicCertConfigured,
      alipayRootCertConfigured: config.alipay.alipayRootCertConfigured,
    },
  }
}

async function getOrCreatePaymentGatewaySettingsRecord() {
  const existing = await prisma.siteSetting.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      appStateJson: true,
      sensitiveStateJson: true,
    },
  })

  if (existing) {
    return existing
  }

  return prisma.siteSetting.create({
    data: defaultSiteSettingsCreateInput,
    select: {
      id: true,
      appStateJson: true,
      sensitiveStateJson: true,
    },
  })
}

export async function getServerPaymentGatewayConfig(): Promise<ServerPaymentGatewayConfigData> {
  const record = await getOrCreatePaymentGatewaySettingsRecord()
  const stateRecord = readPaymentGatewayStateRecord(record.appStateJson)
  return normalizeServerConfig(stateRecord, record.sensitiveStateJson)
}

export async function getPaymentGatewayConfig(): Promise<PaymentGatewayConfigData> {
  return toPublicConfig(await getServerPaymentGatewayConfig())
}

function buildNextStateRecord(existing: PaymentGatewayStateRecord | null, config: ServerPaymentGatewayConfigData): PaymentGatewayStateRecord {
  const installedAt = existing?.installedAt ?? new Date().toISOString()

  return {
    AppId: PAYMENT_GATEWAY_APP_KEY,
    enabled: config.enabled,
    installedAt,
    uninstalledAt: null,
    config: {
      orderExpireMinutes: config.orderExpireMinutes,
      defaultCurrency: config.defaultCurrency,
      defaultReturnPath: config.defaultReturnPath,
      paymentSuccessEmailNotificationEnabled: config.paymentSuccessEmailNotificationEnabled,
      paymentSuccessEmailRecipient: config.paymentSuccessEmailRecipient,
      topupEnabled: config.topupEnabled,
      topupPackages: config.topupPackages,
      topupCustomAmountEnabled: config.topupCustomAmountEnabled,
      topupCustomMinAmountFen: config.topupCustomMinAmountFen,
      topupCustomMaxAmountFen: config.topupCustomMaxAmountFen,
      topupCustomPointsPerYuan: config.topupCustomPointsPerYuan,
      channels: config.channels,
      routes: config.routes,
      alipay: {
        sandbox: config.alipay.sandbox,
        signMode: config.alipay.signMode,
        keyType: config.alipay.keyType,
        appId: config.alipay.appId,
        sellerId: config.alipay.sellerId,
        returnPath: config.alipay.returnPath,
        notifyPath: config.alipay.notifyPath,
      },
    },
    status: "active",
    version: existing?.version ?? "hosted",
    sourceDir: existing?.sourceDir ?? "src",
    lastActivatedAt: new Date().toISOString(),
    lastErrorAt: null,
    lastErrorMessage: null,
    failureCount: 0,
  }
}

function mergePaymentGatewayAppState(
  appStateJson: string | null | undefined,
  config: ServerPaymentGatewayConfigData,
) {
  const root = parseJsonRoot(appStateJson)
  const existing = readPaymentGatewayStateRecord(appStateJson)
  root[PAYMENT_GATEWAY_APP_KEY] = buildNextStateRecord(existing, config)
  return JSON.stringify(root)
}

function mergePaymentGatewaySensitiveState(
  sensitiveStateJson: string | null | undefined,
  config: ServerPaymentGatewayConfigData,
) {
  const root = parseJsonRoot(sensitiveStateJson)
  const state = readSensitiveState(sensitiveStateJson)

  root[SITE_SETTINGS_SENSITIVE_KEY] = {
    ...state,
    [PAYMENT_GATEWAY_SENSITIVE_KEY]: {
      alipay: {
        privateKey: normalizeNullableSecret(config.alipay.privateKey),
        alipayPublicKey: normalizeNullableSecret(config.alipay.alipayPublicKey),
        appCertContent: normalizeNullableSecret(config.alipay.appCertContent),
        alipayPublicCertContent: normalizeNullableSecret(config.alipay.alipayPublicCertContent),
        alipayRootCertContent: normalizeNullableSecret(config.alipay.alipayRootCertContent),
      },
    },
  }

  return JSON.stringify(root)
}

function hasEffectiveAlipayRoute(config: ServerPaymentGatewayConfigData) {
  const enabledChannels = new Set(
    config.channels
      .filter((item) => item.enabled && item.channelCode.startsWith("alipay."))
      .map((item) => item.channelCode),
  )

  if (enabledChannels.size === 0) {
    return false
  }

  return config.routes.some((item) => item.enabled && item.providerCode === "alipay" && enabledChannels.has(item.channelCode))
}

function assertRuntimeConfig(config: ServerPaymentGatewayConfigData) {
  if (config.paymentSuccessEmailNotificationEnabled && !config.paymentSuccessEmailRecipient) {
    apiError(400, "开启支付成功邮件通知时，必须填写接收邮箱")
  }

  if (config.paymentSuccessEmailRecipient && !isValidEmailAddress(config.paymentSuccessEmailRecipient)) {
    apiError(400, "支付成功邮件通知邮箱格式不正确")
  }

  if (!config.enabled) {
    return
  }

  if (!hasEffectiveAlipayRoute(config)) {
    return
  }

  if (!config.alipay.appId) {
    apiError(400, "支付宝 AppId 不能为空")
  }

  if (!config.alipay.privateKey) {
    apiError(400, "支付宝应用私钥不能为空")
  }

  if (config.alipay.signMode === "PUBLIC_KEY" && !config.alipay.alipayPublicKey) {
    apiError(400, "公钥模式下必须填写支付宝公钥")
  }

  if (config.alipay.signMode === "CERT" && (!config.alipay.appCertContent || !config.alipay.alipayPublicCertContent || !config.alipay.alipayRootCertContent)) {
    apiError(400, "证书模式下必须完整填写应用公钥证书、支付宝公钥证书和支付宝根证书")
  }
}

export async function resolvePaymentGatewayConfigDraftFromAdminInput(body: JsonObject): Promise<ResolvedPaymentGatewayConfigDraft> {
  const record = await getOrCreatePaymentGatewaySettingsRecord()
  const current = await getServerPaymentGatewayConfig()

  const rawConfig = body.config
  const rawSecret = body.secret
  const configInput = isRecord(rawConfig) ? rawConfig : {}
  const secretInput = isRecord(rawSecret) ? rawSecret : {}
  const alipayConfigInput = isRecord(configInput.alipay) ? configInput.alipay : {}

  const channels = normalizeChannelToggles(
    configInput.channels,
    current.channels,
  )
  const routes = normalizeRouteRules(
    configInput.routes,
    current.routes,
    { allowEmpty: Array.isArray(configInput.routes) },
  )

  const nextConfig: ServerPaymentGatewayConfigData = {
    enabled: normalizeBoolean(configInput.enabled, current.enabled),
    orderExpireMinutes: typeof configInput.orderExpireMinutes === "number" && Number.isFinite(configInput.orderExpireMinutes)
      ? Math.max(5, Math.min(1440, Math.trunc(configInput.orderExpireMinutes)))
      : current.orderExpireMinutes,
    defaultCurrency: normalizeCurrency(configInput.defaultCurrency, current.defaultCurrency),
    defaultReturnPath: normalizePathOrUrl(configInput.defaultReturnPath, current.defaultReturnPath),
    paymentSuccessEmailNotificationEnabled: normalizeBoolean(configInput.paymentSuccessEmailNotificationEnabled, current.paymentSuccessEmailNotificationEnabled),
    paymentSuccessEmailRecipient: normalizeOptionalString(configInput.paymentSuccessEmailRecipient, current.paymentSuccessEmailRecipient, 160),
    topupEnabled: normalizeBoolean(configInput.topupEnabled, current.topupEnabled),
    topupPackages: normalizeTopupPackages(
      configInput.topupPackages,
      current.topupPackages,
      { allowEmpty: Array.isArray(configInput.topupPackages) },
    ),
    topupCustomAmountEnabled: normalizeBoolean(configInput.topupCustomAmountEnabled, current.topupCustomAmountEnabled),
    topupCustomMinAmountFen: typeof configInput.topupCustomMinAmountFen === "number" && Number.isFinite(configInput.topupCustomMinAmountFen)
      ? Math.max(100, Math.min(100_000_000, Math.trunc(configInput.topupCustomMinAmountFen)))
      : current.topupCustomMinAmountFen,
    topupCustomMaxAmountFen: typeof configInput.topupCustomMaxAmountFen === "number" && Number.isFinite(configInput.topupCustomMaxAmountFen)
      ? Math.max(100, Math.min(100_000_000, Math.trunc(configInput.topupCustomMaxAmountFen)))
      : current.topupCustomMaxAmountFen,
    topupCustomPointsPerYuan: typeof configInput.topupCustomPointsPerYuan === "number" && Number.isFinite(configInput.topupCustomPointsPerYuan)
      ? Math.max(1, Math.min(1_000_000, Math.trunc(configInput.topupCustomPointsPerYuan)))
      : current.topupCustomPointsPerYuan,
    channels,
    routes,
    alipay: {
      sandbox: normalizeBoolean(alipayConfigInput.sandbox, current.alipay.sandbox),
      signMode: normalizeSignMode(alipayConfigInput.signMode, current.alipay.signMode),
      keyType: normalizeKeyType(alipayConfigInput.keyType, current.alipay.keyType),
      appId: normalizeOptionalString(alipayConfigInput.appId, current.alipay.appId, 64),
      sellerId: normalizeOptionalString(alipayConfigInput.sellerId, current.alipay.sellerId, 64),
      returnPath: normalizePathOrUrl(alipayConfigInput.returnPath, current.alipay.returnPath),
      notifyPath: normalizePathOrUrl(alipayConfigInput.notifyPath, current.alipay.notifyPath),
      privateKey: current.alipay.privateKey,
      alipayPublicKey: current.alipay.alipayPublicKey,
      appCertContent: current.alipay.appCertContent,
      alipayPublicCertContent: current.alipay.alipayPublicCertContent,
      alipayRootCertContent: current.alipay.alipayRootCertContent,
      privateKeyConfigured: current.alipay.privateKeyConfigured,
      alipayPublicKeyConfigured: current.alipay.alipayPublicKeyConfigured,
      appCertConfigured: current.alipay.appCertConfigured,
      alipayPublicCertConfigured: current.alipay.alipayPublicCertConfigured,
      alipayRootCertConfigured: current.alipay.alipayRootCertConfigured,
    },
  }

  const secretUpdates = {
    privateKey: normalizeNullableSecret(secretInput.privateKey),
    alipayPublicKey: normalizeNullableSecret(secretInput.alipayPublicKey),
    appCertContent: normalizeNullableSecret(secretInput.appCertContent),
    alipayPublicCertContent: normalizeNullableSecret(secretInput.alipayPublicCertContent),
    alipayRootCertContent: normalizeNullableSecret(secretInput.alipayRootCertContent),
  }

  const clearSecretFlags = {
    privateKey: normalizeBoolean(secretInput.clearPrivateKey, false),
    alipayPublicKey: normalizeBoolean(secretInput.clearAlipayPublicKey, false),
    appCertContent: normalizeBoolean(secretInput.clearAppCertContent, false),
    alipayPublicCertContent: normalizeBoolean(secretInput.clearAlipayPublicCertContent, false),
    alipayRootCertContent: normalizeBoolean(secretInput.clearAlipayRootCertContent, false),
  }

  nextConfig.alipay.privateKey = clearSecretFlags.privateKey
    ? null
    : (secretUpdates.privateKey || current.alipay.privateKey)
  nextConfig.alipay.alipayPublicKey = clearSecretFlags.alipayPublicKey
    ? null
    : (secretUpdates.alipayPublicKey || current.alipay.alipayPublicKey)
  nextConfig.alipay.appCertContent = clearSecretFlags.appCertContent
    ? null
    : (secretUpdates.appCertContent || current.alipay.appCertContent)
  nextConfig.alipay.alipayPublicCertContent = clearSecretFlags.alipayPublicCertContent
    ? null
    : (secretUpdates.alipayPublicCertContent || current.alipay.alipayPublicCertContent)
  nextConfig.alipay.alipayRootCertContent = clearSecretFlags.alipayRootCertContent
    ? null
    : (secretUpdates.alipayRootCertContent || current.alipay.alipayRootCertContent)
  nextConfig.alipay.privateKeyConfigured = Boolean(nextConfig.alipay.privateKey)
  nextConfig.alipay.alipayPublicKeyConfigured = Boolean(nextConfig.alipay.alipayPublicKey)
  nextConfig.alipay.appCertConfigured = Boolean(nextConfig.alipay.appCertContent)
  nextConfig.alipay.alipayPublicCertConfigured = Boolean(nextConfig.alipay.alipayPublicCertContent)
  nextConfig.alipay.alipayRootCertConfigured = Boolean(nextConfig.alipay.alipayRootCertContent)

  if (nextConfig.topupCustomMaxAmountFen < nextConfig.topupCustomMinAmountFen) {
    apiError(400, "自定义充值最大金额不能小于最小金额")
  }

  assertRuntimeConfig(nextConfig)

  return {
    record,
    config: nextConfig,
  }
}

async function persistResolvedPaymentGatewayConfigDraft(resolved: ResolvedPaymentGatewayConfigDraft) {
  await prisma.siteSetting.update({
    where: { id: resolved.record.id },
    data: {
      appStateJson: mergePaymentGatewayAppState(resolved.record.appStateJson, resolved.config),
      sensitiveStateJson: mergePaymentGatewaySensitiveState(resolved.record.sensitiveStateJson, resolved.config),
    },
  })

  return getPaymentGatewayConfig()
}

export async function resolvePaymentGatewayBaseConfigDraftFromAdminInput(body: JsonObject): Promise<ResolvedPaymentGatewayConfigDraft> {
  const record = await getOrCreatePaymentGatewaySettingsRecord()
  const current = await getServerPaymentGatewayConfig()

  const rawConfig = body.config
  const configInput = isRecord(rawConfig) ? rawConfig : {}

  const channels = normalizeChannelToggles(
    configInput.channels,
    current.channels,
  )
  const routes = normalizeRouteRules(
    configInput.routes,
    current.routes,
    { allowEmpty: Array.isArray(configInput.routes) },
  )

  const nextConfig: ServerPaymentGatewayConfigData = {
    ...current,
    enabled: normalizeBoolean(configInput.enabled, current.enabled),
    orderExpireMinutes: typeof configInput.orderExpireMinutes === "number" && Number.isFinite(configInput.orderExpireMinutes)
      ? Math.max(5, Math.min(1440, Math.trunc(configInput.orderExpireMinutes)))
      : current.orderExpireMinutes,
    defaultCurrency: normalizeCurrency(configInput.defaultCurrency, current.defaultCurrency),
    defaultReturnPath: normalizePathOrUrl(configInput.defaultReturnPath, current.defaultReturnPath),
    paymentSuccessEmailNotificationEnabled: normalizeBoolean(configInput.paymentSuccessEmailNotificationEnabled, current.paymentSuccessEmailNotificationEnabled),
    paymentSuccessEmailRecipient: normalizeOptionalString(configInput.paymentSuccessEmailRecipient, current.paymentSuccessEmailRecipient, 160),
    topupEnabled: normalizeBoolean(configInput.topupEnabled, current.topupEnabled),
    topupPackages: normalizeTopupPackages(
      configInput.topupPackages,
      current.topupPackages,
      { allowEmpty: Array.isArray(configInput.topupPackages) },
    ),
    topupCustomAmountEnabled: normalizeBoolean(configInput.topupCustomAmountEnabled, current.topupCustomAmountEnabled),
    topupCustomMinAmountFen: typeof configInput.topupCustomMinAmountFen === "number" && Number.isFinite(configInput.topupCustomMinAmountFen)
      ? Math.max(100, Math.min(100_000_000, Math.trunc(configInput.topupCustomMinAmountFen)))
      : current.topupCustomMinAmountFen,
    topupCustomMaxAmountFen: typeof configInput.topupCustomMaxAmountFen === "number" && Number.isFinite(configInput.topupCustomMaxAmountFen)
      ? Math.max(100, Math.min(100_000_000, Math.trunc(configInput.topupCustomMaxAmountFen)))
      : current.topupCustomMaxAmountFen,
    topupCustomPointsPerYuan: typeof configInput.topupCustomPointsPerYuan === "number" && Number.isFinite(configInput.topupCustomPointsPerYuan)
      ? Math.max(1, Math.min(1_000_000, Math.trunc(configInput.topupCustomPointsPerYuan)))
      : current.topupCustomPointsPerYuan,
    channels,
    routes,
  }

  if (nextConfig.topupCustomMaxAmountFen < nextConfig.topupCustomMinAmountFen) {
    apiError(400, "自定义充值最大金额不能小于最小金额")
  }

  assertRuntimeConfig(nextConfig)

  return {
    record,
    config: nextConfig,
  }
}

export async function resolvePaymentGatewayAlipayConfigDraftFromAdminInput(body: JsonObject): Promise<ResolvedPaymentGatewayConfigDraft> {
  const record = await getOrCreatePaymentGatewaySettingsRecord()
  const current = await getServerPaymentGatewayConfig()

  const rawConfig = body.config
  const rawSecret = body.secret
  const configInput = isRecord(rawConfig) ? rawConfig : {}
  const secretInput = isRecord(rawSecret) ? rawSecret : {}
  const alipayConfigInput = isRecord(configInput.alipay) ? configInput.alipay : {}

  const nextConfig: ServerPaymentGatewayConfigData = {
    ...current,
    alipay: {
      ...current.alipay,
      sandbox: normalizeBoolean(alipayConfigInput.sandbox, current.alipay.sandbox),
      signMode: normalizeSignMode(alipayConfigInput.signMode, current.alipay.signMode),
      keyType: normalizeKeyType(alipayConfigInput.keyType, current.alipay.keyType),
      appId: normalizeOptionalString(alipayConfigInput.appId, current.alipay.appId, 64),
      sellerId: normalizeOptionalString(alipayConfigInput.sellerId, current.alipay.sellerId, 64),
      returnPath: normalizePathOrUrl(alipayConfigInput.returnPath, current.alipay.returnPath),
      notifyPath: normalizePathOrUrl(alipayConfigInput.notifyPath, current.alipay.notifyPath),
    },
  }

  const secretUpdates = {
    privateKey: normalizeNullableSecret(secretInput.privateKey),
    alipayPublicKey: normalizeNullableSecret(secretInput.alipayPublicKey),
    appCertContent: normalizeNullableSecret(secretInput.appCertContent),
    alipayPublicCertContent: normalizeNullableSecret(secretInput.alipayPublicCertContent),
    alipayRootCertContent: normalizeNullableSecret(secretInput.alipayRootCertContent),
  }

  const clearSecretFlags = {
    privateKey: normalizeBoolean(secretInput.clearPrivateKey, false),
    alipayPublicKey: normalizeBoolean(secretInput.clearAlipayPublicKey, false),
    appCertContent: normalizeBoolean(secretInput.clearAppCertContent, false),
    alipayPublicCertContent: normalizeBoolean(secretInput.clearAlipayPublicCertContent, false),
    alipayRootCertContent: normalizeBoolean(secretInput.clearAlipayRootCertContent, false),
  }

  nextConfig.alipay.privateKey = clearSecretFlags.privateKey
    ? null
    : (secretUpdates.privateKey || current.alipay.privateKey)
  nextConfig.alipay.alipayPublicKey = clearSecretFlags.alipayPublicKey
    ? null
    : (secretUpdates.alipayPublicKey || current.alipay.alipayPublicKey)
  nextConfig.alipay.appCertContent = clearSecretFlags.appCertContent
    ? null
    : (secretUpdates.appCertContent || current.alipay.appCertContent)
  nextConfig.alipay.alipayPublicCertContent = clearSecretFlags.alipayPublicCertContent
    ? null
    : (secretUpdates.alipayPublicCertContent || current.alipay.alipayPublicCertContent)
  nextConfig.alipay.alipayRootCertContent = clearSecretFlags.alipayRootCertContent
    ? null
    : (secretUpdates.alipayRootCertContent || current.alipay.alipayRootCertContent)
  nextConfig.alipay.privateKeyConfigured = Boolean(nextConfig.alipay.privateKey)
  nextConfig.alipay.alipayPublicKeyConfigured = Boolean(nextConfig.alipay.alipayPublicKey)
  nextConfig.alipay.appCertConfigured = Boolean(nextConfig.alipay.appCertContent)
  nextConfig.alipay.alipayPublicCertConfigured = Boolean(nextConfig.alipay.alipayPublicCertContent)
  nextConfig.alipay.alipayRootCertConfigured = Boolean(nextConfig.alipay.alipayRootCertContent)

  assertRuntimeConfig(nextConfig)

  return {
    record,
    config: nextConfig,
  }
}

export async function updatePaymentGatewayConfigFromAdminInput(body: JsonObject) {
  return persistResolvedPaymentGatewayConfigDraft(await resolvePaymentGatewayConfigDraftFromAdminInput(body))
}

export async function updatePaymentGatewayBaseConfigFromAdminInput(body: JsonObject) {
  return persistResolvedPaymentGatewayConfigDraft(await resolvePaymentGatewayBaseConfigDraftFromAdminInput(body))
}

export async function updatePaymentGatewayAlipayConfigFromAdminInput(body: JsonObject) {
  return persistResolvedPaymentGatewayConfigDraft(await resolvePaymentGatewayAlipayConfigDraftFromAdminInput(body))
}
