import type { SitePostItem } from "@/lib/posts"
import { resolvePostHeatStyle } from "@/lib/post-heat"
import { getSiteSettings } from "@/lib/site-settings"
import { getVipNameClass } from "@/lib/vip-status"

export interface PostStreamDisplayItem {
  id: string
  slug: string
  title: string
  excerpt: string
  coverImage?: string | null
  type?: string
  typeLabel: string
  pinScope?: string | null
  pinLabel?: string | null
  hasRedPacket?: boolean
  hasAttachments?: boolean
  rewardMode?: SitePostItem["rewardMode"]
  minViewLevel?: number
  minViewVipLevel?: number
  isFeatured: boolean
  boardName: string
  boardSlug?: string
  boardIcon?: string
  authorName: string
  authorUsername: string
  authorAvatarPath?: string | null
  authorStatus?: SitePostItem["authorStatus"]
  authorIsVip?: boolean
  authorVipLevel?: number | null
  authorNameClassName?: string
  authorDisplayedBadges?: SitePostItem["authorDisplayedBadges"]
  metaPrimary: string
  metaPrimaryRaw?: string
  metaSecondary?: string | null
  latestReplyAuthorName?: string | null
  commentCount: number
  commentAccentColor: string
}

type PostStreamDisplaySettings = Pick<
  Awaited<ReturnType<typeof getSiteSettings>>,
  "heatViewWeight" | "heatCommentWeight" | "heatLikeWeight" | "heatTipCountWeight" | "heatTipPointsWeight" | "heatStageThresholds" | "heatStageColors"
>

export function getVisiblePinLabel(
  pinScope: SitePostItem["pinScope"],
  visiblePinScopes: Array<"GLOBAL" | "ZONE" | "BOARD">,
) {
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

export function mapSitePostsToDisplayItems(
  posts: SitePostItem[],
  settings: PostStreamDisplaySettings,
  visiblePinScopes: Array<"GLOBAL" | "ZONE" | "BOARD">,
): PostStreamDisplayItem[] {
  return posts.map((post) => {
    const commentHeat = resolvePostHeatStyle({
      views: post.stats.views,
      comments: post.stats.comments,
      likes: post.stats.likes,
      tipCount: post.stats.tips,
      tipPoints: post.stats.tipPoints,
    }, settings)

    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      coverImage: post.coverImage,
      type: post.type,
      typeLabel: post.typeLabel,
      pinScope: post.pinScope,
      pinLabel: getVisiblePinLabel(post.pinScope, visiblePinScopes),
      hasRedPacket: post.hasRedPacket,
      hasAttachments: post.hasAttachments,
      rewardMode: post.rewardMode,
      minViewLevel: post.minViewLevel,
      minViewVipLevel: post.minViewVipLevel,
      isFeatured: post.isFeatured,
      boardName: post.board,
      boardSlug: post.boardSlug,
      boardIcon: post.boardIcon,
      authorName: post.author,
      authorUsername: post.authorUsername ?? post.author,
      authorAvatarPath: post.authorAvatarPath,
      authorStatus: post.authorStatus,
      authorIsVip: post.authorIsVip,
      authorVipLevel: post.authorVipLevel,
      authorNameClassName: getVipNameClass(post.authorIsVip, post.authorVipLevel, { emphasize: true }),
      authorDisplayedBadges: post.authorDisplayedBadges,
      metaPrimary: post.publishedAt,
      metaPrimaryRaw: post.publishedAtRaw,
      metaSecondary: post.latestReplyAuthorName ? `最新回复 ${post.latestReplyAuthorName}` : null,
      latestReplyAuthorName: post.latestReplyAuthorName ?? null,
      commentCount: post.stats.comments,
      commentAccentColor: commentHeat.color,
    }
  })
}
