import Link from "next/link"

import { cn } from "@/lib/utils"

type PaginationToken = number | "ellipsis"

interface PageNumberPaginationProps {
  page: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
  buildHref: (page: number) => string
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
    const previous = typeof result.at(-1) === "number" ? (result.at(-1) as number) : null

    if (previous !== null && current - previous > 1) {
      result.push("ellipsis")
    }

    result.push(current)
  }

  return result
}

export function PageNumberPagination({
  page,
  totalPages,
  hasPrevPage,
  hasNextPage,
  buildHref,
}: PageNumberPaginationProps) {
  const tokens = buildPageTokens(page, totalPages)

  return (
    <nav className="flex flex-col items-center gap-3 pt-2" aria-label="pagination">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href={hasPrevPage ? buildHref(page - 1) : "#"}
          aria-disabled={!hasPrevPage}
          className={hasPrevPage ? "rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent/40" : "pointer-events-none rounded-full border border-border px-4 py-2 text-sm text-muted-foreground opacity-50"}
        >
          上一页
        </Link>

        {tokens.map((token, index) => token === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="px-1 text-sm text-muted-foreground">
            ...
          </span>
        ) : (
          <Link
            key={token}
            href={buildHref(token)}
            aria-current={token === page ? "page" : undefined}
            className={cn(
              "inline-flex min-w-10 items-center justify-center rounded-full border px-3 py-2 text-sm transition-colors",
              token === page
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card hover:bg-accent/40",
            )}
          >
            {token}
          </Link>
        ))}

        <Link
          href={hasNextPage ? buildHref(page + 1) : "#"}
          aria-disabled={!hasNextPage}
          className={hasNextPage ? "rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent/40" : "pointer-events-none rounded-full border border-border px-4 py-2 text-sm text-muted-foreground opacity-50"}
        >
          下一页
        </Link>
      </div>


    </nav>
  )
}
