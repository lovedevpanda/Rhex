import { findFollowFeedTargetIds } from "@/db/follow-queries"
import { findFollowingFeedPosts, findLatestFeedPosts, findLatestReplyComments, findLatestTopicPosts } from "@/db/forum-feed-queries"
import { findGlobalPinnedPosts } from "@/db/taxonomy-queries"
import { formatRelativeTime } from "@/lib/formatters"
import { extractPinnedPostIds } from "@/lib/pinned-posts"

import { resolvePostCoverImage } from "@/lib/post-cover"
import { getPostTypeLabel, type LocalPostType } from "@/lib/post-types"

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
  lastRepliedAt: string
  latestReplyAuthorName: string | null
  latestReplyExcerpt: string | null
  commentCount: number
  viewCount: number
  likeCount: number
  tipCount: number
  tipTotalPoints: number
  hasRedPacket: boolean
  isPinned: boolean

  pinScope?: string | null
  minViewLevel?: number | null
  minViewVipLevel?: number | null
  isFeatured: boolean
  type: LocalPostType
  typeLabel: string
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
    lastRepliedAt: formatRelativeTime(feedPost.lastCommentedAt ?? feedPost.publishedAt ?? feedPost.createdAt),
    latestReplyAuthorName: latestReply ? latestReply.user.nickname ?? latestReply.user.username : null,
    latestReplyExcerpt: latestReply ? latestReply.content.slice(0, 42) : null,
    commentCount: feedPost.commentCount,
    viewCount: feedPost.viewCount,
    likeCount: feedPost.likeCount,
    tipCount: feedPost.tipCount ?? 0,
    tipTotalPoints: feedPost.tipTotalPoints ?? 0,
    hasRedPacket: Boolean(feedPost.redPacket),
    isPinned: feedPost.isPinned,

    pinScope: feedPost.pinScope ?? (feedPost.isPinned ? "BOARD" : "NONE"),
    minViewLevel: feedPost.minViewLevel ?? 0,
    minViewVipLevel: feedPost.minViewVipLevel ?? 0,
    isFeatured: feedPost.isFeatured,
    type: postType,
    typeLabel: getPostTypeLabel(postType),
  }
}

export async function getLatestFeed(page = 1, pageSize = 20, sort: FeedSort = "latest", currentUserId?: number): Promise<ForumFeedItem[]> {
  if (sort === "following") {
    if (!currentUserId) {
      return []
    }

    const { boardIds, authorIds } = await findFollowFeedTargetIds(currentUserId)

    if (boardIds.length === 0 && authorIds.length === 0) {
      return []
    }

    const posts = await findFollowingFeedPosts(page, pageSize, sort, { boardIds, authorIds })

    return posts.map((post) => mapFeedPost(post))
  }

  if (page === 1) {
    const globalPinnedPosts = await findGlobalPinnedPosts()
    const pinnedPostIds = extractPinnedPostIds(globalPinnedPosts)
    const pinnedItems = globalPinnedPosts.map((post) => mapFeedPost(post))
    const normalPosts = await findLatestFeedPosts(1, pageSize, sort, pinnedPostIds)

    return [...pinnedItems, ...normalPosts.map((post) => mapFeedPost(post))]
  }

  const posts = await findLatestFeedPosts(page, pageSize, sort, [])

  return posts.map((post) => mapFeedPost(post))
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
