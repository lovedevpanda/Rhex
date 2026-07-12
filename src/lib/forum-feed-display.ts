import type { FeedSort, ForumFeedItem } from "@/lib/forum-feed"
import { resolvePostHeatStyle } from "@/lib/post-heat"
import { resolvePostListPreviewMedia, type PostListPreviewMedia } from "@/lib/post-list-media"
import { buildPostListPreviewContent } from "@/lib/post-list-preview-content"
import type { PostListTipSummary } from "@/lib/post-list-tipping"
import type { PostRewardPoolMode } from "@/lib/post-reward-pool-config"
import { getSiteSettings } from "@/lib/site-settings"
import { getVipNameClass, isVipActive } from "@/lib/vip-status"

export interface FeedDisplayItem {
  id: string
  slug: string
  title: string
  type: ForumFeedItem["type"]
  typeLabel: string
  status: string
  statusLabel: string
  reviewNote?: string | null
  pinScope?: string | null
  pinLabel?: string | null
  hasRedPacket: boolean
  hasAttachments: boolean
  rewardMode?: PostRewardPoolMode
  minViewLevel?: number
  minViewVipLevel?: number
  isFeatured: boolean
  boardName: string
  boardSlug: string
  boardIcon: string
  authorName: string
  authorUsername: string
  authorPublicUid?: string | null
  authorAvatarPath: string | null
  authorStatus?: ForumFeedItem["authorStatus"]
  authorIsVip: boolean
  authorVipLevel?: number | null
  authorNameClassName: string
  metaPrimary: string
  metaPrimaryRaw?: string
  metaSecondary?: string | null
  latestReplyAuthorName?: string | null
  latestReplyAuthorUsername?: string | null
  latestReplyCommentId?: string | null
  commentCount: number
  likeCount?: number
  favoriteCount?: number
  tipCount?: number
  tipTotalPoints?: number
  tipping?: PostListTipSummary
  viewCount?: number
  commentAccentColor: string
  coverImage?: string | null
  previewMedia?: PostListPreviewMedia | null
  excerpt: string
  contentMarkdown?: string
  contentPreviewMarkdown?: string
  contentPreviewHtml?: string
}

type FeedDisplaySettings = Pick<
  Awaited<ReturnType<typeof getSiteSettings>>,
  "heatViewWeight" | "heatCommentWeight" | "heatLikeWeight" | "heatTipCountWeight" | "heatTipPointsWeight" | "heatStageThresholds" | "heatStageColors"
  | "markdownEmojiMap" | "postLinkDisplayMode"
>

function resolveGalleryCoverImage(coverImage: string | null | undefined, previewMedia: PostListPreviewMedia | null) {
  const normalizedCoverImage = coverImage?.trim()
  if (normalizedCoverImage) {
    return normalizedCoverImage
  }

  return previewMedia?.type === "image" ? previewMedia.src : null
}

export function getFeedPinLabel(pinScope?: string | null) {
  if (pinScope === "GLOBAL") {
    return "全局置顶"
  }

  return null
}

export function mapForumFeedItemsToDisplayItems(
  items: ForumFeedItem[],
  currentSort: FeedSort,
  settings: FeedDisplaySettings,
): FeedDisplayItem[] {
  return items.map((item) => {
    const commentHeat = resolvePostHeatStyle({
      views: item.viewCount,
      comments: item.commentCount,
      likes: item.likeCount,
      tipCount: item.tipCount,
      tipPoints: item.tipTotalPoints,
    }, settings)
    const authorIsVip = isVipActive({ vipLevel: item.authorVipLevel, vipExpiresAt: item.authorVipExpiresAt })

    const contentMarkdown = typeof item.contentMarkdown === "string" ? item.contentMarkdown : ""
    const previewMedia = resolvePostListPreviewMedia(contentMarkdown, item.coverImage)
    const previewContent = buildPostListPreviewContent({
      contentMarkdown,
      previewMedia,
      markdownEmojiMap: settings.markdownEmojiMap,
      postLinkDisplayMode: settings.postLinkDisplayMode,
    })

    return {
      id: item.id,
      slug: item.slug,
      title: item.title,
      type: item.type,
      typeLabel: item.typeLabel,
      status: item.status,
      statusLabel: item.statusLabel,
      reviewNote: item.reviewNote ?? null,
      pinScope: item.pinScope,
      pinLabel: getFeedPinLabel(item.pinScope),
      hasRedPacket: item.hasRedPacket,
      hasAttachments: item.hasAttachments,
      rewardMode: item.rewardMode,
      minViewLevel: item.minViewLevel ?? undefined,
      minViewVipLevel: item.minViewVipLevel ?? undefined,
      isFeatured: item.isFeatured,
      boardName: item.boardName,
      boardSlug: item.boardSlug,
      boardIcon: item.boardIcon,
      authorName: item.authorName,
      authorUsername: item.authorUsername,
      authorPublicUid: item.authorPublicUid,
      authorAvatarPath: item.authorAvatarPath,
      authorStatus: item.authorStatus,
      authorIsVip,
      authorVipLevel: item.authorVipLevel,
      authorNameClassName: getVipNameClass(authorIsVip, item.authorVipLevel, { emphasize: true }),
      metaPrimary: currentSort === "new" ? item.publishedAt : item.lastRepliedAt,
      metaPrimaryRaw: currentSort === "new" ? item.publishedAtRaw : item.lastRepliedAtRaw,
      metaSecondary: (currentSort === "latest" || currentSort === "new" || currentSort === "hot" || currentSort === "following") && item.latestReplyAuthorName
        ? `最新回复 ${item.latestReplyAuthorName}`
        : null,
      latestReplyAuthorName: item.latestReplyAuthorName ?? null,
      latestReplyAuthorUsername: item.latestReplyAuthorUsername ?? null,
      latestReplyCommentId: item.latestReplyCommentId ?? null,
      commentCount: item.commentCount,
      likeCount: item.likeCount,
      tipCount: item.tipCount,
      tipTotalPoints: item.tipTotalPoints,
      viewCount: item.viewCount,
      commentAccentColor: commentHeat.color,
      coverImage: resolveGalleryCoverImage(item.coverImage, previewMedia),
      previewMedia,
      excerpt: item.summary,
      contentMarkdown,
      contentPreviewMarkdown: previewContent.markdown,
      contentPreviewHtml: previewContent.html,
    }
  })
}
