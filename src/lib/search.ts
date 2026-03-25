import { buildPostSearchWhere, countSearchPosts, findSearchPosts } from "@/db/search-queries"
import { getPostPath } from "@/lib/post-links"

import { mapListPost } from "@/lib/post-map"



import type { SitePostItem } from "@/lib/posts"

export interface SearchResultItem extends SitePostItem {
  href: string
}


export interface SearchResults {
  keyword: string
  total: number
  items: SearchResultItem[]
}

function normalizeKeyword(keyword: string) {
  return keyword.trim().slice(0, 50)
}

export async function searchPosts(keyword: string, page = 1, pageSize = 10): Promise<SearchResults> {
  const normalizedKeyword = normalizeKeyword(keyword)

  if (!normalizedKeyword) {
    return {
      keyword: "",
      total: 0,
      items: [],
    }
  }

  try {
    const where = buildPostSearchWhere(normalizedKeyword)

    const [total, posts] = await Promise.all([
      countSearchPosts(where),
      findSearchPosts({
        where,
        page,
        pageSize,
      }),

    ])


    return {
      keyword: normalizedKeyword,
      total,
      items: posts.map((post) => ({
        ...mapListPost(post),
        href: getPostPath(post),
      })),
    }
  } catch (error) {
    console.error(error)
    return {
      keyword: normalizedKeyword,
      total: 0,
      items: [],
    }
  }
}
