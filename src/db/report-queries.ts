import { RelatedType, ReportStatus, TargetType } from "@/db/types"
import { Prisma } from "@/db/types"
import type { Prisma as PrismaTypes } from "@/db/types"

import { prisma } from "@/db/client"
import { createReportResultNotification as createReportResultNotificationEntry } from "@/lib/notification-writes"

type NumericLike = bigint | number | null | undefined
type ReportQueryClient = PrismaTypes.TransactionClient | typeof prisma

function toNumber(value: NumericLike) {
  if (typeof value === "bigint") {
    return Number(value)
  }

  return Number(value ?? 0)
}

export function findReportTargetPost(targetId: string) {
  return prisma.post.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      slug: true,
      title: true,
      author: { select: { id: true, username: true, nickname: true } },
    },
  })
}

export function findReportTargetPosts(targetIds: string[]) {
  const normalizedTargetIds = [...new Set(targetIds.filter(Boolean))]

  if (normalizedTargetIds.length === 0) {
    return Promise.resolve([])
  }

  return prisma.post.findMany({
    where: {
      id: {
        in: normalizedTargetIds,
      },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      author: { select: { id: true, username: true, nickname: true } },
    },
  })
}

export function findReportTargetComment(targetId: string) {
  return prisma.comment.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      content: true,
      userId: true,
      user: { select: { username: true, nickname: true } },
      post: { select: { id: true, slug: true, title: true } },

    },
  })
}

export function findReportTargetComments(targetIds: string[]) {
  const normalizedTargetIds = [...new Set(targetIds.filter(Boolean))]

  if (normalizedTargetIds.length === 0) {
    return Promise.resolve([])
  }

  return prisma.comment.findMany({
    where: {
      id: {
        in: normalizedTargetIds,
      },
    },
    select: {
      id: true,
      content: true,
      userId: true,
      user: { select: { username: true, nickname: true } },
      post: { select: { id: true, slug: true, title: true } },
    },
  })
}

export function findReportTargetUser(targetId: string) {
  return prisma.user.findUnique({
    where: { id: Number(targetId) },
    select: {
      id: true,
      username: true,
      nickname: true,
      bio: true,
    },
  })
}

export function findReportTargetUsers(targetIds: string[]) {
  const normalizedTargetIds = [...new Set(targetIds.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))]

  if (normalizedTargetIds.length === 0) {
    return Promise.resolve([])
  }

  return prisma.user.findMany({
    where: {
      id: {
        in: normalizedTargetIds,
      },
    },
    select: {
      id: true,
      username: true,
      nickname: true,
      bio: true,
    },
  })
}

export function lockReportSubmission(tx: PrismaTypes.TransactionClient, reporterId: number, targetType: TargetType, targetId: string) {
  return tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtext('report-submit'),
      hashtext(${`${reporterId}:${targetType}:${targetId}`})
    )
  `)
}

export function findDuplicatedPendingReport(reporterId: number, targetType: TargetType, targetId: string, client: ReportQueryClient = prisma) {
  return client.report.findFirst({
    where: {
      reporterId,
      targetType,
      targetId,
      status: {
        in: [ReportStatus.PENDING, ReportStatus.PROCESSING],
      },
    },
    select: { id: true },
  })
}

export function createReportRecord(data: {
  reporterId: number
  targetType: TargetType
  targetId: string
  reasonType: string
  reasonDetail: string | null
  client?: ReportQueryClient
}) {
  const { client = prisma, ...record } = data
  return client.report.create({
    data: record,
  })
}

export function countReportsByStatus() {
  return prisma.$queryRaw<Array<{
    total: NumericLike
    pending: NumericLike
    processing: NumericLike
    resolved: NumericLike
    rejected: NumericLike
  }>>(Prisma.sql`
    SELECT
      COUNT(*) AS "total",
      COUNT(*) FILTER (WHERE status = 'PENDING') AS "pending",
      COUNT(*) FILTER (WHERE status = 'PROCESSING') AS "processing",
      COUNT(*) FILTER (WHERE status = 'RESOLVED') AS "resolved",
      COUNT(*) FILTER (WHERE status = 'REJECTED') AS "rejected"
    FROM "Report"
  `).then((rows) => {
    const row = rows[0]

    return [
      toNumber(row?.total),
      toNumber(row?.pending),
      toNumber(row?.processing),
      toNumber(row?.resolved),
      toNumber(row?.rejected),
    ] as const
  })
}

export function findAdminReportsPage(skip: number, take: number) {
  return prisma.report.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    skip,
    take,
    include: {
      reporter: {
        select: {
          id: true,
          username: true,
          nickname: true,
        },
      },
      handler: {
        select: {
          id: true,
          username: true,
          nickname: true,
        },
      },
    },
  })
}

export function findReportById(reportId: string) {
  return prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      reporterId: true,
      targetType: true,
      targetId: true,
      reasonType: true,
    },
  })
}

export function createReportResultNotification(data: {
  userId: number
  senderId: number
  relatedType: RelatedType
  relatedId: string
  title: string
  content: string
}) {
  return createReportResultNotificationEntry(data)
}
