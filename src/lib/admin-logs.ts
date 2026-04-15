import type { Prisma } from "@/db/types"

import {
  countAdminLogs,
  countAdminLogTabs,
  countPaymentOrders,
  countPointLogs,
  countUploadLogs,
  countUserCheckInLogs,
  countUserLoginLogs,
  countVipOrders,
  findAdminLogsPage,
  findPaymentOrdersPage,
  findPointLogsPage,
  findUploadLogsPage,
  findUserCheckInLogsPage,
  findUserLoginLogsPage,
  findVipOrdersPage,
} from "@/db/admin-log-queries"
import { serializeDate, serializeDateTime } from "@/lib/formatters"

import { normalizePageSize, normalizePositiveInteger } from "@/lib/shared/normalizers"


export type AdminLogCenterTab = "admin" | "login" | "checkins" | "points" | "uploads" | "payments" | "orders"

interface GetAdminLogCenterOptions {
  activeTab?: string
  keyword?: string
  page?: number
  pageSize?: number
  action?: string
  changeType?: string
  bucketType?: string
}

interface AdminLogCenterSummaryItem {
  key: AdminLogCenterTab
  label: string
  count: number
}

interface AdminLogCenterTabItem {
  key: AdminLogCenterTab
  label: string
  count: number
}

interface AdminLogCenterFilters {
  keyword: string
  action: string
  changeType: string
  bucketType: string
}

interface AdminLogCenterPagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

interface AdminLogRow {
  id: string
  occurredAt: string
  actorPrimary: string
  actorSecondary: string
  typePrimary: string
  typeSecondary: string
  targetPrimary: string
  targetSecondary: string
  detailPrimary: string
  detailSecondary: string
  tone: "default" | "success" | "warning" | "danger" | "info"
}

export interface AdminLogCenterResult {
  activeTab: AdminLogCenterTab
  tabs: AdminLogCenterTabItem[]
  summary: AdminLogCenterSummaryItem[]
  filters: AdminLogCenterFilters
  pagination: AdminLogCenterPagination
  rows: AdminLogRow[]
}

const LOG_TABS: Array<{ key: AdminLogCenterTab; label: string }> = [
  { key: "admin", label: "管理员日志" },
  { key: "login", label: "用户登录日志" },
  { key: "checkins", label: "签到日志" },
  { key: "points", label: "积分日志" },
  { key: "uploads", label: "上传日志" },
  { key: "payments", label: "支付流水" },
  { key: "orders", label: "VIP 订单日志" },
]



function normalizeTab(value?: string): AdminLogCenterTab {
  return LOG_TABS.some((item) => item.key === value) ? (value as AdminLogCenterTab) : "admin"
}

function buildPagination(total: number, requestedPage: number, pageSize: number): AdminLogCenterPagination {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
  }
}

function resolveAdminTone(action: string) {
  if (/ban|reject|delete|hide|down|mute/i.test(action)) {
    return "danger" as const
  }
  if (/approve|resolve|activate|promote|setadmin|vip/i.test(action)) {
    return "success" as const
  }
  if (/process|review|security/i.test(action)) {
    return "warning" as const
  }
  return "info" as const
}

function resolvePointTone(changeType: string, changeValue: number) {
  if (changeType === "EXPENSE" || changeValue < 0) {
    return "danger" as const
  }
  return "success" as const
}

function formatUserDisplay(user: { username: string; nickname: string | null } | null) {
  if (!user) {
    return {
      primary: "匿名 / 系统",
      secondary: "未关联用户",
    }
  }

  return {
    primary: user.nickname ?? user.username,
    secondary: `@${user.username}`,
  }
}

function formatCurrencyAmount(amountFen: number, currency: string) {
  return `${currency} ${(amountFen / 100).toFixed(2)}`
}

function resolvePaymentTone(status: string, fulfillmentStatus: string) {
  if (status === "FAILED") {
    return "danger" as const
  }
  if (status === "CLOSED" || status === "REFUNDING" || status === "REFUNDED") {
    return "warning" as const
  }
  if (status === "PAID" && fulfillmentStatus === "SUCCEEDED") {
    return "success" as const
  }
  if (status === "PAID" && fulfillmentStatus === "FAILED") {
    return "danger" as const
  }
  return "info" as const
}

export async function getAdminLogCenter(options: GetAdminLogCenterOptions = {}): Promise<AdminLogCenterResult> {
  const activeTab = normalizeTab(options.activeTab)
  const keyword = String(options.keyword ?? "").trim()
  const action = String(options.action ?? "ALL").trim() || "ALL"
  const changeType = String(options.changeType ?? "ALL").trim() || "ALL"
  const bucketType = String(options.bucketType ?? "ALL").trim() || "ALL"
  const requestedPage = normalizePositiveInteger(options.page, 1)
  const pageSize = normalizePageSize(options.pageSize)

  const [adminCount, loginCount, checkInCount, pointCount, uploadCount, paymentCount, orderCount] = await countAdminLogTabs()


  const summary = [
    { key: "admin" as const, label: "管理员日志", count: adminCount },
    { key: "login" as const, label: "用户登录日志", count: loginCount },
    { key: "checkins" as const, label: "签到日志", count: checkInCount },
    { key: "points" as const, label: "积分日志", count: pointCount },
    { key: "uploads" as const, label: "上传日志", count: uploadCount },
    { key: "payments" as const, label: "支付流水", count: paymentCount },
    { key: "orders" as const, label: "VIP 订单日志", count: orderCount },
  ]

  if (activeTab === "admin") {
    const where: Prisma.AdminLogWhereInput = {
      ...(action !== "ALL" ? { action } : {}),
      ...(keyword
        ? {
            OR: [
              { action: { contains: keyword, mode: "insensitive" } },
              { targetType: { contains: keyword, mode: "insensitive" } },
              { targetId: { contains: keyword, mode: "insensitive" } },
              { detail: { contains: keyword, mode: "insensitive" } },
              { admin: { username: { contains: keyword, mode: "insensitive" } } },
              { admin: { nickname: { contains: keyword, mode: "insensitive" } } },
            ],
          }
        : {}),
    }

    const total = await countAdminLogs(where)
    const pagination = buildPagination(total, requestedPage, pageSize)
    const rows = await findAdminLogsPage(where, (pagination.page - 1) * pagination.pageSize, pagination.pageSize)


    return {
      activeTab,
      tabs: LOG_TABS.map((item) => ({ key: item.key, label: item.label, count: summary.find((summaryItem) => summaryItem.key === item.key)?.count ?? 0 })),
      summary,
      filters: { keyword, action, changeType, bucketType },
      pagination,
      rows: rows.map((item) => ({
        id: item.id,
        occurredAt: serializeDateTime(item.createdAt) ?? item.createdAt.toISOString(),
        actorPrimary: item.admin.nickname ?? item.admin.username,
        actorSecondary: `@${item.admin.username}`,
        typePrimary: item.action,
        typeSecondary: item.targetType,
        targetPrimary: item.targetType,
        targetSecondary: item.targetId ?? "-",
        detailPrimary: item.detail?.trim() || "未填写附加说明",
        detailSecondary: item.ip ?? "IP 未记录",
        tone: resolveAdminTone(item.action),
      })),

    }
  }

  if (activeTab === "login") {
    const baseWhere: Prisma.UserLoginLogWhereInput = keyword
      ? {
          user: {
            OR: [
              { username: { contains: keyword, mode: "insensitive" } },
              { nickname: { contains: keyword, mode: "insensitive" } },
              { email: { contains: keyword, mode: "insensitive" } },
            ],
          },
        }
      : {}

    const total = await countUserLoginLogs(baseWhere)
    const pagination = buildPagination(total, requestedPage, pageSize)
    const rows = await findUserLoginLogsPage(baseWhere, (pagination.page - 1) * pagination.pageSize, pagination.pageSize)


    return {
      activeTab,
      tabs: LOG_TABS.map((item) => ({ key: item.key, label: item.label, count: summary.find((summaryItem) => summaryItem.key === item.key)?.count ?? 0 })),
      summary,
      filters: { keyword, action, changeType, bucketType },
      pagination,
      rows: rows.map((item) => ({
        id: item.id,
        occurredAt: item.createdAt.toISOString(),
        actorPrimary: item.user.nickname ?? item.user.username,
        actorSecondary: `@${item.user.username}`,
        typePrimary: "LOGIN",
        typeSecondary: item.user.status,
        targetPrimary: item.ip ?? "未知 IP",
        targetSecondary: item.user.email ?? "未绑定邮箱",
        detailPrimary: item.userAgent ?? "未记录 User-Agent",
        detailSecondary: item.ip ? "登录成功" : "登录成功 / IP 缺失",
        tone: "info",
      })),
    }
  }

  if (activeTab === "checkins") {
    const where: Prisma.UserCheckInLogWhereInput = {
      ...(action === "check-in" ? { isMakeUp: false } : {}),
      ...(action === "make-up" ? { isMakeUp: true } : {}),
      ...(keyword
        ? {
            OR: [
              { checkedInOn: { contains: keyword, mode: "insensitive" } },
              { user: { username: { contains: keyword, mode: "insensitive" } } },
              { user: { nickname: { contains: keyword, mode: "insensitive" } } },
            ],
          }
        : {}),
    }

    const total = await countUserCheckInLogs(where)
    const pagination = buildPagination(total, requestedPage, pageSize)
    const rows = await findUserCheckInLogsPage(where, (pagination.page - 1) * pagination.pageSize, pagination.pageSize)

    return {
      activeTab,
      tabs: LOG_TABS.map((item) => ({ key: item.key, label: item.label, count: summary.find((summaryItem) => summaryItem.key === item.key)?.count ?? 0 })),
      summary,
      filters: { keyword, action, changeType, bucketType },
      pagination,
      rows: rows.map((item) => ({
        id: item.id,
        occurredAt: serializeDateTime(item.createdAt) ?? item.createdAt.toISOString(),
        actorPrimary: item.user.nickname ?? item.user.username,
        actorSecondary: `@${item.user.username}`,
        typePrimary: item.isMakeUp ? "MAKE_UP" : "CHECK_IN",
        typeSecondary: item.isMakeUp ? "补签" : "正常签到",
        targetPrimary: item.checkedInOn,
        targetSecondary: "签到日期",
        detailPrimary: item.isMakeUp
          ? `补签获得 ${item.reward}，消耗 ${item.makeUpCost}`
          : `签到获得 ${item.reward}`,
        detailSecondary: item.isMakeUp && item.makeUpCost > 0 ? `补签成本 ${item.makeUpCost}` : "无补签成本",
        tone: item.isMakeUp ? "warning" : "success",
      })),
    }
  }

  if (activeTab === "points") {
    const where: Prisma.PointLogWhereInput = {
      ...(changeType !== "ALL" ? { changeType: changeType as Prisma.EnumChangeTypeFilter["equals"] } : {}),
      ...(keyword
        ? {
            OR: [
              { reason: { contains: keyword, mode: "insensitive" } },
              { relatedId: { contains: keyword, mode: "insensitive" } },
              { user: { username: { contains: keyword, mode: "insensitive" } } },
              { user: { nickname: { contains: keyword, mode: "insensitive" } } },
            ],
          }
        : {}),
    }

    const total = await countPointLogs(where)
    const pagination = buildPagination(total, requestedPage, pageSize)
    const rows = await findPointLogsPage(where, (pagination.page - 1) * pagination.pageSize, pagination.pageSize)


    return {
      activeTab,
      tabs: LOG_TABS.map((item) => ({ key: item.key, label: item.label, count: summary.find((summaryItem) => summaryItem.key === item.key)?.count ?? 0 })),
      summary,
      filters: { keyword, action, changeType, bucketType },
      pagination,
      rows: rows.map((item) => ({
        id: item.id,
        occurredAt: item.createdAt.toISOString(),
        actorPrimary: item.user.nickname ?? item.user.username,
        actorSecondary: `@${item.user.username}`,
        typePrimary: item.changeType,
        typeSecondary: item.relatedType ?? "SYSTEM",
        targetPrimary: `${item.changeValue > 0 ? "+" : ""}${item.changeValue}`,
        targetSecondary: item.relatedId ?? "-",
        detailPrimary: item.reason,
        detailSecondary: item.relatedType ? `关联 ${item.relatedType}` : "系统记录",
        tone: resolvePointTone(item.changeType, item.changeValue),
      })),
    }
  }

  if (activeTab === "uploads") {
    const where: Prisma.UploadWhereInput = {
      ...(bucketType !== "ALL" ? { bucketType } : {}),
      ...(keyword
        ? {
            OR: [
              { originalName: { contains: keyword, mode: "insensitive" } },
              { fileName: { contains: keyword, mode: "insensitive" } },
              { mimeType: { contains: keyword, mode: "insensitive" } },
              { user: { username: { contains: keyword, mode: "insensitive" } } },
              { user: { nickname: { contains: keyword, mode: "insensitive" } } },
            ],
          }
        : {}),
    }

    const total = await countUploadLogs(where)
    const pagination = buildPagination(total, requestedPage, pageSize)
    const rows = await findUploadLogsPage(where, (pagination.page - 1) * pagination.pageSize, pagination.pageSize)

    return {
      activeTab,
      tabs: LOG_TABS.map((item) => ({ key: item.key, label: item.label, count: summary.find((summaryItem) => summaryItem.key === item.key)?.count ?? 0 })),
      summary,
      filters: { keyword, action, changeType, bucketType },
      pagination,
      rows: rows.map((item) => ({
        id: item.id,
        occurredAt: item.createdAt.toISOString(),
        actorPrimary: item.user.nickname ?? item.user.username,
        actorSecondary: `@${item.user.username}`,
        typePrimary: item.bucketType,
        typeSecondary: item.mimeType,
        targetPrimary: item.originalName,
        targetSecondary: `${Math.max(1, Math.round(item.fileSize / 1024))} KB`,
        detailPrimary: item.urlPath,
        detailSecondary: item.fileName,
        tone: "info",
      })),
    }
  }

  if (activeTab === "payments") {
    const where: Prisma.PaymentOrderWhereInput = keyword
      ? {
          OR: [
            { merchantOrderNo: { contains: keyword, mode: "insensitive" } },
            { bizScene: { contains: keyword, mode: "insensitive" } },
            { bizOrderId: { contains: keyword, mode: "insensitive" } },
            { subject: { contains: keyword, mode: "insensitive" } },
            { providerCode: { contains: keyword, mode: "insensitive" } },
            { channelCode: { contains: keyword, mode: "insensitive" } },
            { providerTradeNo: { contains: keyword, mode: "insensitive" } },
            { lastErrorMessage: { contains: keyword, mode: "insensitive" } },
            { user: { username: { contains: keyword, mode: "insensitive" } } },
            { user: { nickname: { contains: keyword, mode: "insensitive" } } },
          ],
        }
      : {}

    const total = await countPaymentOrders(where)
    const pagination = buildPagination(total, requestedPage, pageSize)
    const rows = await findPaymentOrdersPage(where, (pagination.page - 1) * pagination.pageSize, pagination.pageSize)

    return {
      activeTab,
      tabs: LOG_TABS.map((item) => ({ key: item.key, label: item.label, count: summary.find((summaryItem) => summaryItem.key === item.key)?.count ?? 0 })),
      summary,
      filters: { keyword, action, changeType, bucketType },
      pagination,
      rows: rows.map((item) => {
        const actor = formatUserDisplay(item.user)
        const timeHints = [
          item.paidAt ? `支付 ${serializeDateTime(item.paidAt) ?? item.paidAt.toISOString()}` : null,
          item.fulfilledAt ? `到账 ${serializeDateTime(item.fulfilledAt) ?? item.fulfilledAt.toISOString()}` : null,
        ].filter(Boolean).join(" · ")

        return {
          id: item.id,
          occurredAt: serializeDateTime(item.createdAt) ?? item.createdAt.toISOString(),
          actorPrimary: actor.primary,
          actorSecondary: actor.secondary,
          typePrimary: item.status,
          typeSecondary: `${item.providerCode} / ${item.channelCode}`,
          targetPrimary: item.merchantOrderNo,
          targetSecondary: formatCurrencyAmount(item.amountFen, item.currency),
          detailPrimary: item.subject,
          detailSecondary: [
            `场景 ${item.bizScene}`,
            item.bizOrderId ? `业务单 ${item.bizOrderId}` : null,
            `履约 ${item.fulfillmentStatus}`,
            item.providerTradeNo ? `第三方流水 ${item.providerTradeNo}` : null,
            timeHints || null,
            item.lastErrorMessage ? `错误 ${item.lastErrorMessage}` : null,
          ].filter(Boolean).join(" · "),
          tone: resolvePaymentTone(item.status, item.fulfillmentStatus),
        }
      }),
    }
  }

  const where: Prisma.VipOrderWhereInput = keyword
    ? {
        OR: [
          { orderType: { contains: keyword, mode: "insensitive" } },
          { remark: { contains: keyword, mode: "insensitive" } },
          { user: { username: { contains: keyword, mode: "insensitive" } } },
          { user: { nickname: { contains: keyword, mode: "insensitive" } } },
        ],
      }
    : {}
  const total = await countVipOrders(where)
  const pagination = buildPagination(total, requestedPage, pageSize)
  const rows = await findVipOrdersPage(where, (pagination.page - 1) * pagination.pageSize, pagination.pageSize)

  return {
    activeTab,
    tabs: LOG_TABS.map((item) => ({ key: item.key, label: item.label, count: summary.find((summaryItem) => summaryItem.key === item.key)?.count ?? 0 })),
    summary,
    filters: { keyword, action, changeType, bucketType },
    pagination,
    rows: rows.map((item) => ({
      id: item.id,
      occurredAt: serializeDateTime(item.createdAt) ?? item.createdAt.toISOString(),
      actorPrimary: item.user.nickname ?? item.user.username,
      actorSecondary: `@${item.user.username}`,
      typePrimary: item.orderType,
      typeSecondary: `VIP${item.vipLevel}`,
      targetPrimary: item.amount ? `¥${item.amount / 100}` : `${item.pointsCost ?? 0} 积分`,
      targetSecondary: `${item.days} 天`,
      detailPrimary: item.remark ?? "无附加备注",
      detailSecondary: item.expiresAt ? `到期 ${serializeDate(item.expiresAt) ?? item.expiresAt.toISOString().slice(0, 10)}` : "未设置到期",
      tone: "success",
    })),

  }
}
