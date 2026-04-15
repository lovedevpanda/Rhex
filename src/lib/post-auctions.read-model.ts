import { prisma } from "@/db/client"
import { PostAuctionMode, PostAuctionStatus } from "@/db/types"
import {
  getPostAuctionStatusLabel,
  getUserDisplayName,
} from "@/lib/post-auctions.core"
import type {
  PostAuctionBidRecordPage,
  PostAuctionParticipantPage,
  PostAuctionSummary,
} from "@/lib/post-auctions.types"
import {
  getPostAuctionModeLabel,
  getPostAuctionPricingRuleLabel,
} from "@/lib/post-auction-types"

async function readAuctionForSummary(postId: string) {
  return prisma.postAuction.findUnique({
    where: { postId },
    include: {
      winner: {
        select: {
          id: true,
          username: true,
          nickname: true,
          avatarPath: true,
          vipLevel: true,
          vipExpiresAt: true,
        },
      },
    },
  })
}

function resolvePostAuctionSummaryStatus(
  auction: Awaited<ReturnType<typeof readAuctionForSummary>>,
  now: Date,
) {
  if (
    auction
    && (auction.status === PostAuctionStatus.ACTIVE
      || auction.status === PostAuctionStatus.SETTLING)
    && auction.endsAt.getTime() <= now.getTime()
  ) {
    return PostAuctionStatus.SETTLING
  }

  return auction?.status ?? null
}

export async function getPostAuctionSummary(
  postId: string,
  currentUserId?: number,
  options?: {
    isAdmin?: boolean
  },
): Promise<PostAuctionSummary | null> {
  const auction = await readAuctionForSummary(postId)
  if (!auction) {
    return null
  }

  const [viewerEntry, participantEntries] = await Promise.all([
    currentUserId
      ? prisma.postAuctionEntry.findUnique({
          where: {
            auctionId_userId: {
              auctionId: auction.id,
              userId: currentUserId,
            },
          },
        })
      : Promise.resolve(null),
    prisma.postAuctionEntry.findMany({
      where: {
        auctionId: auction.id,
      },
      orderBy: {
        lastBidAt: "desc",
      },
      take: 10,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            avatarPath: true,
            vipLevel: true,
            vipExpiresAt: true,
          },
        },
      },
    }),
  ])

  const now = new Date()
  const summaryStatus = resolvePostAuctionSummaryStatus(auction, now) ?? auction.status
  const resultVisible =
    auction.status === PostAuctionStatus.SETTLED
    || auction.status === PostAuctionStatus.SETTLING
  const hasStarted = !auction.startsAt || now.getTime() >= auction.startsAt.getTime()
  const hasEnded =
    summaryStatus === PostAuctionStatus.SETTLED
    || summaryStatus === PostAuctionStatus.SETTLING
    || summaryStatus === PostAuctionStatus.CANCELLED
    || summaryStatus === PostAuctionStatus.FAILED
    || now.getTime() >= auction.endsAt.getTime()
  const isSeller = Boolean(currentUserId && currentUserId === auction.sellerId)
  const viewerCanViewWinnerContent = Boolean(
    options?.isAdmin
      || isSeller
      || (auction.status === PostAuctionStatus.SETTLED
        && currentUserId
        && currentUserId === auction.winnerUserId),
  )

  const participantPreviews = participantEntries.map((entry) => ({
    userId: entry.userId,
    userName: getUserDisplayName(entry.user) ?? "匿名用户",
    avatarPath: entry.user.avatarPath ?? null,
    isVip: Boolean(
      entry.user.vipExpiresAt && entry.user.vipExpiresAt.getTime() > Date.now(),
    ),
    vipLevel: entry.user.vipLevel ?? null,
    amount:
      auction.mode === PostAuctionMode.OPEN_ASCENDING || hasEnded
        ? entry.currentBidAmount
        : null,
    isLeader: Boolean(
      (auction.mode === PostAuctionMode.OPEN_ASCENDING || hasEnded)
      && auction.leaderUserId === entry.userId,
    ),
  }))

  return {
    id: auction.id,
    mode: auction.mode,
    modeLabel: getPostAuctionModeLabel(auction.mode),
    status: summaryStatus,
    statusLabel: getPostAuctionStatusLabel(summaryStatus),
    pricingRule: auction.pricingRule,
    pricingRuleLabel: getPostAuctionPricingRuleLabel(auction.pricingRule),
    startPrice: auction.startPrice,
    incrementStep: auction.incrementStep,
    startsAt: auction.startsAt?.toISOString() ?? null,
    endsAt: auction.endsAt.toISOString(),
    participantCount: auction.participantCount,
    bidCount: auction.bidCount,
    leaderBidAmount:
      auction.mode === PostAuctionMode.OPEN_ASCENDING || resultVisible
        ? auction.leaderBidAmount
        : null,
    leaderUserId:
      auction.mode === PostAuctionMode.OPEN_ASCENDING || resultVisible
        ? auction.leaderUserId ?? null
        : null,
    winnerUserId: resultVisible ? auction.winnerUserId ?? null : null,
    winnerUserName: resultVisible ? getUserDisplayName(auction.winner) : null,
    winnerAvatarPath: resultVisible ? auction.winner?.avatarPath ?? null : null,
    winnerIsVip: resultVisible
      ? Boolean(
          auction.winner?.vipExpiresAt
          && auction.winner.vipExpiresAt.getTime() > Date.now(),
        )
      : false,
    winnerVipLevel: resultVisible ? auction.winner?.vipLevel ?? null : null,
    winningBidAmount: resultVisible ? auction.winningBidAmount ?? null : null,
    finalPrice: resultVisible ? auction.finalPrice ?? null : null,
    settledAt: auction.settledAt?.toISOString() ?? null,
    hasStarted,
    hasEnded,
    minNextBidAmount: auction.leaderBidAmount
      ? auction.leaderBidAmount + Math.max(1, auction.incrementStep)
      : auction.startPrice,
    viewerIsSeller: isSeller,
    viewerHasJoined: Boolean(viewerEntry),
    viewerBidAmount: viewerEntry?.currentBidAmount ?? null,
    viewerFrozenAmount: viewerEntry?.frozenAmount ?? null,
    viewerStatus: viewerEntry?.status ?? null,
    viewerIsLeader: Boolean(currentUserId && auction.leaderUserId === currentUserId),
    viewerCanBid: Boolean(
      currentUserId
      && !isSeller
      && summaryStatus === PostAuctionStatus.ACTIVE
      && hasStarted
      && !hasEnded
      && (auction.mode === PostAuctionMode.OPEN_ASCENDING || !viewerEntry),
    ),
    viewerCanViewWinnerContent,
    winnerOnlyContentPreview: auction.winnerOnlyContentPreview ?? null,
    winnerOnlyContent: viewerCanViewWinnerContent
      ? auction.winnerOnlyContent ?? null
      : null,
    participantPreviews,
  }
}

export async function getPostAuctionBidRecordPage(
  postId: string,
  options?: {
    page?: number
    pageSize?: number
  },
): Promise<PostAuctionBidRecordPage | null> {
  const auction = await prisma.postAuction.findUnique({
    where: { postId },
    include: {
      post: {
        select: {
          status: true,
        },
      },
    },
  })

  if (
    !auction
    || auction.mode !== PostAuctionMode.OPEN_ASCENDING
    || auction.post.status !== "NORMAL"
  ) {
    return null
  }

  const pageSize = Math.min(20, Math.max(1, Math.trunc(options?.pageSize ?? 10)))
  const page = Math.max(1, Math.trunc(options?.page ?? 1))
  const total = await prisma.postAuctionBidRecord.count({
    where: {
      auctionId: auction.id,
    },
  })
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount)

  const records = await prisma.postAuctionBidRecord.findMany({
    where: {
      auctionId: auction.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: (safePage - 1) * pageSize,
    take: pageSize,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          nickname: true,
        },
      },
    },
  })

  return {
    items: records.map((record) => ({
      id: record.id,
      userId: record.userId,
      userName: getUserDisplayName(record.user) ?? "匿名用户",
      amount: record.amount,
      createdAt: record.createdAt.toISOString(),
    })),
    total,
    page: safePage,
    pageSize,
    pageCount,
  }
}

export async function getPostAuctionParticipantPage(
  postId: string,
  options?: {
    page?: number
    pageSize?: number
  },
): Promise<PostAuctionParticipantPage | null> {
  const auction = await prisma.postAuction.findUnique({
    where: { postId },
    include: {
      post: {
        select: {
          status: true,
        },
      },
    },
  })

  if (!auction || auction.post.status !== "NORMAL") {
    return null
  }

  const hasEnded =
    auction.status === PostAuctionStatus.SETTLED
    || auction.status === PostAuctionStatus.SETTLING
    || auction.status === PostAuctionStatus.CANCELLED
    || auction.status === PostAuctionStatus.FAILED
    || auction.endsAt.getTime() <= Date.now()

  const pageSize = Math.min(20, Math.max(1, Math.trunc(options?.pageSize ?? 10)))
  const page = Math.max(1, Math.trunc(options?.page ?? 1))
  const total = await prisma.postAuctionEntry.count({
    where: {
      auctionId: auction.id,
    },
  })
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount)

  const entries = await prisma.postAuctionEntry.findMany({
    where: {
      auctionId: auction.id,
    },
    orderBy: {
      lastBidAt: "desc",
    },
    skip: (safePage - 1) * pageSize,
    take: pageSize,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          nickname: true,
        },
      },
    },
  })

  return {
    items: entries.map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      userName: getUserDisplayName(entry.user) ?? "匿名用户",
      createdAt: (
        auction.mode === PostAuctionMode.OPEN_ASCENDING
          ? entry.lastBidAt
          : entry.firstBidAt
      ).toISOString(),
      amount:
        auction.mode === PostAuctionMode.OPEN_ASCENDING || hasEnded
          ? entry.currentBidAmount
          : null,
    })),
    total,
    page: safePage,
    pageSize,
    pageCount,
  }
}
