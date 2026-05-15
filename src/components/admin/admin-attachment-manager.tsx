"use client"

import Link from "next/link"
import { ExternalLink, FileArchive, Filter, Loader2, Search, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

import {
  AdminFilterActions,
  AdminFilterCard,
  AdminFilterSearchField,
  AdminFilterSelectField,
} from "@/components/admin/admin-filter-card"
import { AdminSummaryStrip } from "@/components/admin/admin-summary-strip"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAdminMutation } from "@/hooks/use-admin-mutation"
import { adminPost } from "@/lib/admin-client"
import type { AdminAttachmentCleanupResult, AdminAttachmentManagementResult } from "@/lib/admin-attachments"
import type { AdminAttachmentReferenceFilter } from "@/lib/admin-attachments"
import { formatDateTime, formatNumber } from "@/lib/formatters"
import { cn } from "@/lib/utils"

interface AdminAttachmentManagerProps {
  data: AdminAttachmentManagementResult
}

const referenceOptions = [
  { value: "ALL", label: "全部引用状态" },
  { value: "REFERENCED", label: "已引用" },
  { value: "ORPHAN", label: "无引用" },
]
const pageSizeOptions = [20, 50, 100]

function formatFileSize(fileSize: number) {
  if (!fileSize || fileSize <= 0) {
    return "-"
  }

  if (fileSize >= 1024 * 1024 * 1024) {
    return `${(fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  if (fileSize >= 1024 * 1024) {
    return `${(fileSize / (1024 * 1024)).toFixed(2)} MB`
  }

  return `${Math.max(1, Math.round(fileSize / 1024))} KB`
}

function isCleanupResult(value: unknown): value is AdminAttachmentCleanupResult {
  if (!value || typeof value !== "object") {
    return false
  }

  const item = value as Partial<AdminAttachmentCleanupResult>
  return typeof item.dryRun === "boolean"
    && typeof item.scanned === "number"
    && typeof item.deletedRecords === "number"
    && typeof item.deletedFiles === "number"
    && typeof item.retainedSharedFiles === "number"
    && typeof item.failed === "number"
    && Array.isArray(item.candidates)
}

function normalizeReferenceFilter(value: string): AdminAttachmentReferenceFilter {
  return value === "REFERENCED" || value === "ORPHAN" ? value : "ALL"
}

export function AdminAttachmentManager({ data }: AdminAttachmentManagerProps) {
  const [filters, setFilters] = useState({
    keyword: data.filters.keyword,
    bucketType: data.filters.bucketType,
    referenceStatus: data.filters.referenceStatus,
    pageSize: String(data.pagination.pageSize),
  })
  const [cleanupPreview, setCleanupPreview] = useState<AdminAttachmentCleanupResult | null>(null)
  const { isPending, runMutation } = useAdminMutation()

  const bucketOptions = useMemo(() => [
    { value: "ALL", label: "全部目录" },
    ...data.bucketOptions.map((item) => ({ value: item.value, label: `${item.label} (${item.count})` })),
  ], [data.bucketOptions])

  const activeFilterBadges = useMemo(() => {
    const badges: string[] = []
    if (filters.keyword.trim()) {
      badges.push(`关键词: ${filters.keyword.trim()}`)
    }
    if (filters.bucketType !== "ALL") {
      badges.push(`目录: ${filters.bucketType}`)
    }
    if (filters.referenceStatus !== "ALL") {
      badges.push(`引用: ${referenceOptions.find((item) => item.value === filters.referenceStatus)?.label ?? filters.referenceStatus}`)
    }
    if (filters.pageSize !== "20") {
      badges.push(`每页: ${filters.pageSize} 条`)
    }

    return badges
  }, [filters])

  const baseQuery = new URLSearchParams({
    tab: "attachments",
    attachmentKeyword: data.filters.keyword,
    attachmentBucketType: data.filters.bucketType,
    attachmentReferenceStatus: data.filters.referenceStatus,
    attachmentPageSize: String(data.pagination.pageSize),
  })

  function buildHref(next: Partial<Record<string, string>>) {
    const query = new URLSearchParams(baseQuery)
    Object.entries(next).forEach(([key, value]) => {
      query.set(key, value ?? "")
    })

    return `/admin?${query.toString()}`
  }

  function buildPageHref(page: number) {
    return buildHref({ attachmentPage: String(page) })
  }

  function runCleanup(dryRun: boolean) {
    runMutation({
      mutation: () => adminPost<AdminAttachmentCleanupResult>("/api/admin/attachments", {
        action: "cleanup-orphans",
        dryRun,
        limit: 100,
        keyword: data.filters.keyword,
        bucketType: data.filters.bucketType,
      }, {
        validateData: isCleanupResult,
        invalidDataMessage: "清理结果返回格式不正确",
        defaultErrorMessage: dryRun ? "无引用资源扫描失败" : "无引用资源清理失败",
      }),
      successTitle: dryRun ? "扫描完成" : "清理完成",
      errorTitle: dryRun ? "扫描失败" : "清理失败",
      refreshRouter: !dryRun,
      onSuccess: (result) => setCleanupPreview(result.data),
    })
  }

  function deleteOne(uploadId: string) {
    runMutation({
      mutation: () => adminPost("/api/admin/attachments", {
        action: "delete-orphan",
        uploadId,
      }, {
        defaultErrorMessage: "删除资源失败",
      }),
      successTitle: "删除成功",
      errorTitle: "删除失败",
      refreshRouter: true,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <AdminSummaryStrip
        items={[
          { label: "上传资源", value: data.summary.total, icon: <FileArchive className="h-4 w-4" /> },
          { label: "已引用", value: data.summary.referenced, tone: "emerald", hint: "含内容、头像、附件等引用" },
          { label: "无引用", value: data.summary.orphan, tone: data.summary.orphan > 0 ? "amber" : "slate", hint: "可先扫描再清理" },
          { label: "占用空间", value: formatFileSize(data.summary.totalBytes), tone: "sky", hint: "当前筛选结果合计" },
        ]}
      />

      <AdminFilterCard
        title="附件管理"
        description="集中查看上传记录、引用来源和无引用资源；清理前会重新校验引用状态。"
        badge={<Badge variant="secondary" className="rounded-full">当前 {formatNumber(data.pagination.total)} 条</Badge>}
        activeBadges={activeFilterBadges}
      >
        <form className="grid gap-2 xl:grid-cols-[minmax(176px,1.7fr)_140px_140px_96px_auto] xl:items-end">
          <input type="hidden" name="tab" value="attachments" />
          <input type="hidden" name="attachmentPage" value="1" />
          <input type="hidden" name="attachmentBucketType" value={filters.bucketType} />
          <input type="hidden" name="attachmentReferenceStatus" value={filters.referenceStatus} />
          <input type="hidden" name="attachmentPageSize" value={filters.pageSize} />

          <AdminFilterSearchField
            label="关键词"
            name="attachmentKeyword"
            value={filters.keyword}
            onChange={(value) => setFilters((current) => ({ ...current, keyword: value }))}
            placeholder="文件名 / MIME / URL / 用户 / ID"
          />
          <AdminFilterSelectField
            label="上传目录"
            value={filters.bucketType}
            onValueChange={(value) => setFilters((current) => ({ ...current, bucketType: value }))}
            options={bucketOptions}
          />
          <AdminFilterSelectField
            label="引用状态"
            value={filters.referenceStatus}
            onValueChange={(value) => setFilters((current) => ({ ...current, referenceStatus: normalizeReferenceFilter(value) }))}
            options={referenceOptions}
          />
          <AdminFilterSelectField
            label="每页"
            value={filters.pageSize}
            onValueChange={(value) => setFilters((current) => ({ ...current, pageSize: value }))}
            options={pageSizeOptions.map((item) => ({ value: String(item), label: `${item} 条` }))}
          />
          <AdminFilterActions
            submitLabel="筛选"
            submitIcon={<Filter className="h-3.5 w-3.5" />}
            resetHref="/admin?tab=attachments"
          />
        </form>
      </AdminFilterCard>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>无引用资源清理</CardTitle>
          <CardDescription>默认按当前关键词和目录筛选扫描前 100 个无引用候选；执行清理前会再次校验引用，避免误删。</CardDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="outline" className="rounded-full" disabled={isPending} onClick={() => runCleanup(true)}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              扫描无引用
            </Button>
            <Button type="button" variant="destructive" className="rounded-full" disabled={isPending || data.summary.orphan === 0} onClick={() => runCleanup(false)}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              清理无引用
            </Button>
          </div>
        </CardHeader>
        {cleanupPreview ? (
          <CardContent className="flex flex-wrap gap-2 py-3 text-sm text-muted-foreground">
            <Badge variant="outline" className="rounded-full">扫描 {cleanupPreview.scanned} 条</Badge>
            <Badge variant="outline" className="rounded-full">候选 {cleanupPreview.candidates.length} 条</Badge>
            <Badge variant="outline" className="rounded-full">删除记录 {cleanupPreview.deletedRecords} 条</Badge>
            <Badge variant="outline" className="rounded-full">删除文件 {cleanupPreview.deletedFiles} 个</Badge>
            {cleanupPreview.retainedSharedFiles > 0 ? <Badge variant="outline" className="rounded-full">共享保留 {cleanupPreview.retainedSharedFiles} 个</Badge> : null}
            {cleanupPreview.failed > 0 ? <Badge variant="destructive" className="rounded-full">失败 {cleanupPreview.failed} 条</Badge> : null}
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardContent className="px-0 py-0">
          {data.rows.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下没有上传资源。</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[220px]">文件</TableHead>
                  <TableHead className="w-[140px]">目录 / 类型</TableHead>
                  <TableHead className="w-[160px]">上传人</TableHead>
                  <TableHead className="w-[160px]">引用</TableHead>
                  <TableHead>路径</TableHead>
                  <TableHead className="w-[120px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="align-top">
                      <div className="min-w-0 space-y-1">
                        <div className="line-clamp-1 text-sm font-medium">{item.originalName}</div>
                        <div className="truncate text-xs text-muted-foreground">{item.fileName}</div>
                        <div className="text-xs text-muted-foreground">{formatFileSize(item.fileSize)} · {formatDateTime(item.createdAt)}</div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <Badge variant="secondary" className="rounded-full">{item.bucketType}</Badge>
                        <div className="truncate text-xs text-muted-foreground">{item.mimeType}</div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="min-w-0 space-y-1">
                        <div className="truncate text-sm font-medium">{item.userName}</div>
                        <div className="truncate text-xs text-muted-foreground">{item.userHandle}</div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <Badge className={item.referenceStatus === "REFERENCED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"}>
                          {item.referenceStatus === "REFERENCED" ? `已引用 ${item.referenceCount}` : "无引用"}
                        </Badge>
                        <div className="line-clamp-2 text-xs text-muted-foreground">
                          {item.referenceSources.length > 0 ? item.referenceSources.join(" / ") : "暂无引用来源"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="min-w-0 space-y-1">
                        <Link href={item.urlPath} target="_blank" className="line-clamp-1 text-sm font-medium hover:underline">
                          {item.urlPath}
                        </Link>
                        <div className="line-clamp-1 text-xs text-muted-foreground">{item.storagePath}</div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={item.urlPath} target="_blank" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full px-2")}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                        <Button type="button" variant="destructive" size="sm" className="rounded-full px-2" disabled={isPending || item.referenceStatus !== "ORPHAN"} onClick={() => deleteOne(item.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>第 {data.pagination.page} / {data.pagination.totalPages} 页</span>
            <span>每页 {data.pagination.pageSize} 条</span>
            <span>共 {data.pagination.total} 条资源</span>
          </div>
          <div className="flex items-center gap-2">
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
        disabled ? "pointer-events-none opacity-40" : "",
      )}
    >
      {children}
    </Link>
  )
}
