import { randomInt } from "node:crypto"

import { prisma } from "@/db/client"
import { upsertCommentEffectFeedback } from "@/db/comment-effect-feedback-queries"
import { PostRedPacketStatus, PostRedPacketTriggerType, Prisma } from "@/db/types"
import { applyPointDelta, prepareScopedPointDelta, prepareScopedProbability } from "@/lib/point-center"
import { buildRedPacketEffectFeedback } from "@/lib/post-reward-effect-feedback-builders"

interface PostRedPacketEligibleCandidate {
  userId: number
}

const POST_REWARD_POOL_TRANSACTION_MAX_RETRIES = 3
const POST_REWARD_POOL_TRANSACTION_RETRY_BASE_DELAY_MS = 25

function pickRandomCandidate<T>(candidates: readonly T[]) {
  if (candidates.length === 0) {
    return null
  }

  return candidates[randomInt(0, candidates.length)] ?? null
}

function shouldHitProbability(probability: number) {
  const normalizedProbability = Number.isFinite(probability)
    ? Math.min(100, Math.max(0, probability))
    : 0

  return randomInt(0, 10_000) < normalizedProbability * 100
}

function resolveRandomClaimRecipient(params: {
  eligibleCandidates: PostRedPacketEligibleCandidate[]
  currentUserId: number
  currentTriggerCommentId?: string
  currentUserHitProbability?: number | null
}) {
  const currentUserEligible = params.eligibleCandidates.some((candidate) => candidate.userId === params.currentUserId)
  if (!currentUserEligible) {
    const selectedCandidate = pickRandomCandidate(params.eligibleCandidates)
    return selectedCandidate
      ? {
          userId: selectedCandidate.userId,
          triggerCommentId: undefined,
        }
      : null
  }

  if (params.eligibleCandidates.length <= 1) {
    return {
      userId: params.currentUserId,
      triggerCommentId: params.currentTriggerCommentId,
    }
  }

  if (typeof params.currentUserHitProbability === "number" && shouldHitProbability(params.currentUserHitProbability)) {
    return {
      userId: params.currentUserId,
      triggerCommentId: params.currentTriggerCommentId,
    }
  }

  const otherCandidates = params.eligibleCandidates.filter((candidate) => candidate.userId !== params.currentUserId)
  const selectedCandidate = pickRandomCandidate(otherCandidates)

  if (!selectedCandidate) {
    return {
      userId: params.currentUserId,
      triggerCommentId: params.currentTriggerCommentId,
    }
  }

  return {
    userId: selectedCandidate.userId,
    triggerCommentId: undefined,
  }
}

function isCurrentUserEligibleForRandomClaim(params: {
  eligibleCandidates: PostRedPacketEligibleCandidate[]
  currentUserId: number
}) {
  return params.eligibleCandidates.some((candidate) => candidate.userId === params.currentUserId)
}

function isRetryablePostRewardPoolTransactionError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === "P2034"
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function runPostRewardPoolTransactionWithRetry<T>(
  execute: () => Promise<T>,
): Promise<T> {
  let retryCount = 0

  while (true) {
    try {
      return await execute()
    } catch (error) {
      if (!isRetryablePostRewardPoolTransactionError(error) || retryCount >= POST_REWARD_POOL_TRANSACTION_MAX_RETRIES) {
        throw error
      }

      const delayMs = POST_REWARD_POOL_TRANSACTION_RETRY_BASE_DELAY_MS * (2 ** retryCount)
        + randomInt(0, POST_REWARD_POOL_TRANSACTION_RETRY_BASE_DELAY_MS)

      retryCount += 1
      await sleep(delayMs)
    }
  }
}

async function lockPostRewardPoolByPostId(
  tx: Prisma.TransactionClient,
  postId: string,
) {
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "PostRedPacket"
    WHERE "postId" = ${postId}
    FOR UPDATE
  `)
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

async function findExistingPostRedPacketClaim(
  tx: Prisma.TransactionClient,
  redPacketId: string,
  userId: number,
) {
  return tx.postRedPacketClaim.findFirst({
    where: {
      redPacketId,
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      amount: true,
    },
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
  randomClaimProbability: number
  buildClaimReason: (params: { amount: number; pointName: string; postId: string; triggerType: PostRedPacketTriggerType }) => string
  allocateAmount: (packet: {
    grantMode: string
    remainingPoints: number
    remainingCount: number
    totalPoints: number
    packetCount: number
  }) => number
}) {
  return runPostRewardPoolTransactionWithRetry(() => prisma.$transaction(async (tx) => {
    await lockPostRewardPoolByPostId(tx, input.postId)

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

    const existingClaim = await findExistingPostRedPacketClaim(tx, packet.id, input.userId)

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

    const usesFixedRandomClaimProbability = packet.claimOrderMode === "RANDOM" && input.randomClaimProbability > 0
    const baseRandomClaimProbability = packet.claimOrderMode === "RANDOM"
      ? usesFixedRandomClaimProbability
        ? input.randomClaimProbability
        : eligibleCandidates.length > 1
          ? 100 / eligibleCandidates.length
          : null
      : null
    const preparedRandomClaimProbability = baseRandomClaimProbability === null
      ? null
      : await prepareScopedProbability({
          scopeKey: "RED_PACKET_RANDOM_CLAIM_PROBABILITY",
          baseProbability: baseRandomClaimProbability,
          userId: user.id,
        })

    if (usesFixedRandomClaimProbability) {
      const currentUserEligible = isCurrentUserEligibleForRandomClaim({
        eligibleCandidates,
        currentUserId: user.id,
      })

      if (!currentUserEligible) {
        return { claimed: false as const, reason: "当前暂无可领取的红包名额" }
      }

      const hitCurrentUser = typeof preparedRandomClaimProbability?.finalProbability === "number"
        && shouldHitProbability(preparedRandomClaimProbability.finalProbability)

      if (!hitCurrentUser) {
        const missEffectFeedback = buildRedPacketEffectFeedback({
          preparedProbability: preparedRandomClaimProbability,
          claimed: false,
          pointName: input.pointName,
        })

        if (input.triggerCommentId && missEffectFeedback) {
          await upsertCommentEffectFeedback({
            tx,
            postId: post.id,
            commentId: input.triggerCommentId,
            userId: input.userId,
            scene: "RED_PACKET_REPLY",
            feedback: missEffectFeedback,
          })
        }

        return {
          claimed: false as const,
          reason: "本次随机红包未命中你",
          effectFeedback: missEffectFeedback,
        }
      }
    }

    const resolvedRecipient = packet.claimOrderMode === "FIRST_COME_FIRST_SERVED"
      ? {
          userId: user.id,
          triggerCommentId: input.triggerCommentId,
        }
      : usesFixedRandomClaimProbability
        ? {
            userId: user.id,
            triggerCommentId: input.triggerCommentId,
          }
        : resolveRandomClaimRecipient({
            eligibleCandidates,
            currentUserId: user.id,
            currentTriggerCommentId: input.triggerCommentId,
            currentUserHitProbability: preparedRandomClaimProbability?.finalProbability ?? null,
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
      const latestClaim = await findExistingPostRedPacketClaim(tx, packet.id, input.userId)

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

    let rewardClaimId: string | null = null

    try {
      const rewardClaim = await tx.postRedPacketClaim.create({
        data: {
          redPacketId: packet.id,
          postId: post.id,
          userId: recipientUser.id,
          triggerType: input.triggerType,
          triggerCommentId: resolvedRecipient.triggerCommentId,
          amount,
        },
      })

      rewardClaimId = rewardClaim.id
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

        const duplicatedClaim = await findExistingPostRedPacketClaim(tx, packet.id, recipientUser.id)

        const duplicatedEffectFeedback = recipientUser.id === input.userId
          ? null
          : buildRedPacketEffectFeedback({
              preparedProbability: preparedRandomClaimProbability,
              claimed: false,
              pointName: input.pointName,
            })

        if (input.triggerCommentId && duplicatedEffectFeedback) {
          await upsertCommentEffectFeedback({
            tx,
            postId: post.id,
            commentId: input.triggerCommentId,
            userId: input.userId,
            scene: "RED_PACKET_REPLY",
            feedback: duplicatedEffectFeedback,
          })
        }

        return recipientUser.id === input.userId
          ? { claimed: false as const, reason: "你已经领取过该红包", amount: duplicatedClaim?.amount }
          : { claimed: false as const, reason: "本次随机红包未命中你", effectFeedback: duplicatedEffectFeedback }
      }

      throw error
    }

    const preparedReward = await prepareScopedPointDelta({
      scopeKey: "RED_PACKET_CLAIM",
      baseDelta: amount,
      userId: recipientUser.id,
    })

    await applyPointDelta({
      tx,
      userId: recipientUser.id,
      beforeBalance: recipientUser.points,
      prepared: preparedReward,
      pointName: input.pointName,
      reason: input.buildClaimReason({
        amount,
        pointName: input.pointName,
        postId: post.id,
        triggerType: input.triggerType,
      }),
      insufficientMessage: `${input.pointName}不足，无法完成本次红包结算`,
      relatedType: "POST",
      relatedId: post.id,
    })

    const effectFeedback = buildRedPacketEffectFeedback({
      preparedProbability: preparedRandomClaimProbability,
      preparedReward: recipientUser.id === input.userId ? preparedReward : null,
      claimed: recipientUser.id === input.userId,
      pointName: input.pointName,
    })

    if (input.triggerCommentId && effectFeedback) {
      await upsertCommentEffectFeedback({
        tx,
        postId: post.id,
        commentId: input.triggerCommentId,
        userId: input.userId,
        scene: "RED_PACKET_REPLY",
        rewardClaimId: recipientUser.id === input.userId ? rewardClaimId : null,
        feedback: effectFeedback,
      })
    }

    return recipientUser.id === input.userId
      ? { claimed: true as const, amount: Math.abs(preparedReward.finalDelta), pointName: input.pointName, effectFeedback }
      : { claimed: false as const, reason: "本次随机红包未命中你", effectFeedback }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  }))
}

export function findPostRewardPoolContentByPostId(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    select: {
      content: true,
    },
  })
}

export function createPostRewardPoolRecord(
  tx: Prisma.TransactionClient,
  data: Prisma.PostRedPacketUncheckedCreateInput,
) {
  return tx.postRedPacket.create({ data })
}

export function runSerializablePostRewardPoolTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    postId?: string
  },
) {
  return runPostRewardPoolTransactionWithRetry(() => prisma.$transaction(async (tx) => {
    if (options?.postId) {
      await lockPostRewardPoolByPostId(tx, options.postId)
    }

    return callback(tx)
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  }))
}

export function findJackpotClaimContext(tx: Prisma.TransactionClient, postId: string, userId: number) {
  return Promise.all([
    tx.user.findUnique({
      where: { id: userId },
      select: { id: true, points: true, status: true },
    }),
    tx.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        status: true,
        authorId: true,
        content: true,
        redPacket: true,
      },
    }),
  ])
}

export async function findJackpotParticipantStats(
  tx: Prisma.TransactionClient,
  postId: string,
  userId: number,
  redPacketId: string,
) {
  const [replyCount, priorWinSummary] = await Promise.all([
    tx.comment.count({
      where: {
        postId,
        userId,
      },
    }),
    tx.postRedPacketClaim.aggregate({
      where: {
        redPacketId,
        userId,
      },
      _count: {
        _all: true,
      },
    }),
  ])

  return {
    replyCount,
    priorWinCount: priorWinSummary._count._all,
  }
}

export function updateJackpotStatus(tx: Prisma.TransactionClient, redPacketId: string, status: PostRedPacketStatus) {
  return tx.postRedPacket.update({
    where: { id: redPacketId },
    data: { status },
  })
}

export function depositJackpotPool(
  tx: Prisma.TransactionClient,
  redPacketId: string,
  expectedRemainingPoints: number,
  nextRemainingPoints: number,
) {
  return tx.postRedPacket.updateMany({
    where: {
      id: redPacketId,
      status: "ACTIVE",
      remainingPoints: expectedRemainingPoints,
    },
    data: {
      remainingPoints: nextRemainingPoints,
    },
  })
}

export function settleJackpotClaim(
  tx: Prisma.TransactionClient,
  redPacketId: string,
  expectedRemainingPoints: number,
  nextRemainingPoints: number,
  amount: number,
  status: PostRedPacketStatus,
) {
  return tx.postRedPacket.updateMany({
    where: {
      id: redPacketId,
      status: "ACTIVE",
      remainingPoints: expectedRemainingPoints,
    },
    data: {
      remainingPoints: nextRemainingPoints,
      claimedCount: { increment: 1 },
      claimedPoints: { increment: amount },
      status,
    },
  })
}

export function createJackpotRewardClaim(tx: Prisma.TransactionClient, input: {
  redPacketId: string
  postId: string
  userId: number
  triggerCommentId?: string
  amount: number
}) {
  return tx.postRedPacketClaim.create({
    data: {
      redPacketId: input.redPacketId,
      postId: input.postId,
      userId: input.userId,
      triggerType: "REPLY",
      triggerCommentId: input.triggerCommentId,
      amount: input.amount,
    },
  })
}

export function rollbackJackpotClaimSettlement(
  tx: Prisma.TransactionClient,
  redPacketId: string,
  restoredRemainingPoints: number,
  amount: number,
  restoredStatus: PostRedPacketStatus,
) {
  return tx.postRedPacket.update({
    where: { id: redPacketId },
    data: {
      remainingPoints: restoredRemainingPoints,
      claimedCount: { decrement: 1 },
      claimedPoints: { decrement: amount },
      status: restoredStatus,
    },
  })
}


export function findPostRedPacketSummaryData(postId: string, currentUserId?: number) {
  return Promise.all([
    prisma.postRedPacket.findUnique({
      where: { postId },
      include: {
        post: {
          select: {
            content: true,
          },
        },
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
  return prisma.postRedPacketClaim.aggregate({
    where: {
      redPacketId,
      userId: currentUserId,
    },
    _count: {
      _all: true,
    },
    _sum: {
      amount: true,
    },
  })
}
