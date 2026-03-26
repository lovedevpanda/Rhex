import type { SitePostItem } from "@/lib/posts"
import { getSiteSettings } from "@/lib/site-settings"
import { resolvePostHeatStyle } from "@/lib/post-heat"
import { getVipNameClass } from "@/lib/vip-status"

import { ForumPostListItem } from "@/components/forum-post-list-item"

interface ForumPostStreamProps {
  posts: SitePostItem[]
  showBoard?: boolean
  visiblePinScopes?: Array<"GLOBAL" | "ZONE" | "BOARD">
  showPinnedDivider?: boolean
}

function getVisiblePinLabel(pinScope: SitePostItem["pinScope"], visiblePinScopes: Array<"GLOBAL" | "ZONE" | "BOARD">) {
  if (!pinScope || !visiblePinScopes.includes(pinScope as "GLOBAL" | "ZONE" | "BOARD")) {
    return null
  }

  if (pinScope === "GLOBAL") {
    return "全局置顶"
  }

  if (pinScope === "ZONE") {
    return "分区置顶"
  }

  if (pinScope === "BOARD") {
    return "节点置顶"
  }

  return null
}

export async function ForumPostStream({ posts, showBoard = true, visiblePinScopes = ["GLOBAL", "ZONE", "BOARD"], showPinnedDivider = false }: ForumPostStreamProps) {
  const settings = await getSiteSettings()
  const pinnedSectionCount = showPinnedDivider
    ? posts.filter((post) => Boolean(getVisiblePinLabel(post.pinScope, visiblePinScopes))).length
    : 0

  return (
    <div className="overflow-hidden rounded-md bg-background">
      <div className="lg:pl-4">
        {posts.map((post, index) => {
          const commentHeat = resolvePostHeatStyle({
            views: post.stats.views,
            comments: post.stats.comments,
            likes: post.stats.likes,
            tipCount: post.stats.tips,
            tipPoints: post.stats.tipPoints,
          }, settings)
          const pinLabel = getVisiblePinLabel(post.pinScope, visiblePinScopes)
          const showDivider = showPinnedDivider && pinnedSectionCount > 0 && index === pinnedSectionCount

          return (
            <div key={post.id}>
              {showDivider ? (
                <div className="mb-2 mt-4 flex items-center gap-3 px-3 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border bg-background px-2.5 py-1 font-medium">最新内容</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              ) : null}
              <ForumPostListItem
                item={{
                  id: post.id,
                  slug: post.slug,
                  title: post.title,
                  type: post.type,
                  typeLabel: post.typeLabel,
                  pinScope: post.pinScope,
                  pinLabel,
                  minViewLevel: post.minViewLevel,
                  isFeatured: post.isFeatured,
                  boardName: post.board,
                  boardSlug: post.boardSlug,
                  boardIcon: post.boardIcon,
                  authorName: post.author,
                  authorUsername: post.authorUsername ?? post.author,
                  authorAvatarPath: post.authorAvatarPath,
                  authorStatus: post.authorStatus,
                  authorNameClassName: getVipNameClass(post.authorIsVip, post.authorVipLevel, { emphasize: true }),
                  authorDisplayedBadges: post.authorDisplayedBadges,
                  metaPrimary: post.publishedAt,
                  commentCount: post.stats.comments,
                  commentAccentColor: commentHeat.color,
                }}
                showBoard={showBoard}
                compactFirstItem={index === 0}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
