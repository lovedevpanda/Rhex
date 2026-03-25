import Link from "next/link"

import { cn } from "@/lib/utils"

interface NotificationsPaginationProps {
  currentPage: number
  totalPages: number
}

function buildPageHref(page: number) {
  return page <= 1 ? "/notifications" : `/notifications?page=${page}`
}

function paginationLinkClassName(disabled?: boolean) {
  return cn(
    "inline-flex h-10 items-center justify-center rounded-full border border-border px-5 text-sm font-medium transition-colors",
    disabled ? "pointer-events-none cursor-not-allowed opacity-50" : "bg-card hover:bg-accent hover:text-accent-foreground",
  )
}

export function NotificationsPagination({ currentPage, totalPages }: NotificationsPaginationProps) {
  if (totalPages <= 1) {
    return null
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        第 {currentPage} / {totalPages} 页
      </p>
      <div className="flex items-center gap-3">
        <Link href={buildPageHref(currentPage - 1)} aria-disabled={currentPage <= 1} className={paginationLinkClassName(currentPage <= 1)}>
          上一页
        </Link>
        <Link href={buildPageHref(currentPage + 1)} aria-disabled={currentPage >= totalPages} className={paginationLinkClassName(currentPage >= totalPages)}>
          下一页
        </Link>
      </div>
    </div>
  )
}
