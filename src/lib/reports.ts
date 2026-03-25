import { RelatedType, TargetType } from "@/db/types"


import { countReportsByStatus, createReportRecord, createReportResultNotification, findAdminReportsPage, findDuplicatedPendingReport, findReportById, findReportTargetComment, findReportTargetPost, findReportTargetUser } from "@/db/report-queries"
import { resolvePagination } from "@/db/helpers"



import type { AdminReportListResult } from "@/lib/admin-report-management"
import { getUserDisplayName } from "@/lib/users"

export const REPORT_REASON_OPTIONS = [
  "垃圾广告",
  "骚扰辱骂",
  "违规内容",
  "侵权抄袭",
  "色情低俗",
  "诈骗引流",
  "人身攻击",
  "其他",
] as const

export type ReportReasonType = (typeof REPORT_REASON_OPTIONS)[number]

export interface CreateReportInput {
  reporterId: number
  targetType: TargetType
  targetId: string
  reasonType: string
  reasonDetail?: string | null
}

async function resolveReportTarget(targetType: TargetType, targetId: string) {
  if (targetType === TargetType.POST) {
    const post = await findReportTargetPost(targetId)


    if (!post) {
      return null
    }

    return {
      title: post.title,
      description: `帖子作者：${getUserDisplayName(post.author)}`,
      href: `/posts/${post.slug}`,
      ownerUserId: null as number | null,
      relatedType: RelatedType.POST,
      relatedId: post.id,
    }
  }

  if (targetType === TargetType.COMMENT) {
    const comment = await findReportTargetComment(targetId)


    if (!comment) {
      return null
    }

    return {
      title: `评论：${comment.post.title}`,
      description: `评论人：${getUserDisplayName(comment.user)} · ${comment.content.slice(0, 56) || "无内容"}`,
      href: `/posts/${comment.post.slug}#comment-${comment.id}`,
      ownerUserId: comment.userId,
      relatedType: RelatedType.COMMENT,
      relatedId: comment.id,
    }
  }

  const user = await findReportTargetUser(targetId)


  if (!user) {
    return null
  }

  return {
    title: `用户：${getUserDisplayName(user)}`,
    description: user.bio?.slice(0, 72) || `账号 @${user.username}`,
    href: `/users/${user.username}`,
    ownerUserId: user.id,
    relatedType: RelatedType.REPORT,
    relatedId: targetId,
  }
}

export async function createReport(input: CreateReportInput) {
  const normalizedReasonType = input.reasonType.trim()
  const normalizedReasonDetail = input.reasonDetail?.trim() || null

  if (!normalizedReasonType) {
    throw new Error("请选择举报原因")
  }

  const target = await resolveReportTarget(input.targetType, input.targetId)

  if (!target) {
    throw new Error("举报目标不存在或已被删除")
  }

  if (target.ownerUserId && target.ownerUserId === input.reporterId) {
    throw new Error("不能举报自己")
  }

  const duplicatedReport = await findDuplicatedPendingReport(input.reporterId, input.targetType, input.targetId)


  if (duplicatedReport) {
    throw new Error("你已经举报过该内容，处理中请耐心等待")
  }

  return await createReportRecord({
    reporterId: input.reporterId,
    targetType: input.targetType,
    targetId: input.targetId,
    reasonType: normalizedReasonType,
    reasonDetail: normalizedReasonDetail,
  })

}

export async function getAdminReports(options: { page?: number; pageSize?: number } = {}): Promise<AdminReportListResult> {
  const [total, pending, processing, resolved, rejected] = await countReportsByStatus()
  const pagination = resolvePagination(options, total)

  const reports = await findAdminReportsPage(pagination.skip, pagination.pageSize)

  const targetSummaries = await Promise.all(reports.map((report) => resolveReportTarget(report.targetType, report.targetId)))


  return {
    reports: reports.map((report, index) => ({
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reasonType: report.reasonType,
      reasonDetail: report.reasonDetail,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
      handledAt: report.handledAt?.toISOString() ?? null,
      handledNote: report.handledNote ?? null,
      reporter: {
        id: report.reporter.id,
        username: report.reporter.username,
        displayName: getUserDisplayName(report.reporter),
      },
      handler: report.handler
        ? {
            id: report.handler.id,
            username: report.handler.username,
            displayName: getUserDisplayName(report.handler),
          }
        : null,
      targetSummary: targetSummaries[index] ?? {
        title: "目标已不存在",
        description: `原始目标 ID：${report.targetId}`,
        href: "/admin?tab=reports",
      },
    })),
    summary: {
      total,
      pending,
      processing,
      resolved,
      rejected,
    },
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages: pagination.totalPages,
      hasPrevPage: pagination.hasPrevPage,
      hasNextPage: pagination.hasNextPage,
    },

  }
}

export async function notifyReportResult(reportId: string, handledByUserId: number, passed: boolean, handledNote: string) {
  const report = await findReportById(reportId)


  if (!report) {
    return
  }

  const target = await resolveReportTarget(report.targetType, report.targetId)
  const resultLabel = passed ? "举报已成立" : "举报未通过"

  await createReportResultNotification({
    userId: report.reporterId,
    senderId: handledByUserId,
    relatedType: target?.relatedType ?? RelatedType.REPORT,
    relatedId: target?.relatedId ?? report.id,
    title: resultLabel,
    content: `${target?.title ?? "你举报的内容"}：${handledNote || (passed ? "管理员已确认违规并处理。" : "管理员复核后认为不构成违规。")}`,
  })

}
