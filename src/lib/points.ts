import { ChangeType } from "@/db/types"

import { prisma } from "@/db/client"
import { formatDateTime } from "@/lib/formatters"
import { normalizePositiveInteger } from "@/lib/shared/normalizers"

export interface SitePointLogItem {
  id: string
  changeType: ChangeType
  changeValue: number
  reason: string
  relatedType?: string | null
  relatedId?: string | null
  createdAt: string
  isRedeemCode?: boolean
}

export interface UserPointLogsResult {
  items: SitePointLogItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export async function getUserPointLogs(userId: number, options: { page?: number; pageSize?: number } = {}): Promise<UserPointLogsResult> {
  const pageSize = 10
  const requestedPage = normalizePositiveInteger(options.page, 1)

  try {
    const total = await prisma.pointLog.count({
      where: { userId },
    })
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const page = Math.min(requestedPage, totalPages)
    const logs = await prisma.pointLog.findMany({
      where: { userId },
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return {
      items: logs.map((log) => ({
        id: log.id,
        changeType: log.changeType,
        changeValue: log.changeValue,
        reason: log.reason,
        relatedType: log.relatedType,
        relatedId: log.relatedId,
        createdAt: formatDateTime(log.createdAt),
      })),
      page,
      pageSize,
      total,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      page: 1,
      pageSize,
      total: 0,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
    }
  }
}

