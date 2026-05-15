"use client"

import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ShieldOff,
  ShieldQuestion,
} from "lucide-react"
import { useState } from "react"

import { AdminActionForm } from "@/components/admin/admin-action-form"
import { AdminReportDetailModal } from "@/components/admin/admin-report-detail-modal"
import { AdminSummaryStrip } from "@/components/admin/admin-summary-strip"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { serializeDate } from "@/lib/formatters"
import type { AdminReportListResult } from "@/lib/admin-report-management"
import { cn } from "@/lib/utils"

const statusLabelMap: Record<AdminReportListResult["reports"][number]["status"], string> = {
  PENDING: "待处理",
  PROCESSING: "处理中",
  RESOLVED: "已成立",
  REJECTED: "已驳回",
}

const statusClassMap: Record<AdminReportListResult["reports"][number]["status"], string> = {
  PENDING: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  PROCESSING: "border-transparent bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  RESOLVED: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  REJECTED: "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
}

export function AdminReportCenter({ data }: { data: AdminReportListResult }) {
  const [pageSize, setPageSize] = useState(String(data.pagination.pageSize))

  const cards = [
    { label: "总举报", value: data.summary.total, icon: <AlertTriangle className="h-4 w-4" /> },
    { label: "待处理", value: data.summary.pending, icon: <ShieldQuestion className="h-4 w-4" />, tone: "amber" as const },
    { label: "处理中", value: data.summary.processing, icon: <Clock3 className="h-4 w-4" />, tone: "sky" as const },
    { label: "已成立", value: data.summary.resolved, icon: <CheckCircle2 className="h-4 w-4" />, tone: "emerald" as const },
    { label: "已驳回", value: data.summary.rejected, icon: <ShieldOff className="h-4 w-4" />, tone: "slate" as const },
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
      <AdminSummaryStrip items={cards} />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>举报处理中心</CardTitle>
          <CardDescription>高密度审核视图，优先处理待处理与处理中项。</CardDescription>
          <CardAction>
            <form action="/admin" className="flex items-center gap-2">
              <input type="hidden" name="tab" value="reports" />
              <input type="hidden" name="reportPage" value="1" />
              <input type="hidden" name="reportPageSize" value={pageSize} />
              <Select value={pageSize} onValueChange={setPageSize}>
                <SelectTrigger className="h-8 w-[104px] rounded-full bg-background text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[20, 50, 100].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} / 页
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" variant="outline" size="sm" className="rounded-full px-3 text-xs">
                更新
              </Button>
            </form>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {data.reports.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              当前没有举报记录，社区状态良好。
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[150px]">状态 / 类型</TableHead>
                  <TableHead className="w-[160px]">举报人</TableHead>
                  <TableHead>举报原因</TableHead>
                  <TableHead>举报目标</TableHead>
                  <TableHead className="w-[240px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="align-top">
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <Badge className={statusClassMap[report.status]}>
                          {statusLabelMap[report.status]}
                        </Badge>
                        <p>{report.targetType}</p>
                        <p>{serializeDate(report.createdAt) ?? report.createdAt}</p>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <p className="truncate font-medium text-foreground">@{report.reporter.username}</p>
                        <p className="truncate">{report.reporter.displayName}</p>
                        <p className="truncate">{report.handler ? `处理 @${report.handler.username}` : "未分配"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="min-w-0">
                        <div className="line-clamp-1 text-sm font-medium">{report.reasonType}</div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{report.reasonDetail ?? "无补充说明"}</p>
                        {report.handledNote ? (
                          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                            处理：{report.handledNote}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="min-w-0">
                        <Link href={report.targetSummary.href} className="block line-clamp-1 text-sm font-medium hover:underline">
                          {report.targetSummary.title}
                        </Link>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {report.targetSummary.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <AdminReportDetailModal report={report} />
                        {report.status === "PENDING" ? (
                          <AdminActionForm
                            action="report.process"
                            targetId={report.id}
                            buttonText="处理中"
                            useModal
                            modalTitle="开始处理举报"
                            modalDescription={`举报对象：${report.targetSummary.title}`}
                            confirmText="开始处理"
                          />
                        ) : null}
                        {report.status !== "RESOLVED" ? (
                          <AdminActionForm
                            action="report.resolve"
                            targetId={report.id}
                            buttonText="成立"
                            tone="danger"
                            placeholder="填写处理结论，例如已下线内容、已禁言用户等"
                            useModal
                            modalTitle="确认举报成立"
                            modalDescription={`举报对象：${report.targetSummary.title}`}
                            confirmText="确认成立"
                          />
                        ) : null}
                        {report.status !== "REJECTED" ? (
                          <AdminActionForm
                            action="report.reject"
                            targetId={report.id}
                            buttonText="驳回"
                            placeholder="填写驳回说明，结果会通知举报人"
                            useModal
                            modalTitle="驳回举报"
                            modalDescription={`举报对象：${report.targetSummary.title}`}
                            confirmText="确认驳回"
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-center justify-center gap-4 py-6">
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            <span>第 {data.pagination.page} / {data.pagination.totalPages} 页</span>
            <span>每页 {data.pagination.pageSize} 条</span>
            <span>共 {data.pagination.total} 个举报</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <PaginationLink href={data.pagination.hasPrevPage ? buildPageHref(data.pagination.page - 1) : "#"} disabled={!data.pagination.hasPrevPage}>上一页</PaginationLink>
            <Badge variant="secondary" className="h-8 rounded-full px-3 text-sm">{data.pagination.page}</Badge>
            <PaginationLink href={data.pagination.hasNextPage ? buildPageHref(data.pagination.page + 1) : "#"} disabled={!data.pagination.hasNextPage}>下一页</PaginationLink>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

function PaginationLink({
  href,
  disabled,
  children,
}: {
  href: string
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-disabled={disabled}
      className={cn(
        buttonVariants({ variant: "outline", size: "default" }),
        "rounded-full px-3 text-xs",
        disabled ? "pointer-events-none opacity-40" : ""
      )}
    >
      {children}
    </Link>
  )
}
