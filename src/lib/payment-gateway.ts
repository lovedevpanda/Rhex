import { randomUUID } from "node:crypto"

import { PaymentAttemptStatus, PaymentFulfillmentStatus, PaymentOrderStatus, Prisma } from "@prisma/client"

import { prisma } from "@/db/client"
import { apiError } from "@/lib/api-route"
import {
  createAlipayCheckoutPresentation,
  isAlipayConfigRunnable,
  queryAlipayTradeStatus,
  readAlipayNotifyTradeStatus,
  readAlipayNotifyTradeTime,
  toAlipayResultError,
  verifyAlipayNotifySignature,
} from "@/lib/payment-gateway-alipay"
import { getPaymentGatewayConfig, getServerPaymentGatewayConfig } from "@/lib/payment-gateway-config"
import { maybeEnqueuePaymentGatewayOrderSuccessEmail, type PaymentGatewayOrderSuccessEmailSnapshot } from "@/lib/payment-gateway-email-notifications"
import { findPaymentGatewayChannelDefinition, listPaymentGatewayChannelDefinitions } from "@/lib/payment-gateway-registry"
import { POINT_LOG_EVENT_TYPES } from "@/lib/point-log-events"
import { applyPointDelta } from "@/lib/point-center"
import type {
  PaymentGatewayAdminData,
  PaymentGatewayCheckoutResult,
  PaymentGatewayCheckoutMethodOption,
  PaymentGatewayClientType,
  PaymentGatewayRouteRule,
  ServerPaymentGatewayConfigData,
} from "@/lib/payment-gateway.types"
import { getSiteSettings } from "@/lib/site-settings"
import { toAbsoluteSiteUrl } from "@/lib/site-origin"

const PAYMENT_GATEWAY_ADMIN_RECENT_ORDERS_PAGE_SIZE = 12

function formatUserDisplayName(user: { username: string; nickname: string | null } | null) {
  if (!user) {
    return "匿名 / 系统"
  }

  return user.nickname ?? user.username
}

function buildRouteWeight(route: PaymentGatewayRouteRule, scene: string, clientType: PaymentGatewayClientType) {
  let score = 0

  if (route.scene === scene) {
    score += 100
  } else if (route.scene === "*") {
    score += 10
  } else {
    return -1
  }

  if (route.clientType === clientType) {
    score += 20
  } else if (route.clientType === "ANY") {
    score += 1
  } else {
    return -1
  }

  return score
}

function buildRouteSceneWeight(route: PaymentGatewayRouteRule, scene: string) {
  if (route.scene === scene) {
    return 100
  }

  if (route.scene === "*") {
    return 10
  }

  return -1
}

function isProviderRunnable(config: ServerPaymentGatewayConfigData, providerCode: string) {
  if (providerCode === "alipay") {
    return isAlipayConfigRunnable(config.alipay)
  }

  return false
}

function listCheckoutMethodOptionsForScene(config: ServerPaymentGatewayConfigData, scene: string): PaymentGatewayCheckoutMethodOption[] {
  const enabledChannels = new Set(
    config.channels
      .filter((item) => item.enabled)
      .map((item) => item.channelCode),
  )
  const methodMap = new Map<string, PaymentGatewayCheckoutMethodOption & { sceneWeight: number; priority: number }>()

  for (const route of config.routes) {
    const sceneWeight = buildRouteSceneWeight(route, scene)
    if (!route.enabled || sceneWeight < 0 || !enabledChannels.has(route.channelCode) || !isProviderRunnable(config, route.providerCode)) {
      continue
    }

    const definition = findPaymentGatewayChannelDefinition(route.channelCode)
    if (!definition) {
      continue
    }

    const concreteClientTypes = route.clientType === "ANY"
      ? definition.clientTypes.filter((item) => item !== "ANY")
      : (definition.clientTypes.includes(route.clientType) ? [route.clientType] : [])

    for (const checkoutClientType of concreteClientTypes) {
      const key = `${definition.channelCode}:${checkoutClientType}`
      const current = methodMap.get(key)
      const next = {
        id: key,
        providerCode: definition.providerCode,
        channelCode: definition.channelCode,
        label: definition.label,
        description: route.description.trim() || definition.description,
        presentationType: definition.presentationType,
        checkoutClientType,
        sceneWeight,
        priority: route.priority,
      }

      if (!current || next.sceneWeight > current.sceneWeight || (next.sceneWeight === current.sceneWeight && next.priority < current.priority)) {
        methodMap.set(key, next)
      }
    }
  }

  return [...methodMap.values()]
    .sort((left, right) => {
      if (right.sceneWeight !== left.sceneWeight) {
        return right.sceneWeight - left.sceneWeight
      }
      if (left.priority !== right.priority) {
        return left.priority - right.priority
      }
      return left.label.localeCompare(right.label, "zh-CN")
    })
    .map((item) => ({
      id: item.id,
      providerCode: item.providerCode,
      channelCode: item.channelCode,
      label: item.label,
      description: item.description,
      presentationType: item.presentationType,
      checkoutClientType: item.checkoutClientType,
    }))
}

function resolvePaymentRoute(
  config: ServerPaymentGatewayConfigData,
  scene: string,
  clientType: PaymentGatewayClientType,
  preferredChannelCode?: string | null,
) {
  const enabledChannels = new Set(
    config.channels
      .filter((item) => item.enabled)
      .map((item) => item.channelCode),
  )

  const candidates = config.routes
    .filter((route) => route.enabled)
    .filter((route) => enabledChannels.has(route.channelCode))
    .filter((route) => !preferredChannelCode || route.channelCode === preferredChannelCode)
    .map((route) => ({
      route,
      weight: buildRouteWeight(route, scene, clientType),
    }))
    .filter((item) => item.weight >= 0)
    .sort((a, b) => {
      if (b.weight !== a.weight) {
        return b.weight - a.weight
      }

      if (a.route.priority !== b.route.priority) {
        return a.route.priority - b.route.priority
      }

      return a.route.id.localeCompare(b.route.id)
    })

  return candidates[0]?.route ?? null
}

function createMerchantOrderNo() {
  return `pay_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 20)}`
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (typeof value === "undefined") {
    return undefined
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function mapTradeStatusToOrderStatus(currentStatus: PaymentOrderStatus, tradeStatus: string) {
  switch (tradeStatus) {
    case "WAIT_BUYER_PAY":
      return PaymentOrderStatus.WAIT_BUYER_PAY
    case "TRADE_SUCCESS":
    case "TRADE_FINISHED":
      return PaymentOrderStatus.PAID
    case "TRADE_CLOSED":
      return currentStatus === PaymentOrderStatus.PAID || currentStatus === PaymentOrderStatus.REFUNDING
        ? PaymentOrderStatus.REFUNDED
        : PaymentOrderStatus.CLOSED
    default:
      return currentStatus
  }
}

async function resolveAbsoluteUrl(target: string) {
  if (/^https?:\/\//i.test(target)) {
    return target
  }

  return toAbsoluteSiteUrl(target)
}

function normalizeRuntimeClientType(value: unknown): PaymentGatewayClientType {
  if (value === "WEB_MOBILE" || value === "QR_CODE" || value === "APP" || value === "MINI_APP") {
    return value
  }

  return "WEB_DESKTOP"
}

function readPointTopupMetadata(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const root = value as Record<string, unknown>
  if (root.kind !== "points.topup") {
    return null
  }

  const points = typeof root.points === "number" && Number.isFinite(root.points)
    ? Math.max(0, Math.trunc(root.points))
    : 0
  const bonusPoints = typeof root.bonusPoints === "number" && Number.isFinite(root.bonusPoints)
    ? Math.max(0, Math.trunc(root.bonusPoints))
    : 0
  const totalPoints = typeof root.totalPoints === "number" && Number.isFinite(root.totalPoints)
    ? Math.max(0, Math.trunc(root.totalPoints))
    : points + bonusPoints

  return {
    kind: "points.topup" as const,
    packageId: typeof root.packageId === "string" ? root.packageId : "",
    title: typeof root.title === "string" ? root.title : "积分充值",
    points,
    bonusPoints,
    totalPoints,
  }
}

async function createCheckoutAttempt(params: {
  orderId: string
  providerCode: string
  channelCode: string
  attemptNo: number
  action: string
  status: PaymentAttemptStatus
  presentationType?: string | null
  requestPayloadJson?: Prisma.InputJsonValue
  responsePayloadJson?: Prisma.InputJsonValue
  providerTraceId?: string | null
  formHtml?: string | null
  qrCode?: string | null
  providerTradeNo?: string | null
  errorCode?: string | null
  errorMessage?: string | null
}) {
  return prisma.paymentAttempt.create({
    data: {
      orderId: params.orderId,
      providerCode: params.providerCode,
      channelCode: params.channelCode,
      attemptNo: params.attemptNo,
      action: params.action,
      status: params.status,
      presentationType: params.presentationType ?? null,
      requestPayloadJson: params.requestPayloadJson,
      responsePayloadJson: params.responsePayloadJson,
      providerTraceId: params.providerTraceId ?? null,
      formHtml: params.formHtml ?? null,
      qrCode: params.qrCode ?? null,
      providerTradeNo: params.providerTradeNo ?? null,
      errorCode: params.errorCode ?? null,
      errorMessage: params.errorMessage ?? null,
    },
  })
}

function normalizePaymentGatewayAdminOrdersPage(value: number | null | undefined) {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : 1
}

export async function getPaymentGatewayAdminData(options?: { page?: number | null }): Promise<PaymentGatewayAdminData> {
  const [config, totalRecentOrders, clearableRecentOrderCount] = await Promise.all([
    getPaymentGatewayConfig(),
    prisma.paymentOrder.count(),
    prisma.paymentOrder.count({
      where: {
        OR: [
          { status: PaymentOrderStatus.FAILED },
          { status: PaymentOrderStatus.CLOSED },
          { status: PaymentOrderStatus.REFUNDED },
          {
            status: PaymentOrderStatus.PAID,
            fulfillmentStatus: {
              in: [PaymentFulfillmentStatus.SUCCEEDED, PaymentFulfillmentStatus.FAILED],
            },
          },
        ],
      },
    }),
  ])

  const pageSize = PAYMENT_GATEWAY_ADMIN_RECENT_ORDERS_PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(totalRecentOrders / pageSize))
  const page = Math.min(normalizePaymentGatewayAdminOrdersPage(options?.page), totalPages)

  const orders = await prisma.paymentOrder.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        merchantOrderNo: true,
        bizScene: true,
        bizOrderId: true,
        subject: true,
        amountFen: true,
        currency: true,
        clientType: true,
        providerCode: true,
        channelCode: true,
        status: true,
        fulfillmentStatus: true,
        providerTradeNo: true,
        lastErrorCode: true,
        lastErrorMessage: true,
        paidAt: true,
        fulfilledAt: true,
        createdAt: true,
        user: {
          select: {
            username: true,
            nickname: true,
          },
        },
      },
    })

  return {
    config,
    channelDefinitions: listPaymentGatewayChannelDefinitions(),
    recentOrdersPagination: {
      page,
      pageSize,
      total: totalRecentOrders,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    },
    recentOrders: orders.map((item) => ({
      id: item.id,
      merchantOrderNo: item.merchantOrderNo,
      bizScene: item.bizScene,
      bizOrderId: item.bizOrderId,
      subject: item.subject,
      amountFen: item.amountFen,
      currency: item.currency,
      clientType: item.clientType,
      providerCode: item.providerCode,
      channelCode: item.channelCode,
      status: item.status,
      fulfillmentStatus: item.fulfillmentStatus,
      providerTradeNo: item.providerTradeNo,
      lastErrorCode: item.lastErrorCode,
      lastErrorMessage: item.lastErrorMessage,
      paidAt: item.paidAt ? item.paidAt.toISOString() : null,
      fulfilledAt: item.fulfilledAt ? item.fulfilledAt.toISOString() : null,
      createdAt: item.createdAt.toISOString(),
      userDisplayName: formatUserDisplayName(item.user),
    })),
    clearableRecentOrderCount,
  }
}

export async function clearPaymentGatewayAdminLogs() {
  const deletableOrders = await prisma.paymentOrder.findMany({
    where: {
      OR: [
        { status: PaymentOrderStatus.FAILED },
        { status: PaymentOrderStatus.CLOSED },
        { status: PaymentOrderStatus.REFUNDED },
        {
          status: PaymentOrderStatus.PAID,
          fulfillmentStatus: {
            in: [PaymentFulfillmentStatus.SUCCEEDED, PaymentFulfillmentStatus.FAILED],
          },
        },
      ],
    },
    select: {
      id: true,
    },
  })

  if (deletableOrders.length === 0) {
    return 0
  }

  const orderIds = deletableOrders.map((item) => item.id)

  await prisma.$transaction([
    prisma.paymentNotification.deleteMany({
      where: {
        orderId: {
          in: orderIds,
        },
      },
    }),
    prisma.paymentOrder.deleteMany({
      where: {
        id: {
          in: orderIds,
        },
      },
    }),
  ])

  return deletableOrders.length
}

export async function getEnabledPointTopupPackages() {
  const config = await getServerPaymentGatewayConfig()
  const paymentMethods = config.enabled && config.topupEnabled
    ? listCheckoutMethodOptionsForScene(config, "points.topup")
    : []

  return {
    enabled: config.enabled && config.topupEnabled,
    packages: config.topupPackages
      .filter((item) => item.enabled)
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder
        }

        return left.id.localeCompare(right.id)
      }),
    customAmountEnabled: config.enabled && config.topupEnabled && config.topupCustomAmountEnabled,
    customMinAmountFen: config.topupCustomMinAmountFen,
    customMaxAmountFen: config.topupCustomMaxAmountFen,
    customPointsPerYuan: config.topupCustomPointsPerYuan,
    paymentMethods,
  }
}

function findEnabledTopupPackage(config: ServerPaymentGatewayConfigData, packageId: string) {
  return config.topupPackages.find((item) => item.id === packageId && item.enabled) ?? null
}

export async function createPaymentCheckout(input: {
  userId: number
  scene: string
  bizOrderId?: string | null
  subject: string
  body?: string | null
  amountFen: number
  clientType: PaymentGatewayClientType
  preferredChannelCode?: string | null
  returnPath?: string | null
  returnPathTemplate?: string | null
  metadata?: Record<string, unknown> | null
  requestIp?: string | null
}): Promise<PaymentGatewayCheckoutResult> {
  const scene = input.scene.trim()
  if (!scene) {
    apiError(400, "支付场景不能为空")
  }

  const subject = input.subject.trim()
  if (!subject) {
    apiError(400, "订单标题不能为空")
  }

  if (!Number.isInteger(input.amountFen) || input.amountFen <= 0) {
    apiError(400, "支付金额必须大于 0")
  }

  const config = await getServerPaymentGatewayConfig()
  if (!config.enabled) {
    apiError(400, "当前支付网关未启用")
  }

  const preferredChannelCode = input.preferredChannelCode?.trim() || null
  if (preferredChannelCode && !findPaymentGatewayChannelDefinition(preferredChannelCode)) {
    apiError(400, "所选支付方式不存在")
  }

  const route = resolvePaymentRoute(config, scene, input.clientType, preferredChannelCode)
  if (!route) {
    apiError(400, preferredChannelCode ? "当前所选支付方式暂不可用，请重新选择" : "当前支付场景未配置可用路由，请联系管理员")
  }

  if (route.providerCode === "alipay" && !isAlipayConfigRunnable(config.alipay)) {
    apiError(400, "支付宝配置不完整，请联系管理员补全密钥或证书")
  }

  if (input.bizOrderId) {
    const existingPaidOrder = await prisma.paymentOrder.findFirst({
      where: {
        bizScene: scene,
        bizOrderId: input.bizOrderId,
        status: {
          in: [PaymentOrderStatus.PAID, PaymentOrderStatus.REFUNDING, PaymentOrderStatus.REFUNDED],
        },
      },
      select: {
        merchantOrderNo: true,
      },
    })

    if (existingPaidOrder) {
      apiError(409, `该业务订单已完成支付，支付单号：${existingPaidOrder.merchantOrderNo}`)
    }
  }

  const merchantOrderNo = createMerchantOrderNo()
  const expiredAt = new Date(Date.now() + config.orderExpireMinutes * 60_000)
  const effectiveReturnTarget = input.returnPathTemplate?.trim()
    ? input.returnPathTemplate.trim().replaceAll("{merchantOrderNo}", encodeURIComponent(merchantOrderNo))
    : (input.returnPath?.trim()
        ? input.returnPath.trim()
        : config.alipay.returnPath || config.defaultReturnPath)

  const order = await prisma.paymentOrder.create({
    data: {
      merchantOrderNo,
      bizScene: scene,
      bizOrderId: input.bizOrderId?.trim() || null,
      userId: input.userId,
      subject,
      body: input.body?.trim() || null,
      clientType: input.clientType,
      amountFen: input.amountFen,
      currency: config.defaultCurrency,
      providerCode: route.providerCode,
      channelCode: route.channelCode,
      routeSnapshotJson: route as unknown as Prisma.InputJsonValue,
      status: PaymentOrderStatus.PENDING,
      expiredAt,
      metadataJson: toJsonValue(input.metadata ?? undefined),
    },
    select: {
      id: true,
      merchantOrderNo: true,
      status: true,
      providerCode: true,
      channelCode: true,
    },
  })

  try {
    if (route.providerCode !== "alipay") {
      apiError(400, `当前尚未实现提供方 ${route.providerCode}`)
    }

    const notifyUrl = await resolveAbsoluteUrl(config.alipay.notifyPath)
    const returnUrl = await resolveAbsoluteUrl(effectiveReturnTarget)
    const presentation = await createAlipayCheckoutPresentation({
      channelCode: route.channelCode as "alipay.page" | "alipay.wap" | "alipay.precreate",
      merchantOrderNo,
      amountFen: input.amountFen,
      subject,
      body: input.body?.trim() || null,
      notifyUrl,
      returnUrl,
      requestIp: input.requestIp,
      timeoutMinutes: config.orderExpireMinutes,
      config: config.alipay,
    })

    await prisma.$transaction([
      prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: PaymentOrderStatus.WAIT_BUYER_PAY,
          providerTradeNo: presentation.providerTradeNo,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      }),
      prisma.paymentAttempt.create({
        data: {
          orderId: order.id,
          attemptNo: 1,
          action: "checkout",
          providerCode: route.providerCode,
          channelCode: route.channelCode,
          status: PaymentAttemptStatus.SUCCEEDED,
          presentationType: presentation.presentation.type,
          requestPayloadJson: toJsonValue(presentation.requestPayload),
          responsePayloadJson: toJsonValue(presentation.responsePayload),
          providerTraceId: presentation.providerTraceId,
          formHtml: presentation.presentation.html ?? null,
          qrCode: presentation.presentation.qrCode ?? null,
          providerTradeNo: presentation.providerTradeNo,
        },
      }),
    ])

    return {
      orderId: order.id,
      merchantOrderNo: order.merchantOrderNo,
      status: PaymentOrderStatus.WAIT_BUYER_PAY,
      providerCode: order.providerCode,
      channelCode: order.channelCode,
      presentation: presentation.presentation,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建支付订单失败"
    await prisma.$transaction([
      prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: PaymentOrderStatus.FAILED,
          lastErrorCode: "CHECKOUT_FAILED",
          lastErrorMessage: message,
        },
      }),
      prisma.paymentAttempt.create({
        data: {
          orderId: order.id,
          attemptNo: 1,
          action: "checkout",
          providerCode: route.providerCode,
          channelCode: route.channelCode,
          status: PaymentAttemptStatus.FAILED,
          errorCode: "CHECKOUT_FAILED",
          errorMessage: message,
        },
      }),
    ])

    throw error
  }
}

async function fulfillPointTopupOrder(orderId: string) {
  const settings = await getSiteSettings()
  let successEmailSnapshot: PaymentGatewayOrderSuccessEmailSnapshot | null = null

  const promoted = await prisma.paymentOrder.updateMany({
    where: {
      id: orderId,
      status: PaymentOrderStatus.PAID,
      fulfillmentStatus: {
        in: [PaymentFulfillmentStatus.PENDING, PaymentFulfillmentStatus.FAILED],
      },
      fulfilledAt: null,
    },
    data: {
      fulfillmentStatus: PaymentFulfillmentStatus.PROCESSING,
      fulfillmentErrorMessage: null,
    },
  })

  if (promoted.count === 0) {
    return
  }

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.paymentOrder.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          userId: true,
          merchantOrderNo: true,
          bizScene: true,
          subject: true,
          amountFen: true,
          currency: true,
          providerCode: true,
          channelCode: true,
          paidAt: true,
          metadataJson: true,
          fulfillmentStatus: true,
          user: {
            select: {
              username: true,
              nickname: true,
            },
          },
        },
      })

      if (!order) {
        apiError(404, "支付订单不存在")
      }

      const topup = readPointTopupMetadata(order.metadataJson)
      if (!topup) {
        await tx.paymentOrder.update({
          where: { id: orderId },
          data: {
            fulfillmentStatus: PaymentFulfillmentStatus.SUCCEEDED,
            fulfilledAt: new Date(),
            fulfillmentErrorMessage: null,
          },
        })

        successEmailSnapshot = {
          merchantOrderNo: order.merchantOrderNo,
          bizScene: order.bizScene,
          orderSubject: order.subject,
          amountFen: order.amountFen,
          currency: order.currency,
          providerCode: order.providerCode,
          channelCode: order.channelCode,
          paidAt: order.paidAt?.toISOString() ?? new Date().toISOString(),
          username: formatUserDisplayName(order.user),
          pointName: null,
          points: null,
          bonusPoints: null,
          totalPoints: null,
        }
        return
      }

      if (!order.userId) {
        apiError(400, "积分充值订单缺少用户信息")
      }

      const user = await tx.user.findUnique({
        where: { id: order.userId },
        select: {
          id: true,
          points: true,
        },
      })

      if (!user) {
        apiError(404, "用户不存在")
      }

      await applyPointDelta({
        tx,
        userId: user.id,
        beforeBalance: user.points,
        prepared: {
          scopeKey: "POINTS_TOPUP",
          baseDelta: topup.totalPoints,
          finalDelta: topup.totalPoints,
          appliedRules: [],
        },
        pointName: settings.pointName,
        reason: `积分充值到账（${topup.title} / +${topup.totalPoints}${settings.pointName}）`,
        eventType: POINT_LOG_EVENT_TYPES.POINTS_TOPUP,
        eventData: {
          kind: "points.topup",
          merchantOrderNo: order.merchantOrderNo,
          packageId: topup.packageId,
          title: topup.title,
          points: topup.points,
          bonusPoints: topup.bonusPoints,
          totalPoints: topup.totalPoints,
        },
      })

      await tx.paymentOrder.update({
        where: { id: orderId },
        data: {
          fulfillmentStatus: PaymentFulfillmentStatus.SUCCEEDED,
          fulfilledAt: new Date(),
          fulfillmentErrorMessage: null,
        },
      })

      successEmailSnapshot = {
        merchantOrderNo: order.merchantOrderNo,
        bizScene: order.bizScene,
        orderSubject: order.subject,
        amountFen: order.amountFen,
        currency: order.currency,
        providerCode: order.providerCode,
        channelCode: order.channelCode,
        paidAt: order.paidAt?.toISOString() ?? new Date().toISOString(),
        username: formatUserDisplayName(order.user),
        pointName: settings.pointName,
        points: topup.points,
        bonusPoints: topup.bonusPoints,
        totalPoints: topup.totalPoints,
      }
    })

    if (successEmailSnapshot) {
      await maybeEnqueuePaymentGatewayOrderSuccessEmail(successEmailSnapshot)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "积分充值履约失败"
    await prisma.paymentOrder.update({
      where: { id: orderId },
      data: {
        fulfillmentStatus: PaymentFulfillmentStatus.FAILED,
        fulfillmentErrorMessage: message,
      },
    })
    throw error
  }
}

async function fulfillPaymentOrderIfNeeded(orderId: string) {
  const order = await prisma.paymentOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      metadataJson: true,
    },
  })

  if (!order) {
    return
  }

  const topup = readPointTopupMetadata(order.metadataJson)
  if (topup) {
    await fulfillPointTopupOrder(order.id)
  }
}

export async function syncPaymentOrderStatusByQuery(merchantOrderNo: string) {
  const order = await prisma.paymentOrder.findUnique({
    where: { merchantOrderNo },
    select: {
      id: true,
      merchantOrderNo: true,
      status: true,
      fulfillmentStatus: true,
      fulfilledAt: true,
      providerCode: true,
      channelCode: true,
    },
  })

  if (!order) {
    apiError(404, "支付订单不存在")
  }

  if (order.providerCode !== "alipay") {
    apiError(400, "当前仅支持同步支付宝订单状态")
  }

  const config = await getServerPaymentGatewayConfig()
  if (!isAlipayConfigRunnable(config.alipay)) {
    apiError(400, "支付宝配置不完整，无法查询订单")
  }

  const result = await queryAlipayTradeStatus({
    config: config.alipay,
    merchantOrderNo,
  })

  const attemptNo = await prisma.paymentAttempt.count({
    where: {
      orderId: order.id,
    },
  }) + 1

  if (result.code !== "10000") {
    const errorMeta = toAlipayResultError(result)
    await createCheckoutAttempt({
      orderId: order.id,
      providerCode: order.providerCode,
      channelCode: order.channelCode,
      attemptNo,
      action: "query",
      status: PaymentAttemptStatus.FAILED,
      responsePayloadJson: toJsonValue(result),
      providerTraceId: typeof result.traceId === "string" ? result.traceId : null,
      errorCode: errorMeta.code,
      errorMessage: errorMeta.message,
    })
    return result
  }

  const tradeStatus = typeof result.tradeStatus === "string" ? result.tradeStatus : ""
  const nextStatus = mapTradeStatusToOrderStatus(order.status, tradeStatus)
  const paidAt = typeof result.sendPayDate === "string"
    ? new Date(result.sendPayDate.replace(" ", "T"))
    : null

  await prisma.$transaction([
    prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
        providerTradeNo: typeof result.tradeNo === "string" ? result.tradeNo : null,
        providerBuyerId: typeof result.buyerUserId === "string"
          ? result.buyerUserId
          : (typeof result.buyerOpenId === "string" ? result.buyerOpenId : null),
        paidAt: paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt : undefined,
        closedAt: tradeStatus === "TRADE_CLOSED" ? new Date() : undefined,
        rawSuccessPayloadJson: toJsonValue(result),
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    }),
    prisma.paymentAttempt.create({
      data: {
        orderId: order.id,
        attemptNo,
        action: "query",
        providerCode: order.providerCode,
        channelCode: order.channelCode,
        status: PaymentAttemptStatus.SUCCEEDED,
        responsePayloadJson: toJsonValue(result),
        providerTraceId: typeof result.traceId === "string" ? result.traceId : null,
        providerTradeNo: typeof result.tradeNo === "string" ? result.tradeNo : null,
      },
    }),
  ])

  if (nextStatus === PaymentOrderStatus.PAID) {
    await fulfillPaymentOrderIfNeeded(order.id)
  }

  return result
}

export async function handleAlipayPaymentNotification(payload: Record<string, string>) {
  const config = await getServerPaymentGatewayConfig()
  const verified = verifyAlipayNotifySignature(config.alipay, payload)
  const merchantOrderNo = payload.out_trade_no?.trim() || null

  const order = merchantOrderNo
    ? await prisma.paymentOrder.findUnique({
        where: { merchantOrderNo },
        select: {
          id: true,
          amountFen: true,
          status: true,
          fulfillmentStatus: true,
          providerCode: true,
          channelCode: true,
        },
      })
    : null

  const notification = await prisma.paymentNotification.create({
    data: {
      orderId: order?.id ?? null,
      providerCode: "alipay",
      channelCode: order?.channelCode ?? null,
      notifyType: payload.notify_type?.trim() || null,
      notifyId: payload.notify_id?.trim() || null,
      merchantOrderNo,
      providerTradeNo: payload.trade_no?.trim() || null,
      tradeStatus: payload.trade_status?.trim() || null,
      verified,
      handled: false,
      payloadJson: toJsonValue(payload) ?? Prisma.JsonNull,
    },
    select: {
      id: true,
    },
  })

  if (!verified) {
    await prisma.paymentNotification.update({
      where: { id: notification.id },
      data: {
        errorMessage: "支付宝异步通知验签失败",
      },
    })
    return false
  }

  if (!order) {
    await prisma.paymentNotification.update({
      where: { id: notification.id },
      data: {
        errorMessage: "未找到对应支付订单",
      },
    })
    return false
  }

  const appId = payload.app_id?.trim() || ""
  if (config.alipay.appId && appId && appId !== config.alipay.appId) {
    await prisma.paymentNotification.update({
      where: { id: notification.id },
      data: {
        errorMessage: "异步通知 app_id 与当前配置不匹配",
      },
    })
    return false
  }

  const sellerId = payload.seller_id?.trim() || ""
  if (config.alipay.sellerId && sellerId && sellerId !== config.alipay.sellerId) {
    await prisma.paymentNotification.update({
      where: { id: notification.id },
      data: {
        errorMessage: "异步通知 seller_id 与当前配置不匹配",
      },
    })
    return false
  }

  const totalAmount = Number(payload.total_amount ?? "0")
  const totalAmountFen = Number.isFinite(totalAmount) ? Math.round(totalAmount * 100) : -1
  if (totalAmountFen > 0 && totalAmountFen !== order.amountFen) {
    await prisma.paymentNotification.update({
      where: { id: notification.id },
      data: {
        errorMessage: "异步通知金额与订单金额不匹配",
      },
    })
    return false
  }

  const tradeStatus = readAlipayNotifyTradeStatus(payload)
  const nextStatus = mapTradeStatusToOrderStatus(order.status, tradeStatus)
  const tradeTime = readAlipayNotifyTradeTime(payload)

  await prisma.$transaction([
    prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
        providerTradeNo: payload.trade_no?.trim() || null,
        providerBuyerId: payload.buyer_id?.trim() || payload.buyer_open_id?.trim() || null,
        paidAt: tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED"
          ? (tradeTime ?? new Date())
          : undefined,
        closedAt: tradeStatus === "TRADE_CLOSED"
          ? (tradeTime ?? new Date())
          : undefined,
        rawSuccessPayloadJson: toJsonValue(payload),
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    }),
    prisma.paymentNotification.update({
      where: { id: notification.id },
      data: {
        handled: true,
        handledAt: new Date(),
        errorMessage: null,
      },
    }),
  ])

  if (nextStatus === PaymentOrderStatus.PAID) {
    await fulfillPaymentOrderIfNeeded(order.id)
  }

  return true
}

export async function createPointTopupCheckout(input: {
  userId: number
  packageId?: string | null
  customAmountFen?: number | null
  clientType: PaymentGatewayClientType
  preferredChannelCode?: string | null
  requestIp?: string | null
}) {
  const config = await getServerPaymentGatewayConfig()
  if (!config.enabled || !config.topupEnabled) {
    apiError(400, "当前未开放积分充值")
  }

  let amountFen = 0
  let title = ""
  let points = 0
  let bonusPoints = 0
  let packageId: string | null = null

  if (input.packageId?.trim()) {
    const selectedPackage = findEnabledTopupPackage(config, input.packageId.trim())
    if (!selectedPackage) {
      apiError(404, "充值套餐不存在或已下线")
    }
    amountFen = selectedPackage.amountFen
    title = selectedPackage.title
    points = selectedPackage.points
    bonusPoints = selectedPackage.bonusPoints
    packageId = selectedPackage.id
  } else {
    if (!config.topupCustomAmountEnabled) {
      apiError(400, "当前未开放自定义金额充值")
    }
    if (!Number.isInteger(input.customAmountFen) || (input.customAmountFen ?? 0) <= 0) {
      apiError(400, "自定义充值金额不正确")
    }
    if ((input.customAmountFen ?? 0) < config.topupCustomMinAmountFen || (input.customAmountFen ?? 0) > config.topupCustomMaxAmountFen) {
      apiError(400, "自定义充值金额不在允许范围内")
    }

    amountFen = input.customAmountFen ?? 0
    points = Math.max(1, Math.floor((amountFen / 100) * config.topupCustomPointsPerYuan))
    bonusPoints = 0
    title = `自定义充值 ${((amountFen / 100)).toFixed(2)} 元`
  }

  const totalPoints = points + bonusPoints
  const settings = await getSiteSettings()

  return createPaymentCheckout({
    userId: input.userId,
    scene: "points.topup",
    bizOrderId: null,
    subject: `${title} · ${totalPoints}${settings.pointName}`,
    body: `${points}${settings.pointName}${bonusPoints > 0 ? ` + 赠送 ${bonusPoints}${settings.pointName}` : ""}`,
    amountFen,
    clientType: input.clientType,
    preferredChannelCode: input.preferredChannelCode,
    returnPathTemplate: "/topup/result?merchantOrderNo={merchantOrderNo}",
    metadata: {
      kind: "points.topup",
      packageId,
      title,
      points,
      bonusPoints,
      totalPoints,
    },
    requestIp: input.requestIp,
  })
}

export async function getPaymentOrderStatusForUser(userId: number, merchantOrderNo: string) {
  const order = await prisma.paymentOrder.findUnique({
    where: { merchantOrderNo },
    select: {
      id: true,
      userId: true,
      merchantOrderNo: true,
      bizScene: true,
      amountFen: true,
      currency: true,
      status: true,
      fulfillmentStatus: true,
      fulfilledAt: true,
      providerCode: true,
      channelCode: true,
      paidAt: true,
      createdAt: true,
      metadataJson: true,
      lastErrorCode: true,
      lastErrorMessage: true,
    },
  })

  if (!order || order.userId !== userId) {
    apiError(404, "支付订单不存在")
  }

  if (order.providerCode === "alipay" && (order.status === PaymentOrderStatus.PENDING || order.status === PaymentOrderStatus.WAIT_BUYER_PAY)) {
    try {
      await syncPaymentOrderStatusByQuery(order.merchantOrderNo)
    } catch {
      // Ignore query failures here and fallback to the last persisted state.
    }
  }

  const refreshed = await prisma.paymentOrder.findUnique({
    where: { merchantOrderNo },
    select: {
      merchantOrderNo: true,
      bizScene: true,
      amountFen: true,
      currency: true,
      status: true,
      fulfillmentStatus: true,
      fulfilledAt: true,
      providerCode: true,
      channelCode: true,
      paidAt: true,
      createdAt: true,
      metadataJson: true,
      lastErrorCode: true,
      lastErrorMessage: true,
    },
  })

  if (!refreshed) {
    apiError(404, "支付订单不存在")
  }

  const topup = readPointTopupMetadata(refreshed.metadataJson)

  return {
    merchantOrderNo: refreshed.merchantOrderNo,
    bizScene: refreshed.bizScene,
    amountFen: refreshed.amountFen,
    currency: refreshed.currency,
    status: refreshed.status,
    fulfillmentStatus: refreshed.fulfillmentStatus,
    fulfilledAt: refreshed.fulfilledAt ? refreshed.fulfilledAt.toISOString() : null,
    providerCode: refreshed.providerCode,
    channelCode: refreshed.channelCode,
    paidAt: refreshed.paidAt ? refreshed.paidAt.toISOString() : null,
    createdAt: refreshed.createdAt.toISOString(),
    lastErrorCode: refreshed.lastErrorCode,
    lastErrorMessage: refreshed.lastErrorMessage,
    topup,
  }
}

export function inferCheckoutClientType(userAgent: string | null | undefined, explicitClientType?: string | null) {
  if (explicitClientType) {
    return normalizeRuntimeClientType(explicitClientType)
  }

  const normalizedUserAgent = userAgent?.toLowerCase() ?? ""
  return /android|iphone|ipad|mobile/.test(normalizedUserAgent)
    ? "WEB_MOBILE"
    : "WEB_DESKTOP"
}
