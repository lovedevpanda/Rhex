"use client"

import Link from "next/link"
import {
  AdminFilterActions,
  AdminFilterCard,
  AdminFilterSearchField,
  AdminFilterSelectField,
} from "@/components/admin/admin-filter-card"
import {
  Activity,
  CalendarDays,
  CreditCard,
  FileClock,
  LogIn,
  ReceiptText,
  ShieldCheck,
} from "lucide-react"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { AdminSummaryStrip } from "@/components/admin/admin-summary-strip"
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTime, formatNumber } from "@/lib/formatters"
import type { AdminLogCenterResult } from "@/lib/admin-logs"
import { cn } from "@/lib/utils"

interface AdminLogCenterProps {
  data: AdminLogCenterResult
}

const pageSizeOptions = [20, 50, 100]
const actionOptions = [
  { value: "ALL", label: "全部动作" },
  { value: "report.resolve", label: "举报成立" },
  { value: "report.reject", label: "举报驳回" },
  { value: "user.ban", label: "用户封禁" },
  { value: "user.mute", label: "用户禁言" },
  { value: "post.approve", label: "帖子通过" },
  { value: "post.reject", label: "帖子驳回" },
]
const checkInActionOptions = [
  { value: "ALL", label: "全部动作" },
  { value: "check-in", label: "正常签到" },
  { value: "make-up", label: "补签" },
]
const pointTypeOptions = [
  { value: "ALL", label: "全部变动" },
  { value: "INCOME", label: "收入" },
  { value: "EXPENSE", label: "支出" },
]
const bucketTypeOptions = [
  { value: "ALL", label: "全部目录" },
  { value: "avatars", label: "头像" },
  { value: "posts", label: "帖子图片" },
  { value: "icon", label: "图标" },
]
const tabIcons = {
  admin: ShieldCheck,
  login: LogIn,
  checkins: CalendarDays,
  points: Activity,
  uploads: FileClock,
  payments: CreditCard,
  orders: ReceiptText,
} as const

const toneClassMap = {
  default: "bg-secondary text-foreground",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
} as const

export function AdminLogCenter({ data }: AdminLogCenterProps) {
  const [filters, setFilters] = useState({
    keyword: data.filters.keyword,
    action: data.filters.action,
    changeType: data.filters.changeType,
    bucketType: data.filters.bucketType,
    pageSize: String(data.pagination.pageSize),
  })

  const activeActionOptions = data.activeTab === "checkins" ? checkInActionOptions : actionOptions
  const actionLabel = data.activeTab === "checkins" ? "签到动作" : "管理员动作"
  const actionDisabled = data.activeTab !== "admin" && data.activeTab !== "checkins"

  const activeFilterBadges = useMemo(() => {
    const badges: string[] = []

    if (filters.keyword.trim()) {
      badges.push(`关键词: ${filters.keyword.trim()}`)
    }
    if (filters.action !== "ALL" && !actionDisabled) {
      badges.push(`${actionLabel}: ${activeActionOptions.find((item) => item.value === filters.action)?.label ?? filters.action}`)
    }
    if (filters.changeType !== "ALL" && data.activeTab === "points") {
      badges.push(`积分类型: ${pointTypeOptions.find((item) => item.value === filters.changeType)?.label ?? filters.changeType}`)
    }
    if (filters.bucketType !== "ALL" && data.activeTab === "uploads") {
      badges.push(`上传目录: ${bucketTypeOptions.find((item) => item.value === filters.bucketType)?.label ?? filters.bucketType}`)
    }
    if (filters.pageSize !== "20") {
      badges.push(`每页: ${filters.pageSize} 条`)
    }

    return badges
  }, [actionDisabled, actionLabel, activeActionOptions, data.activeTab, filters])

  const baseQuery = new URLSearchParams({
    tab: "logs",
    logSubTab: data.activeTab,
    logKeyword: data.filters.keyword,
    logAction: data.filters.action,
    logChangeType: data.filters.changeType,
    logBucketType: data.filters.bucketType,
    logPageSize: String(data.pagination.pageSize),
  })

  function buildHref(next: Partial<Record<string, string>>) {
    const query = new URLSearchParams(baseQuery)
    Object.entries(next).forEach(([key, value]) => {
      query.set(key, value ?? "")
    })

    return `/admin?${query.toString()}`
  }

  function buildPageHref(page: number) {
    return buildHref({ logPage: String(page) })
  }

  return (
    <div className="space-y-4">
      <AdminSummaryStrip
        items={data.summary.map((card) => {
          const Icon = tabIcons[card.key]
          return {
            key: card.key,
            label: card.label,
            value: card.count,
            icon: <Icon className="h-4 w-4" />,
          }
        })}
      />

      <AdminFilterCard
        title="日志中心"
        description="按日志类型独立分页与筛选，适合日常巡检与快速追溯。"
        badge={<Badge variant="secondary" className="rounded-full">当前共 {formatNumber(data.pagination.total)} 条</Badge>}
        activeBadges={activeFilterBadges}
      >
          <div className="flex flex-wrap gap-2">
            {data.tabs.map((item) => {
              const Icon = tabIcons[item.key]
              const active = item.key === data.activeTab
              return (
                <Link
                  key={item.key}
                  href={buildHref({ logSubTab: item.key, logPage: "1" })}
                  className={cn(
                    buttonVariants({ variant: active ? "default" : "outline", size: "default" }),
                    "rounded-full px-4 text-xs"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                  <span className={active ? "text-background/70" : "text-muted-foreground"}>{item.count}</span>
                </Link>
              )
            })}
          </div>

          <form className="grid gap-2 xl:grid-cols-[minmax(176px,1.7fr)_118px_108px_108px_84px_auto] xl:items-end">
            <input type="hidden" name="tab" value="logs" />
            <input type="hidden" name="logSubTab" value={data.activeTab} />
            <input type="hidden" name="logPage" value="1" />
            <input type="hidden" name="logAction" value={filters.action} />
            <input type="hidden" name="logChangeType" value={filters.changeType} />
            <input type="hidden" name="logBucketType" value={filters.bucketType} />
            <input type="hidden" name="logPageSize" value={filters.pageSize} />

            <AdminFilterSearchField
              label="关键词"
              name="logKeyword"
              value={filters.keyword}
              onChange={(value) => setFilters((current) => ({ ...current, keyword: value }))}
              placeholder="用户 / 动作 / 文件名 / 备注 / IP"
            />

            <AdminFilterSelectField
              label={actionLabel}
              value={filters.action}
              onValueChange={(value) => setFilters((current) => ({ ...current, action: value }))}
              options={activeActionOptions}
              disabled={actionDisabled}
            />
            <AdminFilterSelectField
              label="积分类型"
              value={filters.changeType}
              onValueChange={(value) => setFilters((current) => ({ ...current, changeType: value }))}
              options={pointTypeOptions}
              disabled={data.activeTab !== "points"}
            />
            <AdminFilterSelectField
              label="上传目录"
              value={filters.bucketType}
              onValueChange={(value) => setFilters((current) => ({ ...current, bucketType: value }))}
              options={bucketTypeOptions}
              disabled={data.activeTab !== "uploads"}
            />
            <AdminFilterSelectField
              label="每页"
              value={filters.pageSize}
              onValueChange={(value) => setFilters((current) => ({ ...current, pageSize: value }))}
              options={pageSizeOptions.map((item) => ({ value: String(item), label: `${item} 条` }))}
            />

            <AdminFilterActions
              submitLabel="筛选"
              resetHref={`/admin?tab=logs&logSubTab=${data.activeTab}`}
            />
          </form>
      </AdminFilterCard>

      <Card>
        <CardContent className="px-0 py-0">
          {data.rows.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下没有日志记录。</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[160px]">时间</TableHead>
                  <TableHead className="w-[180px]">操作人</TableHead>
                  <TableHead className="w-[160px]">类型</TableHead>
                  <TableHead className="w-[160px]">目标</TableHead>
                  <TableHead>详情</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="align-top">
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="font-medium text-foreground">{formatDateTime(row.occurredAt)}</div>
                        <div className="truncate">ID {row.id.slice(0, 10)}</div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="min-w-0 space-y-1">
                        <div className="truncate text-sm font-medium">{row.actorPrimary}</div>
                        <div className="truncate text-xs text-muted-foreground">{row.actorSecondary}</div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="min-w-0 space-y-1">
                        <Badge className={toneClassMap[row.tone]}>{row.typePrimary}</Badge>
                        <div className="truncate text-xs text-muted-foreground">{row.typeSecondary}</div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="min-w-0 space-y-1">
                        <div className="truncate text-sm font-medium">{row.targetPrimary}</div>
                        <div className="truncate text-xs text-muted-foreground">{row.targetSecondary}</div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="min-w-0 space-y-1">
                        <div className="line-clamp-1 text-sm font-medium">{row.detailPrimary}</div>
                        <div className="line-clamp-2 text-xs leading-5 text-muted-foreground">{row.detailSecondary}</div>
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
            <span>共 {data.pagination.total} 条记录</span>
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
        disabled ? "pointer-events-none opacity-40" : ""
      )}
    >
      {children}
    </Link>
  )
}
