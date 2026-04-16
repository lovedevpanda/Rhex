import type { PostLinkDisplayMode } from "@/lib/site-settings"

interface PostCommentPathOptions {
  mode?: PostLinkDisplayMode
  sort?: "oldest" | "newest"
  view?: "tree" | "flat"
  page?: number
  highlight?: string
}


export function getPostRouteSegment(post: { id: string; slug: string }, mode: PostLinkDisplayMode = "SLUG") {
  return mode === "ID" ? post.id : post.slug
}

export function getCanonicalPostPath(
  post: { id?: string; slug: string },
  options?: PostLinkDisplayMode | { mode?: PostLinkDisplayMode },
) {
  const mode = typeof options === "string" ? options : options?.mode ?? "SLUG"
  const routeSegment = mode === "ID" && post.id ? post.id : post.slug

  return `/posts/${encodeURIComponent(routeSegment)}`
}

export function getPostPath(post: { id: string; slug: string }, options?: PostLinkDisplayMode | { mode?: PostLinkDisplayMode }) {
  const mode = typeof options === "string" ? options : options?.mode ?? "ID"

  return `/posts/${encodeURIComponent(getPostRouteSegment(post, mode))}`
}



export function getPostCommentPath(
  post: { id: string; slug: string; title?: string },
  commentId: string,
  options?: PostLinkDisplayMode | PostCommentPathOptions,
) {
  const mode = typeof options === "string" ? options : options?.mode
  const searchParams = new URLSearchParams()

  if (typeof options === "object") {
    if (options.sort) {
      searchParams.set("sort", options.sort)
    }

    if (options.view) {
      searchParams.set("view", options.view)
    }

    if (typeof options.page === "number" && Number.isFinite(options.page) && options.page >= 1) {
      searchParams.set("page", String(Math.floor(options.page)))
    }

    if (options.highlight) {
      searchParams.set("highlight", options.highlight)
    }
  }

  const queryString = searchParams.toString()
  return `${getPostPath(post, mode)}${queryString ? `?${queryString}` : ""}#comment-${commentId}`
}


export function extractPostIdFromRouteSegment(segment: string) {
  const trimmed = segment.trim()

  if (!trimmed) {
    return null
  }

  const directId = trimmed.match(/^[a-z0-9]+$/i)?.[0]
  if (directId) {
    return directId
  }

  return trimmed.match(/-([a-z0-9]+)$/i)?.[1] ?? null
}

