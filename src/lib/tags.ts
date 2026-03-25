import { findAllTags, findTagBySlugOrName, findTagPostsBySlugOrName } from "@/db/taxonomy-queries"
import { mapListPost } from "@/lib/post-map"



export interface SiteTagItem {
  id: string
  name: string
  slug: string
  count: number
}

function normalizeTagParam(value: string) {
  try {
    return decodeURIComponent(value).trim().toLowerCase()
  } catch {
    return value.trim().toLowerCase()
  }
}

export async function getTags(): Promise<SiteTagItem[]> {
  try {
    const tags = await findAllTags()


    return tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      count: tag._count.posts,
    }))
  } catch (error) {
    console.error(error)
    return []
  }
}

export async function getTagBySlug(slug: string): Promise<SiteTagItem | null> {
  try {
    const normalized = normalizeTagParam(slug)
    const tag = await findTagBySlugOrName(normalized)


    if (!tag) {
      return null
    }

    return {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      count: tag._count.posts,
    }
  } catch (error) {
    console.error(error)
    return null
  }
}

export async function getTagPosts(slug: string) {
  try {
    const normalized = normalizeTagParam(slug)
    const posts = await findTagPostsBySlugOrName(normalized)



    return posts.map((post) => mapListPost(post))
  } catch (error) {
    console.error(error)
    return []
  }
}
