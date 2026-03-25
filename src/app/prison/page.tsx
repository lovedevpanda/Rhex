import type { Metadata } from "next"
import Link from "next/link"
import { UserStatus } from "@/db/types"

import { SiteHeader } from "@/components/site-header"
import { prisma } from "@/db/client"

export const metadata: Metadata = {
  title: "小黑屋",
  description: "查看当前被拉黑和禁言的用户名单。",
}

const statusTabs = [
  { key: "ALL", label: "全部" },
  { key: "BANNED", label: "拉黑名单" },
  { key: "MUTED", label: "禁言名单" },
] as const

type PrisonStatusFilter = (typeof statusTabs)[number]["key"]

interface PrisonPageProps {
  searchParams?: {
    status?: string
  }
}

function normalizeStatusFilter(value?: string): PrisonStatusFilter {
  if (value === "BANNED" || value === "MUTED") {
    return value
  }

  return "ALL"
}

export default async function PrisonPage({ searchParams }: PrisonPageProps) {
  const activeStatus = normalizeStatusFilter(searchParams?.status)
  const where = activeStatus === "ALL"
    ? { status: { in: [UserStatus.BANNED, UserStatus.MUTED] } }
    : { status: activeStatus === "BANNED" ? UserStatus.BANNED : UserStatus.MUTED }

  const [users, mutedCount, bannedCount] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
      select: {
        id: true,
        username: true,
        nickname: true,
        status: true,
        updatedAt: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where: { status: UserStatus.MUTED } }),
    prisma.user.count({ where: { status: UserStatus.BANNED } }),
  ])

  const totalCount = mutedCount + bannedCount

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-4 py-8 lg:px-6">
        <div className="space-y-6">
          <section className="rounded-[30px] border border-border bg-card px-6 py-8 shadow-sm sm:px-8 lg:px-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                  Prison Center
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">小黑屋</h1>
                <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
                  这里集中展示当前处于禁言或拉黑状态的用户名单，方便社区成员了解公开可见的处理结果。
                </p>
              </div>

              <div className="grid min-w-[240px] grid-cols-3 gap-3">
                <SummaryCard label="总人数" value={totalCount} />
                <SummaryCard label="禁言中" value={mutedCount} tone="warning" />
                <SummaryCard label="拉黑中" value={bannedCount} tone="danger" />
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {statusTabs.map((tab) => {
                const active = tab.key === activeStatus
                const href = tab.key === "ALL" ? "/prison" : `/prison?status=${tab.key}`

                return (
                  <Link
                    key={tab.key}
                    href={href}
                    className={active ? "inline-flex items-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background" : "inline-flex items-center rounded-full border border-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-border/70 hover:bg-accent hover:text-foreground"}
                  >
                    {tab.label}
                  </Link>
                )
              })}
            </div>
          </section>

          <section className="rounded-[24px] border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-semibold">禁闭名单</h2>
                <p className="mt-1 text-sm text-muted-foreground">按最近处理时间排序，用户昵称可直接跳转到个人主页。</p>
              </div>
              <div className="text-xs text-muted-foreground">当前显示 {users.length} 条</div>
            </div>

            <div className="divide-y divide-border">
              {users.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-muted-foreground">当前筛选条件下，小黑屋里还没有用户。</div>
              ) : (
                users.map((user) => {
                  const displayName = user.nickname ?? user.username
                  const isBanned = user.status === UserStatus.BANNED

                  return (
                    <div key={user.id} className="px-5 py-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/users/${user.username}`} className="text-sm font-semibold text-foreground hover:underline">
                              {displayName}
                            </Link>
                            <span className="text-xs text-muted-foreground">@{user.username}</span>
                            <span className={isBanned ? "rounded-full bg-red-100 px-3 py-1 text-xs text-red-700 dark:bg-red-500/15 dark:text-red-200" : "rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"}>
                              {isBanned ? "已拉黑" : "已禁言"}
                            </span>
                          </div>

                          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
                            <div>
                              <span className="font-medium text-foreground">处理时间：</span>
                              {new Intl.DateTimeFormat("zh-CN", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(new Date(user.updatedAt))}
                            </div>
                            <div>
                              <span className="font-medium text-foreground">加入社区：</span>
                              {new Intl.DateTimeFormat("zh-CN", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                              }).format(new Date(user.createdAt))}
                            </div>
                            <div>
                              <span className="font-medium text-foreground">当前状态：</span>
                              {isBanned ? "拉黑" : "禁言"}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <Link href={`/users/${user.username}`} className="inline-flex items-center rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent">
                            查看主页
                          </Link>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

function SummaryCard({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warning" | "danger" }) {
  return (
    <div className={tone === "danger" ? "rounded-[20px] border border-red-200  px-4 py-4 dark:border-red-500/20 dark:bg-red-500/10" : tone === "warning" ? "rounded-[20px] border border-amber-200 px-4 py-4 dark:border-amber-500/20 dark:bg-amber-500/10" : "rounded-[20px] border border-border bg-background px-4 py-4"}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}
