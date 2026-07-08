"use client"

import { AddonSurfaceClientRenderer } from "@/addons-host/client/addon-surface-client-renderer"
import { ForumPostSortToggle } from "@/components/forum/forum-post-sort-toggle"
import { ForumPostListItem } from "@/components/forum/forum-post-list-item"
import { PostGalleryGrid } from "@/components/post/post-gallery-grid"
import { PostWeiboFeed } from "@/components/post/post-weibo-feed"
import type { TaxonomyPostSortLinks } from "@/lib/forum-taxonomy-sort"
import type { PostStreamDisplayItem } from "@/lib/forum-post-stream-display"
import { normalizePostListDisplayMode, POST_LIST_DISPLAY_MODE_GALLERY, POST_LIST_DISPLAY_MODE_WEIBO, type PostListDisplayMode } from "@/lib/post-list-display"
import { cn } from "@/lib/utils"

interface ForumPostStreamViewProps {
  items: PostStreamDisplayItem[]
  listDisplayMode?: PostListDisplayMode
  showBoard?: boolean
  showPinnedDivider?: boolean
  compactFirstItem?: boolean
  postLinkDisplayMode?: "SLUG" | "ID"
  sortLinks?: TaxonomyPostSortLinks
}

export function ForumPostStreamView({
  items,
  listDisplayMode,
  showBoard = true,
  showPinnedDivider = false,
  compactFirstItem = true,
  postLinkDisplayMode = "SLUG",
  sortLinks,
}: ForumPostStreamViewProps) {
  const resolvedListDisplayMode = normalizePostListDisplayMode(listDisplayMode)
  const isGalleryMode = resolvedListDisplayMode === POST_LIST_DISPLAY_MODE_GALLERY
  const pinnedPosts = items.filter((post) => Boolean(post.pinLabel))
  const normalPosts = items.filter((post) => !post.pinLabel)
  const displayPinnedPosts = isGalleryMode ? [] : pinnedPosts
  const galleryPosts = isGalleryMode ? items : normalPosts
  const shouldShowPinnedDivider = showPinnedDivider && displayPinnedPosts.length > 0 && normalPosts.length > 0
  const shouldShowLatestContentHeader = Boolean(sortLinks) || shouldShowPinnedDivider

  return (
    <div className="overflow-hidden rounded-md bg-background">
      <div className={cn(!isGalleryMode && "lg:pl-4")}>
        {displayPinnedPosts.map((post, index) => (
          <ForumPostListItem
            key={post.id}
            item={post}
            showBoard={showBoard}
            compactFirstItem={compactFirstItem && index === 0}
            hideDivider={shouldShowPinnedDivider && index === displayPinnedPosts.length - 1}
            postLinkDisplayMode={postLinkDisplayMode}
          />
        ))}
        {shouldShowLatestContentHeader ? (
          <div className="mb-2 mt-4 flex flex-wrap items-center gap-3 px-3 text-xs text-muted-foreground">
            <span className="rounded-full border border-border bg-background px-2.5 py-1 font-medium">最新内容</span>
            <div className="h-px min-w-10 flex-1 bg-border" />
            {sortLinks ? <ForumPostSortToggle {...sortLinks} /> : null}
          </div>
        ) : null}
        {resolvedListDisplayMode === POST_LIST_DISPLAY_MODE_GALLERY ? (
          <PostGalleryGrid items={galleryPosts} showBoard={showBoard} postLinkDisplayMode={postLinkDisplayMode} />
        ) : resolvedListDisplayMode === POST_LIST_DISPLAY_MODE_WEIBO ? (
          <AddonSurfaceClientRenderer
            surface="post.weibo.feed"
            surfaceProps={{
              items: normalPosts,
              source: "post-stream",
              showBoard,
              showPinBadge: true,
              postLinkDisplayMode,
              sortLinks,
            }}
            fallback={<PostWeiboFeed items={normalPosts} showBoard={showBoard} postLinkDisplayMode={postLinkDisplayMode} />}
          />
        ) : normalPosts.map((post, index) => (
          <ForumPostListItem
            key={post.id}
            item={post}
            showBoard={showBoard}
            compactFirstItem={compactFirstItem && displayPinnedPosts.length === 0 && index === 0}
            postLinkDisplayMode={postLinkDisplayMode}
          />
        ))}
      </div>
    </div>
  )
}
