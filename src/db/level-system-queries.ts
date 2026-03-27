import { prisma } from "@/db/client"

export type LevelDefinitionRecord = {
  id: string
  level: number
  name: string
  color: string
  icon: string
  requireCheckInDays: number
  requirePostCount: number
  requireCommentCount: number
  requireLikeCount: number
  createdAt: Date
  updatedAt: Date
}

export type UserLevelProgressRecord = {
  id: string
  userId: number
  checkInDays: number
  receivedPostLikes: number
  receivedCommentLikes: number
  receivedLikeCount: number
  createdAt: Date
  updatedAt: Date
}

type ExtendedPrismaClient = typeof prisma & {
  levelDefinition: {
    count: () => Promise<number>
    createMany: (args: { data: Array<Omit<LevelDefinitionRecord, "id" | "createdAt" | "updatedAt">> }) => Promise<unknown>
    findMany: (args?: { orderBy?: { level: "asc" | "desc" }; select?: { id: true } }) => Promise<Array<LevelDefinitionRecord | { id: string }>>
    findUnique: (args: { where: { level?: number; id?: string } }) => Promise<LevelDefinitionRecord | null>
    deleteMany: (args: { where: { id: { in: string[] } } }) => Promise<unknown>
    update: (args: { where: { id: string }; data: Partial<Omit<LevelDefinitionRecord, "id" | "createdAt" | "updatedAt">> }) => Promise<LevelDefinitionRecord>
    create: (args: { data: Omit<LevelDefinitionRecord, "id" | "createdAt" | "updatedAt"> }) => Promise<LevelDefinitionRecord>
  }
  userLevelProgress: {
    findUnique: (args: { where: { userId: number }; select?: { checkInDays: true } }) => Promise<Pick<UserLevelProgressRecord, "checkInDays"> | UserLevelProgressRecord | null>
    upsert: (args: {
      where: { userId: number }
      update: Partial<{ checkInDays: { increment: number }; receivedPostLikes: number; receivedCommentLikes: number; receivedLikeCount: number }>
      create: { userId: number; checkInDays?: number; receivedPostLikes?: number; receivedCommentLikes?: number; receivedLikeCount?: number }
    }) => Promise<UserLevelProgressRecord>
  }
}

const extendedPrisma = prisma as ExtendedPrismaClient

export function countLevelDefinitions() {
  return extendedPrisma.levelDefinition.count()
}

export function createManyLevelDefinitions(data: Array<Omit<LevelDefinitionRecord, "id" | "createdAt" | "updatedAt">>) {
  return extendedPrisma.levelDefinition.createMany({ data })
}

export function findAllLevelDefinitions() {
  return extendedPrisma.levelDefinition.findMany({
    orderBy: { level: "asc" },
  }) as Promise<LevelDefinitionRecord[]>
}

export function findLevelDefinitionByLevel(level: number) {
  return extendedPrisma.levelDefinition.findUnique({ where: { level } })
}

export function findUserLevelGrowthUser(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      level: true,
      postCount: true,
      commentCount: true,
      likeReceivedCount: true,
    },
  })
}

export function findUserLevelProgressByUserId(userId: number) {
  return extendedPrisma.userLevelProgress.findUnique({
    where: { userId },
    select: {
      checkInDays: true,
    },
  })
}

export function updateUserLevel(userId: number, level: number) {
  return prisma.user.update({
    where: { id: userId },
    data: { level },
  })
}

export function upsertUserCheckInGrowth(userId: number) {
  return extendedPrisma.userLevelProgress.upsert({
    where: { userId },
    update: {
      checkInDays: {
        increment: 1,
      },
    },
    create: {
      userId,
      checkInDays: 1,
    },
  })
}

export function countUserPostLikes(userId: number) {
  return prisma.like.count({
    where: {
      targetType: "POST",
      post: {
        authorId: userId,
      },
    },
  })
}

export function countUserCommentLikes(userId: number) {
  return prisma.like.count({
    where: {
      targetType: "COMMENT",
      comment: {
        userId,
      },
    },
  })
}

export async function syncUserReceivedLikesInTransaction(userId: number, postLikes: number, commentLikes: number) {
  const totalLikes = postLikes + commentLikes

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { likeReceivedCount: totalLikes },
    })

    await extendedPrisma.userLevelProgress.upsert({
      where: { userId },
      update: {
        receivedPostLikes: postLikes,
        receivedCommentLikes: commentLikes,
        receivedLikeCount: totalLikes,
      },
      create: {
        userId,
        receivedPostLikes: postLikes,
        receivedCommentLikes: commentLikes,
        receivedLikeCount: totalLikes,
      },
    })
  })
}

export async function saveLevelDefinitionsInTransaction(input: Array<{
  id?: string
  level: number
  name: string
  color: string
  icon: string
  requireCheckInDays: number
  requirePostCount: number
  requireCommentCount: number
  requireLikeCount: number
}>) {
  await prisma.$transaction(async () => {
    const existing = await extendedPrisma.levelDefinition.findMany({ select: { id: true } }) as Array<{ id: string }>
    const keepIds = input.map((item) => item.id).filter(Boolean) as string[]
    const deleteIds = existing.map((item) => item.id).filter((id) => !keepIds.includes(id))

    if (deleteIds.length > 0) {
      await extendedPrisma.levelDefinition.deleteMany({
        where: {
          id: {
            in: deleteIds,
          },
        },
      })
    }

    for (const item of input) {
      if (item.id) {
        await extendedPrisma.levelDefinition.update({
          where: { id: item.id },
          data: {
            level: item.level,
            name: item.name,
            color: item.color,
            icon: item.icon,
            requireCheckInDays: item.requireCheckInDays,
            requirePostCount: item.requirePostCount,
            requireCommentCount: item.requireCommentCount,
            requireLikeCount: item.requireLikeCount,
          },
        })
        continue
      }

      await extendedPrisma.levelDefinition.create({
        data: {
          level: item.level,
          name: item.name,
          color: item.color,
          icon: item.icon,
          requireCheckInDays: item.requireCheckInDays,
          requirePostCount: item.requirePostCount,
          requireCommentCount: item.requireCommentCount,
          requireLikeCount: item.requireLikeCount,
        },
      })
    }
  })
}

export function findAllUserIdsForLevelRefresh() {
  return prisma.user.findMany({ select: { id: true } })
}
