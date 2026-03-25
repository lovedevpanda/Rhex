"use client"

import { useState } from "react"

import { AdminModal } from "@/components/admin-modal"
import { Button } from "@/components/ui/button"
import type { AdminReportItem } from "@/lib/admin-report-management"

interface AdminReportDetailModalProps {
  report: AdminReportItem
}

export function AdminReportDetailModal({ report }: AdminReportDetailModalProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant="outline" className="h-7 rounded-full px-2.5 text-xs" onClick={() => setOpen(true)}>
        详情
      </Button>
      <AdminModal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={report.reasonType}
        description={`举报对象：${report.targetSummary.title}`}
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Info label="举报状态" value={report.status} />
            <Info label="举报类型" value={report.targetType} />
            <Info label="举报人" value={`@${report.reporter.username}`} />
            <Info label="提交时间" value={new Date(report.createdAt).toLocaleString("zh-CN")} />
          </div>
          <div className="rounded-[20px] border border-border p-4">
            <p className="text-xs text-muted-foreground">举报说明</p>
            <p className="mt-2 text-sm leading-7 text-foreground/90">{report.reasonDetail ?? "举报人未补充额外说明。"}</p>
          </div>
          <div className="rounded-[20px] border border-border p-4">
            <p className="text-xs text-muted-foreground">举报目标</p>
            <a href={report.targetSummary.href} className="mt-2 block text-sm font-medium hover:underline">{report.targetSummary.title}</a>
            <p className="mt-2 text-sm text-muted-foreground">{report.targetSummary.description}</p>
          </div>
          {report.handledNote ? (
            <div className="rounded-[20px] border border-border p-4">
              <p className="text-xs text-muted-foreground">处理记录</p>
              <p className="mt-2 text-sm text-foreground/90">{report.handledNote}</p>
              <p className="mt-2 text-xs text-muted-foreground">{report.handler ? `处理人 @${report.handler.username}` : "未记录处理人"} · {report.handledAt ? new Date(report.handledAt).toLocaleString("zh-CN") : "未记录处理时间"}</p>
            </div>
          ) : null}
        </div>
      </AdminModal>
    </>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium break-all">{value}</p>
    </div>
  )
}
