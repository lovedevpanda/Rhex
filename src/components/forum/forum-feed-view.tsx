"use client"

import { AddonSurfaceClientRenderer } from "@/addons-host/client/addon-surface-client-renderer"
import { ForumPostListItem } from "@/components/forum/forum-post-list-item"
import { PostGalleryGrid } from "@/components/post/post-gallery-grid"
import { PostWeiboFeed } from "@/components/post/post-weibo-feed"
import type { FeedDisplayItem } from "@/lib/forum-feed-display"
import { normalizePostListDisplayMode, POST_LIST_DISPLAY_MODE_GALLERY, POST_LIST_DISPLAY_MODE_WEIBO, type PostListDisplayMode } from "@/lib/post-list-display"
import { cn } from "@/lib/utils"

interface ForumFeedViewProps {
  items: FeedDisplayItem[]
  listDisplayMode?: PostListDisplayMode
  postLinkDisplayMode?: "SLUG" | "ID"
}

export function ForumFeedView({ items, listDisplayMode, postLinkDisplayMode = "SLUG" }: ForumFeedViewProps) {
  const resolvedListDisplayMode = normalizePostListDisplayMode(listDisplayMode)
  const isGalleryMode = resolvedListDisplayMode === POST_LIST_DISPLAY_MODE_GALLERY
  const usesSeparatedNormalItems =
    isGalleryMode ||
    resolvedListDisplayMode === POST_LIST_DISPLAY_MODE_WEIBO
  const pinnedItems = items.filter((item) => item.pinScope === "GLOBAL")
  const normalItems = items.filter((item) => item.pinScope !== "GLOBAL")
  const displayPinnedItems = isGalleryMode ? [] : pinnedItems
  const galleryItems = isGalleryMode ? items : normalItems

  return (
    <div className={cn(!isGalleryMode && "lg:pl-2")}>
      {displayPinnedItems.map((item) => (
        <ForumPostListItem
          key={item.id}
          item={item}
          showBoard
          showPinBadge
          postLinkDisplayMode={postLinkDisplayMode}
        />
      ))}
      {displayPinnedItems.length > 0 && normalItems.length > 0 && usesSeparatedNormalItems ? (
        <div className="mb-2 mt-4 flex items-center gap-3 px-3 text-xs text-muted-foreground">
          <span className="rounded-full border border-border bg-background px-2.5 py-1 font-medium">最新内容</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      ) : null}
      {resolvedListDisplayMode === POST_LIST_DISPLAY_MODE_GALLERY ? (
        <div className="pt-[10px]">
          <PostGalleryGrid items={galleryItems} showBoard={false} showPinBadge postLinkDisplayMode={postLinkDisplayMode} />
        </div>
      ) : resolvedListDisplayMode === POST_LIST_DISPLAY_MODE_WEIBO ? (
        <AddonSurfaceClientRenderer
          surface="post.weibo.feed"
          surfaceProps={{
            items: normalItems,
            source: "feed",
            showBoard: true,
            showPinBadge: false,
            postLinkDisplayMode,
          }}
          fallback={<PostWeiboFeed items={normalItems} showBoard showPinBadge={false} postLinkDisplayMode={postLinkDisplayMode} />}
        />
      ) : normalItems.map((item) => (
        <ForumPostListItem
          key={item.id}
          item={item}
          showBoard
          showPinBadge={false}
          postLinkDisplayMode={postLinkDisplayMode}
        />
      ))}
    </div>
  )
}
