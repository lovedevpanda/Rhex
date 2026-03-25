import { findLatestFeedPosts, findLatestReplyComments, findLatestTopicPosts } from "@/db/forum-feed-queries"
import { formatRelativeTime } from "@/lib/formatters"
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
  isPinned: boolean
  pinScope?: string | null
  minViewLevel?: number | null
  isFeatured: boolean

  type: LocalPostType


  typeLabel: string
}



function getPinScopeWeight(scope?: string | null) {
  if (scope === "GLOBAL") return 3
  if (scope === "ZONE") return 2
  if (scope === "BOARD") return 1
  return 0
}

export async function getLatestFeed(page = 1, pageSize = 20, sort: FeedSort = "latest"): Promise<ForumFeedItem[]> {

  const posts = await findLatestFeedPosts(page, pageSize, sort)


  const orderedPosts = sort === "latest"
    ? [...posts].sort((left, right) => {
        const pinDiff = getPinScopeWeight(right.pinScope ?? (right.isPinned ? "BOARD" : "NONE")) - getPinScopeWeight(left.pinScope ?? (left.isPinned ? "BOARD" : "NONE"))
        if (pinDiff !== 0) {
          return pinDiff
        }

        const leftTime = new Date(left.lastCommentedAt ?? left.publishedAt ?? left.createdAt).getTime()
        const rightTime = new Date(right.lastCommentedAt ?? right.publishedAt ?? right.createdAt).getTime()
        return rightTime - leftTime
      })
    : [...posts].sort((left, right) => {
        const pinDiff = getPinScopeWeight(right.pinScope ?? (right.isPinned ? "BOARD" : "NONE")) - getPinScopeWeight(left.pinScope ?? (left.isPinned ? "BOARD" : "NONE"))
        if (pinDiff !== 0) {
          return pinDiff
        }
        return 0
      })


  return orderedPosts.map((post) => {
    const feedPost = post as typeof post & {
      board: { name: string; slug: string; iconPath?: string | null }
      author: { username: string; nickname: string | null; avatarPath: string | null; vipLevel?: number | null; vipExpiresAt?: Date | string | null }

      comments: Array<{ content: string; user: { username: string; nickname: string | null } }>
      type?: LocalPostType | string
      tipCount?: number | null
      tipTotalPoints?: number | null
    }
    const latestReply = feedPost.comments[0]
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
      isPinned: feedPost.isPinned,
      pinScope: feedPost.pinScope ?? (feedPost.isPinned ? "BOARD" : "NONE"),
      minViewLevel: feedPost.minViewLevel ?? 0,
      isFeatured: feedPost.isFeatured,


      type: postType,
      typeLabel: getPostTypeLabel(postType),
    }
  })

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
