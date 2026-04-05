import { findPostUnlockUserPoints, findPurchasedPostBlockLog, listPurchasedPostBlockLogReasons, runPostUnlockTransaction } from "@/db/post-unlock-queries"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { getSiteSettings } from "@/lib/site-settings"

const PURCHASE_REASON_PREFIX = "[purchase:block]"

function buildReasonPrefix(postId: string, blockId: string) {
  return `${PURCHASE_REASON_PREFIX} post=${postId} block=${blockId}`
}

function buildReason(postId: string, blockId: string, pointName: string, price: number) {
  return `${buildReasonPrefix(postId, blockId)} 购买帖子隐藏内容（${price}${pointName}）`
}

export async function purchasePostBlock(options: { userId: number; postId: string; blockId: string; price: number; sellerId: number }) {
  const settings = await getSiteSettings()

  return runPostUnlockTransaction(async (tx) => {
    const existing = await findPurchasedPostBlockLog({
      userId: options.userId,
      postId: options.postId,
      reasonPrefix: buildReasonPrefix(options.postId, options.blockId),
    }, tx)

    if (existing) {
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

    await applyPointDelta({
      tx,
      userId: options.userId,
      beforeBalance: user.points,
      prepared: buyerPreparedDelta,
      pointName: settings.pointName,
      insufficientMessage: `当前${settings.pointName}不足`,
      reason: buildReason(options.postId, options.blockId, settings.pointName, options.price),
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

  const rows = await listPurchasedPostBlockLogReasons(postId, userId)

  return new Set<string>(
    rows
      .map((row) => row.reason.match(/block=([^\s]+)/)?.[1])
      .filter((value): value is string => Boolean(value)),
  )
}
