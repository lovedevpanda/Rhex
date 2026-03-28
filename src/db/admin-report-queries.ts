import { ReportStatus } from "@/db/types"

import { prisma } from "@/db/client"

export function markReportProcessing(reportId: string, adminUserId: number) {
  return prisma.report.update({
    where: { id: reportId },
    data: {
      status: ReportStatus.PROCESSING,
      handledBy: adminUserId,
    },
  })
}

export function resolveReport(reportId: string, adminUserId: number, handledNote: string) {
  return prisma.report.update({
    where: { id: reportId },
    data: {
      status: ReportStatus.RESOLVED,
      handledBy: adminUserId,
      handledAt: new Date(),
      handledNote,
    },
  })
}

export function rejectReport(reportId: string, adminUserId: number, handledNote: string) {
  return prisma.report.update({
    where: { id: reportId },
    data: {
      status: ReportStatus.REJECTED,
      handledBy: adminUserId,
      handledAt: new Date(),
      handledNote,
    },
  })
}
