import { prisma } from "@/db/client"

export interface ModeratorScopeAssignmentInput {
  id: string
  canEditSettings: boolean
}

export async function findModeratorScopeSetup(userId: number, zoneIds: string[], boardIds: string[]) {
  const [user, zones, boards] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
      },
    }),
    zoneIds.length > 0
      ? prisma.zone.findMany({
          where: { id: { in: zoneIds } },
          select: { id: true },
        })
      : Promise.resolve([]),
    boardIds.length > 0
      ? prisma.board.findMany({
          where: { id: { in: boardIds } },
          select: { id: true },
        })
      : Promise.resolve([]),
  ])

  return { user, zones, boards }
}

export async function replaceModeratorScopes(
  userId: number,
  zoneScopes: ModeratorScopeAssignmentInput[],
  boardScopes: ModeratorScopeAssignmentInput[],
) {
  await prisma.$transaction(async (tx) => {
    await tx.moderatorZoneScope.deleteMany({ where: { moderatorId: userId } })
    await tx.moderatorBoardScope.deleteMany({ where: { moderatorId: userId } })

    if (zoneScopes.length > 0) {
      await tx.moderatorZoneScope.createMany({
        data: zoneScopes.map((scope) => ({
          moderatorId: userId,
          zoneId: scope.id,
          canEditSettings: scope.canEditSettings,
        })),
      })
    }

    if (boardScopes.length > 0) {
      await tx.moderatorBoardScope.createMany({
        data: boardScopes.map((scope) => ({
          moderatorId: userId,
          boardId: scope.id,
          canEditSettings: scope.canEditSettings,
        })),
      })
    }
  })
}
