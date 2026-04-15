"use client"

import type { AdminUserDetailResult } from "@/lib/admin-user-management"

import { LogSectionCard, LogSummaryCard } from "@/components/admin/user-modal/components/UserInfo"

export function ActivityTab({ detail }: { detail: AdminUserDetailResult | null }) {
  if (!detail) {
    return (
      <div className="rounded-[20px] border border-dashed border-border bg-secondary/20 px-4 py-10 text-sm text-muted-foreground">
        暂无活动详情，稍后重试。
      </div>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {detail.logSections.map((section) => (
          <LogSummaryCard key={section.key} section={section} />
        ))}
      </section>

      <div className="flex flex-col gap-4">
        {detail.logSections.map((section) => (
          <LogSectionCard key={section.key} section={section} />
        ))}
      </div>
    </div>
  )
}
