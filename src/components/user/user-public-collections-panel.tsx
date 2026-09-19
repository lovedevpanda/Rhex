"use client"

import Link from "next/link"
import { useState, useTransition } from "react"

import type { PublicFavoriteCollectionProfilePage } from "@/lib/favorite-collections"
import { formatCompactNumber, formatNumber, serializeDate } from "@/lib/formatters"
import { cn } from "@/lib/utils"

function buildPageTokens(page: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1) as Array<number | "ellipsis">
  }

  const tokens = new Set<number>([1, totalPages, page, page - 1, page + 1])
  const visiblePages = Array.from(tokens)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right)

  const result: Array<number | "ellipsis"> = []

  for (const current of visiblePages) {
    const previous = typeof result.at(-1) === "number" ? result.at(-1) as number : null

    if (previous !== null && current - previous > 1) {
      result.push("ellipsis")
    }

    result.push(current)
  }

  return result
}

async function readUserPublicCollections(username: string, page: number) {
  const response = await fetch(`/api/users/${encodeURIComponent(username)}/collections?page=${page}`, {
    method: "GET",
    cache: "no-store",
  })
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message ?? "公开合集加载失败")
  }

  return result.data as PublicFavoriteCollectionProfilePage
}

export function UserPublicCollectionsPanel({
  username,
  initialData,
}: {
  username: string
  initialData: PublicFavoriteCollectionProfilePage
}) {
  const [data, setData] = useState(initialData)
  const [errorMessage, setErrorMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const pageTokens = buildPageTokens(data.pagination.page, data.pagination.totalPages)

  async function loadPage(page: number) {
    setErrorMessage("")
    setLoading(true)

    try {
      const nextData = await readUserPublicCollections(username, page)
      startTransition(() => {
        setData(nextData)
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "公开合集加载失败")
    } finally {
      setLoading(false)
    }
  }

  if (data.items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed  px-4 py-12 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-white/2">
        这个用户还没有公开合集。
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3 transition-opacity", loading || isPending ? "opacity-70" : "opacity-100")}>
        {data.items.map((collection) => (
          <Link
            key={collection.id}
            href={`/collections/${collection.id}`}
            className="rounded-[18px] border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/30"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="line-clamp-1 text-sm font-medium text-foreground">{collection.title}</h3>
              {collection.allowOtherUsersToContribute ? (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                  {collection.requireContributionApproval ? "投稿需审核" : "可投稿"}
                </span>
              ) : null}
            </div>
            {collection.description ? (
              <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">{collection.description}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span title={`${formatNumber(collection.postCount)} 帖`}>帖子 {formatCompactNumber(collection.postCount)}</span>
              <span>{serializeDate(collection.updatedAt) ?? ""}</span>
            </div>
          </Link>
        ))}
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {data.pagination.totalPages > 1 ? (
        <nav className="flex flex-col items-center gap-3 pt-1" aria-label="公开合集分页">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => void loadPage(data.pagination.page - 1)}
              disabled={!data.pagination.hasPrevPage || loading || isPending}
              className={data.pagination.hasPrevPage && !loading && !isPending ? "rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent/40" : "pointer-events-none rounded-full border border-border px-4 py-2 text-sm text-muted-foreground opacity-50"}
            >
              上一页
            </button>

            {pageTokens.map((token, index) => token === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="px-1 text-sm text-muted-foreground">
                ...
              </span>
            ) : (
              <button
                key={token}
                type="button"
                onClick={() => void loadPage(token)}
                disabled={loading || isPending || token === data.pagination.page}
                aria-current={token === data.pagination.page ? "page" : undefined}
                className={cn(
                  "inline-flex min-w-10 items-center justify-center rounded-full border px-3 py-2 text-sm transition-colors",
                  token === data.pagination.page
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card hover:bg-accent/40",
                  loading || isPending ? "pointer-events-none opacity-60" : "",
                )}
              >
                {token}
              </button>
            ))}

            <button
              type="button"
              onClick={() => void loadPage(data.pagination.page + 1)}
              disabled={!data.pagination.hasNextPage || loading || isPending}
              className={data.pagination.hasNextPage && !loading && !isPending ? "rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent/40" : "pointer-events-none rounded-full border border-border px-4 py-2 text-sm text-muted-foreground opacity-50"}
            >
              下一页
            </button>
          </div>
        </nav>
      ) : null}
    </div>
  )
}
