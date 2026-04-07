import { randomUUID } from "node:crypto"

import { createPostBlockPurchase, findPostUnlockUserPoints, findPurchasedPostBlockPurchase, listPurchasedPostBlockPurchaseBuyersByPost, listPurchasedPostBlockPurchases, runPostUnlockTransaction } from "@/db/post-unlock-queries"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { POINT_LOG_EVENT_TYPES } from "@/lib/point-log-events"
import { getSiteSettings } from "@/lib/site-settings"

function buildReason(_postId: string, _blockId: string, pointName: string, price: number) {
  return `购买帖子隐藏内容（${price}${pointName}）`
}

export async function purchasePostBlock(options: { userId: number; postId: string; blockId: string; price: number; sellerId: number }) {
  const settings = await getSiteSettings()

  return runPostUnlockTransaction(async (tx) => {
    const existingPurchase = await findPurchasedPostBlockPurchase({
      userId: options.userId,
      postId: options.postId,
      blockId: options.blockId,
    }, tx)

    if (existingPurchase) {
      return { alreadyOwned: true }
    }

    const [user, seller] = await Promise.all([
      findPostUnlockUserPoints(options.userId, tx),
      findPostUnlockUserPoints(options.sellerId, tx),
    ])

    const buyerPreparedDelta = await prepareScopedPointDelta({
      scopeKey: "POST_UNLOCK_OUTGOING",
      baseDelta: -options.price,
      userId: options.userId,
    })
    const sellerPreparedDelta = await prepareScopedPointDelta({
      scopeKey: "POST_UNLOCK_INCOMING",
      baseDelta: options.price,
      userId: options.sellerId,
    })

    if (!user || !seller || (buyerPreparedDelta.finalDelta < 0 && user.points < Math.abs(buyerPreparedDelta.finalDelta))) {
      throw new Error(`当前${settings.pointName}不足`)
    }

    const purchaseRecord = await createPostBlockPurchase({
      id: `pbp_${randomUUID()}`,
      postId: options.postId,
      blockId: options.blockId,
      buyerId: options.userId,
      sellerId: options.sellerId,
      price: options.price,
    }, tx)

    if (!purchaseRecord) {
      return { alreadyOwned: true }
    }

    await applyPointDelta({
      tx,
      userId: options.userId,
      beforeBalance: user.points,
      prepared: buyerPreparedDelta,
      pointName: settings.pointName,
      insufficientMessage: `当前${settings.pointName}不足`,
      reason: buildReason(options.postId, options.blockId, settings.pointName, options.price),
      eventType: POINT_LOG_EVENT_TYPES.POST_BLOCK_PURCHASE_PAID,
      eventData: {
        postId: options.postId,
        blockId: options.blockId,
        buyerId: options.userId,
        sellerId: options.sellerId,
        configuredPrice: options.price,
        appliedFinalDelta: buyerPreparedDelta.finalDelta,
      },
      relatedType: "POST",
      relatedId: options.postId,
    })

    await applyPointDelta({
      tx,
      userId: options.sellerId,
      beforeBalance: seller.points,
      prepared: sellerPreparedDelta,
      pointName: settings.pointName,
      reason: "帖子隐藏内容被购买",
      eventType: POINT_LOG_EVENT_TYPES.POST_BLOCK_PURCHASE_SOLD,
      eventData: {
        postId: options.postId,
        blockId: options.blockId,
        buyerId: options.userId,
        sellerId: options.sellerId,
        configuredPrice: options.price,
        appliedFinalDelta: sellerPreparedDelta.finalDelta,
      },
      relatedType: "POST",
      relatedId: options.postId,
    })

    return { alreadyOwned: false }
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
