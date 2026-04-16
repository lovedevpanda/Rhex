export const PAYMENT_GATEWAY_APP_KEY = "app.payment-gateway"
export const PAYMENT_GATEWAY_SENSITIVE_KEY = "paymentGatewayConfig"
export const SITE_SETTINGS_SENSITIVE_KEY = "__siteSensitiveSettings"

export const PAYMENT_GATEWAY_CLIENT_TYPES = [
  "ANY",
  "WEB_DESKTOP",
  "WEB_MOBILE",
  "QR_CODE",
  "APP",
  "MINI_APP",
] as const

export type PaymentGatewayClientType = (typeof PAYMENT_GATEWAY_CLIENT_TYPES)[number]

export const PAYMENT_GATEWAY_SIGN_MODES = [
  "PUBLIC_KEY",
  "CERT",
] as const

export type PaymentGatewaySignMode = (typeof PAYMENT_GATEWAY_SIGN_MODES)[number]

export const PAYMENT_GATEWAY_KEY_TYPES = [
  "PKCS1",
  "PKCS8",
] as const

export type PaymentGatewayKeyType = (typeof PAYMENT_GATEWAY_KEY_TYPES)[number]
export type PaymentGatewayChannelCode = string
export type PaymentGatewayProviderCode = string
export type PaymentGatewayPresentationType = "HTML_FORM" | "QR_CODE"

export interface PaymentGatewayCheckoutMethodOption {
  id: string
  providerCode: string
  channelCode: string
  label: string
  description: string
  presentationType: PaymentGatewayPresentationType
  checkoutClientType: PaymentGatewayClientType
}

export interface PaymentGatewayRouteRule {
  id: string
  scene: string
  description: string
  clientType: PaymentGatewayClientType
  providerCode: string
  channelCode: string
  priority: number
  enabled: boolean
}

export interface PaymentGatewayTopupPackage {
  id: string
  title: string
  amountFen: number
  points: number
  bonusPoints: number
  enabled: boolean
  sortOrder: number
}

export interface PaymentGatewayChannelToggle {
  channelCode: string
  enabled: boolean
}

export interface PaymentGatewayChannelDefinition {
  channelCode: string
  providerCode: string
  label: string
  description: string
  clientTypes: PaymentGatewayClientType[]
  presentationType: PaymentGatewayPresentationType
}

export interface PaymentGatewayProviderAdminEntry {
  code: string
  label: string
  description: string
  source: "builtin" | "addon"
  addonId?: string | null
  settingsHref?: string | null
  settingsLabel?: string | null
}

export interface PaymentGatewayAlipayConfigData {
  sandbox: boolean
  signMode: PaymentGatewaySignMode
  keyType: PaymentGatewayKeyType
  appId: string
  sellerId: string
  returnPath: string
  notifyPath: string
  privateKeyConfigured: boolean
  alipayPublicKeyConfigured: boolean
  appCertConfigured: boolean
  alipayPublicCertConfigured: boolean
  alipayRootCertConfigured: boolean
}

export interface ServerPaymentGatewayAlipayConfigData extends PaymentGatewayAlipayConfigData {
  privateKey: string | null
  alipayPublicKey: string | null
  appCertContent: string | null
  alipayPublicCertContent: string | null
  alipayRootCertContent: string | null
}

export interface PaymentGatewayConfigData {
  enabled: boolean
  orderExpireMinutes: number
  defaultCurrency: string
  defaultReturnPath: string
  paymentSuccessEmailNotificationEnabled: boolean
  paymentSuccessEmailRecipient: string
  topupEnabled: boolean
  topupPackages: PaymentGatewayTopupPackage[]
  topupCustomAmountEnabled: boolean
  topupCustomMinAmountFen: number
  topupCustomMaxAmountFen: number
  topupCustomPointsPerYuan: number
  channels: PaymentGatewayChannelToggle[]
  routes: PaymentGatewayRouteRule[]
  alipay: PaymentGatewayAlipayConfigData
}

export interface ServerPaymentGatewayConfigData extends Omit<PaymentGatewayConfigData, "alipay"> {
  alipay: ServerPaymentGatewayAlipayConfigData
}

export interface PaymentGatewayCheckoutPresentation {
  type: PaymentGatewayPresentationType
  html?: string
  qrCode?: string
}

export interface PaymentGatewayCheckoutResult {
  orderId: string
  merchantOrderNo: string
  status: string
  providerCode: string
  channelCode: string
  presentation: PaymentGatewayCheckoutPresentation
}

export interface PaymentGatewayAdminOrderItem {
  id: string
  merchantOrderNo: string
  bizScene: string
  bizOrderId: string | null
  subject: string
  amountFen: number
  currency: string
  clientType: string
  providerCode: string
  channelCode: string
  status: string
  fulfillmentStatus: string
  providerTradeNo: string | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  paidAt: string | null
  fulfilledAt: string | null
  createdAt: string
  userDisplayName: string
}

export interface PaymentGatewayAdminData {
  config: PaymentGatewayConfigData
  channelDefinitions: PaymentGatewayChannelDefinition[]
  providerEntries: PaymentGatewayProviderAdminEntry[]
  recentOrdersPagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
  recentOrders: PaymentGatewayAdminOrderItem[]
  clearableRecentOrderCount: number
}
