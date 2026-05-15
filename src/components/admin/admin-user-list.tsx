"use client"

import Link from "next/link"
import { ArrowRight, Filter, ShieldCheck, UserRoundCheck, UserRoundX, Users, Zap } from "lucide-react"
import { useMemo, useState } from "react"

import {
  AdminFilterActions,
  AdminFilterCard,
  AdminFilterSearchField,
  AdminFilterSelectField,
} from "@/components/admin/admin-filter-card"
import { AdminSummaryStrip } from "@/components/admin/admin-summary-strip"
import { AdminUserModal } from "@/components/admin/admin-user-modal"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip } from "@/components/ui/tooltip"
import { formatDateTime, formatNumber } from "@/lib/formatters"
import type { AdminUserListItem, AdminUserListResult } from "@/lib/admin-user-management"
import { isVipActive } from "@/lib/vip-status"
import { cn } from "@/lib/utils"

interface AdminUserListProps {
  data: AdminUserListResult
}

const roleOptions = [
  { value: "ALL", label: "全部角色" },
  { value: "USER", label: "普通用户" },
  { value: "MODERATOR", label: "版主" },
  { value: "ADMIN", label: "管理员" },
]

const statusOptions = [
  { value: "ALL", label: "全部状态" },
  { value: "ACTIVE", label: "正常" },
  { value: "MUTED", label: "禁言" },
  { value: "BANNED", label: "拉黑" },
  { value: "INACTIVE", label: "未激活" },
]

const pageSizeOptions = [20, 50, 100]
const vipOptions = [
  { value: "ALL", label: "全部 VIP" },
  { value: "vip", label: "仅 VIP" },
  { value: "non-vip", label: "非 VIP" },
]
const activityOptions = [
  { value: "ALL", label: "全部活跃度" },
  { value: "online-7d", label: "7 天内登录" },
  { value: "never-login", label: "从未登录" },
]
const sortOptions = [
  { value: "newest", label: "最新注册" },
  { value: "oldest", label: "最早注册" },
  { value: "lastLogin", label: "最近登录" },
  { value: "mostPosts", label: "发帖最多" },
  { value: "mostComments", label: "评论最多" },
  { value: "mostPoints", label: "积分最高" },
]

export function AdminUserList({ data }: AdminUserListProps) {
  const [filters, setFilters] = useState({
    keyword: data.filters.keyword,
    role: data.filters.role,
    status: data.filters.status,
    vip: data.filters.vip,
    activity: data.filters.activity,
    sort: data.filters.sort,
    pageSize: String(data.pagination.pageSize),
  })

  const statCards = useMemo(
    () => [
      {
        label: "用户总数",
        value: data.summary.total,
        icon: <Users className="h-4 w-4" />,
        hint: `当前结果 ${formatNumber(data.pagination.total)} 人`,
      },
      {
        label: "活跃用户",
        value: data.summary.active,
        icon: <UserRoundCheck className="h-4 w-4" />,
        hint: "状态正常且可继续运营",
        tone: "emerald" as const,
      },
      {
        label: "受限用户",
        value: data.summary.muted + data.summary.banned,
        icon: <UserRoundX className="h-4 w-4" />,
        hint: `禁言 ${formatNumber(data.summary.muted)} / 拉黑 ${formatNumber(data.summary.banned)}`,
        tone: "rose" as const,
      },
      {
        label: "VIP 用户",
        value: data.summary.vip,
        icon: <Zap className="h-4 w-4" />,
        hint: "可重点做留存与续费",
        tone: "amber" as const,
      },
      {
        label: "管理成员",
        value: data.summary.admin + data.summary.moderator,
        icon: <ShieldCheck className="h-4 w-4" />,
        hint: `管理员 ${formatNumber(data.summary.admin)} / 版主 ${formatNumber(data.summary.moderator)}`,
        tone: "sky" as const,
      },
    ],
    [data.pagination.total, data.summary],
  )

  const activeFilterBadges = useMemo(() => {
    const badges: string[] = []

    if (filters.keyword.trim()) {
      badges.push(`关键词: ${filters.keyword.trim()}`)
    }
    if (filters.role !== "ALL") {
      badges.push(`角色: ${roleOptions.find((item) => item.value === filters.role)?.label ?? filters.role}`)
    }
    if (filters.status !== "ALL") {
      badges.push(`状态: ${statusOptions.find((item) => item.value === filters.status)?.label ?? filters.status}`)
    }
    if (filters.vip !== "ALL") {
      badges.push(`VIP: ${vipOptions.find((item) => item.value === filters.vip)?.label ?? filters.vip}`)
    }
    if (filters.activity !== "ALL") {
      badges.push(`活跃度: ${activityOptions.find((item) => item.value === filters.activity)?.label ?? filters.activity}`)
    }
    if (filters.sort !== "newest") {
      badges.push(`排序: ${sortOptions.find((item) => item.value === filters.sort)?.label ?? filters.sort}`)
    }
    if (filters.pageSize !== "20") {
      badges.push(`每页: ${filters.pageSize} 条`)
    }

    return badges
  }, [filters])

  const baseQuery = new URLSearchParams({
    tab: "users",
    userKeyword: data.filters.keyword,
    userRole: data.filters.role,
    userStatus: data.filters.status,
    userVip: data.filters.vip,
    userActivity: data.filters.activity,
    userSort: data.filters.sort,
    userPageSize: String(data.pagination.pageSize),
  })

  function buildPageHref(page: number) {
    const query = new URLSearchParams(baseQuery)
    query.set("userPage", String(page))
    return `/admin?${query.toString()}`
  }

  return (
    <div className="space-y-4">
      <AdminFilterCard
        title="用户筛选"
        description="按角色、状态、VIP 和活跃度快速定位待运营或待处置用户。"
        badge={<Badge variant="secondary" className="rounded-full">已命中 {formatNumber(data.pagination.total)} 人</Badge>}
        activeBadges={activeFilterBadges}
      >
        <form action="/admin" className="grid gap-2 xl:grid-cols-[minmax(180px,1.6fr)_repeat(6,minmax(84px,1fr))_auto] xl:items-end">
          <input type="hidden" name="tab" value="users" />
          <input type="hidden" name="userPage" value="1" />
          <input type="hidden" name="userRole" value={filters.role} />
          <input type="hidden" name="userStatus" value={filters.status} />
          <input type="hidden" name="userVip" value={filters.vip} />
          <input type="hidden" name="userActivity" value={filters.activity} />
          <input type="hidden" name="userSort" value={filters.sort} />
          <input type="hidden" name="userPageSize" value={filters.pageSize} />

          <AdminFilterSearchField
            label="搜索用户"
            name="userKeyword"
            value={filters.keyword}
            onChange={(value) => setFilters((current) => ({ ...current, keyword: value }))}
            placeholder="用户名 / 昵称 / 邮箱 / 手机 / 简介"
          />

          <AdminFilterSelectField
            label="角色"
            value={filters.role}
            onValueChange={(value) => setFilters((current) => ({ ...current, role: value }))}
            options={roleOptions}
          />
          <AdminFilterSelectField
            label="状态"
            value={filters.status}
            onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}
            options={statusOptions}
          />
          <AdminFilterSelectField
            label="VIP"
            value={filters.vip}
            onValueChange={(value) => setFilters((current) => ({ ...current, vip: value }))}
            options={vipOptions}
          />
          <AdminFilterSelectField
            label="活跃度"
            value={filters.activity}
            onValueChange={(value) => setFilters((current) => ({ ...current, activity: value }))}
            options={activityOptions}
          />
          <AdminFilterSelectField
            label="排序"
            value={filters.sort}
            onValueChange={(value) => setFilters((current) => ({ ...current, sort: value }))}
            options={sortOptions}
          />
          <AdminFilterSelectField
            label="每页"
            value={filters.pageSize}
            onValueChange={(value) => setFilters((current) => ({ ...current, pageSize: value }))}
            options={pageSizeOptions.map((item) => ({ value: String(item), label: `${item} 条` }))}
          />

          <AdminFilterActions
            submitLabel="筛选用户"
            resetHref="/admin?tab=users"
            submitIcon={<Filter className="h-3.5 w-3.5" />}
          />
        </form>
      </AdminFilterCard>

      <AdminSummaryStrip items={statCards} />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>用户列表</CardTitle>
          <CardDescription>在同一行里查看身份、状态、活跃度和运营指标，并直接打开详情面板处理。</CardDescription>
          <CardAction>
            <OverviewActionLink href="/admin?tab=users&userVip=vip" label="查看 VIP 用户" />
          </CardAction>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {data.users.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <p className="text-sm font-medium">当前筛选条件下没有用户</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                试试放宽角色、状态或关键词，或者直接重置筛选重新查看。
              </p>
              <OverviewActionLink href="/admin?tab=users" label="重置筛选" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>用户</TableHead>
                  <TableHead className="w-[180px]">联系</TableHead>
                  <TableHead className="w-[170px]">身份</TableHead>
                  <TableHead className="w-[180px]">状态 / VIP</TableHead>
                  <TableHead className="w-[170px]">时间</TableHead>
                  <TableHead className="w-[110px]">产出</TableHead>
                  <TableHead className="w-[110px]">互动</TableHead>
                  <TableHead className="w-[110px]">邀请 / 签到</TableHead>
                  <TableHead className="w-[180px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="align-top">
                      <UserProfileCell user={user} />
                    </TableCell>
                    <TableCell className="align-top">
                      <UserContactCell user={user} />
                    </TableCell>
                    <TableCell className="align-top">
                      <UserIdentityCell user={user} />
                    </TableCell>
                    <TableCell className="align-top">
                      <UserStatusCell user={user} />
                    </TableCell>
                    <TableCell className="align-top">
                      <UserTimeCell user={user} />
                    </TableCell>
                    <TableCell className="align-top">
                      <UserContentMetricsCell user={user} />
                    </TableCell>
                    <TableCell className="align-top">
                      <UserSocialMetricsCell user={user} />
                    </TableCell>
                    <TableCell className="align-top">
                      <UserGrowthMetricsCell user={user} />
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex justify-end">
                        <AdminUserModal
                          user={user}
                          moderatorScopeOptions={data.moderatorScopeOptions}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-3 pr-16 sm:pr-20">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>第 {data.pagination.page} / {data.pagination.totalPages} 页</span>
            <span>每页 {data.pagination.pageSize} 条</span>
            <span>共 {formatNumber(data.pagination.total)} 条用户</span>
          </div>
          <div className="flex items-center gap-2">
            <PaginationLink
              href={data.pagination.hasPrevPage ? buildPageHref(data.pagination.page - 1) : "#"}
              disabled={!data.pagination.hasPrevPage}
            >
              上一页
            </PaginationLink>
            <Badge variant="secondary" className="h-8 rounded-full px-3 text-sm">
              {data.pagination.page}
            </Badge>
            <PaginationLink
              href={data.pagination.hasNextPage ? buildPageHref(data.pagination.page + 1) : "#"}
              disabled={!data.pagination.hasNextPage}
            >
              下一页
            </PaginationLink>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

function UserProfileCell({ user }: { user: AdminUserListItem }) {
  return (
    <div className="flex items-start gap-3">
      <Avatar size="sm" className="mt-0.5 rounded-lg">
        <AvatarFallback className="rounded-lg">
          {getInitials(user.displayName || user.username)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="line-clamp-1 text-sm font-medium">{user.displayName}</p>
        <p className="mt-1 text-xs text-muted-foreground">@{user.username}</p>
        <p className="mt-1 text-xs text-muted-foreground">UID {user.id}</p>
        {user.bio ? (
          <Tooltip content={user.bio} className="w-full" disabled={user.bio.length < 28}>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {user.bio}
            </p>
          </Tooltip>
        ) : null}
      </div>
    </div>
  )
}

function UserContactCell({ user }: { user: AdminUserListItem }) {
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p className="line-clamp-1">{user.email ?? "未绑定邮箱"}</p>
      <p className="line-clamp-1">{user.phone ?? "未绑定手机"}</p>
      <p className="line-clamp-1">{user.lastLoginIp ?? "无登录 IP"}</p>
    </div>
  )
}

function UserIdentityCell({ user }: { user: AdminUserListItem }) {
  const moderatorScopeSummary =
    user.role === "MODERATOR"
      ? `${user.moderatedZoneScopes.length} 个分区 / ${user.moderatedBoardScopes.length} 个节点`
      : null

  return (
    <div className="space-y-2 text-xs">
      <div>
        <p className="font-medium text-foreground">{getRoleLabel(user.role)}</p>
        <p className="mt-0.5 text-muted-foreground">状态 {getStatusLabel(user.status)}</p>
      </div>
      <p className="text-muted-foreground">
        {moderatorScopeSummary ?? `邀请人 ${user.inviterName ?? "-"}`}
      </p>
      <p className="text-muted-foreground">
        收藏 {formatNumber(user.favoriteCount)} · 邀请 {formatNumber(user.inviteCount)}
      </p>
    </div>
  )
}

function UserStatusCell({ user }: { user: AdminUserListItem }) {
  const vipActive = isVipActive({ vipLevel: user.vipLevel, vipExpiresAt: user.vipExpiresAt })

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Badge className={getStatusBadgeClassName(user.status)}>
          {getStatusLabel(user.status)}
        </Badge>
        <Badge className={getRoleBadgeClassName(user.role)}>
          {getRoleLabel(user.role)}
        </Badge>
        <Badge className={vipActive ? getVipBadgeClassName() : "border-border bg-background text-muted-foreground"}>
          {vipActive ? `VIP${user.vipLevel}` : "非 VIP"}
        </Badge>
      </div>
      <div className="text-xs text-muted-foreground">
        <p>等级 Lv.{user.level}</p>
        <p className="mt-1">
          {user.vipExpiresAt ? `到期 ${formatDateTime(user.vipExpiresAt)}` : "长期 / 无"}
        </p>
      </div>
    </div>
  )
}

function UserTimeCell({ user }: { user: AdminUserListItem }) {
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p>注册 {formatDateTime(user.createdAt)}</p>
      <p>{user.lastLoginAt ? `登录 ${formatDateTime(user.lastLoginAt)}` : "从未登录"}</p>
      <p>积分 {formatNumber(user.points)}</p>
    </div>
  )
}

function UserContentMetricsCell({ user }: { user: AdminUserListItem }) {
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p>帖子 {formatNumber(user.postCount)}</p>
      <p>评论 {formatNumber(user.commentCount)}</p>
    </div>
  )
}

function UserSocialMetricsCell({ user }: { user: AdminUserListItem }) {
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p>获赞 {formatNumber(user.likeReceivedCount)}</p>
      <p>收藏 {formatNumber(user.favoriteCount)}</p>
    </div>
  )
}

function UserGrowthMetricsCell({ user }: { user: AdminUserListItem }) {
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p>邀请 {formatNumber(user.inviteCount)}</p>
      <p>签到 {formatNumber(user.checkInDays)}</p>
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

function OverviewActionLink({
  href,
  label,
}: {
  href: string
  label: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "rounded-full shadow-xs"
      )}
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  )
}

function getInitials(name: string) {
  const normalized = name.trim()

  return normalized.slice(0, 2).toUpperCase() || "NA"
}

function getRoleLabel(role: string) {
  if (role === "ADMIN") {
    return "管理员"
  }
  if (role === "MODERATOR") {
    return "版主"
  }
  return "普通用户"
}

function getStatusLabel(status: string) {
  if (status === "ACTIVE") {
    return "正常"
  }
  if (status === "MUTED") {
    return "禁言"
  }
  if (status === "BANNED") {
    return "拉黑"
  }
  if (status === "INACTIVE") {
    return "未激活"
  }
  return status
}

function getRoleBadgeClassName(role: string) {
  if (role === "ADMIN") {
    return "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"
  }
  if (role === "MODERATOR") {
    return "border-transparent bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200"
  }
  return "border-border bg-background text-muted-foreground"
}

function getStatusBadgeClassName(status: string) {
  if (status === "MUTED") {
    return "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
  }
  if (status === "BANNED") {
    return "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"
  }
  if (status === "INACTIVE") {
    return "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200"
  }
  return "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
}

function getVipBadgeClassName() {
  return "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
}
