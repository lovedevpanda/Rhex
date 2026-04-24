import { findCommentEffectFeedbackByCommentIds } from "@/db/comment-effect-feedback-queries"
import { countRootCommentsByPostId, countUserRepliesByPostId, countVisibleCommentsByPostId, findAllFlatCommentIdsByPostId, findAllRootCommentIdsByPostId, findAllVisibleCommentIdsByPostId, findCommentRewardClaimsByCommentIds, findCommentsByIds, findFlatCommentsByPostId, findRepliesByParentIds, findRootCommentsByPostId } from "@/db/comment-queries"
import { getAiAgentUserId } from "@/lib/ai-agent"
import { formatRelativeTime } from "@/lib/formatters"
import type { AnonymousDisplayIdentity } from "@/lib/post-anonymous"
import type { PostRewardPoolEffectFeedback } from "@/lib/post-reward-effect-feedback"
import type { PostRewardPoolMode } from "@/lib/post-reward-pool-config"
import { getUserDisplayName } from "@/lib/users"
import { getVipLevel, isVipActive } from "@/lib/vip-status"

const AUTHOR_ONLY_COMMENT_PLACEHOLDER = "此评论仅楼主可看"

interface SiteCommentRewardClaim {
  amount: number
  rewardMode: PostRewardPoolMode
}

function parseRewardEffectFeedback(rawValue: string) {
  try {
    const parsed = JSON.parse(rawValue) as PostRewardPoolEffectFeedback
    return parsed && Array.isArray(parsed.events) ? parsed : null
  } catch {
    return null
  }
}

export interface SiteCommentReplyItem {
  id: string
  status: "NORMAL" | "HIDDEN" | "DELETED" | "PENDING"
  reviewNote?: string | null
  author: string
  authorIsAnonymous?: boolean
  authorIsAiAgent?: boolean
  authorId: number
  authorUsername: string
  authorAvatarPath?: string | null
  authorRole: "USER" | "MODERATOR" | "ADMIN"
  authorStatus: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  authorIsVip?: boolean
  authorVipLevel?: number
  authorVerification?: {
    id: string
    name: string
    color: string
    iconText?: string | null
    customIconText?: string | null
    description?: string | null
    customDescription?: string | null
  } | null
  authorDisplayedBadges?: Array<{
    id: string
    code?: string | null
    name: string
    description?: string | null
    color: string
    iconText?: string | null
  }>
  isPostAuthor: boolean
  postId: string
  replyToAuthor?: string
  content: string
  createdAt: string
  createdAtRaw: string
  likes: number
  viewerLiked?: boolean
  parentCommentId?: string
  parentCommentAuthor?: string
  parentCommentFloor?: number
  parentCommentExcerpt?: string
  parentCommentPage?: number
  replyToCommentId?: string
  replyToCommentAuthor?: string
  replyToCommentExcerpt?: string
  replyToCommentPage?: number
  flatFloor?: number
  rewardClaim?: SiteCommentRewardClaim
  rewardEffectFeedback?: PostRewardPoolEffectFeedback
}

export interface SiteCommentItem {
  id: string
  status: "NORMAL" | "HIDDEN" | "DELETED" | "PENDING"
  reviewNote?: string | null
  author: string
  authorIsAnonymous?: boolean
  authorIsAiAgent?: boolean
  authorId: number
  authorUsername: string
  authorAvatarPath?: string | null
  authorRole: "USER" | "MODERATOR" | "ADMIN"
  authorStatus: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  authorIsVip?: boolean
  authorVipLevel?: number
  authorVerification?: {
    id: string
    name: string
    color: string
    iconText?: string | null
    customIconText?: string | null
    description?: string | null
    customDescription?: string | null
  } | null
  authorDisplayedBadges?: Array<{
    id: string
    code?: string | null
    name: string
    description?: string | null
    color: string
    iconText?: string | null
  }>
  isPostAuthor: boolean
  postId: string
  content: string
  createdAt: string
  createdAtRaw: string
  likes: number
  viewerLiked?: boolean
  rewardClaim?: SiteCommentRewardClaim
  rewardEffectFeedback?: PostRewardPoolEffectFeedback
  floor: number
  isAcceptedAnswer: boolean
  isPinnedByAuthor: boolean
  replies: SiteCommentReplyItem[]
}

export interface GetCommentsOptions {
  sort?: "oldest" | "newest"
  page?: number
  pageSize?: number
  viewMode?: "tree" | "flat"
}

export type SiteFlatCommentItem = {
  type: "comment"
  comment: SiteCommentItem
} | {
  type: "reply"
  reply: SiteCommentReplyItem
}

export interface SiteCommentListResult {
  items: SiteCommentItem[]
  flatItems: SiteFlatCommentItem[]
  total: number
  page: number
  pageSize: number
  viewMode: "tree" | "flat"
}

interface CommentQueryUser {
  id: number
  username: string
  nickname: string | null
  avatarPath: string | null
  role: "USER" | "MODERATOR" | "ADMIN"
  status: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  vipLevel: number | null
  vipExpiresAt: Date | null
  userBadges?: Array<{
    isDisplayed?: boolean
    displayOrder?: number
    badge: {
      id: string
      code: string
      name: string
      description?: string | null
      color: string
      iconText?: string | null
      status: boolean
    }
  }>
  verificationApplications?: Array<{
    customIconText?: string | null
    customDescription?: string | null
    type: {
      id: string
      name: string
      color: string
      iconText?: string | null
      description?: string | null
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
      code: item.badge.code,
      name: item.badge.name,
      description: item.badge.description,
      color: item.badge.color,
      iconText: item.badge.iconText,
    }))
}

function mapVerification(user: CommentQueryUser) {
  const item = user.verificationApplications?.[0]
  if (!item) {
    return null
  }

  return {
    id: item.type.id,
    name: item.type.name,
    color: item.type.color,
    iconText: item.type.iconText,
    customIconText: item.customIconText,
    description: item.type.description,
    customDescription: item.customDescription,
  }
}

function getAnonymousCommentIdentity(identity?: AnonymousDisplayIdentity | null) {
  return {
    author: identity?.name ?? identity?.username ?? "匿名用户",
    authorUsername: identity?.username ?? "anonymous-user",
    authorAvatarPath: identity?.avatarPath ?? null,
    authorRole: "USER" as const,
    authorStatus: identity?.status ?? "ACTIVE" as const,
    authorIsVip: false,
    authorVipLevel: 0,
    authorVerification: null,
    authorDisplayedBadges: [],
  }
}

function buildCommentExcerpt(content: string, limit = 56) {
  const normalized = content.replace(/\s+/g, " ").trim()
  if (!normalized) {
    return "原评论内容为空"
  }

  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized
}

export async function getCommentsByPostId(
  postId: string,
  options: GetCommentsOptions = {},
  viewer?: {
    userId?: number
    isAdmin?: boolean
    postAuthorId?: number
    postIsAnonymous?: boolean
    commentsVisibleToAuthorOnly?: boolean
    anonymousPostAuthor?: AnonymousDisplayIdentity | null
  },
): Promise<SiteCommentListResult> {
  const sort = options.sort ?? "oldest"
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 10))
  const viewMode = options.viewMode ?? "tree"
  try {
    const aiAgentUserId = await getAiAgentUserId()

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

    type RawCommentRecord = {
      id: string
      status: "NORMAL" | "HIDDEN" | "DELETED" | "PENDING"
      reviewNote: string | null
      userId: number
      useAnonymousIdentity: boolean
      parentId: string | null
      content: string
      likeCount: number
      isAcceptedAnswer: boolean
      isPinnedByAuthor: boolean
      createdAt: Date
      user: CommentQueryUser
      replyToUser?: CommentQueryUser | null
      parent?: {
        id: string
        status: "NORMAL" | "HIDDEN" | "DELETED" | "PENDING"
        userId: number
        useAnonymousIdentity: boolean
        content: string
        createdAt: Date
      } | null
      replyToComment?: {
        id: string
        status: "NORMAL" | "HIDDEN" | "DELETED" | "PENDING"
        userId: number
        useAnonymousIdentity: boolean
        content: string
        createdAt: Date
        user: CommentQueryUser
      } | null
      likes?: CommentQueryLike[]
    }

    const mapReplyItem = (
      comment: RawCommentRecord,
      extra?: {
        parentCommentAuthor?: string
        parentCommentFloor?: number
        parentCommentPage?: number
        parentCommentExcerpt?: string
        replyToCommentId?: string
        replyToCommentAuthor?: string
        replyToCommentExcerpt?: string
        replyToCommentPage?: number
        flatFloor?: number
      },
    ): SiteCommentReplyItem => {
      const replyVipState = getVipState(comment.user)
      const displayAsAnonymous = Boolean(viewer?.postIsAnonymous && comment.userId === viewer.postAuthorId && comment.useAnonymousIdentity)
      const isVisiblePostAuthor = Boolean(comment.userId === viewer?.postAuthorId && (!viewer?.postIsAnonymous || comment.useAnonymousIdentity))
      const displayIdentity = displayAsAnonymous ? viewer?.anonymousPostAuthor : null
      const anonymousCommentIdentity = getAnonymousCommentIdentity(displayIdentity)
      const replyToAuthor = viewer?.postIsAnonymous && comment.replyToUser?.id === viewer.postAuthorId
        ? (viewer.anonymousPostAuthor?.name ?? viewer.anonymousPostAuthor?.username ?? "匿名用户")
        : (comment.replyToUser ? comment.replyToUser.nickname ?? comment.replyToUser.username : undefined)

      return {
        id: comment.id,
        status: comment.status,
        reviewNote: comment.reviewNote,
        postId,
        author: displayAsAnonymous ? anonymousCommentIdentity.author : (comment.user.nickname ?? comment.user.username),
        authorIsAnonymous: displayAsAnonymous,
        authorIsAiAgent: !displayAsAnonymous && comment.userId === aiAgentUserId,
        authorId: comment.userId,
        authorUsername: displayAsAnonymous ? anonymousCommentIdentity.authorUsername : comment.user.username,
        authorAvatarPath: displayAsAnonymous ? anonymousCommentIdentity.authorAvatarPath : comment.user.avatarPath,
        authorRole: displayAsAnonymous ? anonymousCommentIdentity.authorRole : comment.user.role,
        authorStatus: displayAsAnonymous ? anonymousCommentIdentity.authorStatus : comment.user.status,
        authorIsVip: displayAsAnonymous ? anonymousCommentIdentity.authorIsVip : replyVipState.authorIsVip,
        authorVipLevel: displayAsAnonymous ? anonymousCommentIdentity.authorVipLevel : replyVipState.authorVipLevel,
        authorVerification: displayAsAnonymous ? anonymousCommentIdentity.authorVerification : mapVerification(comment.user),
        authorDisplayedBadges: displayAsAnonymous ? anonymousCommentIdentity.authorDisplayedBadges : mapDisplayedBadges(comment.user),
        isPostAuthor: isVisiblePostAuthor,
        replyToAuthor,
        content: shouldMaskComment(comment.userId) ? AUTHOR_ONLY_COMMENT_PLACEHOLDER : comment.content,
        createdAt: formatRelativeTime(comment.createdAt),
        createdAtRaw: comment.createdAt.toISOString(),
        likes: comment.likeCount,
        viewerLiked: Boolean(viewer?.userId && comment.likes?.some((item) => item.userId === viewer.userId)),
        parentCommentId: comment.parentId ?? undefined,
        parentCommentAuthor: extra?.parentCommentAuthor,
        parentCommentFloor: extra?.parentCommentFloor,
        parentCommentPage: extra?.parentCommentPage,
        parentCommentExcerpt: extra?.parentCommentExcerpt,
        replyToCommentId: extra?.replyToCommentId,
        replyToCommentAuthor: extra?.replyToCommentAuthor,
        replyToCommentExcerpt: extra?.replyToCommentExcerpt,
        replyToCommentPage: extra?.replyToCommentPage,
        flatFloor: extra?.flatFloor,
      }
    }

    const mapRootCommentItem = (comment: RawCommentRecord, floor: number, replies: SiteCommentReplyItem[] = []): SiteCommentItem => {
      const displayAsAnonymous = Boolean(viewer?.postIsAnonymous && comment.userId === viewer.postAuthorId && comment.useAnonymousIdentity)
      const isVisiblePostAuthor = Boolean(comment.userId === viewer?.postAuthorId && (!viewer?.postIsAnonymous || comment.useAnonymousIdentity))
      const displayIdentity = displayAsAnonymous ? viewer?.anonymousPostAuthor : null
      const anonymousCommentIdentity = getAnonymousCommentIdentity(displayIdentity)

      return {
        id: comment.id,
        status: comment.status,
        reviewNote: comment.reviewNote,
        postId,
        author: displayAsAnonymous ? anonymousCommentIdentity.author : getUserDisplayName(comment.user),
        authorIsAnonymous: displayAsAnonymous,
        authorIsAiAgent: !displayAsAnonymous && comment.userId === aiAgentUserId,
        authorId: comment.userId,
        authorUsername: displayAsAnonymous ? anonymousCommentIdentity.authorUsername : comment.user.username,
        authorAvatarPath: displayAsAnonymous ? anonymousCommentIdentity.authorAvatarPath : comment.user.avatarPath,
        authorRole: displayAsAnonymous ? anonymousCommentIdentity.authorRole : comment.user.role,
        authorStatus: displayAsAnonymous ? anonymousCommentIdentity.authorStatus : comment.user.status,
        authorIsVip: displayAsAnonymous ? anonymousCommentIdentity.authorIsVip : isVipActive(comment.user),
        authorVipLevel: displayAsAnonymous ? anonymousCommentIdentity.authorVipLevel : getVipLevel(comment.user),
        authorVerification: displayAsAnonymous ? anonymousCommentIdentity.authorVerification : mapVerification(comment.user),
        authorDisplayedBadges: displayAsAnonymous ? anonymousCommentIdentity.authorDisplayedBadges : mapDisplayedBadges(comment.user),
        isPostAuthor: isVisiblePostAuthor,
        content: shouldMaskComment(comment.userId) ? AUTHOR_ONLY_COMMENT_PLACEHOLDER : comment.content,
        createdAt: formatRelativeTime(comment.createdAt),
        createdAtRaw: comment.createdAt.toISOString(),
        likes: comment.likeCount,
        viewerLiked: Boolean(viewer?.userId && comment.likes?.some((item) => item.userId === viewer.userId)),
        rewardClaim: undefined,
        rewardEffectFeedback: undefined,
        floor,
        isAcceptedAnswer: comment.isAcceptedAnswer,
        isPinnedByAuthor: comment.isPinnedByAuthor,
        replies,
      }
    }

    const getCommentDisplayAuthor = (comment: Pick<RawCommentRecord, "userId" | "useAnonymousIdentity" | "user">) => {
      const displayAsAnonymous = Boolean(viewer?.postIsAnonymous && comment.userId === viewer?.postAuthorId && comment.useAnonymousIdentity)
      if (displayAsAnonymous) {
        return viewer?.anonymousPostAuthor?.name ?? viewer?.anonymousPostAuthor?.username ?? "匿名用户"
      }

      return getUserDisplayName(comment.user)
    }

    const allRootComments = await findAllRootCommentIdsByPostId({
      postId,
      viewerUserId: viewer?.userId,
      includeHidden: true,
      includePendingOwn: Boolean(viewer?.userId),
      includePendingAll: Boolean(viewer?.isAdmin),
    })
    const rootFloorMap = new Map(allRootComments.map((comment, index) => [comment.id, index + 1]))
    const rootPageMap = new Map(allRootComments.map((comment, index) => [comment.id, Math.floor(index / pageSize) + 1]))

    if (viewMode === "flat") {
      const [total, rawComments, allVisibleComments, allFlatComments] = await Promise.all([
        countVisibleCommentsByPostId({
          postId,
          viewerUserId: viewer?.userId,
          includeHidden: true,
          includePendingOwn: Boolean(viewer?.userId),
          includePendingAll: Boolean(viewer?.isAdmin),
        }),
        findFlatCommentsByPostId({
          postId,
          sort,
          page,
          pageSize,
          viewerUserId: viewer?.userId,
          includeHidden: true,
          includePendingOwn: Boolean(viewer?.userId),
          includePendingAll: Boolean(viewer?.isAdmin),
        }),
        findAllVisibleCommentIdsByPostId({
          postId,
          viewerUserId: viewer?.userId,
          includeHidden: true,
          includePendingOwn: Boolean(viewer?.userId),
          includePendingAll: Boolean(viewer?.isAdmin),
        }),
        findAllFlatCommentIdsByPostId({
          postId,
          sort,
          viewerUserId: viewer?.userId,
          includeHidden: true,
          includePendingOwn: Boolean(viewer?.userId),
          includePendingAll: Boolean(viewer?.isAdmin),
        }),
      ])

      const flatComments = rawComments as unknown as RawCommentRecord[]
      const flatCommentPageMap = new Map<string, number>(
        allFlatComments.map((comment, index) => [comment.id, Math.floor(index / pageSize) + 1]),
      )
      const flatCommentFloorMap = new Map<string, number>(
        allVisibleComments.map((comment, index) => [comment.id, index + 1]),
      )
      const commentIds = flatComments.map((comment) => comment.id)
      const parentIds = [...new Set(flatComments.map((comment) => comment.parentId).filter((commentId): commentId is string => Boolean(commentId)))]
      const missingParentIds = parentIds.filter((parentId) => !flatComments.some((comment) => comment.id === parentId))
      const parentComments = await findCommentsByIds({
        commentIds: missingParentIds,
        viewerUserId: viewer?.userId,
        includeHidden: true,
        includePendingOwn: Boolean(viewer?.userId),
        includePendingAll: Boolean(viewer?.isAdmin),
      }) as unknown as RawCommentRecord[]
      const parentCommentEntries: Array<[string, RawCommentRecord]> = [
        ...flatComments
          .filter((comment) => comment.parentId === null)
          .map((comment): [string, RawCommentRecord] => [comment.id, comment]),
        ...parentComments.map((comment): [string, RawCommentRecord] => [comment.id, comment]),
      ]
      const parentCommentMap = new Map<string, RawCommentRecord>(parentCommentEntries)
      const [rewardClaims, rewardEffectFeedbackRows] = await Promise.all([
        findCommentRewardClaimsByCommentIds(postId, commentIds),
        findCommentEffectFeedbackByCommentIds(postId, commentIds),
      ])

      const rewardClaimMap = new Map<string, SiteCommentRewardClaim>()
      const rewardEffectFeedbackMap = new Map<string, PostRewardPoolEffectFeedback>()

      rewardClaims.forEach((claim) => {
        if (!claim.triggerCommentId) {
          return
        }

        rewardClaimMap.set(claim.triggerCommentId, {
          amount: claim.amount,
          rewardMode: claim.redPacket.packetCount > 0 ? "RED_PACKET" : "JACKPOT",
        })
      })

      rewardEffectFeedbackRows.forEach((row) => {
        const parsed = parseRewardEffectFeedback(row.feedbackJson)
        if (parsed) {
          rewardEffectFeedbackMap.set(row.commentId, parsed)
        }
      })

      const flatItems: SiteFlatCommentItem[] = flatComments.map((comment) => {
        if (!comment.parentId) {
          const floor = flatCommentFloorMap.get(comment.id) ?? 0
          const mappedComment = mapRootCommentItem(comment, floor)
          mappedComment.rewardClaim = rewardClaimMap.get(comment.id)
          mappedComment.rewardEffectFeedback = rewardEffectFeedbackMap.get(comment.id)

          return {
            type: "comment",
            comment: mappedComment,
          }
        }

        const parentComment = parentCommentMap.get(comment.parentId)
        const parentCommentIsVisible = parentComment
          ? !(parentComment.status === "HIDDEN" && !viewer?.isAdmin)
          : false
        const parentCommentExcerpt = parentComment
          ? shouldMaskComment(parentComment.userId)
            ? AUTHOR_ONLY_COMMENT_PLACEHOLDER
            : parentCommentIsVisible
              ? buildCommentExcerpt(parentComment.content)
              : "原评论当前不可见"
          : "原评论不存在或已不可见"
        const referenceComment = comment.replyToComment ?? parentComment
        const referenceCommentIsVisible = referenceComment
          ? !(referenceComment.status === "HIDDEN" && !viewer?.isAdmin)
          : false
        const referenceCommentExcerpt = referenceComment
          ? shouldMaskComment(referenceComment.userId)
            ? AUTHOR_ONLY_COMMENT_PLACEHOLDER
            : referenceCommentIsVisible
              ? buildCommentExcerpt(referenceComment.content)
              : "原评论当前不可见"
          : "原评论不存在或已不可见"
        const mappedReply = mapReplyItem(comment, {
          parentCommentAuthor: parentComment ? getCommentDisplayAuthor(parentComment) : undefined,
          parentCommentFloor: rootFloorMap.get(comment.parentId) ?? 0,
          parentCommentPage: flatCommentPageMap.get(comment.parentId) ?? 1,
          parentCommentExcerpt,
          replyToCommentId: referenceComment?.id,
          replyToCommentAuthor: referenceComment ? getCommentDisplayAuthor(referenceComment) : undefined,
          replyToCommentExcerpt: referenceCommentExcerpt,
          replyToCommentPage: referenceComment ? flatCommentPageMap.get(referenceComment.id) ?? 1 : undefined,
          flatFloor: flatCommentFloorMap.get(comment.id),
        })
        mappedReply.rewardClaim = rewardClaimMap.get(comment.id)
        mappedReply.rewardEffectFeedback = rewardEffectFeedbackMap.get(comment.id)

        return {
          type: "reply",
          reply: mappedReply,
        }
      })

      return {
        items: [],
        flatItems,
        total,
        page,
        pageSize,
        viewMode,
      }
    }

    const [total, rawRootComments] = await Promise.all([
      countRootCommentsByPostId({
        postId,
        viewerUserId: viewer?.userId,
        includeHidden: true,
        includePendingOwn: Boolean(viewer?.userId),
        includePendingAll: Boolean(viewer?.isAdmin),
      }),
      findRootCommentsByPostId({
        postId,
        sort,
        page,
        pageSize,
        viewerUserId: viewer?.userId,
        includeHidden: true,
        includePendingOwn: Boolean(viewer?.userId),
        includePendingAll: Boolean(viewer?.isAdmin),
      }),
    ])

    const rootComments = rawRootComments as unknown as RawCommentRecord[]
    const rootIds = rootComments.map((comment) => comment.id)
    const replies = await findRepliesByParentIds({
      postId,
      parentIds: rootIds,
      sort,
      viewerUserId: viewer?.userId,
      includeHidden: true,
      includePendingOwn: Boolean(viewer?.userId),
      includePendingAll: Boolean(viewer?.isAdmin),
    }) as unknown as RawCommentRecord[]
    const commentIds = [
      ...rootIds,
      ...replies.map((comment) => comment.id),
    ]
    const [rewardClaims, rewardEffectFeedbackRows] = await Promise.all([
      findCommentRewardClaimsByCommentIds(postId, commentIds),
      findCommentEffectFeedbackByCommentIds(postId, commentIds),
    ])
    const rewardClaimMap = new Map<string, SiteCommentRewardClaim>()
    const rewardEffectFeedbackMap = new Map<string, PostRewardPoolEffectFeedback>()

    rewardClaims.forEach((claim) => {
      if (!claim.triggerCommentId) {
        return
      }

      rewardClaimMap.set(claim.triggerCommentId, {
        amount: claim.amount,
        rewardMode: claim.redPacket.packetCount > 0 ? "RED_PACKET" : "JACKPOT",
      })
    })

    rewardEffectFeedbackRows.forEach((row) => {
      const parsed = parseRewardEffectFeedback(row.feedbackJson)
      if (parsed) {
        rewardEffectFeedbackMap.set(row.commentId, parsed)
      }
    })

    const repliesByParentId = new Map<string, SiteCommentReplyItem[]>()

    replies.forEach((comment) => {
      const parentId = comment.parentId as string
      const currentReplies = repliesByParentId.get(parentId) ?? []
      const mappedReply = mapReplyItem(comment, {
        parentCommentFloor: rootFloorMap.get(parentId) ?? 0,
        parentCommentPage: rootPageMap.get(parentId) ?? 1,
      })
      mappedReply.rewardClaim = rewardClaimMap.get(comment.id)
      mappedReply.rewardEffectFeedback = rewardEffectFeedbackMap.get(comment.id)
      currentReplies.push(mappedReply)

      repliesByParentId.set(parentId, currentReplies)
    })

    const floorStart = sort === "newest" ? Math.max(total - (page - 1) * pageSize, 0) : (page - 1) * pageSize + 1
    const normalizedComments: SiteCommentItem[] = rootComments.map((comment, index) => {
      const repliesForComment = repliesByParentId.get(comment.id) ?? []
      const floor = sort === "newest" ? floorStart - index : floorStart + index
      const mappedComment = mapRootCommentItem(comment, floor, repliesForComment)
      mappedComment.rewardClaim = rewardClaimMap.get(comment.id)
      mappedComment.rewardEffectFeedback = rewardEffectFeedbackMap.get(comment.id)
      return mappedComment
    })

    return {
      items: normalizedComments,
      flatItems: [],
      total,
      page,
      pageSize,
      viewMode,
    }
  } catch (error) {
    console.error(error)
    return {
      items: [],
      flatItems: [],
      total: 0,
      page,
      pageSize,
      viewMode,
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
