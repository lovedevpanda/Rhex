import { revalidateTag } from "next/cache"

export const BOARDS_CACHE_TAG = "taxonomy-boards"
export const ZONES_CACHE_TAG = "taxonomy-zones"
export const TAGS_CACHE_TAG = "taxonomy-tags"
export const TAXONOMY_CONTENT_CACHE_TAG = "taxonomy-content"

export const TAXONOMY_CACHE_TAGS = [BOARDS_CACHE_TAG, ZONES_CACHE_TAG, TAGS_CACHE_TAG] as const

function revalidateTaxonomyTags(profile: "max" | { expire: 0 }) {
  for (const tag of TAXONOMY_CACHE_TAGS) {
    revalidateTag(tag, profile)
  }
}

export function revalidateTaxonomyStructureCache() {
  revalidateTaxonomyTags("max")
  revalidateTaxonomyContentCache()
}

export function expireTaxonomyCacheImmediately() {
  revalidateTaxonomyTags({ expire: 0 })
  expireTaxonomyContentCacheImmediately()
}

export function revalidateTaxonomyContentCache() {
  revalidateTag(TAXONOMY_CONTENT_CACHE_TAG, "max")
}

export function expireTaxonomyContentCacheImmediately() {
  revalidateTag(TAXONOMY_CONTENT_CACHE_TAG, { expire: 0 })
}
