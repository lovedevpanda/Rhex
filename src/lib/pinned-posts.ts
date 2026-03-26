import type { SitePostItem } from "@/lib/posts"
import { mapListPost } from "@/lib/post-map"

interface PostWithId {
  id: string
}

export function dedupeAndMapPinnedPosts<TPost extends PostWithId>(posts: TPost[], mapPost: (post: TPost) => SitePostItem = (post) => mapListPost(post as never)) {
  const pinnedPostIds = new Set<string>()
  const pinnedItems: SitePostItem[] = []

  for (const post of posts) {
    if (pinnedPostIds.has(post.id)) {
      continue
    }

    pinnedPostIds.add(post.id)
    pinnedItems.push(mapPost(post))
  }

  return {
    pinnedItems,
    pinnedPostIds: Array.from(pinnedPostIds),
  }
}

export function extractPinnedPostIds<TPost extends PostWithId>(posts: TPost[]) {
  return Array.from(new Set(posts.map((post) => post.id)))
}
