import { unstable_cache } from "next/cache"

import { countTags, findAllTags, findTagBySlugOrName, findTagListPage, findTagPostsBySlugOrName } from "@/db/taxonomy-queries"
import { getAnonymousMaskDisplayIdentity } from "@/lib/post-anonymous"
import { mapListPost } from "@/lib/post-map"
import { TAGS_CACHE_TAG, TAXONOMY_CONTENT_CACHE_TAG } from "@/lib/taxonomy-cache"

export interface SiteTagItem {
  id: string
  name: string
  slug: string
  count: number
}

export type TagListSort = "hot" | "new"

export interface TagListPageData {
  items: SiteTagItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
}

function normalizeTagParam(value: string) {
  try {
    return decodeURIComponent(value).trim().toLowerCase()
  } catch {
    return value.trim().toLowerCase()
  }
}

function normalizeTagListPage(page?: number) {
  if (!page || Number.isNaN(page)) {
    return 1
  }

  return Math.max(1, Math.trunc(page))
}

function mapSiteTagItem(tag: { id: string; name: string; slug: string; postCount: number }): SiteTagItem {
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    count: tag.postCount,
  }
}

const TAG_LIST_CACHE_REVALIDATE_SECONDS = 60
const TAG_POSTS_CACHE_REVALIDATE_SECONDS = 30
const TAG_LIST_CACHE_MAX_PAGE = 3

function shouldCacheTagListPage(page: number) {
  return page >= 1 && page <= TAG_LIST_CACHE_MAX_PAGE
}

async function readTags(): Promise<SiteTagItem[]> {
  const tags = await findAllTags()
  return tags.map((tag) => mapSiteTagItem(tag))
}

const getPersistentTags = unstable_cache(
  async () => readTags(),
  ["tags:list"],
  {
    tags: [TAGS_CACHE_TAG],
    revalidate: TAG_LIST_CACHE_REVALIDATE_SECONDS,
  },
)

export async function getTags(): Promise<SiteTagItem[]> {
  try {
    return getPersistentTags()
  } catch (error) {
    console.error(error)
    return []
  }
}

async function readTagListPage(page = 1, pageSize = 24, sort: TagListSort = "hot"): Promise<TagListPageData> {
  const resolvedPage = normalizeTagListPage(page)
  const resolvedPageSize = Math.min(50, Math.max(1, Math.trunc(pageSize) || 24))
  const [items, total] = await Promise.all([
    findTagListPage({ page: resolvedPage, pageSize: resolvedPageSize, sort }),
    countTags(),
  ])
  const totalPages = Math.max(1, Math.ceil(total / resolvedPageSize))
  const safePage = Math.min(resolvedPage, totalPages)

  if (safePage !== resolvedPage) {
    const fallbackItems = await findTagListPage({ page: safePage, pageSize: resolvedPageSize, sort })

    return {
      items: fallbackItems.map((tag) => mapSiteTagItem(tag)),
      pagination: {
        page: safePage,
        pageSize: resolvedPageSize,
        total,
        totalPages,
        hasPrevPage: safePage > 1,
        hasNextPage: safePage < totalPages,
      },
    }
  }

  return {
    items: items.map((tag) => mapSiteTagItem(tag)),
    pagination: {
      page: safePage,
      pageSize: resolvedPageSize,
      total,
      totalPages,
      hasPrevPage: safePage > 1,
      hasNextPage: safePage < totalPages,
    },
  }
}

const getPersistentTagListPage = unstable_cache(
  async (page: number, pageSize: number, sort: TagListSort) => readTagListPage(page, pageSize, sort),
  ["tags:page"],
  {
    tags: [TAGS_CACHE_TAG],
    revalidate: TAG_LIST_CACHE_REVALIDATE_SECONDS,
  },
)

export async function getTagListPage(page = 1, pageSize = 24, sort: TagListSort = "hot"): Promise<TagListPageData> {
  try {
    if (shouldCacheTagListPage(page)) {
      return getPersistentTagListPage(page, pageSize, sort)
    }

    return readTagListPage(page, pageSize, sort)
  } catch (error) {
    console.error(error)
    return {
      items: [],
      pagination: {
        page: 1,
        pageSize,
        total: 0,
        totalPages: 1,
        hasPrevPage: false,
        hasNextPage: false,
      },
    }
  }
}

async function readTagByNormalizedSlug(normalized: string): Promise<SiteTagItem | null> {
  const tag = await findTagBySlugOrName(normalized)

  if (!tag) {
    return null
  }

  return mapSiteTagItem(tag)
}

const getPersistentTagByNormalizedSlug = unstable_cache(
  async (normalized: string) => readTagByNormalizedSlug(normalized),
  ["tags:by-slug"],
  {
    tags: [TAGS_CACHE_TAG],
    revalidate: TAG_LIST_CACHE_REVALIDATE_SECONDS,
  },
)

export async function getTagBySlug(slug: string): Promise<SiteTagItem | null> {
  try {
    return getPersistentTagByNormalizedSlug(normalizeTagParam(slug))
  } catch (error) {
    console.error(error)
    return null
  }
}

async function readTagPostsByNormalizedSlug(normalized: string) {
  const [posts, anonymousMaskIdentity] = await Promise.all([
    findTagPostsBySlugOrName(normalized),
    getAnonymousMaskDisplayIdentity(),
  ])

  return posts.map((post) => mapListPost(post, anonymousMaskIdentity))
}

const getPersistentTagPostsByNormalizedSlug = unstable_cache(
  async (normalized: string) => readTagPostsByNormalizedSlug(normalized),
  ["tags:posts"],
  {
    tags: [TAXONOMY_CONTENT_CACHE_TAG],
    revalidate: TAG_POSTS_CACHE_REVALIDATE_SECONDS,
  },
)

export async function getTagPosts(slug: string) {
  try {
    return getPersistentTagPostsByNormalizedSlug(normalizeTagParam(slug))
  } catch (error) {
    console.error(error)
    return []
  }
}
