import { prisma } from "@/db/client"
import { LotteryStatus, NotificationType, type Prisma } from "@/db/types"
import {
  calculateLotteryAutoPrizeTotalCost,
  getLotteryVipPlanDetails,
  resolveLotteryPrizeUnitCost,
  type LotteryPrizeTypeValue,
  type LotteryPrizeCostSettings,
  type LotteryVipPlanValue,
} from "@/lib/lottery-prizes"
import { createNotifications } from "@/lib/notification-writes"
import { applyPointDelta, type PreparedPointDelta } from "@/lib/point-center"
import { POINT_LOG_EVENT_TYPES } from "@/lib/point-log-events"
import { addSafeIntegers } from "@/lib/shared/safe-integer"

export class LotteryDrawClaimConflictError extends Error {
  constructor() {
    super("抽奖已被其他请求处理")
    this.name = "LotteryDrawClaimConflictError"
  }
}

function isPrismaUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002")
}

export async function findLotteryEnrollmentContext(input: { postId: string; userId: number; replyCommentId?: string | null }) {
  const [
    post,
    user,
    replyComment,
    existingParticipant,
    latestReplyComment,
  ] = await Promise.all([
    prisma.post.findUnique({
      where: { id: input.postId },
      select: {
        id: true,
        authorId: true,
        lotteryStatus: true,
        lotteryStartsAt: true,
        lotteryEndsAt: true,
        lotteryLockedAt: true,
        lotteryConditions: {
          orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }],
          select: {
            type: true,
            operator: true,
            value: true,
            groupKey: true,
          },
        },
      },
    }),
    prisma.user.findUnique({ where: { id: input.userId } }),
    input.replyCommentId ? prisma.comment.findUnique({ where: { id: input.replyCommentId } }) : Promise.resolve(null),
    prisma.lotteryParticipant.findUnique({
      where: {
        postId_userId: {
          postId: input.postId,
          userId: input.userId,
        },
      },
      include: {
        sourceComment: true,
      },
    }),
    input.replyCommentId
      ? Promise.resolve(null)
      : prisma.comment.findFirst({
          where: {
            postId: input.postId,
            userId: input.userId,
            status: "NORMAL",
          },
          orderBy: {
            createdAt: "desc",
          },
        }),
  ])

  return [
    post,
    user,
    replyComment ?? existingParticipant?.sourceComment ?? latestReplyComment,
  ] as const
}

export function findLotteryInteractionState(input: { postId: string; userId: number }) {
  return Promise.all([
    prisma.like.findUnique({
      where: {
        userId_targetType_targetId: {
          userId: input.userId,
          targetType: "POST",
          targetId: input.postId,
        },
      },
    }),
    prisma.favorite.findUnique({
      where: {
        userId_postId: {
          userId: input.userId,
          postId: input.postId,
        },
      },
    }),
  ])
}

export async function upsertLotteryParticipantEligibility(input: {
  postId: string
  userId: number
  replyCommentId?: string | null
  isEligible: boolean
  ineligibleReason: string | null
  joinedAt?: Date
}) {
  return prisma.$transaction(async (tx) => {
    const activePost = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Post"
      WHERE "id" = ${input.postId}
        AND "type" = 'LOTTERY'::"PostType"
        AND "lotteryStatus" = 'ACTIVE'::"LotteryStatus"
        AND "lotteryLockedAt" IS NULL
        AND "lotteryDrawnAt" IS NULL
      FOR UPDATE
    `

    if (activePost.length !== 1) {
      return null
    }

    const identity = {
      postId_userId: {
        postId: input.postId,
        userId: input.userId,
      },
    }
    const data = {
      postId: input.postId,
      userId: input.userId,
      sourceCommentId: input.replyCommentId ?? undefined,
      isEligible: input.isEligible,
      ineligibleReason: input.ineligibleReason,
      ...(input.joinedAt ? { joinedAt: input.joinedAt } : {}),
    }

    if (!input.isEligible) {
      try {
        return await tx.lotteryParticipant.create({ data })
      } catch (error) {
        if (!isPrismaUniqueConstraintError(error)) {
          throw error
        }

        await tx.lotteryParticipant.updateMany({
          where: {
            postId: input.postId,
            userId: input.userId,
            isEligible: false,
          },
          data: {
            isEligible: input.isEligible,
            ineligibleReason: input.ineligibleReason,
            sourceCommentId: input.replyCommentId ?? undefined,
          },
        })

        return tx.lotteryParticipant.findUnique({
          where: identity,
        })
      }
    }

    return tx.lotteryParticipant.upsert({
      where: identity,
      update: {
        isEligible: input.isEligible,
        ineligibleReason: input.ineligibleReason,
        sourceCommentId: input.replyCommentId ?? undefined,
        ...(input.joinedAt ? { joinedAt: input.joinedAt } : {}),
      },
      create: data,
    })
  })
}

type LotteryQueryClient = Prisma.TransactionClient | typeof prisma

function resolveLotteryClient(client?: LotteryQueryClient) {
  return client ?? prisma
}

export function findLotteryDrawContext(postId: string, client?: LotteryQueryClient) {
  return resolveLotteryClient(client).post.findUnique({
    where: { id: postId },
    include: {
      author: true,
      lotteryPrizes: {
        orderBy: { sortOrder: "asc" },
      },
      lotteryConditions: {
        orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }],
      },
      lotteryParticipants: {
        where: {
          isEligible: true,
          user: {
            status: "ACTIVE",
          },
        },
        include: {
          user: true,
        },
        orderBy: { joinedAt: "asc" },
      },
      lotteryWinners: true,
    },
  })
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function buildFixedPointDelta(scopeKey: PreparedPointDelta["scopeKey"], delta: number): PreparedPointDelta {
  return {
    scopeKey,
    baseDelta: delta,
    finalDelta: delta,
    appliedRules: [],
  }
}

function addPointCost(total: number, amount: number) {
  const nextTotal = addSafeIntegers(total, amount)
  if (nextTotal === null || nextTotal < 0) {
    throw new Error("抽奖自动奖品积分结算溢出")
  }

  return nextTotal
}

async function deliverLotteryAutomaticPrizes(input: {
  tx: Prisma.TransactionClient
  post: NonNullable<Awaited<ReturnType<typeof findLotteryDrawContext>>>
  winners: Array<{
    id: string
    userId: number
    prize: {
      id: string
      title: string
      type: LotteryPrizeTypeValue
      pointsAmount: number | null
      vipPlan: LotteryVipPlanValue | null
      unitCostPoints: number
    }
  }>
  lockedAt: Date
  prizeCostSettings: LotteryPrizeCostSettings
}) {
  let deliveredCost = 0
  const deliveredWinnerIds: string[] = []
  const affectedUserIds = new Set<number>()

  for (const winner of input.winners) {
    const prize = winner.prize

    if (prize.type === "POINTS") {
      const amount = Math.max(0, Math.trunc(prize.pointsAmount ?? 0))
      if (amount <= 0) {
        continue
      }

      const user = await input.tx.user.findUnique({
        where: { id: winner.userId },
        select: { points: true },
      })
      if (!user) {
        throw new Error("中奖用户不存在，无法发放积分奖品")
      }

      await applyPointDelta({
        tx: input.tx,
        userId: winner.userId,
        beforeBalance: user.points,
        prepared: buildFixedPointDelta("LOTTERY_PRIZE_POINTS_AWARD", amount),
        pointName: input.prizeCostSettings.pointName ?? "积分",
        reason: `抽奖帖《${input.post.title}》中奖奖励：${prize.title}`,
        eventType: POINT_LOG_EVENT_TYPES.LOTTERY_PRIZE_POINTS_AWARD,
        eventData: {
          postId: input.post.id,
          prizeId: prize.id,
          winnerId: winner.id,
          prizeType: prize.type,
          configuredAmount: amount,
        },
        relatedType: "POST",
        relatedId: input.post.id,
      })

      deliveredCost = addPointCost(deliveredCost, resolveLotteryPrizeUnitCost(prize) || amount)
      deliveredWinnerIds.push(winner.id)
      affectedUserIds.add(winner.userId)
      continue
    }

    if (prize.type === "VIP") {
      const user = await input.tx.user.findUnique({
        where: { id: winner.userId },
        select: {
          vipLevel: true,
          vipExpiresAt: true,
        },
      })
      if (!user) {
        throw new Error("中奖用户不存在，无法发放会员权益")
      }

      const plan = getLotteryVipPlanDetails(prize.vipPlan, input.prizeCostSettings)
      const baseExpiresAt = user.vipExpiresAt && user.vipExpiresAt.getTime() > input.lockedAt.getTime()
        ? user.vipExpiresAt
        : input.lockedAt
      const nextExpiresAt = addDays(baseExpiresAt, plan.days)
      const nextVipLevel = Math.max(user.vipLevel ?? 0, plan.level)

      await input.tx.user.update({
        where: { id: winner.userId },
        data: {
          vipLevel: nextVipLevel,
          vipExpiresAt: nextExpiresAt,
        },
      })
      await input.tx.vipOrder.create({
        data: {
          userId: winner.userId,
          orderType: plan.orderType,
          pointsCost: 0,
          days: plan.days,
          vipLevel: nextVipLevel,
          expiresAt: nextExpiresAt,
          remark: `抽奖帖《${input.post.title}》中奖自动发放：${prize.title}`,
        },
      })

      deliveredCost = addPointCost(deliveredCost, resolveLotteryPrizeUnitCost(prize, input.prizeCostSettings))
      deliveredWinnerIds.push(winner.id)
      affectedUserIds.add(winner.userId)
    }
  }

  if (deliveredWinnerIds.length > 0) {
    await input.tx.lotteryWinner.updateMany({
      where: {
        id: {
          in: deliveredWinnerIds,
        },
      },
      data: {
        deliveredAt: input.lockedAt,
      },
    })
  }

  const reservedCost = calculateLotteryAutoPrizeTotalCost(input.post.lotteryPrizes, input.prizeCostSettings)
  if (reservedCost === null) {
    throw new Error("抽奖自动奖品预扣成本计算失败")
  }

  const refundPoints = Math.max(0, reservedCost - deliveredCost)
  if (refundPoints > 0) {
    const author = await input.tx.user.findUnique({
      where: { id: input.post.authorId },
      select: { points: true },
    })
    if (!author) {
      throw new Error("抽奖发起人不存在，无法退回未发放奖品")
    }

    await applyPointDelta({
      tx: input.tx,
      userId: input.post.authorId,
      beforeBalance: author.points,
      prepared: buildFixedPointDelta("LOTTERY_PRIZE_REFUND", refundPoints),
      pointName: input.prizeCostSettings.pointName ?? "积分",
      reason: `抽奖帖《${input.post.title}》未发出的自动奖品退回`,
      eventType: POINT_LOG_EVENT_TYPES.LOTTERY_PRIZE_REFUND,
      eventData: {
        postId: input.post.id,
        reservedCost,
        deliveredCost,
        refundPoints,
      },
      relatedType: "POST",
      relatedId: input.post.id,
    })
    affectedUserIds.add(input.post.authorId)
  }

  return {
    deliveredCost,
    affectedUserIds: [...affectedUserIds],
  }
}

export async function executeLotteryDrawTransaction(input: {
  postId: string
  lockedAt: Date
  actorId?: number | null
  prizeCostSettings: LotteryPrizeCostSettings
  buildDraw: (post: NonNullable<Awaited<ReturnType<typeof findLotteryDrawContext>>>) => {
    winnersToCreate: Prisma.LotteryWinnerCreateManyInput[]
    announcement: string
  }
}) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.post.updateMany({
      where: {
        id: input.postId,
        type: "LOTTERY",
        lotteryStatus: LotteryStatus.ACTIVE,
        lotteryLockedAt: null,
        lotteryDrawnAt: null,
      },
      data: {
        lotteryStatus: LotteryStatus.LOCKED,
        lotteryLockedAt: input.lockedAt,
      },
    })

    if (claimed.count !== 1) {
      throw new LotteryDrawClaimConflictError()
    }

    const post = await findLotteryDrawContext(input.postId, tx)
    if (!post) {
      throw new Error("抽奖帖不存在")
    }

    const { winnersToCreate, announcement } = input.buildDraw(post)

    await tx.lotteryParticipant.updateMany({
      where: {
        postId: post.id,
        isEligible: true,
        lockedAt: null,
      },
      data: {
        lockedAt: input.lockedAt,
        lockVersion: {
          increment: 1,
        },
      },
    })

    if (winnersToCreate.length > 0) {
      await tx.lotteryWinner.createMany({ data: winnersToCreate })
    }

    const finalWinners = await tx.lotteryWinner.findMany({
      where: { postId: post.id },
      include: {
        prize: true,
        user: true,
      },
      orderBy: [{ prize: { sortOrder: "asc" } }, { createdAt: "asc" }],
    })

    const deliveryResult = await deliverLotteryAutomaticPrizes({
      tx,
      post,
      winners: finalWinners,
      lockedAt: input.lockedAt,
      prizeCostSettings: input.prizeCostSettings,
    })

    const finalized = await tx.post.updateMany({
      where: {
        id: post.id,
        lotteryStatus: LotteryStatus.LOCKED,
        lotteryLockedAt: input.lockedAt,
        lotteryDrawnAt: null,
      },
      data: {
        lotteryStatus: LotteryStatus.DRAWN,
        lotteryAnnouncement: announcement,
        lotteryDrawnAt: input.lockedAt,
      },
    })

    if (finalized.count !== 1) {
      throw new LotteryDrawClaimConflictError()
    }

    const notifications = finalWinners.map((winner) => ({
      userId: winner.userId,
      type: NotificationType.SYSTEM,
      senderId: input.actorId ?? null,
      relatedType: "POST" as const,
      relatedId: post.id,
      title: "你在抽奖帖中中奖了",
      content: `恭喜你在《${post.title}》中获得 ${winner.prize.title}，请前往帖子查看开奖结果。`,
    }))

    if (notifications.length > 0) {
      await createNotifications({ client: tx, notifications })
    }

    return {
      post,
      winners: finalWinners,
      announcement,
      affectedUserIds: deliveryResult.affectedUserIds,
    }
  })
}

export function findLotteryAutoDrawStatus(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      type: true,
      lotteryStatus: true,
      lotteryTriggerMode: true,
      lotteryParticipantGoal: true,
      lotteryParticipants: {
        where: {
          isEligible: true,
          user: {
            status: "ACTIVE",
          },
        },
        select: { id: true },
      },
    },
  })
}

export function findLotteryParticipantPage(postId: string, skip: number, take: number) {
  return prisma.lotteryParticipant.findMany({
    where: {
      postId,
      isEligible: true,
      user: {
        status: "ACTIVE",
      },
    },
    orderBy: {
      joinedAt: "desc",
    },
    skip,
    take,
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
  })
}

export function countLotteryParticipants(postId: string) {
  return prisma.lotteryParticipant.count({
    where: {
      postId,
      isEligible: true,
      user: {
        status: "ACTIVE",
      },
    },
  })
}
