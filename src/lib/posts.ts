import type { Board, Comment, LotteryCondition, LotteryParticipant, LotteryPrize, LotteryWinner, PollOption, PollVote, Post, PostAppendix, PostAttachment, PostAttachmentSourceType, User } from "@/db/types"



import type { LocalPostType } from "@/lib/post-types"
import { mapLotteryView } from "@/lib/lottery"
import type { AnonymousDisplayIdentity } from "@/lib/post-anonymous"
import { getAnonymousMaskDisplayIdentity } from "@/lib/post-anonymous"

import { getPublicPostContentText, parsePostContentDocument } from "@/lib/post-content"
import type { PostAuctionSummary } from "@/lib/post-auctions"
import type { PostRedPacketSummary } from "@/lib/post-red-packets"
import type { PostTipSummary } from "@/lib/post-tips"
import type { PostRewardPoolMode } from "@/lib/post-reward-pool-config"
import { withRuntimeFallback } from "@/lib/runtime-errors"
import type { SiteTippingGiftItem } from "@/lib/site-settings"


import { findEditablePostBySlug, findHomepagePosts, findPostDetailBySlug, findPostSeoBySlug, increasePostViewCount } from "@/db/post-queries"

import { mapListPost } from "@/lib/post-map"





interface PostDetailRelations {
  board: Board
  author: User
  acceptedComment: (Comment & { user: User }) | null
  pollOptions: Array<PollOption & { votes: PollVote[] }>
  lotteryPrizes: Array<LotteryPrize & { winners: Array<LotteryWinner & { user: Pick<User, "username" | "nickname" | "avatarPath"> }> }>
  lotteryConditions: LotteryCondition[]
  lotteryParticipants: Array<LotteryParticipant & { user: Pick<User, "username" | "nickname" | "avatarPath" | "status"> }>
  appendices: PostAppendix[]
  attachments: Array<PostAttachment & {
    upload: {
      id: string
      originalName: string
      fileName: string
      fileExt: string
      mimeType: string
      fileSize: number
      storagePath: string
      urlPath: string
    } | null
  }>
  likes?: Array<{ userId: number }>
  favorites?: Array<{ userId: number }>
}



export interface PostSeoData {
  id: string
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
  isAnonymous?: boolean
  author: string
  authorId?: number
  authorUsername?: string
  authorIsAiAgent?: boolean
  authorAvatarPath?: string | null
  authorStatus?: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
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

  publishedAt: string
  publishedAtRaw?: string
  lastRepliedAt?: string
  lastRepliedAtRaw?: string
  latestReplyAuthorName?: string | null
  latestReplyAuthorUsername?: string | null
  latestReplyCommentId?: string | null
  latestReplyExcerpt?: string | null

  excerpt: string
  coverImage?: string | null
  content: string[]
  commentsVisibleToAuthorOnly?: boolean
  contentBlocks?: Array<{
    id: string
    type: "PUBLIC" | "AUTHOR_ONLY" | "LOGIN_UNLOCK" | "REPLY_UNLOCK" | "PURCHASE_UNLOCK"
    text: string
    visible: boolean
    replyThreshold?: number
    price?: number
    purchaseCount?: number
  }>

  editableUntil?: string | null
  createdAt?: string
  appendedContent?: string | null
  lastAppendedAt?: string | null
  appendices?: Array<{
    id: string
    floor: number
    content: string
    createdAt: string
  }>
  hasAttachments?: boolean
  attachments?: Array<{
    id: string
    sourceType: PostAttachmentSourceType
    name: string
    fileExt?: string | null
    mimeType?: string | null
    fileSize?: number | null
    minDownloadLevel: number
    minDownloadVipLevel: number
    pointsCost: number
    requireReplyUnlock: boolean
    downloadCount: number
  }>

  type: LocalPostType


  typeLabel: string
  status: string
  statusLabel: string
  reviewNote?: string | null
  isPinned: boolean
  pinScope?: string | null
  hasRedPacket?: boolean
  rewardMode?: PostRewardPoolMode
  minViewLevel?: number
  minViewVipLevel?: number
  isFeatured: boolean

  bounty?: {
    points: number
    acceptedCommentId?: string | null
    acceptedAnswerAuthor?: string | null
    isResolved: boolean
  }
  auction?: PostAuctionSummary
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
    isLoggedIn: boolean
    pointName: string
    currentUserPoints: number
    gifts: SiteTippingGiftItem[]
    giftStats: PostTipSummary["giftStats"]
    recentGiftEvents: PostTipSummary["recentGiftEvents"]
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


function mapDatabasePost(post: Post & { board: Board; author: User }, anonymousMaskIdentity: AnonymousDisplayIdentity | null = null): SitePostItem {
  return mapListPost(post, anonymousMaskIdentity)
}


function mapPostDetail(
  post: Post & PostDetailRelations,
  currentUserId?: number,
  options?: { isAdmin?: boolean; userReplyCount?: number; purchasedBlockIds?: Set<string>; purchasedBlockBuyerCounts?: Map<string, number>; tipSummary?: PostTipSummary; redPacketSummary?: PostRedPacketSummary; auctionSummary?: PostAuctionSummary | null; anonymousMaskIdentity?: AnonymousDisplayIdentity | null },
): SitePostItem {
  const totalVotes = post.pollOptions.reduce((sum, option) => sum + option.voteCount, 0)
  const tipSummary = options?.tipSummary
  const redPacketSummary = options?.redPacketSummary

  const contentBlocks = parsePostContentDocument(post.content).blocks.map((block) => {

    const isOwner = Boolean(currentUserId && currentUserId === post.authorId)
    const isAdmin = Boolean(options?.isAdmin)
    const replyCount = options?.userReplyCount ?? 0
    const purchasedBlockIds = options?.purchasedBlockIds ?? new Set<string>()
    const purchasedBlockBuyerCounts = options?.purchasedBlockBuyerCounts ?? new Map<string, number>()
    const replyUnlocked = isOwner || isAdmin || replyCount >= (block.replyThreshold ?? 1)
    const visible = block.type === "PUBLIC"
      || (block.type === "AUTHOR_ONLY" && (isOwner || isAdmin))
      || (block.type === "LOGIN_UNLOCK" && (Boolean(currentUserId) || isOwner || isAdmin))
      || (block.type === "REPLY_UNLOCK" && replyUnlocked)
      || (block.type === "PURCHASE_UNLOCK" && (purchasedBlockIds.has(block.id) || isOwner || isAdmin))


    return {
      id: block.id,
      type: block.type,
      text: block.text,
      visible,
      replyThreshold: block.replyThreshold,
      price: block.price,
      purchaseCount: block.type === "PURCHASE_UNLOCK" ? (purchasedBlockBuyerCounts.get(block.id) ?? 0) : undefined,
    }
  })

  return {
    ...mapDatabasePost(post, options?.anonymousMaskIdentity ?? null),
    boardSlug: post.board.slug,
    commentsVisibleToAuthorOnly: post.commentsVisibleToAuthorOnly,
    contentBlocks,

    editableUntil: post.editableUntil?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
    appendedContent: post.appendedContent ?? null,
    lastAppendedAt: post.lastAppendedAt?.toISOString() ?? null,
    appendices: post.appendices
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((item, index) => ({
        id: item.id,
        floor: index + 1,
        content: getPublicPostContentText(item.content),
        createdAt: item.createdAt.toISOString(),
      })),
    attachments: post.attachments
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((attachment) => ({
        id: attachment.id,
        sourceType: attachment.sourceType,
        name: attachment.name,
        fileExt: attachment.fileExt ?? attachment.upload?.fileExt ?? null,
        mimeType: attachment.mimeType ?? attachment.upload?.mimeType ?? null,
        fileSize: attachment.fileSize ?? attachment.upload?.fileSize ?? null,
        minDownloadLevel: attachment.minDownloadLevel,
        minDownloadVipLevel: attachment.minDownloadVipLevel,
        pointsCost: attachment.pointsCost,
        requireReplyUnlock: attachment.requireReplyUnlock,
        downloadCount: attachment.downloadCount,
      })),

    bounty: post.type === "BOUNTY"

      ? {
          points: post.bountyPoints ?? 0,
          acceptedCommentId: post.acceptedCommentId,
          acceptedAnswerAuthor: post.acceptedComment?.user.nickname ?? post.acceptedComment?.user.username ?? null,
          isResolved: Boolean(post.acceptedCommentId),
        }
      : undefined,
    auction: post.type === "AUCTION" ? (options?.auctionSummary ?? undefined) : undefined,
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
      isLoggedIn: tipSummary.isLoggedIn,
      pointName: tipSummary.pointName,
      currentUserPoints: tipSummary.currentUserPoints,
      gifts: tipSummary.gifts,
      giftStats: tipSummary.giftStats,
      recentGiftEvents: tipSummary.recentGiftEvents,
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
      isLoggedIn: false,
      pointName: "积分",
      currentUserPoints: 0,
      gifts: [],
      giftStats: [],
      recentGiftEvents: [],
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
    const [posts, anonymousMaskIdentity] = await Promise.all([
      findHomepagePosts(page, pageSize),
      getAnonymousMaskDisplayIdentity(),
    ])
    return posts.map((post) => mapDatabasePost(post, anonymousMaskIdentity))
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
  options?: { isAdmin?: boolean; userReplyCount?: number; purchasedBlockIds?: Set<string>; purchasedBlockBuyerCounts?: Map<string, number>; tipSummary?: PostTipSummary; redPacketSummary?: PostRedPacketSummary; auctionSummary?: PostAuctionSummary | null },
): Promise<SitePostItem | null> {

  try {
    const [post, anonymousMaskIdentity] = await Promise.all([
      findPostDetailBySlug(slug, currentUserId),
      getAnonymousMaskDisplayIdentity(),
    ])

    if (!post) {

      return null
    }

    return mapPostDetail(post, currentUserId, {
      ...options,
      anonymousMaskIdentity,
    })
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
      id: post.id,
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




