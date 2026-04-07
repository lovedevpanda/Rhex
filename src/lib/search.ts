import { buildPostSearchWhere, countSearchPosts, findSearchPostsCursor } from "@/db/search-queries"
import { decodePinnedTimestampCursor, encodePinnedTimestampCursor } from "@/lib/cursor-pagination"
import { getAnonymousMaskDisplayIdentity } from "@/lib/post-anonymous"
import { getPostPath } from "@/lib/post-links"
import { getSiteSettings } from "@/lib/site-settings"

import { mapListPost } from "@/lib/post-map"




import type { SitePostItem } from "@/lib/posts"

export interface SearchResultItem extends SitePostItem {
  href: string
}


export interface SearchResults {
  keyword: string
  total: number | null
  items: SearchResultItem[]
  hasPrevPage: boolean
  hasNextPage: boolean
  prevCursor: string | null
  nextCursor: string | null
}

function normalizeKeyword(keyword: string) {
  return keyword.trim().slice(0, 50)
}

export async function searchPosts(
  keyword: string,
  options: {
    pageSize?: number
    after?: string | null
    before?: string | null
    includeTotal?: boolean
    searchEnabled?: boolean
    postLinkDisplayMode?: "SLUG" | "ID"
  } = {},
): Promise<SearchResults> {
  const normalizedKeyword = normalizeKeyword(keyword)

  if (!normalizedKeyword) {
    return {
      keyword: "",
      total: 0,
      items: [],
      hasPrevPage: false,
      hasNextPage: false,
      prevCursor: null,
      nextCursor: null,
    }
  }

  try {
    const settings = options.searchEnabled === undefined || !options.postLinkDisplayMode
      ? await getSiteSettings()
      : null
    const searchEnabled = options.searchEnabled ?? settings?.search.enabled ?? false
    const postLinkDisplayMode = options.postLinkDisplayMode ?? settings?.postLinkDisplayMode ?? "SLUG"

    if (!searchEnabled) {
      return {
        keyword: normalizedKeyword,
        total: 0,
        items: [],
        hasPrevPage: false,
        hasNextPage: false,
        prevCursor: null,
        nextCursor: null,
      }
    }

    const where = buildPostSearchWhere(normalizedKeyword)
    const afterCursor = decodePinnedTimestampCursor(options.after)
    const beforeCursor = decodePinnedTimestampCursor(options.before)
    const includeTotal = options.includeTotal ?? (!options.after && !options.before)

    const [{ items: posts, hasPrevPage, hasNextPage }, total, anonymousMaskIdentity] = await Promise.all([
      findSearchPostsCursor({
        where,
        pageSize: options.pageSize ?? 10,
        after: beforeCursor ? null : afterCursor,
        before: beforeCursor,
      }),
      includeTotal ? countSearchPosts(where) : Promise.resolve(null),
      getAnonymousMaskDisplayIdentity(),
    ] as const)

    return {
      keyword: normalizedKeyword,
      total,
      items: posts.map((post: (typeof posts)[number]) => ({
        ...mapListPost(post, anonymousMaskIdentity),
        href: getPostPath(post, { mode: postLinkDisplayMode }),
      })),
      hasPrevPage,
      hasNextPage,
      prevCursor: posts.length > 0 ? encodePinnedTimestampCursor({ id: posts[0].id, createdAt: posts[0].createdAt.toISOString(), isPinned: posts[0].isPinned }) : null,
      nextCursor: posts.length > 0 ? encodePinnedTimestampCursor({ id: posts[posts.length - 1].id, createdAt: posts[posts.length - 1].createdAt.toISOString(), isPinned: posts[posts.length - 1].isPinned }) : null,
    }
  } catch (error) {
    console.error(error)
    return {
      keyword: normalizedKeyword,
      total: null,
      items: [],
      hasPrevPage: false,
      hasNextPage: false,
      prevCursor: null,
      nextCursor: null,
    }
  }
}
