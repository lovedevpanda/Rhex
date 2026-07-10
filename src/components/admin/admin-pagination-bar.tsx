"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants, Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatNumber } from "@/lib/formatters"
import { cn } from "@/lib/utils"

type PaginationToken = number | "ellipsis"

export interface AdminPaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export interface AdminClientPaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevPage?: boolean
  hasNextPage?: boolean
}

interface AdminPaginationHiddenField {
  name: string
  value: string | number | null | undefined
}

interface AdminPaginationJumpConfig {
  action?: string
  pageParamName: string
  hiddenFields?: AdminPaginationHiddenField[]
  ariaLabel?: string
  submitLabel?: string
}

interface AdminPaginationBarProps {
  pagination: AdminPaginationMeta
  buildPageHref: (page: number) => string
  itemLabel: string
  className?: string
  align?: "between" | "center"
  showPageSize?: boolean
  showPageNumbers?: boolean
  previousLabel?: string
  nextLabel?: string
  jump?: AdminPaginationJumpConfig
}

interface AdminClientPaginationBarProps {
  pagination: AdminClientPaginationMeta
  onPageChange: (page: number) => void
  itemLabel: string
  loading?: boolean
  className?: string
  align?: "between" | "center"
  showPageSize?: boolean
  showPageNumbers?: boolean
  previousLabel?: string
  nextLabel?: string
}

function buildPageTokens(page: number, totalPages: number): PaginationToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const tokens = new Set<number>([1, totalPages, page, page - 1, page + 1])
  const visiblePages = Array.from(tokens)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right)
  const result: PaginationToken[] = []

  for (const current of visiblePages) {
    const lastToken = result[result.length - 1]
    const previous = typeof lastToken === "number" ? lastToken : null

    if (previous !== null && current - previous > 1) {
      result.push("ellipsis")
    }

    result.push(current)
  }

  return result
}

export function AdminPaginationBar({
  pagination,
  buildPageHref,
  itemLabel,
  className,
  align = "between",
  showPageSize = true,
  showPageNumbers = true,
  previousLabel = "上一页",
  nextLabel = "下一页",
  jump,
}: AdminPaginationBarProps) {
  const totalPages = Math.max(1, pagination.totalPages)
  const currentPage = Math.min(Math.max(1, pagination.page), totalPages)
  const pageTokens = showPageNumbers ? buildPageTokens(currentPage, totalPages) : []
  const [pageInputDraft, setPageInputDraft] = useState(() => ({
    page: currentPage,
    value: String(currentPage),
  }))
  const pageInput = pageInputDraft.page === currentPage
    ? pageInputDraft.value
    : String(currentPage)

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3",
        align === "center" ? "justify-center text-center" : "justify-between",
        className,
      )}
    >
      <div className={cn("flex flex-wrap items-center gap-3 text-xs text-muted-foreground", align === "center" && "justify-center")}>
        <span>第 {currentPage} / {totalPages} 页</span>
        {showPageSize ? <span>每页 {pagination.pageSize} 条</span> : null}
        <span>共 {formatNumber(pagination.total)} {itemLabel}</span>
      </div>

      <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="分页">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <PaginationControlLink
            href={pagination.hasPrevPage ? buildPageHref(currentPage - 1) : "#"}
            disabled={!pagination.hasPrevPage}
          >
            {previousLabel}
          </PaginationControlLink>
          {showPageNumbers ? pageTokens.map((token, index) => token === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">
              ...
            </span>
          ) : (
            <PaginationControlLink
              key={token}
              href={buildPageHref(token)}
              active={token === currentPage}
            >
              {token}
            </PaginationControlLink>
          )) : (
            <Badge variant="secondary" className="h-8 rounded-full px-3 text-sm">
              {currentPage}
            </Badge>
          )}
          <PaginationControlLink
            href={pagination.hasNextPage ? buildPageHref(currentPage + 1) : "#"}
            disabled={!pagination.hasNextPage}
          >
            {nextLabel}
          </PaginationControlLink>
        </div>

        {jump && totalPages > 1 ? (
          <form action={jump.action} className="flex items-center gap-1.5">
            {jump.hiddenFields?.map((field) => (
              <input key={field.name} type="hidden" name={field.name} value={String(field.value ?? "")} />
            ))}
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              跳至
              <Input
                type="number"
                name={jump.pageParamName}
                min={1}
                max={totalPages}
                step={1}
                value={pageInput}
                onChange={(event) => setPageInputDraft({ page: currentPage, value: event.target.value })}
                aria-label={jump.ariaLabel ?? "跳转到页码"}
                className="h-8 w-16 rounded-full bg-background px-2 text-center text-xs"
              />
            </label>
            <Button type="submit" variant="outline" className="rounded-full px-3 text-xs">
              {jump.submitLabel ?? "跳页"}
            </Button>
          </form>
        ) : null}
      </nav>
    </div>
  )
}

export function AdminClientPaginationBar({
  pagination,
  onPageChange,
  itemLabel,
  loading = false,
  className,
  align = "between",
  showPageSize = true,
  showPageNumbers = true,
  previousLabel = "上一页",
  nextLabel = "下一页",
}: AdminClientPaginationBarProps) {
  const totalPages = Math.max(1, pagination.totalPages)
  const currentPage = Math.min(Math.max(1, pagination.page), totalPages)
  const pageTokens = showPageNumbers ? buildPageTokens(currentPage, totalPages) : []
  const hasPrevPage = pagination.hasPrevPage ?? currentPage > 1
  const hasNextPage = pagination.hasNextPage ?? currentPage < totalPages

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3",
        align === "center" ? "justify-center text-center" : "justify-between",
        className,
      )}
    >
      <div className={cn("flex flex-wrap items-center gap-3 text-xs text-muted-foreground", align === "center" && "justify-center")}>
        <span>第 {currentPage} / {totalPages} 页</span>
        {showPageSize ? <span>每页 {pagination.pageSize} 条</span> : null}
        <span>共 {formatNumber(pagination.total)} {itemLabel}</span>
      </div>

      <nav className="flex flex-wrap items-center justify-end gap-1.5" aria-label="分页">
        <PaginationControlButton
          disabled={!hasPrevPage || loading}
          onClick={() => onPageChange(currentPage - 1)}
        >
          {previousLabel}
        </PaginationControlButton>
        {showPageNumbers ? pageTokens.map((token, index) => token === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">
            ...
          </span>
        ) : (
          <PaginationControlButton
            key={token}
            active={token === currentPage}
            disabled={loading}
            onClick={() => onPageChange(token)}
          >
            {token}
          </PaginationControlButton>
        )) : (
          <Badge variant="secondary" className="h-8 rounded-full px-3 text-sm">
            {currentPage}
          </Badge>
        )}
        <PaginationControlButton
          disabled={!hasNextPage || loading}
          onClick={() => onPageChange(currentPage + 1)}
        >
          {nextLabel}
        </PaginationControlButton>
      </nav>
    </div>
  )
}

function PaginationControlLink({
  href,
  disabled = false,
  active = false,
  children,
}: {
  href: string
  disabled?: boolean
  active?: boolean
  children: ReactNode
}) {
  const className = cn(
    buttonVariants({ variant: active ? "default" : "outline", size: "default" }),
    "min-w-8 rounded-full px-3 text-xs",
    disabled && !active ? "pointer-events-none opacity-40" : "",
  )

  if (disabled || active) {
    return (
      <span aria-disabled={disabled || undefined} aria-current={active ? "page" : undefined} className={className}>
        {children}
      </span>
    )
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}

function PaginationControlButton({
  disabled = false,
  active = false,
  onClick,
  children,
}: {
  disabled?: boolean
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      disabled={disabled || active}
      aria-current={active ? "page" : undefined}
      className="min-w-8 rounded-full px-3 text-xs"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
