"use client"

import Link from "next/link"
import { AlertTriangle, CheckCircle2, Clock3, ShieldOff, ShieldQuestion } from "lucide-react"

import { AdminActionForm } from "@/components/admin-action-form"
import { AdminReportDetailModal } from "@/components/admin-report-detail-modal"
import type { AdminReportListResult } from "@/lib/admin-report-management"

const statusLabelMap: Record<AdminReportListResult["reports"][number]["status"], string> = {
  PENDING: "待处理",
  PROCESSING: "处理中",
  RESOLVED: "已成立",
  REJECTED: "已驳回",
}

const statusClassMap: Record<AdminReportListResult["reports"][number]["status"], string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  PROCESSING: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  RESOLVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  REJECTED: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300",
}

export function AdminReportCenter({ data }: { data: AdminReportListResult }) {
  const cards = [
    { label: "总举报", value: data.summary.total, icon: <AlertTriangle className="h-4 w-4" /> },
    { label: "待处理", value: data.summary.pending, icon: <ShieldQuestion className="h-4 w-4" /> },
    { label: "处理中", value: data.summary.processing, icon: <Clock3 className="h-4 w-4" /> },
    { label: "已成立", value: data.summary.resolved, icon: <CheckCircle2 className="h-4 w-4" /> },
    { label: "已驳回", value: data.summary.rejected, icon: <ShieldOff className="h-4 w-4" /> },
  ]

  function buildPageHref(page: number) {
    const search = new URLSearchParams({
      tab: "reports",
      reportPage: String(page),
      reportPageSize: String(data.pagination.pageSize),
    })
    return `/admin?${search.toString()}`
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-[18px] border border-border bg-card px-4 py-3">
            <div className="flex items-center justify-between gap-3 text-muted-foreground">
              <span className="text-xs">{card.label}</span>
              {card.icon}
            </div>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[22px] border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">举报处理中心</h3>
            <p className="mt-1 text-xs text-muted-foreground">高密度审核视图，优先处理待处理与处理中项。</p>
          </div>
          <div className="flex items-center gap-2">
            <select defaultValue={String(data.pagination.pageSize)} onChange={(event) => { window.location.href = `/admin?tab=reports&reportPage=1&reportPageSize=${event.target.value}` }} className="h-8 rounded-full border border-border bg-background px-3 text-xs outline-none">
              {[20, 50, 100].map((size) => <option key={size} value={size}>{size} / 页</option>)}
            </select>
            <span className="rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">共 {data.pagination.total} 条举报</span>
          </div>
        </div>

        <div className="grid items-center gap-3 border-b border-border bg-secondary/40 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground lg:grid-cols-[110px_110px_minmax(0,1.15fr)_minmax(0,1fr)_240px]">
          <span>状态/类型</span>
          <span>举报人</span>
          <span>举报原因</span>
          <span>举报目标</span>
          <span className="text-right">操作</span>
        </div>

        {data.reports.length === 0 ? <div className="px-6 py-12 text-center text-sm text-muted-foreground">当前没有举报记录，社区状态良好。</div> : null}

        {data.reports.map((report) => (
          <div key={report.id} className="grid items-center gap-3 border-b border-border px-4 py-3 text-xs last:border-b-0 lg:grid-cols-[110px_110px_minmax(0,1.15fr)_minmax(0,1fr)_240px]">
            <div className="space-y-1 text-muted-foreground">
              <span className={`inline-flex rounded-full px-2 py-0.5 ${statusClassMap[report.status]}`}>{statusLabelMap[report.status]}</span>
              <div>{report.targetType}</div>
              <div>{new Date(report.createdAt).toLocaleDateString("zh-CN")}</div>
            </div>

            <div className="space-y-1 text-muted-foreground">
              <div className="font-medium text-foreground truncate">@{report.reporter.username}</div>
              <div className="truncate">{report.reporter.displayName}</div>
              <div className="truncate">{report.handler ? `处理 @${report.handler.username}` : "未分配"}</div>
            </div>

            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{report.reasonType}</div>
              <p className="mt-1 truncate text-muted-foreground">{report.reasonDetail ?? "无补充说明"}</p>
              {report.handledNote ? <p className="mt-1 truncate text-[11px] text-muted-foreground">处理：{report.handledNote}</p> : null}
            </div>

            <div className="min-w-0">
              <Link href={report.targetSummary.href} className="block truncate text-sm font-medium hover:underline">{report.targetSummary.title}</Link>
              <p className="mt-1 truncate text-muted-foreground">{report.targetSummary.description}</p>
            </div>

            <div className="flex flex-wrap justify-end gap-1.5">
              <AdminReportDetailModal report={report} />
              {report.status === "PENDING" ? <AdminActionForm action="report.process" targetId={report.id} buttonText="处理中" useModal modalTitle="开始处理举报" modalDescription={`举报对象：${report.targetSummary.title}`} confirmText="开始处理" /> : null}
              {report.status !== "RESOLVED" ? <AdminActionForm action="report.resolve" targetId={report.id} buttonText="成立" tone="danger" placeholder="填写处理结论，例如已下线内容、已禁言用户等" useModal modalTitle="确认举报成立" modalDescription={`举报对象：${report.targetSummary.title}`} confirmText="确认成立" /> : null}
              {report.status !== "REJECTED" ? <AdminActionForm action="report.reject" targetId={report.id} buttonText="驳回" placeholder="填写驳回说明，结果会通知举报人" useModal modalTitle="驳回举报" modalDescription={`举报对象：${report.targetSummary.title}`} confirmText="确认驳回" /> : null}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/20 px-4 py-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <span>第 {data.pagination.page} / {data.pagination.totalPages} 页</span>
            <span>每页 {data.pagination.pageSize} 条</span>
            <span>共 {data.pagination.total} 条举报</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={data.pagination.hasPrevPage ? buildPageHref(data.pagination.page - 1) : "#"} aria-disabled={!data.pagination.hasPrevPage} className={data.pagination.hasPrevPage ? "inline-flex h-8 items-center justify-center rounded-full border border-border bg-card px-3 font-medium transition-colors hover:bg-accent hover:text-accent-foreground" : "inline-flex h-8 items-center justify-center rounded-full border border-border px-3 opacity-40 pointer-events-none"}>上一页</Link>
            <span className="inline-flex h-8 items-center rounded-full bg-accent px-3 font-medium text-foreground">{data.pagination.page}</span>
            <Link href={data.pagination.hasNextPage ? buildPageHref(data.pagination.page + 1) : "#"} aria-disabled={!data.pagination.hasNextPage} className={data.pagination.hasNextPage ? "inline-flex h-8 items-center justify-center rounded-full border border-border bg-card px-3 font-medium transition-colors hover:bg-accent hover:text-accent-foreground" : "inline-flex h-8 items-center justify-center rounded-full border border-border px-3 opacity-40 pointer-events-none"}>下一页</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
