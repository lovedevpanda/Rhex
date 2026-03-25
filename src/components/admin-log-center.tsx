"use client"

import Link from "next/link"
import { Activity, FileClock, LogIn, Package, ReceiptText, Search, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/formatters"
import type { AdminLogCenterResult } from "@/lib/admin-logs"

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
const pointTypeOptions = [
  { value: "ALL", label: "全部变动" },
  { value: "INCOME", label: "收入" },
  { value: "EXPENSE", label: "支出" },
]
const bucketTypeOptions = [
  { value: "ALL", label: "全部目录" },
  { value: "avatars", label: "头像" },
  { value: "posts", label: "帖子图片" },
]

const tabIcons = {
  admin: ShieldCheck,
  login: LogIn,
  points: Activity,
  uploads: FileClock,
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {data.summary.map((card) => {
          const Icon = tabIcons[card.key]
          return (
            <div key={card.key} className="rounded-[18px] border border-border bg-card px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-muted-foreground">
                <span className="text-xs">{card.label}</span>
                <Icon className="h-4 w-4" />
              </div>
              <p className="mt-2 text-2xl font-semibold">{card.count}</p>
            </div>
          )
        })}
      </div>

      <div className="space-y-4 rounded-[22px] border border-border bg-card p-4">
        <div className="flex flex-wrap gap-2">
          {data.tabs.map((item) => {
            const Icon = tabIcons[item.key]
            const active = item.key === data.activeTab
            return (
              <Link
                key={item.key}
                href={buildHref({ logSubTab: item.key, logPage: "1" })}
                className={active ? "inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background" : "inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
                <span className={active ? "text-background/70" : "text-muted-foreground"}>{item.count}</span>
              </Link>
            )
          })}
        </div>

        <form className="grid gap-3 xl:grid-cols-[minmax(180px,2fr)_132px_132px_132px_92px_auto]">
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">关键词</span>
            <div className="flex h-10 items-center gap-2 rounded-full border border-border bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input name="logKeyword" defaultValue={data.filters.keyword} placeholder="用户 / 动作 / 文件名 / 备注 / IP" className="w-full bg-transparent text-sm outline-none" />
            </div>
          </label>

          <CompactSelect name="logAction" label="管理员动作" value={data.filters.action} options={actionOptions} disabled={data.activeTab !== "admin"} />
          <CompactSelect name="logChangeType" label="积分类型" value={data.filters.changeType} options={pointTypeOptions} disabled={data.activeTab !== "points"} />
          <CompactSelect name="logBucketType" label="上传目录" value={data.filters.bucketType} options={bucketTypeOptions} disabled={data.activeTab !== "uploads"} />
          <CompactSelect name="logPageSize" label="每页" value={String(data.pagination.pageSize)} options={pageSizeOptions.map((item) => ({ value: String(item), label: `${item} 条` }))} />

          <div className="flex items-end gap-2">
            <input type="hidden" name="tab" value="logs" />
            <input type="hidden" name="logSubTab" value={data.activeTab} />
            <input type="hidden" name="logPage" value="1" />
            <Button type="submit" className="h-10 rounded-full px-4 text-xs">筛选</Button>
            <Link href={`/admin?tab=logs&logSubTab=${data.activeTab}`} className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">重置</Link>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-[22px] border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">日志中心</h3>
            <p className="mt-1 text-xs text-muted-foreground">紧凑运营视图，按日志类型独立分页与筛选，适合日常巡检与快速追溯。</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">
            <Package className="h-3.5 w-3.5" />
            当前共 {data.pagination.total} 条
          </div>
        </div>

        <div className="grid items-center gap-3 border-b border-border bg-secondary/40 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground lg:grid-cols-[160px_180px_160px_160px_minmax(0,1fr)]">
          <span>时间</span>
          <span>操作人</span>
          <span>类型</span>
          <span>目标</span>
          <span>详情</span>
        </div>

        {data.rows.length === 0 ? <div className="px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下没有日志记录。</div> : null}

        {data.rows.map((row) => (
          <div key={row.id} className="grid items-center gap-3 border-b border-border px-4 py-2.5 text-xs last:border-b-0 lg:grid-cols-[160px_180px_160px_160px_minmax(0,1fr)]">
            <div className="space-y-1 text-muted-foreground">
              <div className="font-medium text-foreground">{formatDateTime(row.occurredAt)}</div>
              <div className="truncate">ID {row.id.slice(0, 10)}</div>
            </div>

            <div className="space-y-1 min-w-0">
              <div className="truncate text-sm font-medium">{row.actorPrimary}</div>
              <div className="truncate text-muted-foreground">{row.actorSecondary}</div>
            </div>

            <div className="space-y-1 min-w-0">
              <span className={`inline-flex rounded-full px-2 py-0.5 ${toneClassMap[row.tone]}`}>{row.typePrimary}</span>
              <div className="truncate text-muted-foreground">{row.typeSecondary}</div>
            </div>

            <div className="space-y-1 min-w-0">
              <div className="truncate text-sm font-medium">{row.targetPrimary}</div>
              <div className="truncate text-muted-foreground">{row.targetSecondary}</div>
            </div>

            <div className="min-w-0 space-y-1">
              <div className="truncate text-sm font-medium">{row.detailPrimary}</div>
              <div className="truncate text-muted-foreground">{row.detailSecondary}</div>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/20 px-4 py-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <span>第 {data.pagination.page} / {data.pagination.totalPages} 页</span>
            <span>每页 {data.pagination.pageSize} 条</span>
            <span>共 {data.pagination.total} 条记录</span>
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

function CompactSelect({ name, label, value, options, disabled = false }: { name: string; label: string; value: string; options: Array<{ value: string; label: string }>; disabled?: boolean }) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <select name={name} defaultValue={value} disabled={disabled} className="h-10 w-full rounded-full border border-border bg-background px-2.5 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50">
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}
