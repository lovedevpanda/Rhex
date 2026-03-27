import type { Board, Comment, LotteryCondition, LotteryParticipant, LotteryPrize, LotteryWinner, PollOption, PollVote, Post, PostAppendix, User } from "@/db/types"



import type { LocalPostType } from "@/lib/post-types"
import { mapLotteryView } from "@/lib/lottery"

import { parsePostContentDocument } from "@/lib/post-content"
import type { PostRedPacketSummary } from "@/lib/post-red-packets"
import type { PostTipSummary } from "@/lib/post-tips"
import { withRuntimeFallback } from "@/lib/runtime-errors"


import { findEditablePostBySlug, findHomepagePosts, findPostDetailBySlug, findPostSeoBySlug, increasePostViewCount } from "@/db/post-queries"

import { mapListPost } from "@/lib/post-map"





interface PostDetailRelations {
  board: Board
  author: User
  acceptedComment: (Comment & { user: User }) | null
  pollOptions: Array<PollOption & { votes: PollVote[] }>
  lotteryPrizes: Array<LotteryPrize & { winners: Array<LotteryWinner & { user: Pick<User, "username" | "nickname"> }> }>
  lotteryConditions: LotteryCondition[]
  lotteryParticipants: LotteryParticipant[]
  appendices: PostAppendix[]
  likes?: Array<{ userId: number }>
  favorites?: Array<{ userId: number }>
}



export interface PostSeoData {
  slug: string
  title: string
  description: string
}

export interface SitePostItem {

  id: string
  slug: string
  title: string
  description: string
  board: string
  boardIcon: string
  boardSlug?: string
  author: string
  authorId?: number
  authorUsername?: string
  authorAvatarPath?: string | null
  authorStatus?: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  authorIsVip?: boolean
  authorVipLevel?: number
  authorVerification?: {
    id: string
    name: string
    color: string
    iconText?: string | null
  } | null
  authorDisplayedBadges?: Array<{
    id: string
    name: string
    color: string
    iconText?: string | null
  }>

  publishedAt: string

  excerpt: string
  content: string[]
  commentsVisibleToAuthorOnly?: boolean
  contentBlocks?: Array<{
    id: string
    type: "PUBLIC" | "AUTHOR_ONLY" | "REPLY_UNLOCK" | "PURCHASE_UNLOCK"
    text: string
    visible: boolean
    replyThreshold?: number
    price?: number
  }>

  editableUntil?: string | null
  appendedContent?: string | null
  lastAppendedAt?: string | null
  appendices?: Array<{
    id: string
    floor: number
    content: string
    createdAt: string
  }>

  type: LocalPostType


  typeLabel: string
  status: string
  statusLabel: string
  reviewNote?: string | null
  isPinned: boolean
  pinScope?: string | null
  minViewLevel?: number
  isFeatured: boolean

  bounty?: {
    points: number
    acceptedCommentId?: string | null
    acceptedAnswerAuthor?: string | null
    isResolved: boolean
  }
  poll?: {
    totalVotes: number
    hasVoted: boolean
    expiresAt?: string | null
    options: Array<{
      id: string
      content: string
      voteCount: number
      percentage: number
      isVoted: boolean
    }>
  }
  lottery?: ReturnType<typeof mapLotteryView>
  redPacket?: PostRedPacketSummary
  tipping?: {

    enabled: boolean
    pointName: string
    currentUserPoints: number
    allowedAmounts: number[]
    dailyLimit: number
    perPostLimit: number
    usedDailyCount: number
    usedPostCount: number
    totalCount: number
    totalPoints: number
    topSupporters: PostTipSummary["topSupporters"]
  }


  stats: {
    comments: number
    likes: number
    favorites: number
    views: number
    tips: number
    tipPoints: number
  }

  viewerState?: {
    liked: boolean
    favored: boolean
  }
}


function mapDatabasePost(post: Post & { board: Board; author: User }): SitePostItem {
  return mapListPost(post)
}


function mapPostDetail(
  post: Post & PostDetailRelations,
  currentUserId?: number,
  options?: { isAdmin?: boolean; userReplyCount?: number; purchasedBlockIds?: Set<string>; tipSummary?: PostTipSummary; redPacketSummary?: PostRedPacketSummary },
): SitePostItem {
  const totalVotes = post.pollOptions.reduce((sum, option) => sum + option.voteCount, 0)
  const tipSummary = options?.tipSummary
  const redPacketSummary = options?.redPacketSummary

  const contentBlocks = parsePostContentDocument(post.content).blocks.map((block) => {

    const isOwner = Boolean(currentUserId && currentUserId === post.authorId)
    const isAdmin = Boolean(options?.isAdmin)
    const replyCount = options?.userReplyCount ?? 0
    const purchasedBlockIds = options?.purchasedBlockIds ?? new Set<string>()
    const replyUnlocked = isOwner || isAdmin || replyCount >= (block.replyThreshold ?? 1)
    const visible = block.type === "PUBLIC"
      || (block.type === "AUTHOR_ONLY" && (isOwner || isAdmin))
      || (block.type === "REPLY_UNLOCK" && replyUnlocked)
      || (block.type === "PURCHASE_UNLOCK" && (purchasedBlockIds.has(block.id) || isOwner || isAdmin))


    return {
      id: block.id,
      type: block.type,
      text: block.text,
      visible,
      replyThreshold: block.replyThreshold,
      price: block.price,
    }
  })

  return {
    ...mapDatabasePost(post),
    boardSlug: post.board.slug,
    commentsVisibleToAuthorOnly: post.commentsVisibleToAuthorOnly,
    contentBlocks,

    editableUntil: post.editableUntil?.toISOString() ?? null,
    appendedContent: post.appendedContent ?? null,
    lastAppendedAt: post.lastAppendedAt?.toISOString() ?? null,
    appendices: post.appendices
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((item, index) => ({
        id: item.id,
        floor: index + 1,
        content: item.content,
        createdAt: item.createdAt.toISOString(),
      })),

    bounty: post.type === "BOUNTY"

      ? {
          points: post.bountyPoints ?? 0,
          acceptedCommentId: post.acceptedCommentId,
          acceptedAnswerAuthor: post.acceptedComment?.user.nickname ?? post.acceptedComment?.user.username ?? null,
          isResolved: Boolean(post.acceptedCommentId),
        }
      : undefined,
    poll: post.type === "POLL"
      ? {
          totalVotes,
          hasVoted: post.pollOptions.some((option) => option.votes.some((vote) => vote.userId === currentUserId)),
          expiresAt: post.pollExpiresAt?.toISOString() ?? null,
          options: post.pollOptions

            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map((option) => ({
              id: option.id,
              content: option.content,
              voteCount: option.voteCount,
              percentage: totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0,
              isVoted: option.votes.some((vote) => vote.userId === currentUserId),
            })),
        }
      : undefined,
    lottery: mapLotteryView(post, currentUserId),
    redPacket: redPacketSummary,
    tipping: tipSummary ? {

      enabled: tipSummary.enabled,
      pointName: tipSummary.pointName,
      currentUserPoints: tipSummary.currentUserPoints,
      allowedAmounts: tipSummary.allowedAmounts,
      dailyLimit: tipSummary.dailyLimit,
      perPostLimit: tipSummary.perPostLimit,
      usedDailyCount: tipSummary.usedDailyCount,
      usedPostCount: tipSummary.usedPostCount,
      totalCount: tipSummary.tipCount,
      totalPoints: tipSummary.tipTotalPoints,
      topSupporters: tipSummary.topSupporters,
    } : {
      enabled: false,
      pointName: "积分",
      currentUserPoints: 0,
      allowedAmounts: [],
      dailyLimit: 0,
      perPostLimit: 0,
      usedDailyCount: 0,
      usedPostCount: 0,
      totalCount: post.tipCount,
      totalPoints: post.tipTotalPoints,
      topSupporters: [],
    },

    viewerState: {
      liked: Boolean(currentUserId && post.likes?.some((item) => item.userId === currentUserId)),
      favored: Boolean(currentUserId && post.favorites?.some((item) => item.userId === currentUserId)),
    },
  }
}


export async function getHomepagePosts(page = 1, pageSize = 20): Promise<SitePostItem[]> {
  return withRuntimeFallback(async () => {
    const posts = await findHomepagePosts(page, pageSize)
    return posts.map(mapDatabasePost)
  }, {
    area: "posts",
    action: "getHomepagePosts",
    message: "首页帖子加载失败",
    metadata: { page, pageSize },
    fallback: [],
  })
}


export async function getPostDetailBySlug(
  slug: string,
  currentUserId?: number,
  options?: { isAdmin?: boolean; userReplyCount?: number; purchasedBlockIds?: Set<string>; tipSummary?: PostTipSummary; redPacketSummary?: PostRedPacketSummary },
): Promise<SitePostItem | null> {

  try {
    const post = await findPostDetailBySlug(slug, currentUserId)

    if (!post) {

      return null
    }

    return mapPostDetail(post, currentUserId, options)
  } catch (error) {
    console.error(error)
    return null
  }
}

export async function getEditablePostBySlug(slug: string) {
  return findEditablePostBySlug(slug)
}


export async function getPostSeoBySlug(slug: string): Promise<PostSeoData | null> {

  try {
    const post = await findPostSeoBySlug(slug)

    if (!post) {
      return null
    }

    const parsed = parsePostContentDocument(post.content)
    const fallbackDescription = parsed.blocks
      .filter((block) => block.type === "PUBLIC")
      .map((block) => block.summary || block.text)
      .join("\n\n")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160)

    return {
      slug: post.slug,
      title: post.title,
      description: post.summary?.trim() || fallbackDescription,
    }

  } catch (error) {
    console.error(error)
    return null
  }
}




export async function incrementPostViewCount(postId: string) {
  await withRuntimeFallback(async () => {
    await increasePostViewCount(postId)
  }, {
    area: "posts",
    action: "incrementPostViewCount",
    message: "帖子浏览量更新失败",
    metadata: { postId },
    fallback: undefined,
    level: "warn",
  })
}




