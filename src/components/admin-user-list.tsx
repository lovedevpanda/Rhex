"use client"

import { Search, ShieldCheck, UserRoundCheck, UserRoundX, Users, Zap } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"

import { AdminUserActionButton } from "@/components/admin-user-action-button"
import { AdminUserModal } from "@/components/admin-user-modal"
import { AdminUserPasswordModal } from "@/components/admin-user-password-modal"
import { AdminUserStatusModal } from "@/components/admin-user-status-modal"
import { AdminUserVipModal } from "@/components/admin-user-vip-modal"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/formatters"
import type { AdminUserListResult } from "@/lib/admin-user-management"
import { isVipActive } from "@/lib/vip-status"

interface AdminUserListProps {
  data: AdminUserListResult
}

const roleOptions = ["ALL", "USER", "MODERATOR", "ADMIN"]
const statusOptions = ["ALL", "ACTIVE", "MUTED", "BANNED", "INACTIVE"]
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
  const statCards = useMemo(
    () => [
      { label: "用户总数", value: data.summary.total, icon: <Users className="h-4 w-4" /> },
      { label: "活跃用户", value: data.summary.active, icon: <UserRoundCheck className="h-4 w-4" /> },
      { label: "受限用户", value: data.summary.muted + data.summary.banned, icon: <UserRoundX className="h-4 w-4" /> },
      { label: "VIP 用户", value: data.summary.vip, icon: <Zap className="h-4 w-4" /> },
      { label: "管理成员", value: data.summary.admin + data.summary.moderator, icon: <ShieldCheck className="h-4 w-4" /> },
    ],
    [data.summary],
  )

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
      <form className="grid gap-3 rounded-[22px] border border-border bg-card p-4 xl:grid-cols-[minmax(120px,2.15fr)_104px_104px_112px_118px_118px_88px_auto]">
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">搜索用户</span>
          <div className="flex h-10 items-center gap-2 rounded-full border border-border bg-background px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input name="userKeyword" defaultValue={data.filters.keyword} placeholder="用户名 / 昵称 / 邮箱 / 手机 / 简介" className="w-full bg-transparent text-sm outline-none" />
          </div>
        </label>
        <CompactSelect name="userRole" label="角色" value={data.filters.role} options={roleOptions.map((item) => ({ value: item, label: item }))} />
        <CompactSelect name="userStatus" label="状态" value={data.filters.status} options={statusOptions.map((item) => ({ value: item, label: item }))} />
        <CompactSelect name="userVip" label="VIP" value={data.filters.vip} options={vipOptions} />
        <CompactSelect name="userActivity" label="活跃度" value={data.filters.activity} options={activityOptions} />
        <CompactSelect name="userSort" label="排序" value={data.filters.sort} options={sortOptions} />
        <CompactSelect name="userPageSize" label="每页" value={String(data.pagination.pageSize)} options={pageSizeOptions.map((item) => ({ value: String(item), label: `${item} 条` }))} />
        <div className="flex items-end gap-2">
          <input type="hidden" name="tab" value="users" />
          <input type="hidden" name="userPage" value="1" />
          <Button type="submit" className="h-10 rounded-full px-4 text-xs">筛选</Button>
          <Link href="/admin?tab=users" className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
            重置
          </Link>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => (
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
        <div className="grid items-center gap-3 border-b border-border bg-secondary/40 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground lg:grid-cols-[220px_120px_150px_150px_minmax(0,1fr)_320px]">
          <span>用户</span>
          <span>角色/状态</span>
          <span>等级/VIP</span>
          <span>积分/活跃</span>
          <span>运营指标</span>
          <span className="text-right">操作</span>
        </div>
        {data.users.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">当前筛选条件下没有用户。</div>
        ) : null}
        {data.users.map((user) => {
          const vipActive = isVipActive({ vipLevel: user.vipLevel, vipExpiresAt: user.vipExpiresAt })
          const canPromoteModerator = user.role === "USER"
          const canSetAdmin = user.role !== "ADMIN"
          const canDemote = user.role !== "USER"
          const moderatorScopeSummary = user.role === "MODERATOR"
            ? `${user.moderatedZoneScopes.length} 个分区 / ${user.moderatedBoardScopes.length} 个节点`
            : null
          return (
            <div key={user.id} className="grid items-center gap-3 border-b border-border px-4 py-2.5 text-xs last:border-b-0 lg:grid-cols-[220px_120px_150px_150px_minmax(0,1fr)_320px]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-sm">{user.displayName}</span>
                  {user.status !== "ACTIVE" ? <span className="rounded-full bg-accent px-2 py-0.5 text-[10px]">{user.status}</span> : null}
                </div>
                <div className="mt-1 truncate text-muted-foreground">@{user.username}</div>
                <div className="mt-1 truncate text-muted-foreground">{user.email ?? user.phone ?? user.lastLoginIp ?? "-"}</div>
              </div>

              <div className="space-y-1 text-muted-foreground">
                <div className="font-medium text-foreground">{user.role}</div>
                <div>{user.status}</div>
                <div>{moderatorScopeSummary ?? `邀请人 ${user.inviterName ?? "-"}`}</div>
              </div>

              <div className="space-y-1 text-muted-foreground">
                <div>Lv.{user.level}</div>
                <div>{vipActive ? `VIP${user.vipLevel}` : "非 VIP"}</div>
                <div>{user.vipExpiresAt ? formatDateTime(user.vipExpiresAt) : "长期 / 无"}</div>
              </div>

              <div className="space-y-1 text-muted-foreground">
                <div>积分 {user.points}</div>
                <div>注册 {formatDateTime(user.createdAt)}</div>
                <div>登录 {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "从未"}</div>
              </div>

              <div className="grid gap-1 text-muted-foreground md:grid-cols-2 xl:grid-cols-3">
                <Metric label="帖" value={user.postCount} />
                <Metric label="评" value={user.commentCount} />
                <Metric label="赞" value={user.likeReceivedCount} />
                <Metric label="邀" value={user.inviteCount} />
                <Metric label="藏" value={user.favoriteCount} />
                <Metric label="签" value={user.checkInDays} />
              </div>

              <div className="flex flex-wrap justify-end gap-1.5">
                <AdminUserModal user={user} moderatorScopeOptions={data.moderatorScopeOptions} />
                <AdminUserStatusModal userId={user.id} username={user.username} action="mute" />
                <AdminUserStatusModal userId={user.id} username={user.username} action="ban" />
                <AdminUserActionButton userId={user.id} action="user.activate" label="恢复" className="h-7 rounded-full px-2.5 text-xs" />
                {canPromoteModerator ? <AdminUserActionButton userId={user.id} action="user.promoteModerator" label="版主" className="h-7 rounded-full px-2.5 text-xs" /> : null}
                {canSetAdmin ? <AdminUserActionButton userId={user.id} action="user.setAdmin" label="管理员" className="h-7 rounded-full px-2.5 text-xs" /> : null}
                <AdminUserPasswordModal userId={user.id} username={user.username} displayName={user.displayName} />
                <AdminUserVipModal userId={user.id} username={user.username} vipLevel={user.vipLevel} vipExpiresAt={user.vipExpiresAt} />
                {canDemote ? <AdminUserActionButton userId={user.id} action="user.demoteToUser" label="降权" className="h-7 rounded-full px-2.5 text-xs" /> : null}
              </div>
            </div>
          )
        })}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/20 px-4 py-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <span>第 {data.pagination.page} / {data.pagination.totalPages} 页</span>
            <span>每页 {data.pagination.pageSize} 条</span>
            <span>共 {data.pagination.total} 条用户</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={data.pagination.hasPrevPage ? buildPageHref(data.pagination.page - 1) : "#"}
              aria-disabled={!data.pagination.hasPrevPage}
              className={data.pagination.hasPrevPage ? "inline-flex h-8 items-center justify-center rounded-full border border-border bg-card px-3 font-medium transition-colors hover:bg-accent hover:text-accent-foreground" : "inline-flex h-8 items-center justify-center rounded-full border border-border px-3 opacity-40 pointer-events-none"}
            >
              上一页
            </Link>
            <span className="inline-flex h-8 items-center rounded-full bg-accent px-3 font-medium text-foreground">{data.pagination.page}</span>
            <Link
              href={data.pagination.hasNextPage ? buildPageHref(data.pagination.page + 1) : "#"}
              aria-disabled={!data.pagination.hasNextPage}
              className={data.pagination.hasNextPage ? "inline-flex h-8 items-center justify-center rounded-full border border-border bg-card px-3 font-medium transition-colors hover:bg-accent hover:text-accent-foreground" : "inline-flex h-8 items-center justify-center rounded-full border border-border px-3 opacity-40 pointer-events-none"}
            >
              下一页
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function CompactSelect({ name, label, value, options }: { name: string; label: string; value: string; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <select name={name} defaultValue={value} className="h-10 w-full rounded-full border border-border bg-background px-2.5 text-sm outline-none">
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-full bg-secondary/50 px-2 py-1 text-center">
      {label} {value}
    </div>
  )
}
