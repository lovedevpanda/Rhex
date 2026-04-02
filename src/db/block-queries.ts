import type { Prisma } from "@/db/types"

import { prisma } from "@/db/client"

function isKnownPrismaError(error: unknown, code: string) {
  return error instanceof Error && "code" in error && (error as { code?: string }).code === code
}

export function normalizeBlockedUserId(targetId: string | number) {
  const blockedId = typeof targetId === "number" ? targetId : Number(targetId)
  return Number.isInteger(blockedId) && blockedId > 0 ? blockedId : null
}

const blockedUserSelect = {
  id: true,
  username: true,
  nickname: true,
  bio: true,
  avatarPath: true,
  status: true,
  level: true,
  postCount: true,
  commentCount: true,
  likeReceivedCount: true,
  _count: {
    select: {
      followedByUsers: true,
    },
  },
} satisfies Prisma.UserSelect

export function findUserBlockRecord(params: {
  blockerId: number
  blockedId: number
}) {
  return prisma.userBlock.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId: params.blockerId,
        blockedId: params.blockedId,
      },
    },
    select: { id: true },
  })
}

export async function findUserBlockRelationState(viewerUserId: number, targetUserId: number) {
  if (viewerUserId === targetUserId) {
    return {
      hasBlocked: false,
      isBlockedBy: false,
    }
  }

  const relations = await prisma.userBlock.findMany({
    where: {
      OR: [
        {
          blockerId: viewerUserId,
          blockedId: targetUserId,
        },
        {
          blockerId: targetUserId,
          blockedId: viewerUserId,
        },
      ],
    },
    select: {
      blockerId: true,
      blockedId: true,
    },
  })

  return {
    hasBlocked: relations.some((relation) => relation.blockerId === viewerUserId && relation.blockedId === targetUserId),
    isBlockedBy: relations.some((relation) => relation.blockerId === targetUserId && relation.blockedId === viewerUserId),
  }
}

export async function findBlockedUserIdsForViewer(viewerUserId: number, targetUserIds: number[]) {
  const normalizedTargetUserIds = [...new Set(targetUserIds.filter((userId) => Number.isInteger(userId) && userId > 0 && userId !== viewerUserId))]

  if (normalizedTargetUserIds.length === 0) {
    return []
  }

  const relations = await prisma.userBlock.findMany({
    where: {
      OR: [
        {
          blockerId: viewerUserId,
          blockedId: {
            in: normalizedTargetUserIds,
          },
        },
        {
          blockedId: viewerUserId,
          blockerId: {
            in: normalizedTargetUserIds,
          },
        },
      ],
    },
    select: {
      blockerId: true,
      blockedId: true,
    },
  })

  const blockedUserIds = new Set<number>()

  for (const relation of relations) {
    if (relation.blockerId === viewerUserId) {
      blockedUserIds.add(relation.blockedId)
      continue
    }

    blockedUserIds.add(relation.blockerId)
  }

  return [...blockedUserIds]
}

export async function toggleUserBlock(params: {
  blockerId: number
  targetId: string
  desiredBlocked?: boolean
}) {
  const blockedId = normalizeBlockedUserId(params.targetId)

  if (!blockedId) {
    return { status: "invalid" as const }
  }

  if (blockedId === params.blockerId) {
    return { status: "self" as const }
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: blockedId },
      select: { id: true },
    })

    if (!user) {
      return { status: "missing" as const }
    }

    const existing = await tx.userBlock.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: params.blockerId,
          blockedId,
        },
      },
      select: { id: true },
    })

    if (existing) {
      if (params.desiredBlocked === true) {
        return { status: "ok" as const, blocked: true, changed: false }
      }

      await tx.userBlock.delete({
        where: {
          blockerId_blockedId: {
            blockerId: params.blockerId,
            blockedId,
          },
        },
      })

      return { status: "ok" as const, blocked: false, changed: true }
    }

    if (params.desiredBlocked === false) {
      return { status: "ok" as const, blocked: false, changed: false }
    }

    try {
      await tx.userBlock.create({
        data: {
          blockerId: params.blockerId,
          blockedId,
        },
      })
    } catch (error) {
      if (!isKnownPrismaError(error, "P2002")) {
        throw error
      }
    }

    await tx.userFollow.deleteMany({
      where: {
        OR: [
          {
            followerId: params.blockerId,
            followingId: blockedId,
          },
          {
            followerId: blockedId,
            followingId: params.blockerId,
          },
        ],
      },
    })

    return { status: "ok" as const, blocked: true, changed: true }
  })
}

export function countUserBlocks(blockerId: number) {
  return prisma.userBlock.count({
    where: { blockerId },
  })
}

export function findUserBlocksById(blockerId: number, options: { page: number; pageSize: number }) {
  const normalizedPageSize = Math.min(Math.max(1, options.pageSize), 50)

  return prisma.userBlock.findMany({
    where: { blockerId },
    include: {
      blocked: {
        select: blockedUserSelect,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: (options.page - 1) * normalizedPageSize,
    take: normalizedPageSize,
  })
}
