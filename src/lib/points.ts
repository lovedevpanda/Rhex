import { ChangeType } from "@/db/types"

import { countUserPointLogs, findUserPointLogsCursor } from "@/db/point-log-queries"
import { decodeTimestampCursor, encodeTimestampCursor } from "@/lib/cursor-pagination"
import { formatDateTime } from "@/lib/formatters"
import { parsePointLogAuditTrail } from "@/lib/point-log-audit"

import { withRuntimeFallback } from "@/lib/runtime-errors"
import { normalizePositiveInteger } from "@/lib/shared/normalizers"


export interface SitePointLogItem {
  id: string
  changeType: ChangeType
  changeValue: number
  reason: string
  displayReason: string
  relatedType?: string | null
  relatedId?: string | null
  createdAt: string
  beforeBalance?: number | null
  afterBalance?: number | null
  isRedeemCode?: boolean
  pointEffect?: {
    baseValue: string
    ruleSummary: string
    deltaValue: string
  } | null
}

export interface UserPointLogsResult {
  items: SitePointLogItem[]
  pageSize: number
  total: number
  hasPrevPage: boolean
  hasNextPage: boolean
  prevCursor: string | null
  nextCursor: string | null
}

export async function getUserPointLogs(userId: number, options: { pageSize?: number; after?: string | null; before?: string | null } = {}): Promise<UserPointLogsResult> {
  const pageSize = Math.min(50, Math.max(1, normalizePositiveInteger(options.pageSize, 10)))

  return withRuntimeFallback(async () => {
    const afterCursor = decodeTimestampCursor(options.after)
    const beforeCursor = decodeTimestampCursor(options.before)
    const total = await countUserPointLogs(userId)
    const { items: logs, hasPrevPage, hasNextPage } = await findUserPointLogsCursor({
      userId,
      take: pageSize,
      after: beforeCursor ? null : afterCursor,
      before: beforeCursor,
    })


    return {
      items: logs.map((log) => ({
        ...parsePointLogAuditTrail(log.reason),
        id: log.id,
        changeType: log.changeType,
        changeValue: log.changeValue,
        reason: log.reason,
        relatedType: log.relatedType,
        relatedId: log.relatedId,
        createdAt: formatDateTime(log.createdAt),
      })),
      pageSize,
      total,
      hasPrevPage,
      hasNextPage,
      prevCursor: logs.length > 0 ? encodeTimestampCursor({ id: logs[0].id, createdAt: logs[0].createdAt.toISOString() }) : null,
      nextCursor: logs.length > 0 ? encodeTimestampCursor({ id: logs[logs.length - 1].id, createdAt: logs[logs.length - 1].createdAt.toISOString() }) : null,
    }
  }, {
    area: "points",
    action: "getUserPointLogs",
    message: "积分日志加载失败",
    metadata: { userId, after: options.after ?? null, before: options.before ?? null },
    fallback: {
      items: [],
      pageSize,
      total: 0,
      hasPrevPage: false,
      hasNextPage: false,
      prevCursor: null,
      nextCursor: null,
    },
  })
}


