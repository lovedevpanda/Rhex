import { resolvePagination } from "@/db/helpers"
import { findFollowFeedTargetIds } from "@/db/follow-queries"
import { countFollowingFeedPosts, countLatestFeedPosts, findFollowingFeedPosts, findLatestFeedPosts, findLatestReplyComments, findLatestTopicPosts } from "@/db/forum-feed-queries"
import { findGlobalPinnedPosts } from "@/db/taxonomy-queries"
import { formatRelativeTime } from "@/lib/formatters"
import { extractPinnedPostIds } from "@/lib/pinned-posts"

import { resolvePostCoverImage } from "@/lib/post-cover"
import { parsePostRewardPoolConfigFromContent } from "@/lib/post-red-packets"
import { getPostTypeLabel, type LocalPostType } from "@/lib/post-types"
import type { PostRewardPoolMode } from "@/lib/post-reward-pool-config"

export type FeedSort = "latest" | "new" | "hot" | "weekly" | "following"

export interface ForumFeedItem {
  id: string
  slug: string
  title: string
  summary: string
  coverImage?: string | null
  boardName: string
  boardSlug: string
  boardIcon: string
  authorName: string
  authorUsername: string
  authorAvatarPath: string | null
  authorStatus?: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  authorVipLevel?: number | null
  authorVipExpiresAt?: string | null
  publishedAt: string
  publishedAtRaw: string
  lastRepliedAt: string
  lastRepliedAtRaw: string
  latestReplyAuthorName: string | null
  latestReplyExcerpt: string | null
  commentCount: number
  viewCount: number
  likeCount: number
  tipCount: number
  tipTotalPoints: number
  hasRedPacket: boolean
  rewardMode?: PostRewardPoolMode
  isPinned: boolean

  pinScope?: string | null
  minViewLevel?: number | null
  minViewVipLevel?: number | null
  isFeatured: boolean
  type: LocalPostType
  typeLabel: string
}

export interface ForumFeedPageResult {
  items: ForumFeedItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

type FeedPostRecord = Awaited<ReturnType<typeof findLatestFeedPosts>>[number]

type PinnedFeedPostRecord = Awaited<ReturnType<typeof findGlobalPinnedPosts>>[number]

type FeedPost = {
  isPinned: boolean
  id: string
  slug: string
  title: string
  summary: string | null
  content: string
  coverPath: string | null
  commentCount: number
  viewCount: number
  likeCount: number
  tipCount: number | null
  tipTotalPoints: number | null
  pinScope: string | null
  minViewLevel: number | null
  minViewVipLevel: number | null
  isFeatured: boolean
  type: LocalPostType | string
  publishedAt: Date | null
  lastCommentedAt: Date | null
  createdAt: Date
  board: { name: string; slug: string; iconPath: string | null }
  author: {
    username: string
    nickname: string | null
    avatarPath: string | null
    status: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
    vipLevel: number | null
    vipExpiresAt: Date | string | null
  }
  comments?: Array<{ content: string; user: { username: string; nickname: string | null } }>
  redPacket: { id: string } | null
}

function mapFeedPost(post: FeedPostRecord | PinnedFeedPostRecord): ForumFeedItem {
  const feedPost = post as unknown as FeedPost
  const latestReply = feedPost.comments?.[0]
  const postType = (feedPost.type ?? "NORMAL") as LocalPostType
  const rewardPoolConfig = feedPost.redPacket ? parsePostRewardPoolConfigFromContent(feedPost.content) : null

  return {
    id: feedPost.id,
    slug: feedPost.slug,
    title: feedPost.title,
    summary: feedPost.summary ?? feedPost.title,
    coverImage: resolvePostCoverImage(feedPost.content, feedPost.coverPath),
    boardName: feedPost.board.name,
    boardSlug: feedPost.board.slug,
    boardIcon: feedPost.board.iconPath ?? "💬",
    authorName: feedPost.author.nickname ?? feedPost.author.username,
    authorUsername: feedPost.author.username,
    authorAvatarPath: feedPost.author.avatarPath,
    authorStatus: feedPost.author.status ?? "ACTIVE",
    authorVipLevel: feedPost.author.vipLevel,
    authorVipExpiresAt: feedPost.author.vipExpiresAt ? new Date(feedPost.author.vipExpiresAt).toISOString() : null,
    publishedAt: formatRelativeTime(feedPost.publishedAt ?? feedPost.createdAt),
    publishedAtRaw: (feedPost.publishedAt ?? feedPost.createdAt).toISOString(),
    lastRepliedAt: formatRelativeTime(feedPost.lastCommentedAt ?? feedPost.publishedAt ?? feedPost.createdAt),
    lastRepliedAtRaw: (feedPost.lastCommentedAt ?? feedPost.publishedAt ?? feedPost.createdAt).toISOString(),
    latestReplyAuthorName: latestReply ? latestReply.user.nickname ?? latestReply.user.username : null,
    latestReplyExcerpt: latestReply ? latestReply.content.slice(0, 42) : null,
    commentCount: feedPost.commentCount,
    viewCount: feedPost.viewCount,
    likeCount: feedPost.likeCount,
    tipCount: feedPost.tipCount ?? 0,
    tipTotalPoints: feedPost.tipTotalPoints ?? 0,
    hasRedPacket: Boolean(feedPost.redPacket),
    rewardMode: rewardPoolConfig?.mode,
    isPinned: feedPost.isPinned,

    pinScope: feedPost.pinScope ?? (feedPost.isPinned ? "BOARD" : "NONE"),
    minViewLevel: feedPost.minViewLevel ?? 0,
    minViewVipLevel: feedPost.minViewVipLevel ?? 0,
    isFeatured: feedPost.isFeatured,
    type: postType,
    typeLabel: getPostTypeLabel(postType),
  }
}

export async function getLatestFeed(page = 1, pageSize = 20, sort: FeedSort = "latest", currentUserId?: number): Promise<ForumFeedPageResult> {
  if (sort === "following") {
    if (!currentUserId) {
      return {
        items: [],
        page: 1,
        pageSize,
        total: 0,
        totalPages: 1,
        hasPrevPage: false,
        hasNextPage: false,
      }
    }

    const { boardIds, authorIds } = await findFollowFeedTargetIds(currentUserId)

    if (boardIds.length === 0 && authorIds.length === 0) {
      return {
        items: [],
        page: 1,
        pageSize,
        total: 0,
        totalPages: 1,
        hasPrevPage: false,
        hasNextPage: false,
      }
    }

    const total = await countFollowingFeedPosts({ boardIds, authorIds })
    const pagination = resolvePagination({ page, pageSize }, total, [pageSize], pageSize)
    const posts = await findFollowingFeedPosts(pagination.page, pagination.pageSize, sort, { boardIds, authorIds })

    return {
      items: posts.map((post) => mapFeedPost(post)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages: pagination.totalPages,
      hasPrevPage: pagination.hasPrevPage,
      hasNextPage: pagination.hasNextPage,
    }
  }

  const globalPinnedPosts = await findGlobalPinnedPosts()
  const pinnedPostIds = extractPinnedPostIds(globalPinnedPosts)
  const total = await countLatestFeedPosts(pinnedPostIds)
  const pagination = resolvePagination({ page, pageSize }, total, [pageSize], pageSize)
  const normalPosts = await findLatestFeedPosts(pagination.page, pagination.pageSize, sort, pinnedPostIds)

  return {
    items: pagination.page === 1
      ? [...globalPinnedPosts.map((post) => mapFeedPost(post)), ...normalPosts.map((post) => mapFeedPost(post))]
      : normalPosts.map((post) => mapFeedPost(post)),
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: pagination.total,
    totalPages: pagination.totalPages,
    hasPrevPage: pagination.hasPrevPage,
    hasNextPage: pagination.hasNextPage,
  }
}

export async function getLatestTopics(limit = 10) {
  const posts = await findLatestTopicPosts(limit)

  return posts.map((post) => {
    const postType = ((post.type ?? "NORMAL") as LocalPostType)

    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      createdAt: formatRelativeTime(post.createdAt),
      authorName: post.author.nickname ?? post.author.username,
      boardName: post.board.name,
      typeLabel: getPostTypeLabel(postType),
    }
  })
}

export async function getLatestReplies(limit = 10) {
  const comments = await findLatestReplyComments(limit)

  return comments.map((comment) => ({
    id: comment.id,
    excerpt: comment.content.slice(0, 48),
    createdAt: formatRelativeTime(comment.createdAt),
    authorName: comment.user.nickname ?? comment.user.username,
    postSlug: comment.post.slug,
    postTitle: comment.post.title,
  }))
}
