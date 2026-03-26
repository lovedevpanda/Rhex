import Link from "next/link"
import { Clock3, Flame, Sparkles } from "lucide-react"

import { ForumPostListItem } from "@/components/forum-post-list-item"
import type { FeedSort, ForumFeedItem } from "@/lib/forum-feed"
import { getSiteSettings } from "@/lib/site-settings"
import { resolvePostHeatStyle } from "@/lib/post-heat"
import { getVipNameClass, isVipActive } from "@/lib/vip-status"

interface ForumFeedListProps {
  items: ForumFeedItem[]
  currentSort: FeedSort
}

const tabs: Array<{ key: Exclude<FeedSort, "weekly">; label: string; icon: typeof Clock3 }> = [
  { key: "latest", label: "最新", icon: Clock3 },
  { key: "new", label: "新贴", icon: Sparkles },
  { key: "hot", label: "热门", icon: Flame },
]

function getFeedPinLabel(pinScope?: string | null) {
  if (pinScope === "GLOBAL") {
    return "全局置顶"
  }

  return null
}

export async function ForumFeedList({ items, currentSort }: ForumFeedListProps) {
  const settings = await getSiteSettings()

  return (
    <div className="overflow-hidden rounded-md bg-background">
      <div className="flex items-center justify-between gap-1 border-b py-3 lg:justify-start lg:gap-2 lg:px-4">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = currentSort === tab.key

          return (
            <Link
              key={tab.key}
              href={`/?sort=${tab.key}&page=1`}
              className={active ? "flex items-center gap-1 rounded-full bg-accent px-4 py-2 text-sm font-medium text-foreground lg:gap-2" : "flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 lg:gap-2"}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>

      <div className="lg:pl-4">
        {items.map((item) => {
          const commentHeat = resolvePostHeatStyle({
            views: item.viewCount,
            comments: item.commentCount,
            likes: item.likeCount,
            tipCount: item.tipCount,
            tipPoints: item.tipTotalPoints,
          }, settings)

          return (
            <ForumPostListItem
              key={item.id}
              item={{
                id: item.id,
                slug: item.slug,
                title: item.title,
                type: item.type,
                typeLabel: item.typeLabel,
                pinScope: item.pinScope,
                pinLabel: getFeedPinLabel(item.pinScope),
                minViewLevel: item.minViewLevel ?? undefined,
                isFeatured: item.isFeatured,
                boardName: item.boardName,
                boardSlug: item.boardSlug,
                boardIcon: item.boardIcon,
                authorName: item.authorName,
                authorUsername: item.authorUsername,
                authorAvatarPath: item.authorAvatarPath,
                authorStatus: item.authorStatus,
                authorNameClassName: getVipNameClass(isVipActive({ vipLevel: item.authorVipLevel, vipExpiresAt: item.authorVipExpiresAt }), item.authorVipLevel, { emphasize: true }),
                metaPrimary: currentSort === "new" ? item.publishedAt : item.lastRepliedAt,
                metaSecondary: currentSort === "latest" && item.latestReplyAuthorName ? `最新回复 ${item.latestReplyAuthorName}` : null,
                commentCount: item.commentCount,
                commentAccentColor: commentHeat.color,
              }}
              showBoard
            />
          )
        })}
      </div>
    </div>
  )
}
