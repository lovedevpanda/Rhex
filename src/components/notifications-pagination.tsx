import Link from "next/link"

import { cn } from "@/lib/utils"

interface NotificationsPaginationProps {
  prevHref?: string | null
  nextHref?: string | null
}

function paginationLinkClassName(disabled?: boolean) {
  return cn(
    "inline-flex h-10 items-center justify-center rounded-full border border-border px-5 text-sm font-medium transition-colors",
    disabled ? "pointer-events-none cursor-not-allowed opacity-50" : "bg-card hover:bg-accent hover:text-accent-foreground",
  )
}

export function NotificationsPagination({ prevHref, nextHref }: NotificationsPaginationProps) {
  if (!prevHref && !nextHref) {
    return null
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">使用游标分页加载较新的通知与更早的通知。</p>
      <div className="flex items-center gap-3">
        <Link href={prevHref ?? "#"} aria-disabled={!prevHref} className={paginationLinkClassName(!prevHref)}>
          上一页
        </Link>
        <Link href={nextHref ?? "#"} aria-disabled={!nextHref} className={paginationLinkClassName(!nextHref)}>
          下一页
        </Link>
      </div>
    </div>
  )
}
