import type { FeedSort } from "@/lib/forum-feed"

export type HomeFeedSort = Exclude<FeedSort, "weekly">

export function normalizeHomeFeedSort(sort?: string): HomeFeedSort {
  if (sort === "new" || sort === "hot" || sort === "following") {
    return sort
  }

  return "latest"
}

export function parseHomeFeedPage(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value
  const page = Number(rawValue)

  if (!Number.isInteger(page) || page < 1) {
    return 1
  }

  return page
}

export function buildHomeFeedHref(sort: HomeFeedSort, page = 1) {
  const normalizedPage = Math.max(1, Math.trunc(page))

  if (normalizedPage <= 1) {
    return `/${sort}`
  }

  return `/${sort}?page=${normalizedPage}`
}
