import type { SitePostItem } from "@/lib/posts"
import { resolvePostHeatStyle } from "@/lib/post-heat"
import { resolvePostListPreviewMedia, type PostListPreviewMedia } from "@/lib/post-list-media"
import { buildPostListPreviewContent } from "@/lib/post-list-preview-content"
import type { PostListTipSummary } from "@/lib/post-list-tipping"
import { getSiteSettings } from "@/lib/site-settings"
import { getVipNameClass } from "@/lib/vip-status"

export interface PostStreamDisplayItem {
  id: string
  slug: string
  title: string
  excerpt: string
  contentMarkdown?: string
  coverImage?: string | null
  previewMedia?: PostListPreviewMedia | null
  type?: string
  typeLabel: string
  status: string
  statusLabel: string
  reviewNote?: string | null
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
  authorPublicUid?: string | null
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
  contentPreviewMarkdown?: string
  contentPreviewHtml?: string
}

type PostStreamDisplaySettings = Pick<
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

    const contentMarkdown = typeof post.contentMarkdown === "string" ? post.contentMarkdown : ""
    const previewMedia = resolvePostListPreviewMedia(contentMarkdown, post.coverImage)
    const previewContent = buildPostListPreviewContent({
      contentMarkdown,
      previewMedia,
      markdownEmojiMap: settings.markdownEmojiMap,
      postLinkDisplayMode: settings.postLinkDisplayMode,
    })

    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      contentMarkdown,
      coverImage: resolveGalleryCoverImage(post.coverImage, previewMedia),
      previewMedia,
      type: post.type,
      typeLabel: post.typeLabel,
      status: post.status,
      statusLabel: post.statusLabel,
      reviewNote: post.reviewNote ?? null,
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
      authorPublicUid: post.authorPublicUid,
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
      latestReplyAuthorUsername: post.latestReplyAuthorUsername ?? null,
      latestReplyCommentId: post.latestReplyCommentId ?? null,
      commentCount: post.stats.comments,
      likeCount: post.stats.likes,
      favoriteCount: post.stats.favorites,
      tipCount: post.stats.tips,
      tipTotalPoints: post.stats.tipPoints,
      viewCount: post.stats.views,
      commentAccentColor: commentHeat.color,
      contentPreviewMarkdown: previewContent.markdown,
      contentPreviewHtml: previewContent.html,
    }
  })
}
