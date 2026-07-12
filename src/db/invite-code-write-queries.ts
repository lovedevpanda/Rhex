import { prisma } from "@/db/client"

import { apiError } from "@/lib/api-route"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"

export async function purchaseInviteCodeTransaction(params: {
  userId: number
  price: number
  count?: number
  maxUnusedHoldings?: number
  pointName: string
  codes: string[]
}) {
  const count = Math.max(1, Math.trunc(params.count ?? params.codes.length))
  const totalPrice = params.price * count
  const preparedPurchase = await prepareScopedPointDelta({
    scopeKey: "INVITE_CODE_PURCHASE",
    baseDelta: -totalPrice,
    userId: params.userId,
  })

  return prisma.$transaction(async (tx) => {
    const latestUser = await tx.user.findUnique({ where: { id: params.userId }, select: { id: true, points: true, username: true } })

    if (!latestUser) {
      apiError(404, "用户不存在")
    }

    if (preparedPurchase.finalDelta < 0 && latestUser.points < Math.abs(preparedPurchase.finalDelta)) {
      apiError(409, `${params.pointName}不足，无法购买邀请码`)
    }

    if (typeof params.maxUnusedHoldings === "number") {
      const unusedCount = await tx.inviteCode.count({
        where: {
          createdById: latestUser.id,
          usedById: null,
        },
      })

      if (unusedCount + count > params.maxUnusedHoldings) {
        apiError(409, `一次最多购买 10 个邀请码，最多持有 ${params.maxUnusedHoldings} 个未使用邀请码。你当前已有 ${unusedCount} 个未使用邀请码`)
      }
    }

    const inviteCodes = await Promise.all(params.codes.map((code) => tx.inviteCode.create({
      data: {
        code,
        createdById: latestUser.id,
        note: "积分购买",
      },
    })))

    const purchaseResult = await applyPointDelta({
      tx,
      userId: latestUser.id,
      beforeBalance: latestUser.points,
      prepared: preparedPurchase,
      pointName: params.pointName,
      insufficientMessage: `${params.pointName}不足，无法购买邀请码`,
      reason: count > 1
        ? `购买 ${count} 个邀请码消耗${params.pointName}`
        : `购买邀请码消耗${params.pointName}`,
    })

    return {
      inviteCodes,
      code: inviteCodes[0]?.code ?? "",
      codes: inviteCodes.map((item) => item.code),
      balance: purchaseResult.afterBalance,
    }
  })
}
