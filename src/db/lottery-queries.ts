import { prisma } from "@/db/client"
import { LotteryStatus, NotificationType, type Prisma } from "@/db/types"

export function findLotteryEnrollmentContext(input: { postId: string; userId: number; replyCommentId?: string | null }) {
  return Promise.all([
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
  ])
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

export function upsertLotteryParticipantEligibility(input: {
  postId: string
  userId: number
  replyCommentId?: string | null
  isEligible: boolean
  ineligibleReason: string | null
  joinedAt?: Date
}) {
  return prisma.lotteryParticipant.upsert({
    where: {
      postId_userId: {
        postId: input.postId,
        userId: input.userId,
      },
    },
    update: {
      isEligible: input.isEligible,
      ineligibleReason: input.ineligibleReason,
      sourceCommentId: input.replyCommentId ?? undefined,
      ...(input.joinedAt ? { joinedAt: input.joinedAt } : {}),
    },
    create: {
      postId: input.postId,
      userId: input.userId,
      sourceCommentId: input.replyCommentId ?? undefined,
      isEligible: input.isEligible,
      ineligibleReason: input.ineligibleReason,
      ...(input.joinedAt ? { joinedAt: input.joinedAt } : {}),
    },
  })
}

export function findLotteryDrawContext(postId: string) {
  return prisma.post.findUnique({
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

export async function executeLotteryDrawTransaction(input: {
  post: Awaited<ReturnType<typeof findLotteryDrawContext>>
  lockedAt: Date
  winnersToCreate: Prisma.LotteryWinnerCreateManyInput[]
  actorId?: number | null
  announcement: string
}) {
  const post = input.post
  if (!post) {
    throw new Error("抽奖帖不存在")
  }

  return prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: post.id },
      data: {
        lotteryStatus: LotteryStatus.LOCKED,
        lotteryLockedAt: input.lockedAt,
      },
    })

    await tx.lotteryParticipant.updateMany({
      where: {
        postId: post.id,
        isEligible: true,
      },
      data: {
        lockedAt: input.lockedAt,
        lockVersion: {
          increment: 1,
        },
      },
    })

    if (post.lotteryWinners.length > 0) {
      await tx.lotteryWinner.deleteMany({ where: { postId: post.id } })
    }

    if (input.winnersToCreate.length > 0) {
      await tx.lotteryWinner.createMany({ data: input.winnersToCreate })
    }

    const finalWinners = await tx.lotteryWinner.findMany({
      where: { postId: post.id },
      include: {
        prize: true,
        user: true,
      },
      orderBy: [{ prize: { sortOrder: "asc" } }, { createdAt: "asc" }],
    })

    await tx.post.update({
      where: { id: post.id },
      data: {
        lotteryStatus: LotteryStatus.DRAWN,
        lotteryAnnouncement: input.announcement,
        lotteryDrawnAt: input.lockedAt,
      },
    })

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
      await tx.notification.createMany({ data: notifications })
    }

    return {
      winners: finalWinners,
      announcement: input.announcement,
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
