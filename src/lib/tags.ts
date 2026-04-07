import { countTags, findAllTags, findTagBySlugOrName, findTagListPage, findTagPostsBySlugOrName } from "@/db/taxonomy-queries"
import { getAnonymousMaskDisplayIdentity } from "@/lib/post-anonymous"
import { mapListPost } from "@/lib/post-map"

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

export async function getTags(): Promise<SiteTagItem[]> {
  try {
    const tags = await findAllTags()

    return tags.map((tag) => mapSiteTagItem(tag))
  } catch (error) {
    console.error(error)
    return []
  }
}

export async function getTagListPage(page = 1, pageSize = 24, sort: TagListSort = "hot"): Promise<TagListPageData> {
  try {
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

export async function getTagBySlug(slug: string): Promise<SiteTagItem | null> {
  try {
    const normalized = normalizeTagParam(slug)
    const tag = await findTagBySlugOrName(normalized)

    if (!tag) {
      return null
    }

    return mapSiteTagItem(tag)
  } catch (error) {
    console.error(error)
    return null
  }
}

export async function getTagPosts(slug: string) {
  try {
    const normalized = normalizeTagParam(slug)
    const [posts, anonymousMaskIdentity] = await Promise.all([
      findTagPostsBySlugOrName(normalized),
      getAnonymousMaskDisplayIdentity(),
    ])

    return posts.map((post) => mapListPost(post, anonymousMaskIdentity))
  } catch (error) {
    console.error(error)
    return []
  }
}
