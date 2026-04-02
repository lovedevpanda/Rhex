import Link from "next/link"
import { Clock3, Flame, Sparkles, Users2 } from "lucide-react"

import { ForumPostListItem } from "@/components/forum-post-list-item"
import { PostGalleryGrid } from "@/components/post-gallery-grid"
import type { FeedSort, ForumFeedItem } from "@/lib/forum-feed"
import { buildHomeFeedHref } from "@/lib/home-feed-route"
import { normalizePostListDisplayMode, type PostListDisplayMode } from "@/lib/post-list-display"
import { getSiteSettings } from "@/lib/site-settings"
import { resolvePostHeatStyle } from "@/lib/post-heat"
import { getVipNameClass, isVipActive } from "@/lib/vip-status"

interface ForumFeedListProps {
  items: ForumFeedItem[]
  currentSort: FeedSort
  listDisplayMode?: PostListDisplayMode
  postLinkDisplayMode?: "SLUG" | "ID"
}

interface FeedDisplayItem {
  id: string
  slug: string
  title: string
  type: ForumFeedItem["type"]
  typeLabel: string
  pinScope?: string | null
  pinLabel?: string | null
  hasRedPacket: boolean
  minViewLevel?: number
  minViewVipLevel?: number
  isFeatured: boolean
  boardName: string
  boardSlug: string
  boardIcon: string
  authorName: string
  authorUsername: string
  authorAvatarPath: string | null
  authorStatus?: ForumFeedItem["authorStatus"]
  authorIsVip: boolean
  authorVipLevel?: number | null
  authorNameClassName: string
  metaPrimary: string
  metaSecondary?: string | null
  commentCount: number
  commentAccentColor: string
  coverImage?: string | null
  excerpt: string
}

const tabs: Array<{ key: Exclude<FeedSort, "weekly">; label: string; icon: typeof Clock3 }> = [
  { key: "latest", label: "最新", icon: Clock3 },
  { key: "new", label: "新贴", icon: Sparkles },
  { key: "hot", label: "热门", icon: Flame },
  { key: "following", label: "关注", icon: Users2 },
]

function getFeedPinLabel(pinScope?: string | null) {
  if (pinScope === "GLOBAL") {
    return "全局置顶"
  }



  return null
}

export async function ForumFeedList({ items, currentSort, listDisplayMode, postLinkDisplayMode = "SLUG" }: ForumFeedListProps) {
  const settings = await getSiteSettings()
  const resolvedListDisplayMode = normalizePostListDisplayMode(listDisplayMode)
  const mapFeedDisplayItem = (item: ForumFeedItem): FeedDisplayItem => {
    const commentHeat = resolvePostHeatStyle({
      views: item.viewCount,
      comments: item.commentCount,
      likes: item.likeCount,
      tipCount: item.tipCount,
      tipPoints: item.tipTotalPoints,
    }, settings)
    const authorIsVip = isVipActive({ vipLevel: item.authorVipLevel, vipExpiresAt: item.authorVipExpiresAt })

    return {
      id: item.id,
      slug: item.slug,
      title: item.title,
      type: item.type,
      typeLabel: item.typeLabel,
      pinScope: item.pinScope,
      pinLabel: getFeedPinLabel(item.pinScope),
      hasRedPacket: item.hasRedPacket,
      minViewLevel: item.minViewLevel ?? undefined,
      minViewVipLevel: item.minViewVipLevel ?? undefined,
      isFeatured: item.isFeatured,
      boardName: item.boardName,
      boardSlug: item.boardSlug,
      boardIcon: item.boardIcon,
      authorName: item.authorName,
      authorUsername: item.authorUsername,
      authorAvatarPath: item.authorAvatarPath,
      authorStatus: item.authorStatus,
      authorIsVip,
      authorVipLevel: item.authorVipLevel,
      authorNameClassName: getVipNameClass(authorIsVip, item.authorVipLevel, { emphasize: true }),
      metaPrimary: currentSort === "new" ? item.publishedAt : item.lastRepliedAt,
      metaSecondary: (currentSort === "latest" || currentSort === "following") && item.latestReplyAuthorName ? `最新回复 ${item.latestReplyAuthorName}` : null,
      commentCount: item.commentCount,
      commentAccentColor: commentHeat.color,
      coverImage: item.coverImage,
      excerpt: item.summary,
    }
  }
  const pinnedItems = items.filter((item) => item.pinScope === "GLOBAL").map(mapFeedDisplayItem)
  const normalItems = items.filter((item) => item.pinScope !== "GLOBAL").map(mapFeedDisplayItem)

  return (
    <div className="overflow-hidden rounded-md bg-background">
      <div className="flex items-center justify-between gap-1 border-b py-2 lg:justify-start lg:gap-2 lg:px-4 lg:py-3">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = currentSort === tab.key

          return (
            <Link
              key={tab.key}
              href={buildHomeFeedHref(tab.key)}
              className={active ? "flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[13px] font-medium text-foreground sm:px-4 sm:py-2 sm:text-sm lg:gap-2" : "flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent/50 sm:px-4 sm:py-2 sm:text-sm lg:gap-2"}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>

      <div className="lg:pl-4">
        {pinnedItems.map((item) => {
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
                hasRedPacket: item.hasRedPacket,
                minViewLevel: item.minViewLevel ?? undefined,
                minViewVipLevel: item.minViewVipLevel ?? undefined,
                isFeatured: item.isFeatured,
                boardName: item.boardName,
                boardSlug: item.boardSlug,
                boardIcon: item.boardIcon,
                authorName: item.authorName,
                authorUsername: item.authorUsername,
                authorAvatarPath: item.authorAvatarPath,
                authorStatus: item.authorStatus,
                authorIsVip: item.authorIsVip,
                authorVipLevel: item.authorVipLevel,
                authorNameClassName: item.authorNameClassName,
                metaPrimary: item.metaPrimary,
                metaSecondary: item.metaSecondary,
                commentCount: item.commentCount,
                commentAccentColor: item.commentAccentColor,
              }}
              showBoard
              postLinkDisplayMode={postLinkDisplayMode}
            />
          )
        })}
        {pinnedItems.length > 0 && normalItems.length > 0 && resolvedListDisplayMode === "GALLERY" ? (
          <div className="mb-2 mt-4 flex items-center gap-3 px-3 text-xs text-muted-foreground">
            <span className="rounded-full border border-border bg-background px-2.5 py-1 font-medium">最新内容</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        ) : null}
        {resolvedListDisplayMode === "GALLERY" ? (
          <PostGalleryGrid
            items={normalItems.map((item) => ({
              id: item.id,
              slug: item.slug,
              title: item.title,
              excerpt: item.excerpt,
              coverImage: item.coverImage,
              type: item.type,
              typeLabel: item.typeLabel,
              pinScope: item.pinScope,
              pinLabel: item.pinLabel,
              hasRedPacket: item.hasRedPacket,
              minViewLevel: item.minViewLevel,
              minViewVipLevel: item.minViewVipLevel,
              isFeatured: item.isFeatured,
              boardName: item.boardName,
              boardSlug: item.boardSlug,
              boardIcon: item.boardIcon,
              authorName: item.authorName,
              authorUsername: item.authorUsername,
              authorStatus: item.authorStatus,
              authorIsVip: item.authorIsVip,
              authorVipLevel: item.authorVipLevel,
              authorNameClassName: item.authorNameClassName,
              metaPrimary: item.metaPrimary,
              metaSecondary: item.metaSecondary,
              commentCount: item.commentCount,
              commentAccentColor: item.commentAccentColor,
            }))}
            showBoard
            postLinkDisplayMode={postLinkDisplayMode}
          />
        ) : normalItems.map((item) => {
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
                hasRedPacket: item.hasRedPacket,
                minViewLevel: item.minViewLevel ?? undefined,
                minViewVipLevel: item.minViewVipLevel ?? undefined,
                isFeatured: item.isFeatured,
                boardName: item.boardName,
                boardSlug: item.boardSlug,
                boardIcon: item.boardIcon,
                authorName: item.authorName,
                authorUsername: item.authorUsername,
                authorAvatarPath: item.authorAvatarPath,
                authorStatus: item.authorStatus,
                authorIsVip: item.authorIsVip,
                authorVipLevel: item.authorVipLevel,
                authorNameClassName: item.authorNameClassName,
                metaPrimary: item.metaPrimary,
                metaSecondary: item.metaSecondary,
                commentCount: item.commentCount,
                commentAccentColor: item.commentAccentColor,
              }}
              showBoard
              postLinkDisplayMode={postLinkDisplayMode}
            />
          )
        })}
      </div>
    </div>
  )
}
