"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { ForumFeedView } from "@/components/forum/forum-feed-view"
import type { FeedSort } from "@/lib/forum-feed"
import type { FeedDisplayItem } from "@/lib/forum-feed-display"
import type { PostListDisplayMode } from "@/lib/post-list-display"

interface InfiniteForumFeedProps {
  initialItems: FeedDisplayItem[]
  initialPage: number
  initialHasNextPage: boolean
  currentSort: Exclude<FeedSort, "weekly">
  listDisplayMode?: PostListDisplayMode
  postLinkDisplayMode?: "SLUG" | "ID"
}

interface FeedApiPayload {
  items: FeedDisplayItem[]
  page: number
  hasNextPage: boolean
}

export function InfiniteForumFeed({
  initialItems,
  initialPage,
  initialHasNextPage,
  currentSort,
  listDisplayMode,
  postLinkDisplayMode = "SLUG",
}: InfiniteForumFeedProps) {
  const [items, setItems] = useState(initialItems)
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const pageRef = useRef(initialPage)
  const hasNextPageRef = useRef(initialHasNextPage)
  const isLoadingRef = useRef(false)
  const loadedIdsRef = useRef(new Set(initialItems.map((item) => item.id)))

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || !hasNextPageRef.current) {
      return
    }

    const currentPage = pageRef.current
    const nextPage = currentPage + 1
    isLoadingRef.current = true
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/feed?sort=${encodeURIComponent(currentSort)}&page=${nextPage}`, {
        credentials: "same-origin",
      })
      const result = await response.json().catch(() => null) as { data?: FeedApiPayload; message?: string } | null

      if (!response.ok || !result?.data) {
        setError(result?.message || "加载更多帖子失败")
        return
      }

      const nextResultPage = result.data.page
      const nextHasNextPage = result.data.hasNextPage && nextResultPage > currentPage
      const nextItems = result.data.items.filter((item) => !loadedIdsRef.current.has(item.id))
      nextItems.forEach((item) => loadedIdsRef.current.add(item.id))

      if (nextItems.length > 0) {
        setItems((current) => [...current, ...nextItems])
      }
      pageRef.current = Math.max(currentPage, nextResultPage)
      hasNextPageRef.current = nextHasNextPage
      setHasNextPage(nextHasNextPage)
    } catch {
      setError("加载更多帖子失败")
    } finally {
      isLoadingRef.current = false
      setIsLoading(false)
    }
  }, [currentSort])

  useEffect(() => {
    pageRef.current = initialPage
    hasNextPageRef.current = initialHasNextPage
    isLoadingRef.current = false
    loadedIdsRef.current = new Set(initialItems.map((item) => item.id))
    setItems(initialItems)
    setHasNextPage(initialHasNextPage)
    setIsLoading(false)
    setError("")
  }, [currentSort, initialHasNextPage, initialItems, initialPage])

  useEffect(() => {
    if (!hasNextPage || !sentinelRef.current) {
      return
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMore()
      }
    }, { rootMargin: "240px 0px" })

    observer.observe(sentinelRef.current)

    return () => observer.disconnect()
  }, [hasNextPage, loadMore])

  return (
    <div className="space-y-4">
      <ForumFeedView
        items={items}
        listDisplayMode={listDisplayMode}
        postLinkDisplayMode={postLinkDisplayMode}
      />
      {hasNextPage ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
          <button type="button" onClick={() => void loadMore()} disabled={isLoading} className="rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60">
            {isLoading ? "加载中..." : "继续加载"}
          </button>
        </div>
      ) : null}
      {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
