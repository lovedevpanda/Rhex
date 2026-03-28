import type { Prisma } from "@/db/types"

import {
  countAdminLogs,
  countAdminLogTabs,
  countPointLogs,
  countUserLoginLogs,
  findAdminLogsPage,
  findPointLogsPage,
  findUploadLogs,
  findUserLoginLogsPage,
  findVipOrders,
} from "@/db/admin-log-queries"
import { serializeDate, serializeDateTime } from "@/lib/formatters"

import { normalizePageSize, normalizePositiveInteger } from "@/lib/shared/normalizers"


export type AdminLogCenterTab = "admin" | "login" | "points" | "uploads" | "orders"

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
  { key: "points", label: "积分日志" },
  { key: "uploads", label: "上传日志" },
  { key: "orders", label: "订单日志" },
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

function includesKeyword(values: Array<string | null | undefined>, keyword: string) {
  if (!keyword) {
    return true
  }

  const normalized = keyword.toLowerCase()
  return values.some((value) => String(value ?? "").toLowerCase().includes(normalized))
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

export async function getAdminLogCenter(options: GetAdminLogCenterOptions = {}): Promise<AdminLogCenterResult> {
  const activeTab = normalizeTab(options.activeTab)
  const keyword = String(options.keyword ?? "").trim()
  const action = String(options.action ?? "ALL").trim() || "ALL"
  const changeType = String(options.changeType ?? "ALL").trim() || "ALL"
  const bucketType = String(options.bucketType ?? "ALL").trim() || "ALL"
  const requestedPage = normalizePositiveInteger(options.page, 1)
  const pageSize = normalizePageSize(options.pageSize)

  const [adminCount, loginCount, pointCount, uploadCount, orderCount] = await countAdminLogTabs()


  const summary = [
    { key: "admin" as const, label: "管理员日志", count: adminCount },
    { key: "login" as const, label: "用户登录日志", count: loginCount },
    { key: "points" as const, label: "积分日志", count: pointCount },
    { key: "uploads" as const, label: "上传日志", count: uploadCount },
    { key: "orders" as const, label: "订单日志", count: orderCount },
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
    const rawRows = await findUploadLogs()


    const filteredRows = rawRows.filter((item) => {
      const bucketMatched = bucketType === "ALL" || item.bucketType === bucketType
      const keywordMatched = includesKeyword([item.originalName, item.fileName, item.mimeType, item.user.username, item.user.nickname], keyword)
      return bucketMatched && keywordMatched
    })

    const pagination = buildPagination(filteredRows.length, requestedPage, pageSize)
    const rows = filteredRows.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize)

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

  const rawRows = await findVipOrders()


  const filteredRows = rawRows.filter((item) => {
    return includesKeyword([item.orderType, item.user.username, item.user.nickname, item.remark], keyword)
  })
  const pagination = buildPagination(filteredRows.length, requestedPage, pageSize)
  const rows = filteredRows.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize)

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
