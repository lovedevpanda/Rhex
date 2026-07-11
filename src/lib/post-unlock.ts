import { randomUUID } from "node:crypto"

import { createPostBlockPurchase, findPostUnlockPurchaseContext, findPostUnlockUserPoints, listPurchasedPostBlockPurchaseBuyersByPost, listPurchasedPostBlockPurchases, runPostUnlockTransaction } from "@/db/post-unlock-queries"
import { apiError } from "@/lib/api-route"
import { parsePostContentDocument } from "@/lib/post-content"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { isPublicReadablePostStatus } from "@/lib/post-types"
import { POINT_LOG_EVENT_TYPES } from "@/lib/point-log-events"
import { getSiteSettings } from "@/lib/site-settings"

function buildReason(_postId: string, _blockId: string, pointName: string, price: number) {
  return `购买帖子隐藏内容（${price}${pointName}）`
}

export async function purchasePostBlock(options: { userId: number; postId: string; blockId: string }) {
  const settings = await getSiteSettings()

  return runPostUnlockTransaction(async (tx) => {
    const post = await findPostUnlockPurchaseContext(options.postId, tx)
    if (!post || !isPublicReadablePostStatus(post.status)) {
      apiError(404, "帖子不存在或不可购买")
    }

    if (post.authorId === options.userId) {
      apiError(400, "不能购买自己的隐藏内容")
    }

    const targetBlock = parsePostContentDocument(post.content).blocks.find((block) => (
      block.id === options.blockId
      && block.type === "PURCHASE_UNLOCK"
      && typeof block.price === "number"
      && block.price > 0
    ))
    if (!targetBlock || typeof targetBlock.price !== "number") {
      apiError(404, "隐藏内容不存在或不可购买")
    }

    const price = targetBlock.price
    const sellerId = post.authorId
    const purchaseRecord = await createPostBlockPurchase({
      id: `pbp_${randomUUID()}`,
      postId: options.postId,
      blockId: options.blockId,
      buyerId: options.userId,
      sellerId,
      price,
    }, tx)

    if (!purchaseRecord) {
      return { alreadyOwned: true, sellerId }
    }

    const [user, seller] = await Promise.all([
      findPostUnlockUserPoints(options.userId, tx),
      findPostUnlockUserPoints(sellerId, tx),
    ])

    const buyerPreparedDelta = await prepareScopedPointDelta({
      scopeKey: "POST_UNLOCK_OUTGOING",
      baseDelta: -price,
      userId: options.userId,
    })
    const sellerPreparedDelta = await prepareScopedPointDelta({
      scopeKey: "POST_UNLOCK_INCOMING",
      baseDelta: price,
      userId: sellerId,
    })

    if (!user || !seller) {
      throw new Error("用户不存在")
    }

    await applyPointDelta({
      tx,
      userId: options.userId,
      beforeBalance: user.points,
      prepared: buyerPreparedDelta,
      pointName: settings.pointName,
      insufficientMessage: `当前${settings.pointName}不足`,
      reason: buildReason(options.postId, options.blockId, settings.pointName, price),
      eventType: POINT_LOG_EVENT_TYPES.POST_BLOCK_PURCHASE_PAID,
      eventData: {
        postId: options.postId,
        blockId: options.blockId,
        buyerId: options.userId,
        sellerId,
        configuredPrice: price,
        appliedFinalDelta: buyerPreparedDelta.finalDelta,
      },
      relatedType: "POST",
      relatedId: options.postId,
    })

    await applyPointDelta({
      tx,
      userId: sellerId,
      beforeBalance: seller.points,
      prepared: sellerPreparedDelta,
      pointName: settings.pointName,
      reason: "帖子隐藏内容被购买",
      eventType: POINT_LOG_EVENT_TYPES.POST_BLOCK_PURCHASE_SOLD,
      eventData: {
        postId: options.postId,
        blockId: options.blockId,
        buyerId: options.userId,
        sellerId,
        configuredPrice: price,
        appliedFinalDelta: sellerPreparedDelta.finalDelta,
      },
      relatedType: "POST",
      relatedId: options.postId,
    })

    return { alreadyOwned: false, sellerId }
  })
}

export async function getPurchasedPostBlockIds(postId: string, userId?: number) {
  if (!userId) {
    return new Set<string>()
  }

  const purchases = await listPurchasedPostBlockPurchases(postId, userId)

  return new Set<string>(
    purchases
      .map((row) => row.blockId)
      .filter((value): value is string => Boolean(value)),
  )
}

export async function getPurchasedPostBlockBuyerCounts(postId: string) {
  const purchases = await listPurchasedPostBlockPurchaseBuyersByPost(postId)
  const counts = new Map<string, number>()

  for (const purchase of purchases) {
    counts.set(purchase.blockId, (counts.get(purchase.blockId) ?? 0) + 1)
  }

  return counts
}
