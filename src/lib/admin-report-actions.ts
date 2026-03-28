import { markReportProcessing, rejectReport, resolveReport } from "@/db/admin-report-queries"

import { defineAdminAction, writeAdminActionLog, type AdminActionDefinition } from "@/lib/admin-action-types"
import { notifyReportResult } from "@/lib/reports"


export const adminReportActionHandlers: Record<string, AdminActionDefinition> = {
  "report.process": defineAdminAction({ targetType: "REPORT", buildDetail: () => "管理员开始处理举报" }, async (context) => {
    await markReportProcessing(context.targetId, context.adminUserId)
    await writeAdminActionLog(context, adminReportActionHandlers["report.process"].metadata)
    return { message: "举报已标记为处理中" }
  }),
  "report.resolve": defineAdminAction({ targetType: "REPORT", buildDetail: () => "管理员确认举报成立" }, async (context) => {
    await resolveReport(context.targetId, context.adminUserId, context.message || "已确认违规并处理")
    await writeAdminActionLog(context, adminReportActionHandlers["report.resolve"].metadata)
    return { message: "举报已处理完成" }
  }),
  "report.reject": defineAdminAction({ targetType: "REPORT", buildDetail: () => "管理员驳回举报" }, async (context) => {
    await rejectReport(context.targetId, context.adminUserId, context.message || "举报不成立")
    await notifyReportResult(context.targetId, context.adminUserId, false, context.message || "举报不成立")
    await writeAdminActionLog(context, adminReportActionHandlers["report.reject"].metadata)
    return { message: "举报已驳回" }
  }),

}
