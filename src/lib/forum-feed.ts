import { unstable_cache } from "next/cache"

import { resolvePagination } from "@/db/helpers"
import { findFollowFeedTargetIds } from "@/db/follow-queries"
import { countFollowingFeedPosts, countLatestFeedPosts, findFollowingFeedPosts, findLatestFeedPosts, findLatestReplyComments, findLatestTopicPosts } from "@/db/forum-feed-queries"
import { shouldBypassPublicPostListCache, type PostListVisibilityViewer } from "@/db/post-list-visibility"
import { findGlobalPinnedPosts } from "@/db/taxonomy-queries"
import { FORUM_FEED_CACHE_TAG } from "@/lib/content-list-cache"
import { formatRelativeTime } from "@/lib/formatters"
import { applyAnonymousIdentityToPost, getAnonymousMaskDisplayIdentity } from "@/lib/post-anonymous"
import { extractPinnedPostIds } from "@/lib/pinned-posts"

import { resolvePostCoverImage } from "@/lib/post-cover"
import { getPublicPostContentText } from "@/lib/post-content"
import { parsePostRewardPoolConfigFromContent } from "@/lib/post-red-packets"
import { getPostStatusLabel, getPostTypeLabel, type LocalPostType } from "@/lib/post-types"
import { getUserAvatarPath, getUserDisplayName } from "@/lib/user-display"
import type { PostRewardPoolMode } from "@/lib/post-reward-pool-config"

export type FeedSort = "latest" | "new" | "hot" | "featured" | "weekly" | "following"

const PUBLIC_FEED_CACHE_REVALIDATE_SECONDS = 30
const PUBLIC_FEED_CACHE_MAX_PAGE = 3

export interface ForumFeedItem {
  id: string
  slug: string
  title: string
  summary: string
  contentMarkdown: string
  coverImage?: string | null
  boardName: string
  boardSlug: string
  boardIcon: string
  authorName: string
  authorUsername: string
  authorPublicUid?: string | null
  authorAvatarPath: string | null
  authorStatus?: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  authorVipLevel?: number | null
  authorVipExpiresAt?: string | null
  publishedAt: string
  publishedAtRaw: string
  lastRepliedAt: string
  lastRepliedAtRaw: string
  latestReplyAuthorName: string | null
  latestReplyAuthorUsername: string | null
  latestReplyCommentId: string | null
  latestReplyExcerpt: string | null
  commentCount: number
  viewCount: number
  likeCount: number
  tipCount: number
  tipTotalPoints: number
  hasRedPacket: boolean
  hasAttachments: boolean
  rewardMode?: PostRewardPoolMode
  isPinned: boolean

  pinScope?: string | null
  minViewLevel?: number | null
  minViewVipLevel?: number | null
  isFeatured: boolean
  type: LocalPostType
  typeLabel: string
  status: string
  statusLabel: string
  reviewNote?: string | null
}

async function readPublicFeedPage(
  page: number,
  pageSize: number,
  sort: Exclude<FeedSort, "following">,
  hotRecentWindowHours: number,
  viewer?: PostListVisibilityViewer | null,
): Promise<ForumFeedPageResult> {
  const [anonymousMaskIdentity, globalPinnedPosts] = await Promise.all([
    getAnonymousMaskDisplayIdentity(),
    sort === "featured" ? Promise.resolve([]) : findGlobalPinnedPosts({ homeVisibleOnly: true, viewer }),
  ])
  const pinnedPostIds = extractPinnedPostIds(globalPinnedPosts)
  const requestedPagination = resolvePagination({ page, pageSize }, Number.MAX_SAFE_INTEGER, [pageSize], pageSize)
  const [total, requestedNormalPosts] = await Promise.all([
    countLatestFeedPosts(pinnedPostIds, viewer, sort === "featured"),
    findLatestFeedPosts(requestedPagination.page, requestedPagination.pageSize, sort, pinnedPostIds, hotRecentWindowHours, viewer),
  ])
  const pagination = resolvePagination({ page, pageSize }, total, [pageSize], pageSize)
  const normalPosts = pagination.page === requestedPagination.page
    ? requestedNormalPosts
    : await findLatestFeedPosts(pagination.page, pagination.pageSize, sort, pinnedPostIds, hotRecentWindowHours, viewer)

  return {
    items: pagination.page === 1
      ? [...globalPinnedPosts.map((post) => mapFeedPost(post, anonymousMaskIdentity)), ...normalPosts.map((post) => mapFeedPost(post, anonymousMaskIdentity))]
      : normalPosts.map((post) => mapFeedPost(post, anonymousMaskIdentity)),
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: pagination.total,
    totalPages: pagination.totalPages,
    hasPrevPage: pagination.hasPrevPage,
    hasNextPage: pagination.hasNextPage,
  }
}

const getPersistentPublicFeedPage = unstable_cache(
  async (
    page: number,
    pageSize: number,
    sort: Exclude<FeedSort, "following">,
    hotRecentWindowHours: number,
  ) => readPublicFeedPage(page, pageSize, sort, hotRecentWindowHours),
  [FORUM_FEED_CACHE_TAG],
  {
    tags: [FORUM_FEED_CACHE_TAG],
    revalidate: PUBLIC_FEED_CACHE_REVALIDATE_SECONDS,
  },
)

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
  isAnonymous?: boolean
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
  status: string
  reviewNote?: string | null
  minViewLevel: number | null
  minViewVipLevel: number | null
  isFeatured: boolean
  type: LocalPostType | string
  publishedAt: Date | null
  lastCommentedAt: Date | null
  createdAt: Date
  board: { name: string; slug: string; iconPath: string | null }
  author: {
    id?: number
    username: string
    nickname: string | null
    avatarPath: string | null
    status: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
    vipLevel: number | null
    vipExpiresAt: Date | string | null
  }
  comments?: Array<{ id: string; content: string; userId?: number; useAnonymousIdentity?: boolean; user: { username: string; nickname: string | null } }>
  redPacket: { id: string } | null
  _count?: {
    attachments?: number
  }
}

function mapFeedPost(post: FeedPostRecord | PinnedFeedPostRecord, anonymousMaskIdentity: Awaited<ReturnType<typeof getAnonymousMaskDisplayIdentity>> = null): ForumFeedItem {
  const feedPost = post as unknown as FeedPost
  const latestReply = feedPost.comments?.[0]
  const postType = (feedPost.type ?? "NORMAL") as LocalPostType
  const publicContent = getPublicPostContentText(feedPost.content)
  const rewardPoolConfig = feedPost.redPacket ? parsePostRewardPoolConfigFromContent(feedPost.content) : null
  const maskedAuthor = applyAnonymousIdentityToPost({
    isAnonymous: Boolean(feedPost.isAnonymous),
    author: getUserDisplayName(feedPost.author),
    authorUsername: feedPost.author.username,
    authorAvatarPath: getUserAvatarPath(feedPost.author),
    authorStatus: feedPost.author.status ?? "ACTIVE",
    authorVipLevel: feedPost.author.vipLevel,
    authorIsVip: Boolean(feedPost.author.vipExpiresAt && new Date(feedPost.author.vipExpiresAt).getTime() > Date.now()),
  }, anonymousMaskIdentity)
  const latestReplyUsesAnonymousIdentity = Boolean(feedPost.isAnonymous && latestReply?.useAnonymousIdentity)
  const latestReplyAuthorName = latestReplyUsesAnonymousIdentity
    ? (anonymousMaskIdentity?.name ?? anonymousMaskIdentity?.username ?? "匿名用户")
    : (latestReply ? latestReply.user.nickname ?? latestReply.user.username : null)
  const latestReplyAuthorUsername = latestReplyUsesAnonymousIdentity ? null : (latestReply?.user.username ?? null)
  const latestReplyCommentId = latestReply?.id ?? null

  return {
    id: feedPost.id,
    slug: feedPost.slug,
    title: feedPost.title,
    summary: feedPost.summary ?? feedPost.title,
    contentMarkdown: publicContent,
    coverImage: resolvePostCoverImage(feedPost.content, feedPost.coverPath),
    boardName: feedPost.board.name,
    boardSlug: feedPost.board.slug,
    boardIcon: feedPost.board.iconPath ?? "💬",
    authorName: maskedAuthor.author,
    authorUsername: maskedAuthor.authorUsername ?? maskedAuthor.author,
    authorAvatarPath: maskedAuthor.authorAvatarPath ?? null,
    authorStatus: maskedAuthor.authorStatus ?? "ACTIVE",
    authorVipLevel: maskedAuthor.authorVipLevel ?? null,
    authorVipExpiresAt: maskedAuthor.authorIsVip ? (feedPost.author.vipExpiresAt ? new Date(feedPost.author.vipExpiresAt).toISOString() : null) : null,
    publishedAt: formatRelativeTime(feedPost.publishedAt ?? feedPost.createdAt),
    publishedAtRaw: (feedPost.publishedAt ?? feedPost.createdAt).toISOString(),
    lastRepliedAt: formatRelativeTime(feedPost.lastCommentedAt ?? feedPost.publishedAt ?? feedPost.createdAt),
    lastRepliedAtRaw: (feedPost.lastCommentedAt ?? feedPost.publishedAt ?? feedPost.createdAt).toISOString(),
    latestReplyAuthorName,
    latestReplyAuthorUsername,
    latestReplyCommentId,
    latestReplyExcerpt: latestReply ? latestReply.content.slice(0, 42) : null,
    commentCount: feedPost.commentCount,
    viewCount: feedPost.viewCount,
    likeCount: feedPost.likeCount,
    tipCount: feedPost.tipCount ?? 0,
    tipTotalPoints: feedPost.tipTotalPoints ?? 0,
    hasRedPacket: Boolean(feedPost.redPacket),
    hasAttachments: (feedPost._count?.attachments ?? 0) > 0,
    rewardMode: rewardPoolConfig?.mode,
    isPinned: feedPost.isPinned,

    pinScope: feedPost.pinScope ?? (feedPost.isPinned ? "BOARD" : "NONE"),
    status: feedPost.status,
    statusLabel: getPostStatusLabel(feedPost.status),
    reviewNote: feedPost.reviewNote ?? null,
    minViewLevel: feedPost.minViewLevel ?? 0,
    minViewVipLevel: feedPost.minViewVipLevel ?? 0,
    isFeatured: feedPost.isFeatured,
    type: postType,
    typeLabel: getPostTypeLabel(postType),
  }
}

export async function getLatestFeed(
  page = 1,
  pageSize = 20,
  sort: FeedSort = "latest",
  currentUserId?: number,
  hotRecentWindowHours = 72,
  viewer?: PostListVisibilityViewer | null,
): Promise<ForumFeedPageResult> {
  const resolvedViewer = viewer ?? (currentUserId ? { userId: currentUserId } : null)

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

    const { boardIds, authorIds, tagIds } = await findFollowFeedTargetIds(currentUserId)

    if (boardIds.length === 0 && authorIds.length === 0 && tagIds.length === 0) {
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

    const requestedPagination = resolvePagination({ page, pageSize }, Number.MAX_SAFE_INTEGER, [pageSize], pageSize)
    const [anonymousMaskIdentity, total, requestedPosts] = await Promise.all([
      getAnonymousMaskDisplayIdentity(),
      countFollowingFeedPosts({ boardIds, authorIds, tagIds }, resolvedViewer),
      findFollowingFeedPosts(requestedPagination.page, requestedPagination.pageSize, sort, { boardIds, authorIds, tagIds }, hotRecentWindowHours, resolvedViewer),
    ])
    const pagination = resolvePagination({ page, pageSize }, total, [pageSize], pageSize)
    const posts = pagination.page === requestedPagination.page
      ? requestedPosts
      : await findFollowingFeedPosts(pagination.page, pagination.pageSize, sort, { boardIds, authorIds, tagIds }, hotRecentWindowHours, resolvedViewer)

    return {
      items: posts.map((post) => mapFeedPost(post, anonymousMaskIdentity)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages: pagination.totalPages,
      hasPrevPage: pagination.hasPrevPage,
      hasNextPage: pagination.hasNextPage,
    }
  }

  if (!shouldBypassPublicPostListCache(resolvedViewer) && page <= PUBLIC_FEED_CACHE_MAX_PAGE) {
    return getPersistentPublicFeedPage(page, pageSize, sort, hotRecentWindowHours)
  }

  return readPublicFeedPage(page, pageSize, sort, hotRecentWindowHours, resolvedViewer)
}

export async function getLatestTopics(limit = 10) {
  const [posts, anonymousMaskIdentity] = await Promise.all([
    findLatestTopicPosts(limit),
    getAnonymousMaskDisplayIdentity(),
  ])

  return posts.map((post) => {
    const postType = ((post.type ?? "NORMAL") as LocalPostType)
    const maskedAuthor = applyAnonymousIdentityToPost({
      isAnonymous: Boolean(post.isAnonymous),
      author: post.author.nickname ?? post.author.username,
      authorUsername: post.author.username,
    }, anonymousMaskIdentity)

    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      createdAt: formatRelativeTime(post.createdAt),
      authorName: maskedAuthor.author,
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
