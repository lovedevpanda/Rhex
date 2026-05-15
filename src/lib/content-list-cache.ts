import { revalidateTag } from "next/cache"

import { revalidateTaxonomyContentCache } from "@/lib/taxonomy-cache"

export const FORUM_FEED_CACHE_TAG = "forum-feed"
export const HOME_SIDEBAR_HOT_TOPICS_CACHE_TAG = "home-sidebar-hot-topics"

function revalidateContentListTag(tag: string) {
  try {
    revalidateTag(tag, "max")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      message.startsWith("Invariant: static generation store missing in revalidateTag")
      || message.includes('used "revalidateTag ')
    ) {
      return
    }

    throw error
  }
}

export function revalidateForumFeedCache() {
  revalidateContentListTag(FORUM_FEED_CACHE_TAG)
}

export function revalidateHomeSidebarHotTopicsCache() {
  revalidateContentListTag(HOME_SIDEBAR_HOT_TOPICS_CACHE_TAG)
}

export function revalidateContentListCaches() {
  revalidateForumFeedCache()
  revalidateHomeSidebarHotTopicsCache()
  revalidateTaxonomyContentCache()
}
