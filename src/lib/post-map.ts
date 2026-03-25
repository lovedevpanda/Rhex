import { LotteryStatus, LotteryTriggerMode } from "@/db/types"

import { formatRelativeTime } from "@/lib/formatters"

import { getPublicPostContentText } from "@/lib/post-content"
import { getPostStatusLabel, getPostTypeLabel, type LocalPostType } from "@/lib/post-types"
import { getUserDisplayName, type PublicUserStatus } from "@/lib/users"
import { getVipLevel, isVipActive, type VipStateSource } from "@/lib/vip-status"



interface ListPostAuthor extends VipStateSource {
  id: number
  username: string
  nickname?: string | null
  avatarPath?: string | null
  status: PublicUserStatus
  userBadges?: Array<{
    id: string
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



interface ListPostBoard {
  name: string
  slug: string
  iconPath?: string | null
}


interface ListPostSource {
  id: string
  slug: string
  title: string
  summary?: string | null
  content: string
  type: string
  status: string
  reviewNote?: string | null
  isPinned: boolean
  pinScope?: string | null
  isFeatured: boolean
  minViewLevel?: number | null
  bountyPoints?: number | null
  lotteryStatus?: LotteryStatus | null
  lotteryTriggerMode?: LotteryTriggerMode | null
  lotteryStartsAt?: Date | null
  lotteryEndsAt?: Date | null
  lotteryParticipantGoal?: number | null
  lotteryLockedAt?: Date | null
  lotteryDrawnAt?: Date | null
  lotteryAnnouncement?: string | null

  acceptedCommentId?: string | null

  commentCount: number
  likeCount: number
  favoriteCount: number
  viewCount: number
  tipCount?: number | null
  tipTotalPoints?: number | null
  publishedAt?: Date | null
  createdAt: Date
  board: ListPostBoard
  author: ListPostAuthor
}

export function mapListPost(post: ListPostSource) {
  const publicContent = getPublicPostContentText(post.content)

  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    description: post.summary ?? post.title,
    board: post.board.name,
    boardIcon: post.board.iconPath ?? "💬",
    boardSlug: post.board.slug,
    author: getUserDisplayName(post.author),
    authorId: post.author.id,

    authorUsername: post.author.username,
    authorAvatarPath: post.author.avatarPath,
    authorStatus: post.author.status,
    authorIsVip: isVipActive(post.author),

    authorVipLevel: getVipLevel(post.author),
    authorDisplayedBadges: (post.author.userBadges ?? [])
      .filter((item) => Boolean(item.isDisplayed) && item.badge.status)
      .slice(0, 3)

      .map((item) => ({
        id: item.badge.id,
        name: item.badge.name,
        color: item.badge.color,
        iconText: item.badge.iconText,
      })),
    publishedAt: formatRelativeTime(post.publishedAt ?? post.createdAt),

    excerpt: post.summary ?? publicContent.slice(0, 120),
    content: publicContent.split("\n\n").filter(Boolean),
    type: (post.type as LocalPostType) ?? "NORMAL",
    typeLabel: getPostTypeLabel((post.type as LocalPostType) ?? "NORMAL"),

    status: post.status,
    statusLabel: getPostStatusLabel(post.status),
    reviewNote: post.reviewNote,
    isPinned: post.isPinned,
    pinScope: post.pinScope ?? (post.isPinned ? "BOARD" : "NONE"),
    minViewLevel: post.minViewLevel ?? 0,
    isFeatured: post.isFeatured,

    bounty: post.type === "BOUNTY"
      ? {
          points: post.bountyPoints ?? 0,
          acceptedCommentId: post.acceptedCommentId,
          acceptedAnswerAuthor: null,
          isResolved: Boolean(post.acceptedCommentId),
        }
      : undefined,
    lottery: post.type === "LOTTERY"
      ? {
          status: post.lotteryStatus ?? LotteryStatus.DRAFT,
          triggerMode: post.lotteryTriggerMode ?? LotteryTriggerMode.MANUAL,
          startsAt: post.lotteryStartsAt?.toISOString() ?? null,
          endsAt: post.lotteryEndsAt?.toISOString() ?? null,
          participantGoal: post.lotteryParticipantGoal ?? null,
          participantCount: 0,
          lockedAt: post.lotteryLockedAt?.toISOString() ?? null,
          drawnAt: post.lotteryDrawnAt?.toISOString() ?? null,
          announcement: post.lotteryAnnouncement ?? null,
          joined: false,
          eligible: false,
          ineligibleReason: null,
          currentProbability: null,
          prizes: [],
          conditionGroups: [],
        }
      : undefined,


    stats: {
      comments: post.commentCount,
      likes: post.likeCount,
      favorites: post.favoriteCount,
      views: post.viewCount,
      tips: post.tipCount ?? 0,
      tipPoints: post.tipTotalPoints ?? 0,
    },
  }
}


