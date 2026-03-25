import { prisma } from "@/db/client"

export async function purchaseInviteCodeTransaction(params: {
  userId: number
  price: number
  pointName: string
  code: string
}) {
  return prisma.$transaction(async (tx) => {
    const latestUser = await tx.user.findUnique({ where: { id: params.userId }, select: { id: true, points: true, username: true } })

    if (!latestUser) {
      throw new Error("用户不存在")
    }

    if (latestUser.points < params.price) {
      throw new Error(`${params.pointName}不足，无法购买邀请码`)
    }

    const inviteCode = await tx.inviteCode.create({
      data: {
        code: params.code,
        createdById: latestUser.id,
        note: "积分购买",
      },
    })

    await tx.user.update({
      where: { id: latestUser.id },
      data: {
        points: {
          decrement: params.price,
        },
      },
    })

    await tx.pointLog.create({
      data: {
        userId: latestUser.id,
        changeType: "DECREASE",
        changeValue: params.price,
        reason: `购买邀请码消耗${params.pointName}`,
      },
    })

    return inviteCode
  })
}
