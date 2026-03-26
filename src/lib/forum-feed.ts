import { findLatestFeedPosts, findLatestReplyComments, findLatestTopicPosts } from "@/db/forum-feed-queries"
import { findGlobalPinnedPosts } from "@/db/taxonomy-queries"
import { formatRelativeTime } from "@/lib/formatters"
import { extractPinnedPostIds } from "@/lib/pinned-posts"

import { getPostTypeLabel, type LocalPostType } from "@/lib/post-types"

export type FeedSort = "latest" | "new" | "hot" | "weekly"

export interface ForumFeedItem {
  id: string
  slug: string
  title: string
  summary: string
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
  isFeatured: boolean
  type: LocalPostType
  typeLabel: string
}

type FeedPostRecord = Awaited<ReturnType<typeof findLatestFeedPosts>>[number]

type PinnedFeedPostRecord = Awaited<ReturnType<typeof findGlobalPinnedPosts>>[number]

function mapFeedPost(post: FeedPostRecord | PinnedFeedPostRecord): ForumFeedItem {
  const feedPost = post as typeof post & {
    board: { name: string; slug: string; iconPath?: string | null }
    author: {
      username: string
      nickname: string | null
      avatarPath: string | null
      status?: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
      vipLevel?: number | null
      vipExpiresAt?: Date | string | null
    }
    comments?: Array<{ content: string; user: { username: string; nickname: string | null } }>
    type?: LocalPostType | string
    tipCount?: number | null
    tipTotalPoints?: number | null
    redPacket?: { id: string } | null
    publishedAt?: Date | null

    createdAt: Date
    lastCommentedAt?: Date | null
    summary?: string | null
    minViewLevel?: number | null
    pinScope?: string | null
  }
  const latestReply = feedPost.comments?.[0]
  const postType = (feedPost.type ?? "NORMAL") as LocalPostType

  return {
    id: feedPost.id,
    slug: feedPost.slug,
    title: feedPost.title,
    summary: feedPost.summary ?? feedPost.title,
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
    isFeatured: feedPost.isFeatured,
    type: postType,
    typeLabel: getPostTypeLabel(postType),
  }
}

export async function getLatestFeed(page = 1, pageSize = 20, sort: FeedSort = "latest"): Promise<ForumFeedItem[]> {
  const globalPinnedPosts = await findGlobalPinnedPosts()

  if (page === 1) {
    const pinnedPostIds = extractPinnedPostIds(globalPinnedPosts)
    const pinnedItems = globalPinnedPosts.map((post) => mapFeedPost(post))
    const normalPosts = await findLatestFeedPosts(1, pageSize, sort, pinnedPostIds)

    return [...pinnedItems, ...normalPosts.map((post) => mapFeedPost(post))]
  }


  const excludedPostIds = extractPinnedPostIds(globalPinnedPosts)
  const posts = await findLatestFeedPosts(page, pageSize, sort, excludedPostIds)

  return posts.map((post) => mapFeedPost(post))
}

export async function getLatestTopics(limit = 10) {
  const posts = await findLatestTopicPosts(limit)

  return posts.map((post) => {
    const topicPost = post as typeof post & {
      author: { username: string; nickname: string | null }
      board: { name: string }
      type?: LocalPostType | string
    }
    const postType = (topicPost.type ?? "NORMAL") as LocalPostType

    return {
      id: topicPost.id,
      slug: topicPost.slug,
      title: topicPost.title,
      createdAt: formatRelativeTime(topicPost.createdAt),
      authorName: topicPost.author.nickname ?? topicPost.author.username,
      boardName: topicPost.board.name,
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
