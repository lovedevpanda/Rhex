"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"

import type { AdminUserDetailLogSection } from "@/lib/admin-user-management"
import { formatDateTime } from "@/lib/formatters"
import { cn } from "@/lib/utils"

import type { AdminUserMetricItem } from "@/components/admin/user-modal/types"

export function UserInfoGrid({
  items,
  compact = false,
  columnsClassName = "sm:grid-cols-2 xl:grid-cols-3",
}: {
  items: AdminUserMetricItem[]
  compact?: boolean
  columnsClassName?: string
}) {
  return (
    <div className={cn("grid gap-2", columnsClassName)}>
      {items.map((item) => (
        <InfoCard key={item.label} label={item.label} value={item.value} compact={compact} />
      ))}
    </div>
  )
}

export function LogSummaryCard({ section }: { section: AdminUserDetailLogSection }) {
  return (
    <div className="rounded-[18px] border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{section.title}</p>
          <p className="mt-2 text-2xl font-semibold">{section.total}</p>
        </div>
        <Link href={section.href} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{section.description}</p>
    </div>
  )
}

export function LogSectionCard({ section }: { section: AdminUserDetailLogSection }) {
  return (
    <section className="rounded-[20px] border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">{section.title}</h4>
          <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
        </div>
        <Link href={section.href} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
          <span>日志中心</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {section.items.length === 0 ? <p className="rounded-[16px] border border-dashed border-border px-3 py-5 text-sm text-muted-foreground">{section.emptyText}</p> : null}
        {section.items.map((item) => (
          <div key={item.id} className={cn("rounded-[16px] border px-3 py-2.5", resolveToneClassName(item.tone))}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{item.title}</p>
              <span className="text-[11px] opacity-80">{formatDateTime(item.occurredAt)}</span>
            </div>
            <p className="mt-1 text-xs leading-5 opacity-90">{item.description}</p>
            {item.meta.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] opacity-80">
                {item.meta.map((meta, index) => (
                  <span key={`${item.id}-${index}`} className="rounded-full bg-white/70 px-2 py-0.5 dark:bg-black/20">{meta}</span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}

export function InfoCard({
  label,
  value,
  compact = false,
}: {
  label: string
  value: string
  compact?: boolean
}) {
  return (
    <div className={compact ? "rounded-[16px] border border-border px-3 py-2" : "rounded-[18px] border border-border p-4"}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium break-all">{value}</p>
    </div>
  )
}

function resolveToneClassName(tone: AdminUserDetailLogSection["items"][number]["tone"]) {
  switch (tone) {
    case "success":
      return "border-emerald-200/80 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100"
    case "warning":
      return "border-amber-200/80 bg-amber-50/70 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100"
    case "danger":
      return "border-rose-200/80 bg-rose-50/70 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-100"
    case "info":
      return "border-sky-200/80 bg-sky-50/70 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100"
    default:
      return "border-border bg-secondary/20"
  }
}
