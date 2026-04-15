import { revalidateTag } from "next/cache"

export const BOARDS_CACHE_TAG = "taxonomy-boards"
export const ZONES_CACHE_TAG = "taxonomy-zones"

export const TAXONOMY_CACHE_TAGS = [BOARDS_CACHE_TAG, ZONES_CACHE_TAG] as const

function revalidateTaxonomyTags(profile: "max" | { expire: 0 }) {
  for (const tag of TAXONOMY_CACHE_TAGS) {
    revalidateTag(tag, profile)
  }
}

export function revalidateTaxonomyStructureCache() {
  revalidateTaxonomyTags("max")
}

export function expireTaxonomyCacheImmediately() {
  revalidateTaxonomyTags({ expire: 0 })
}
