import type { FeedSort } from "@/lib/forum-feed"

export type HomeFeedSort = Exclude<FeedSort, "weekly"> | "universe"

export function normalizeHomeFeedSort(sort?: string): HomeFeedSort {
  if (sort === "new" || sort === "hot" || sort === "featured" || sort === "following" || sort === "universe") {
    return sort
  }

  return "latest"
}

export function parseHomeFeedPage(value: number | string | string[] | undefined) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1 ? value : 1
  }

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

  if (sort === "latest" || sort === "new" || sort === "hot" || sort === "featured") {
    return `/${sort}/page/${normalizedPage}`
  }

  return `/${sort}?page=${normalizedPage}`
}

export function normalizeAddonHomeFeedSlug(slug?: string) {
  return typeof slug === "string"
    ? slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "")
    : ""
}

export function buildAddonHomeFeedHref(
  slug: string,
  page = 1,
  useRootAlias = false,
) {
  const normalizedSlug = normalizeAddonHomeFeedSlug(slug)
  const normalizedPage = Math.max(1, Math.trunc(page))

  if (!normalizedSlug) {
    return "/"
  }

  if (useRootAlias && normalizedPage <= 1) {
    return "/"
  }

  const baseHref = `/feed/${normalizedSlug}`

  if (normalizedPage <= 1) {
    return baseHref
  }

  return `${baseHref}?page=${normalizedPage}`
}
