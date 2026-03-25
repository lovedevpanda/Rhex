import { countRootCommentsByPostId, countUserRepliesByPostId, findRepliesByParentIds, findRootCommentsByPostId } from "@/db/comment-queries"
import { formatRelativeTime } from "@/lib/formatters"
import { getUserDisplayName } from "@/lib/users"
import { getVipLevel, isVipActive } from "@/lib/vip-status"

const AUTHOR_ONLY_COMMENT_PLACEHOLDER = "此评论仅楼主可看"

export interface SiteCommentReplyItem {
  id: string
  author: string
  authorId: number
  authorUsername: string
  authorAvatarPath?: string | null
  authorStatus: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  authorIsVip?: boolean
  authorVipLevel?: number
  authorDisplayedBadges?: Array<{
    id: string
    name: string
    color: string
    iconText?: string | null
  }>
  replyToAuthor?: string
  content: string
  createdAt: string
  likes: number
  viewerLiked?: boolean
}

export interface SiteCommentItem {
  id: string
  author: string
  authorId: number
  authorUsername: string
  authorAvatarPath?: string | null
  authorStatus: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  authorIsVip?: boolean
  authorVipLevel?: number
  authorDisplayedBadges?: Array<{
    id: string
    name: string
    color: string
    iconText?: string | null
  }>
  content: string
  createdAt: string
  likes: number
  viewerLiked?: boolean
  floor: number
  isAcceptedAnswer: boolean
  isPinnedByAuthor: boolean
  replies: SiteCommentReplyItem[]
}

export interface GetCommentsOptions {
  sort?: "oldest" | "newest"
  page?: number
  pageSize?: number
}

export interface SiteCommentListResult {
  items: SiteCommentItem[]
  total: number
  page: number
  pageSize: number
}

interface CommentQueryUser {
  username: string
  nickname: string | null
  avatarPath: string | null
  status: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  vipLevel: number | null
  vipExpiresAt: Date | null
  userBadges?: Array<{
    isDisplayed?: boolean
    displayOrder?: number
    badge: {
      id: string
      name: string
      color: string
      iconText?: string | null
      status: boolean
    }
  }>
}

interface CommentQueryLike {
  userId: number
}

function getVipState(user: CommentQueryUser) {
  return {
    authorIsVip: Boolean(user.vipExpiresAt && new Date(user.vipExpiresAt).getTime() > Date.now()),
    authorVipLevel: user.vipLevel ?? 0,
  }
}

function mapDisplayedBadges(user: CommentQueryUser) {
  return (user.userBadges ?? [])
    .filter((item) => Boolean(item.isDisplayed) && item.badge.status)
    .slice(0, 3)
    .map((item) => ({
      id: item.badge.id,
      name: item.badge.name,
      color: item.badge.color,
      iconText: item.badge.iconText,
    }))
}

export async function getCommentsByPostId(
  postId: string,
  options: GetCommentsOptions = {},
  viewer?: { userId?: number; isAdmin?: boolean; postAuthorId?: number; commentsVisibleToAuthorOnly?: boolean },
): Promise<SiteCommentListResult> {
  const sort = options.sort ?? "oldest"
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 10))
  try {
    const shouldMaskComment = (authorId: number) => {
      if (!viewer?.commentsVisibleToAuthorOnly) {
        return false
      }
      if (viewer.isAdmin) {
        return false
      }
      if (!viewer.userId) {
        return true
      }
      return viewer.userId !== viewer.postAuthorId && viewer.userId !== authorId
    }

    const [total, rootComments] = await Promise.all([
      countRootCommentsByPostId(postId),
      findRootCommentsByPostId({
        postId,
        sort,
        page,
        pageSize,
        viewerUserId: viewer?.userId,
      }),
    ])

    const rootIds = rootComments.map((comment) => comment.id)
    const replies = await findRepliesByParentIds({
      postId,
      parentIds: rootIds,
      sort,
      viewerUserId: viewer?.userId,
    }) as Array<{
      id: string
      userId: number
      parentId: string | null
      content: string
      likeCount: number
      isAcceptedAnswer: boolean
      isPinnedByAuthor: boolean
      createdAt: Date
      user: CommentQueryUser
      replyToUser: CommentQueryUser | null
      likes?: CommentQueryLike[]
    }>

    const repliesByParentId = new Map<string, SiteCommentReplyItem[]>()

    replies.forEach((comment) => {
      const parentId = comment.parentId as string
      const currentReplies = repliesByParentId.get(parentId) ?? []
      const replyVipState = getVipState(comment.user)

      currentReplies.push({
        id: comment.id,
        author: comment.user.nickname ?? comment.user.username,
        authorId: comment.userId,
        authorUsername: comment.user.username,
        authorAvatarPath: comment.user.avatarPath,
        authorStatus: comment.user.status,
        authorIsVip: replyVipState.authorIsVip,
        authorVipLevel: replyVipState.authorVipLevel,
        authorDisplayedBadges: mapDisplayedBadges(comment.user),
        replyToAuthor: comment.replyToUser ? comment.replyToUser.nickname ?? comment.replyToUser.username : undefined,
        content: shouldMaskComment(comment.userId) ? AUTHOR_ONLY_COMMENT_PLACEHOLDER : comment.content,
        createdAt: formatRelativeTime(comment.createdAt),
        likes: comment.likeCount,
        viewerLiked: Boolean(viewer?.userId && comment.likes?.some((item) => item.userId === viewer.userId)),
      })

      repliesByParentId.set(parentId, currentReplies)
    })

    const floorStart = sort === "newest" ? Math.max(total - (page - 1) * pageSize, 0) : (page - 1) * pageSize + 1
    const normalizedComments: SiteCommentItem[] = rootComments.map((comment, index) => {
      const repliesForComment = repliesByParentId.get(comment.id) ?? []
      const floor = sort === "newest" ? floorStart - index : floorStart + index

      return {
        id: comment.id,
        author: getUserDisplayName(comment.user),
        authorId: comment.userId,
        authorUsername: comment.user.username,
        authorAvatarPath: comment.user.avatarPath,
        authorStatus: comment.user.status,
        authorIsVip: isVipActive(comment.user),
        authorVipLevel: getVipLevel(comment.user),
        authorDisplayedBadges: mapDisplayedBadges(comment.user),
        content: shouldMaskComment(comment.userId) ? AUTHOR_ONLY_COMMENT_PLACEHOLDER : comment.content,
        createdAt: formatRelativeTime(comment.createdAt),
        likes: comment.likeCount,
        viewerLiked: Boolean(viewer?.userId && comment.likes?.some((item) => item.userId === viewer.userId)),
        floor,
        isAcceptedAnswer: comment.isAcceptedAnswer,
        isPinnedByAuthor: comment.isPinnedByAuthor,
        replies: repliesForComment,
      }
    })

    return {
      items: normalizedComments,
      total,
      page,
      pageSize,
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      total: 0,
      page,
      pageSize,
    }
  }
}

export async function getUserReplyCountByPost(postId: string, userId?: number) {
  if (!userId) {
    return 0
  }

  try {
    return await countUserRepliesByPostId(postId, userId)
  } catch (error) {
    console.error(error)
    return 0
  }
}
