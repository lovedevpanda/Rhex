import { prisma } from "@/db/client"
import { PostAuctionStatus } from "@/db/types"
import { parseBusinessDateTime } from "@/lib/formatters"
import {
  enqueuePostAuctionSettlement,
  type AuctionTx,
} from "@/lib/post-auctions.core"
import type { NormalizedPostAuctionConfig } from "@/lib/post-auctions.types"
import {
  normalizePostAuctionMode,
  normalizePostAuctionPricingRule,
  type LocalPostAuctionMode,
  type LocalPostAuctionPricingRule,
} from "@/lib/post-auction-types"

export function normalizePostAuctionConfig(
  input: {
    mode: LocalPostAuctionMode
    pricingRule: LocalPostAuctionPricingRule
    startPrice: number
    incrementStep: number
    startsAt: string | null
    endsAt: string
    winnerOnlyContent: string
    winnerOnlyContentPreview: string | null
  } | null | undefined,
) {
  if (!input) {
    return { success: false as const, message: "拍卖配置缺失" }
  }

  const startsAt = input.startsAt ? parseBusinessDateTime(input.startsAt) : null
  const endsAt = parseBusinessDateTime(input.endsAt)
  if (input.startsAt && !startsAt) {
    return { success: false as const, message: "拍卖开始时间格式不正确" }
  }

  if (!endsAt) {
    return { success: false as const, message: "拍卖结束时间格式不正确" }
  }

  if (startsAt && endsAt.getTime() <= startsAt.getTime()) {
    return { success: false as const, message: "结束时间必须晚于开始时间" }
  }

  if (endsAt.getTime() <= Date.now()) {
    return { success: false as const, message: "结束时间必须晚于当前时间" }
  }

  const startPrice = Math.max(1, Math.trunc(input.startPrice))
  const incrementStep = Math.max(1, Math.trunc(input.incrementStep))
  const winnerOnlyContent = input.winnerOnlyContent.trim()
  const winnerOnlyContentPreview = input.winnerOnlyContentPreview?.trim() || null

  if (!winnerOnlyContent) {
    return { success: false as const, message: "赢家专属内容不能为空" }
  }

  return {
    success: true as const,
    data: {
      mode: normalizePostAuctionMode(input.mode),
      pricingRule: normalizePostAuctionPricingRule(input.pricingRule),
      startPrice,
      incrementStep,
      startsAt,
      endsAt,
      winnerOnlyContent,
      winnerOnlyContentPreview,
    } satisfies NormalizedPostAuctionConfig,
  }
}

export function createPostAuctionRecord(
  tx: AuctionTx,
  params: {
    postId: string
    sellerId: number
    config: NormalizedPostAuctionConfig
    active: boolean
  },
) {
  return tx.postAuction.create({
    data: {
      postId: params.postId,
      sellerId: params.sellerId,
      mode: params.config.mode,
      pricingRule: params.config.pricingRule,
      startPrice: params.config.startPrice,
      incrementStep: params.config.incrementStep,
      startsAt: params.config.startsAt,
      endsAt: params.config.endsAt,
      winnerOnlyContent: params.config.winnerOnlyContent,
      winnerOnlyContentPreview: params.config.winnerOnlyContentPreview,
      status: params.active ? PostAuctionStatus.ACTIVE : PostAuctionStatus.DRAFT,
      activatedAt: params.active ? new Date() : null,
    },
    select: {
      id: true,
      endsAt: true,
      status: true,
    },
  })
}

export async function activatePostAuctionForPost(postId: string) {
  const auction = await prisma.postAuction.findUnique({
    where: { postId },
    select: {
      id: true,
      status: true,
      endsAt: true,
    },
  })

  if (!auction || auction.status !== PostAuctionStatus.DRAFT) {
    return auction
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      status: true,
    },
  })

  if (!post || post.status !== "NORMAL") {
    return auction
  }

  const updated = await prisma.postAuction.update({
    where: { id: auction.id },
    data: {
      status: PostAuctionStatus.ACTIVE,
      activatedAt: new Date(),
    },
    select: {
      id: true,
      endsAt: true,
    },
  })

  await enqueuePostAuctionSettlement(updated.id, updated.endsAt)
  return updated
}
