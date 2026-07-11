import {
  countRssEntryTipsBySender,
  findRssEntryForInteraction,
  findRssEntryLike,
  findRssTipSender,
  findRssTipSupportersByIds,
  findRssTipUserPoints,
  listRssEntryTipSupportAggregates,
  lockRssTipSender,
  runRssInteractionTransaction,
} from "@/db/rss-interaction-queries"
import { apiError } from "@/lib/api-route"
import { getBusinessDayRange } from "@/lib/formatters"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { POINT_LOG_EVENT_TYPES } from "@/lib/point-log-events"
import { getSiteSettings, type SiteTippingGiftItem } from "@/lib/site-settings"

export interface RssEntrySupportSummary {
  enabled: boolean
  isLoggedIn: boolean
  pointName: string
  currentUserPoints: number
  gifts: SiteTippingGiftItem[]
  allowedAmounts: number[]
  dailyLimit: number
  perEntryLimit: number
  usedDailyCount: number
  usedEntryCount: number
  tipCount: number
  tipTotalPoints: number
  topSupporters: Array<{
    userId: number
    username: string
    nickname: string | null
    avatarPath: string | null
    totalAmount: number
  }>
}

function assertPublicRssEntry(entry: Awaited<ReturnType<typeof findRssEntryForInteraction>>) {
  if (!entry || entry.reviewStatus !== "APPROVED") {
    apiError(404, "内容不存在或暂不可操作")
  }

  return entry
}

export async function toggleRssEntryLike(input: {
  entryId: string
  userId: number
}) {
  return runRssInteractionTransaction(async (tx) => {
    const entry = assertPublicRssEntry(await findRssEntryForInteraction(input.entryId, tx))
    const existing = await findRssEntryLike(input.entryId, input.userId, tx)

    if (existing) {
      await tx.rssEntryLike.delete({
        where: { id: existing.id },
      })
      const updated = await tx.rssEntry.update({
        where: { id: entry.id },
        data: {
          likeCount: {
            decrement: Math.min(1, entry.likeCount),
          },
        },
        select: {
          likeCount: true,
        },
      })
      return {
        liked: false,
        likeCount: updated.likeCount,
      }
    }

    await tx.rssEntryLike.create({
      data: {
        entryId: entry.id,
        userId: input.userId,
      },
    })
    const updated = await tx.rssEntry.update({
      where: { id: entry.id },
      data: {
        likeCount: {
          increment: 1,
        },
      },
      select: {
        likeCount: true,
      },
    })

    return {
      liked: true,
      likeCount: updated.likeCount,
    }
  })
}

export async function getRssEntrySupportSummary(entryId: string, currentUserId?: number | null): Promise<RssEntrySupportSummary> {
  const settings = await getSiteSettings()
  const { start, end } = getBusinessDayRange()
  const [entry, currentUser, usedDailyCount, usedEntryCount, aggregates] = await Promise.all([
    findRssEntryForInteraction(entryId),
    currentUserId ? findRssTipUserPoints(currentUserId) : Promise.resolve(null),
    currentUserId
      ? countRssEntryTipsBySender({ senderId: currentUserId, start, end })
      : Promise.resolve(0),
    currentUserId
      ? countRssEntryTipsBySender({ senderId: currentUserId, entryId })
      : Promise.resolve(0),
    listRssEntryTipSupportAggregates(entryId, 10),
  ])
  const publicEntry = assertPublicRssEntry(entry)
  const supporterIds = aggregates.map((item) => item.senderId)
  const supporters = await findRssTipSupportersByIds(supporterIds)
  const supporterMap = new Map(supporters.map((item) => [item.id, item]))

  return {
    enabled: settings.tippingEnabled,
    isLoggedIn: Boolean(currentUserId),
    pointName: settings.pointName,
    currentUserPoints: currentUser?.points ?? 0,
    gifts: settings.tippingGifts,
    allowedAmounts: settings.tippingAmounts,
    dailyLimit: settings.tippingDailyLimit,
    perEntryLimit: settings.tippingPerPostLimit,
    usedDailyCount,
    usedEntryCount,
    tipCount: publicEntry.tipCount,
    tipTotalPoints: publicEntry.tipTotalPoints,
    topSupporters: aggregates.flatMap((item) => {
      const supporter = supporterMap.get(item.senderId)
      if (!supporter) {
        return []
      }

      return [{
        userId: supporter.id,
        username: supporter.username,
        nickname: supporter.nickname,
        avatarPath: supporter.avatarPath,
        totalAmount: item._sum.amount ?? 0,
      }]
    }),
  }
}

function validateTipInput(params: {
  settings: Awaited<ReturnType<typeof getSiteSettings>>
  amount: number
  giftId?: string | null
}) {
  if (!params.settings.tippingEnabled) {
    apiError(403, "当前未开启打赏")
  }

  const gift = params.giftId
    ? params.settings.tippingGifts.find((item) => item.id === params.giftId) ?? null
    : null

  if (params.giftId && !gift) {
    apiError(400, "当前礼物不存在或已下架")
  }

  if (gift && gift.price !== params.amount) {
    apiError(400, "礼物价格已变更，请刷新后重试")
  }

  if (!gift && !params.settings.tippingAmounts.includes(params.amount)) {
    apiError(400, `仅支持固定打赏金额：${params.settings.tippingAmounts.join(" / ")}`)
  }

  return gift
}

export async function tipRssEntry(input: {
  entryId: string
  senderId: number
  amount: number
  giftId?: string | null
}) {
  const settings = await getSiteSettings()
  const gift = validateTipInput({
    settings,
    amount: input.amount,
    giftId: input.giftId,
  })
  const prepared = await prepareScopedPointDelta({
    scopeKey: gift ? "GIFT_OUTGOING" : "TIP_OUTGOING",
    baseDelta: -input.amount,
    userId: input.senderId,
  })
  const { start, end } = getBusinessDayRange()

  const result = await runRssInteractionTransaction(async (tx) => {
    await lockRssTipSender(tx, input.senderId)

    const [entry, sender] = await Promise.all([
      findRssEntryForInteraction(input.entryId, tx),
      findRssTipSender(input.senderId, tx),
    ])
    const publicEntry = assertPublicRssEntry(entry)

    if (!sender) {
      apiError(404, "用户不存在")
    }

    const [usedDailyCount, usedEntryCount] = await Promise.all([
      countRssEntryTipsBySender({ senderId: sender.id, start, end, client: tx }),
      countRssEntryTipsBySender({ senderId: sender.id, entryId: publicEntry.id, client: tx }),
    ])

    if (usedDailyCount >= settings.tippingDailyLimit) {
      apiError(400, `今日打赏次数已达上限（${settings.tippingDailyLimit} 次）`)
    }

    if (usedEntryCount >= settings.tippingPerPostLimit) {
      apiError(400, `该内容打赏次数已达上限（${settings.tippingPerPostLimit} 次）`)
    }

    await tx.rssEntryTip.create({
      data: {
        entryId: publicEntry.id,
        senderId: sender.id,
        amount: input.amount,
        giftId: gift?.id ?? null,
        giftNameSnapshot: gift?.name ?? null,
        giftIconSnapshot: gift?.icon ?? null,
      },
    })
    const updated = await tx.rssEntry.update({
      where: { id: publicEntry.id },
      data: {
        tipCount: {
          increment: 1,
        },
        tipTotalPoints: {
          increment: input.amount,
        },
      },
      select: {
        tipCount: true,
        tipTotalPoints: true,
      },
    })

    await applyPointDelta({
      tx,
      userId: sender.id,
      beforeBalance: sender.points,
      prepared,
      pointName: settings.pointName,
      insufficientMessage: `${settings.pointName}不足，无法完成打赏`,
      reason: gift
        ? `宇宙内容送礼（${gift.name} / ${input.amount}${settings.pointName}）`
        : `宇宙内容打赏（${input.amount}${settings.pointName}）`,
      eventType: gift ? POINT_LOG_EVENT_TYPES.POST_GIFT_SENT : POINT_LOG_EVENT_TYPES.POST_TIP_SENT,
      eventData: {
        rssEntryId: publicEntry.id,
        rssSourceId: publicEntry.source.id,
        senderId: sender.id,
        configuredAmount: input.amount,
        appliedFinalDelta: prepared.finalDelta,
        gift: gift
          ? {
              id: gift.id,
              name: gift.name,
              price: gift.price,
            }
          : null,
      },
      relatedType: null,
      relatedId: publicEntry.id,
    })

    return {
      amount: input.amount,
      gift,
      tipCount: updated.tipCount,
      tipTotalPoints: updated.tipTotalPoints,
    }
  })

  return {
    pointName: settings.pointName,
    ...result,
  }
}
