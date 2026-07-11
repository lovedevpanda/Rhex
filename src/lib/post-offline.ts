import { PostStatus } from "@/db/types"

import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
import { findPostOfflineTarget, findPostOfflineUser, lockPostOfflineTarget, runPostOfflineTransaction, updatePostOfflineTarget } from "@/db/post-offline-queries"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-route"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { getSiteSettings } from "@/lib/site-settings"
import { isVipActive } from "@/lib/vip-status"

interface PostOfflinePriceSnapshot {
  amount: number
  label: string
}

function resolvePostOfflinePrice(input: { points: number; vipLevel: number; vipExpiresAt?: Date | null }, settings: Awaited<ReturnType<typeof getSiteSettings>>): PostOfflinePriceSnapshot {
  const vipActive = isVipActive(input)

  if (!vipActive || input.vipLevel <= 0) {
    return { amount: settings.postOfflinePrice, label: "普通用户" }
  }

  if (input.vipLevel >= 3) {
    return { amount: settings.postOfflineVip3Price, label: "VIP3" }
  }

  if (input.vipLevel === 2) {
    return { amount: settings.postOfflineVip2Price, label: "VIP2" }
  }

  return { amount: settings.postOfflineVip1Price, label: "VIP1" }
}

export async function getPostOfflineActionMeta(postId: string) {
  const [currentUser, settings, post] = await Promise.all([
    getCurrentUser(),
    getSiteSettings(),
    findPostOfflineTarget(postId),
  ])

  if (!currentUser || !post || post.authorId !== currentUser.id || post.status !== PostStatus.NORMAL) {
    return null
  }

  const price = resolvePostOfflinePrice(currentUser, settings)

  return {
    postId: post.id,
    title: post.title,
    pointName: settings.pointName,
    price,
    currentPoints: currentUser.points,
    canAfford: currentUser.points >= price.amount,
  }
}

export async function offlineOwnPost(input: { postId: string; actorId: number; reason?: string | null }) {
  const settings = await getSiteSettings()
  const reason = String(input.reason ?? "").trim()

  const result = await runPostOfflineTransaction(async (tx) => {
    if (!await lockPostOfflineTarget(tx, input.postId)) {
      apiError(404, "帖子不存在")
    }

    const latestUser = await findPostOfflineUser(input.actorId, tx)
    if (!latestUser) {
      apiError(401, "当前用户不存在")
    }

    const latestPrice = resolvePostOfflinePrice(latestUser, settings)
    const post = await findPostOfflineTarget(input.postId, tx)

    if (!post || post.authorId !== latestUser.id) {
      apiError(403, "只能下线自己发布的帖子")
    }

    if (post.status !== PostStatus.NORMAL) {
      apiError(409, "当前帖子状态不支持下线")
    }

    if (latestUser.points < latestPrice.amount) {
      apiError(400, `当前${settings.pointName}不足`)
    }

    if (latestPrice.amount > 0) {
      const preparedPrice = await prepareScopedPointDelta({
        scopeKey: "POST_OFFLINE_PURCHASE",
        baseDelta: -latestPrice.amount,
        userId: latestUser.id,
      })

      await applyPointDelta({
        tx,
        userId: latestUser.id,
        beforeBalance: latestUser.points,
        prepared: preparedPrice,
        pointName: settings.pointName,
        insufficientMessage: `当前${settings.pointName}不足`,
        reason: "作者下线帖子",
        relatedType: "POST",
        relatedId: post.id,
      })
    }

    const nextReviewNote = [reason || null, latestPrice.amount > 0 ? `作者自主下线（${latestPrice.label}，扣除 ${latestPrice.amount} ${settings.pointName}）` : `作者自主下线（${latestPrice.label}，免费）`]
      .filter(Boolean)
      .join("；")

    const updated = await updatePostOfflineTarget(tx, {
      postId: post.id,
      reviewNote: nextReviewNote || null,
    })

    return {
      userId: latestUser.id,
      post: updated,
      price: latestPrice,
      pointName: settings.pointName,
    }
  })

  await executeAddonActionHook("post.status.changed.after", {
    postId: input.postId,
    editorId: String(result.userId),
    previousStatus: "NORMAL",
    nextStatus: "OFFLINE",
  })

  return result
}
