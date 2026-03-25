import { prisma } from "@/db/client"
import { getSiteSettings } from "@/lib/site-settings"

const PURCHASE_REASON_PREFIX = "[purchase:block]"

function buildReason(postId: string, blockId: string, pointName: string, price: number) {
  return `${PURCHASE_REASON_PREFIX} 购买帖子隐藏内容（${price}${pointName}） post=${postId} block=${blockId}`
}

export async function purchasePostBlock(options: { userId: number; postId: string; blockId: string; price: number; sellerId: number }) {
  const settings = await getSiteSettings()

  return prisma.$transaction(async (tx) => {
    const existing = await tx.pointLog.findFirst({
      where: {
        userId: options.userId,
        reason: buildReason(options.postId, options.blockId, settings.pointName, options.price),
      },
      select: { id: true },
    })

    if (existing) {
      return { alreadyOwned: true }
    }

    const user = await tx.user.findUnique({
      where: { id: options.userId },
      select: { id: true, points: true },
    })

    if (!user || user.points < options.price) {
      throw new Error(`当前${settings.pointName}不足`)
    }

    await tx.user.update({
      where: { id: options.userId },
      data: {
        points: {
          decrement: options.price,
        },
      },
    })

    await tx.user.update({
      where: { id: options.sellerId },
      data: {
        points: {
          increment: options.price,
        },
      },
    })

    await tx.pointLog.createMany({
      data: [
        {
          userId: options.userId,
          changeType: "DECREASE",
          changeValue: options.price,
          reason: buildReason(options.postId, options.blockId, settings.pointName, options.price),
          relatedType: "POST",
          relatedId: options.postId,
        },
        {
          userId: options.sellerId,
          changeType: "INCREASE",
          changeValue: options.price,
          reason: `帖子隐藏内容被购买，获得${options.price}${settings.pointName}`,
          relatedType: "POST",
          relatedId: options.postId,
        },
      ],
    })

    return { alreadyOwned: false }
  })
}

export async function getPurchasedPostBlockIds(postId: string, userId?: number) {
  if (!userId) {
    return new Set<string>()
  }

  const rows = await prisma.pointLog.findMany({
    where: {
      userId,
      relatedType: "POST",
      relatedId: postId,
      reason: {
        startsWith: PURCHASE_REASON_PREFIX,
      },
    },
    select: {
      reason: true,
    },
  })

  return new Set<string>(
    rows
      .map((row) => row.reason.match(/block=([^\s]+)/)?.[1])
      .filter((value): value is string => Boolean(value)),
  )
}
