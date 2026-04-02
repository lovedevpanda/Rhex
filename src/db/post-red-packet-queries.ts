import { prisma } from "@/db/client"
import { ChangeType, PostRedPacketStatus, PostRedPacketTriggerType, type Prisma } from "@/db/types"

interface PostRedPacketEligibleCandidate {
  userId: number
}

async function findPostRedPacketEligibleCandidates(
  tx: Prisma.TransactionClient,
  input: {
    redPacketId: string
    postId: string
    triggerType: PostRedPacketTriggerType
  },
): Promise<PostRedPacketEligibleCandidate[]> {
  const claimedUserIds = await tx.postRedPacketClaim.findMany({
    where: {
      redPacketId: input.redPacketId,
    },
    select: {
      userId: true,
    },
  }).then((records) => records.map((record) => record.userId))

  const unclaimedUserFilter = claimedUserIds.length > 0 ? { notIn: claimedUserIds } : undefined

  if (input.triggerType === "REPLY") {
    return tx.comment.findMany({
      where: {
        postId: input.postId,
        userId: unclaimedUserFilter,
        user: {
          status: {
            notIn: ["MUTED", "BANNED"],
          },
        },
      },
      select: {
        userId: true,
      },
      distinct: ["userId"],
    })
  }

  if (input.triggerType === "LIKE") {
    return tx.like.findMany({
      where: {
        postId: input.postId,
        targetType: "POST",
        userId: unclaimedUserFilter,
        user: {
          status: {
            notIn: ["MUTED", "BANNED"],
          },
        },
      },
      select: {
        userId: true,
      },
      distinct: ["userId"],
    })
  }

  return tx.favorite.findMany({
    where: {
      postId: input.postId,
      userId: unclaimedUserFilter,
      user: {
        status: {
          notIn: ["MUTED", "BANNED"],
        },
      },
    },
    select: {
      userId: true,
    },
    distinct: ["userId"],
  })
}

export function sumTodayPostRedPacketPoints(senderId: number, start: Date, end: Date) {
  return prisma.postRedPacket.aggregate({
    where: {
      senderId,
      createdAt: {
        gte: start,
        lt: end,
      },
      status: {
        in: ["ACTIVE", "COMPLETED", "EXPIRED"],
      },
    },
    _sum: {
      totalPoints: true,
    },
  })
}

export async function claimPostRedPacketInTransaction(input: {
  postId: string
  userId: number
  triggerType: PostRedPacketTriggerType
  triggerCommentId?: string
  pointName: string
  buildClaimReason: (params: { amount: number; pointName: string; postId: string; triggerType: PostRedPacketTriggerType }) => string
  resolveRecipient: (params: {
    packet: {
      claimOrderMode: string
    }
    eligibleCandidates: PostRedPacketEligibleCandidate[]
  }) => {
    userId: number
    triggerCommentId?: string
  } | null
  allocateAmount: (packet: {
    grantMode: string
    remainingPoints: number
    remainingCount: number
    totalPoints: number
    packetCount: number
  }) => number
}) {
  return prisma.$transaction(async (tx) => {
    const [user, post] = await Promise.all([
      tx.user.findUnique({ where: { id: input.userId }, select: { id: true, points: true, status: true, username: true } }),
      tx.post.findUnique({
        where: { id: input.postId },
        select: {
          id: true,
          status: true,
          authorId: true,
          redPacket: true,
        },
      }),
    ])

    if (!user || !post || post.status !== "NORMAL") {
      return { claimed: false as const, reason: "帖子不存在或暂不可领取" }
    }

    if (user.status === "MUTED" || user.status === "BANNED") {
      return { claimed: false as const, reason: "当前账号状态不可领取红包" }
    }

    const packet = post.redPacket
    if (!packet || packet.status !== "ACTIVE") {
      return { claimed: false as const, reason: "当前帖子没有可领取红包" }
    }

    if (packet.triggerType !== input.triggerType) {
      return { claimed: false as const, reason: "当前行为不满足红包领取条件" }
    }

    const existingClaim = await tx.postRedPacketClaim.findUnique({
      where: {
        redPacketId_userId: {
          redPacketId: packet.id,
          userId: input.userId,
        },
      },
      select: {
        amount: true,
      },
    })

    if (existingClaim) {
      return { claimed: false as const, reason: "你已经领取过该红包", amount: existingClaim.amount }
    }

    if (packet.remainingCount <= 0 || packet.remainingPoints <= 0) {
      const nextStatus = packet.claimedCount >= packet.packetCount ? "COMPLETED" : "EXPIRED"
      await tx.postRedPacket.update({ where: { id: packet.id }, data: { status: nextStatus } })
      return { claimed: false as const, reason: "红包已领完" }
    }

    const eligibleCandidates = packet.claimOrderMode === "FIRST_COME_FIRST_SERVED"
      ? [{ userId: user.id }]
      : await findPostRedPacketEligibleCandidates(tx, {
          redPacketId: packet.id,
          postId: post.id,
          triggerType: input.triggerType,
        })

    const resolvedRecipient = input.resolveRecipient({
      packet: {
        claimOrderMode: packet.claimOrderMode,
      },
      eligibleCandidates,
    })

    if (!resolvedRecipient) {
      return { claimed: false as const, reason: "当前暂无可领取的红包名额" }
    }

    const recipientUser = resolvedRecipient.userId === user.id
      ? user
      : await tx.user.findUnique({
          where: { id: resolvedRecipient.userId },
          select: { id: true, points: true, status: true, username: true },
        })

    if (!recipientUser || recipientUser.status === "MUTED" || recipientUser.status === "BANNED") {
      return { claimed: false as const, reason: "随机候选用户已失效，请稍后重试" }
    }

    const amount = input.allocateAmount(packet)
    const nextRemainingCount = packet.remainingCount - 1
    const nextRemainingPoints = packet.remainingPoints - amount
    const nextStatus: PostRedPacketStatus = nextRemainingCount === 0 || nextRemainingPoints === 0 ? "COMPLETED" : "ACTIVE"

    const updatedPacket = await tx.postRedPacket.updateMany({
      where: {
        id: packet.id,
        status: "ACTIVE",
        remainingCount: packet.remainingCount,
        remainingPoints: packet.remainingPoints,
      },
      data: {
        remainingCount: nextRemainingCount,
        remainingPoints: nextRemainingPoints,
        claimedCount: { increment: 1 },
        claimedPoints: { increment: amount },
        status: nextStatus,
      },
    })

    if (updatedPacket.count === 0) {
      const latestClaim = await tx.postRedPacketClaim.findUnique({
        where: {
          redPacketId_userId: {
            redPacketId: packet.id,
            userId: input.userId,
          },
        },
        select: {
          amount: true,
        },
      })

      if (latestClaim) {
        return { claimed: false as const, reason: "你已经领取过该红包", amount: latestClaim.amount }
      }

      const latestPacket = await tx.postRedPacket.findUnique({
        where: { id: packet.id },
        select: {
          remainingCount: true,
          remainingPoints: true,
          claimedCount: true,
          packetCount: true,
          status: true,
        },
      })

      if (!latestPacket || latestPacket.status !== "ACTIVE" || latestPacket.remainingCount <= 0 || latestPacket.remainingPoints <= 0) {
        if (latestPacket && latestPacket.status === "ACTIVE") {
          const settledStatus = latestPacket.claimedCount >= latestPacket.packetCount ? "COMPLETED" : "EXPIRED"
          await tx.postRedPacket.update({ where: { id: packet.id }, data: { status: settledStatus } })
        }
        return { claimed: false as const, reason: "红包已领完" }
      }

      return { claimed: false as const, reason: "红包正在被其他请求处理，请稍后重试" }
    }

    try {
      await tx.postRedPacketClaim.create({
        data: {
          redPacketId: packet.id,
          postId: post.id,
          userId: recipientUser.id,
          triggerType: input.triggerType,
          triggerCommentId: resolvedRecipient.triggerCommentId,
          amount,
        },
      })
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") {
        await tx.postRedPacket.update({
          where: { id: packet.id },
          data: {
            remainingCount: { increment: 1 },
            remainingPoints: { increment: amount },
            claimedCount: { decrement: 1 },
            claimedPoints: { decrement: amount },
            status: packet.status,
          },
        })

        const duplicatedClaim = await tx.postRedPacketClaim.findUnique({
          where: {
            redPacketId_userId: {
              redPacketId: packet.id,
              userId: recipientUser.id,
            },
          },
          select: {
            amount: true,
          },
        })

        return recipientUser.id === input.userId
          ? { claimed: false as const, reason: "你已经领取过该红包", amount: duplicatedClaim?.amount }
          : { claimed: false as const, reason: "本次随机红包未命中你" }
      }

      throw error
    }

    await tx.user.update({
      where: { id: recipientUser.id },
      data: {
        points: { increment: amount },
      },
    })

    await tx.pointLog.create({
      data: {
        userId: recipientUser.id,
        changeType: ChangeType.INCREASE,
        changeValue: amount,
        reason: input.buildClaimReason({ amount, pointName: input.pointName, postId: post.id, triggerType: input.triggerType }),
        relatedType: "POST",
        relatedId: post.id,
      },
    })

    return recipientUser.id === input.userId
      ? { claimed: true as const, amount, pointName: input.pointName }
      : { claimed: false as const, reason: "本次随机红包未命中你" }
  })
}


export function findPostRedPacketSummaryData(postId: string, currentUserId?: number) {
  return Promise.all([
    prisma.postRedPacket.findUnique({
      where: { postId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            nickname: true,
          },
        },
        claims: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
                avatarPath: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
          take: 50,
        },
      },
    }),
    currentUserId ? prisma.user.findUnique({ where: { id: currentUserId }, select: { points: true } }) : Promise.resolve(null),
  ])
}

export function findCurrentUserPostRedPacketClaim(redPacketId: string, currentUserId: number) {
  return prisma.postRedPacketClaim.findFirst({
    where: {
      redPacketId,
      userId: currentUserId,
    },
    select: {
      amount: true,
    },
  })
}
