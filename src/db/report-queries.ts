import { NotificationType, RelatedType, ReportStatus, TargetType } from "@/db/types"

import { prisma } from "@/db/client"

export function findReportTargetPost(targetId: string) {
  return prisma.post.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      slug: true,
      title: true,
      author: { select: { username: true, nickname: true } },
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
      post: { select: { slug: true, title: true } },
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

export function findDuplicatedPendingReport(reporterId: number, targetType: TargetType, targetId: string) {
  return prisma.report.findFirst({
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
}) {
  return prisma.report.create({
    data,
  })
}

export function countReportsByStatus() {
  return Promise.all([
    prisma.report.count(),
    prisma.report.count({ where: { status: ReportStatus.PENDING } }),
    prisma.report.count({ where: { status: ReportStatus.PROCESSING } }),
    prisma.report.count({ where: { status: ReportStatus.RESOLVED } }),
    prisma.report.count({ where: { status: ReportStatus.REJECTED } }),
  ])
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

  return prisma.notification.create({
    data: {
      userId: data.userId,
      senderId: data.senderId,
      type: NotificationType.REPORT_RESULT,
      relatedType: data.relatedType,
      relatedId: data.relatedId,
      title: data.title,
      content: data.content,
    },
  })
}
