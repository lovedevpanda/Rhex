import { prisma } from "@/db/client"

export type GobangStatus = "ONGOING" | "FINISHED"

export interface GobangMatchRow {
  id: string
  creatorId: number
  challengerId: number | null
  status: GobangStatus
  winnerId: number | null
  ticketCost: number
  winReward: number
  createdAt: Date
  updatedAt: Date
  finishedAt: Date | null
}

export interface GobangMoveRow {
  id: string
  matchId: string
  playerId: number
  step: number
  x: number
  y: number
  createdAt: Date
}

function mapGobangMatchRow(match: {
  id: string
  creatorId: number
  challengerId: number | null
  status: GobangStatus
  winnerId: number | null
  ticketCost: number
  winReward: number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    ...match,
    finishedAt: match.status === "FINISHED" ? match.updatedAt : null,
  } satisfies GobangMatchRow
}

export async function countGobangMatchesInRange(userId: number, start: Date, end: Date) {
  const [total, paid] = await Promise.all([
    prisma.gobangMatch.count({
      where: {
        creatorId: userId,
        createdAt: {
          gte: start,
          lt: end,
        },
      },
    }),
    prisma.gobangMatch.count({
      where: {
        creatorId: userId,
        ticketCost: { gt: 0 },
        createdAt: {
          gte: start,
          lt: end,
        },
      },
    }),
  ])

  return { total, paid }
}

export async function createGobangMatchRecord(params: {
  id: string
  creatorId: number
  ticketCost: number
  winReward: number
  createdAt?: Date
}) {
  const createdAt = params.createdAt ?? new Date()

  await prisma.gobangMatch.create({
    data: {
      id: params.id,
      creatorId: params.creatorId,
      challengerId: null,
      status: "ONGOING",
      ticketCost: params.ticketCost,
      winReward: params.winReward,
      createdAt,
      updatedAt: createdAt,
    },
  })
}

export const insertGobangMatch = createGobangMatchRecord

export async function insertGobangMove(params: {
  id: string
  matchId: string
  playerId: number
  step: number
  x: number
  y: number
  createdAt: Date
}) {
  await prisma.gobangMove.create({
    data: {
      id: params.id,
      matchId: params.matchId,
      playerId: params.playerId,
      step: params.step,
      x: params.x,
      y: params.y,
      createdAt: params.createdAt,
    },
  })
}

export async function insertGobangMoveNow(params: {
  id: string
  matchId: string
  playerId: number
  step: number
  x: number
  y: number
  createdAt?: Date
}) {
  await insertGobangMove({
    ...params,
    createdAt: params.createdAt ?? new Date(),
  })
}

export async function listGobangMatchRows(userId: number, limit = 20) {
  const matches = await prisma.gobangMatch.findMany({
    where: { creatorId: userId },
    orderBy: [
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
    take: Math.max(1, Math.min(limit, 100)),
  })

  return matches.map(mapGobangMatchRow)
}

export async function listGobangMovesByMatchIds(matchIds: string[]) {
  if (matchIds.length === 0) {
    return [] as GobangMoveRow[]
  }

  return prisma.gobangMove.findMany({
    where: {
      matchId: {
        in: matchIds,
      },
    },
    orderBy: {
      step: "asc",
    },
  })
}

export async function getGobangMatchRow(matchId: string) {
  const match = await prisma.gobangMatch.findUnique({
    where: { id: matchId },
  })

  return match ? mapGobangMatchRow(match) : null
}

export async function getGobangMoves(matchId: string) {
  return prisma.gobangMove.findMany({
    where: { matchId },
    orderBy: {
      step: "asc",
    },
  })
}

export async function updateGobangMatchTimestamp(matchId: string, updatedAt: Date) {
  await prisma.gobangMatch.update({
    where: { id: matchId },
    data: { updatedAt },
  })
}

export async function finishGobangMatch(params: { matchId: string; winnerId: number; updatedAt: Date }) {
  await prisma.gobangMatch.update({
    where: { id: params.matchId },
    data: {
      status: "FINISHED",
      winnerId: params.winnerId,
      updatedAt: params.updatedAt,
    },
  })
}

export async function finishGobangMatchNow(params: { matchId: string; winnerId: number; updatedAt?: Date }) {
  await finishGobangMatch({
    ...params,
    updatedAt: params.updatedAt ?? new Date(),
  })
}



