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

export async function countGobangMatchesInRange(userId: number, start: Date, end: Date) {
  const [totalRows, paidRows] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*)::bigint AS count FROM "GobangMatch" WHERE "creatorId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3`,
      userId,
      start,
      end,
    ),
    prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*)::bigint AS count FROM "GobangMatch" WHERE "creatorId" = $1 AND "ticketCost" > 0 AND "createdAt" >= $2 AND "createdAt" < $3`,
      userId,
      start,
      end,
    ),
  ])

  return {
    total: Number(totalRows[0]?.count ?? 0),
    paid: Number(paidRows[0]?.count ?? 0),
  }
}

export async function createGobangMatchRecord(params: {
  id: string
  creatorId: number
  ticketCost: number
  winReward: number
  createdAt?: Date
}) {
  const createdAt = params.createdAt ?? new Date()

  await prisma.$executeRawUnsafe(
    `INSERT INTO "GobangMatch" ("id", "creatorId", "challengerId", "status", "ticketCost", "winReward", "createdAt", "updatedAt") VALUES ($1, $2, NULL, 'ONGOING', $3, $4, $5, $5)`,
    params.id,
    params.creatorId,
    params.ticketCost,
    params.winReward,
    createdAt,
  )
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
  await prisma.$executeRawUnsafe(
    `INSERT INTO "GobangMove" ("id", "matchId", "playerId", "step", "x", "y", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    params.id,
    params.matchId,
    params.playerId,
    params.step,
    params.x,
    params.y,
    params.createdAt,
  )
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
  const createdAt = params.createdAt ?? new Date()

  await prisma.$executeRawUnsafe(
    `INSERT INTO "GobangMove" ("id", "matchId", "playerId", "step", "x", "y", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    params.id,
    params.matchId,
    params.playerId,
    params.step,
    params.x,
    params.y,
    createdAt,
  )
}



export async function listGobangMatchRows(userId: number, limit = 20) {
  return prisma.$queryRawUnsafe<GobangMatchRow[]>(
    `SELECT *, CASE WHEN "status" = 'FINISHED' THEN "updatedAt" ELSE NULL END AS "finishedAt" FROM "GobangMatch" WHERE "creatorId" = $1 ORDER BY COALESCE(CASE WHEN "status" = 'FINISHED' THEN "updatedAt" END, "createdAt") DESC LIMIT ${Math.max(1, Math.min(limit, 100))}`,
    userId,
  )
}

export async function listGobangMovesByMatchIds(matchIds: string[]) {
  if (matchIds.length === 0) {
    return [] as GobangMoveRow[]
  }

  const ids = matchIds.map((matchId) => `'${matchId}'`).join(",")
  return prisma.$queryRawUnsafe<GobangMoveRow[]>(`SELECT * FROM "GobangMove" WHERE "matchId" IN (${ids}) ORDER BY "step" ASC`)
}

export async function getGobangMatchRow(matchId: string) {
  const rows = await prisma.$queryRawUnsafe<GobangMatchRow[]>(`SELECT *, CASE WHEN "status" = 'FINISHED' THEN "updatedAt" ELSE NULL END AS "finishedAt" FROM "GobangMatch" WHERE "id" = $1 LIMIT 1`, matchId)
  return rows[0] ?? null
}

export async function getGobangMoves(matchId: string) {
  return prisma.$queryRawUnsafe<GobangMoveRow[]>(`SELECT * FROM "GobangMove" WHERE "matchId" = $1 ORDER BY "step" ASC`, matchId)
}

export async function updateGobangMatchTimestamp(matchId: string, updatedAt: Date) {
  await prisma.$executeRawUnsafe(
    `UPDATE "GobangMatch" SET "updatedAt" = $2 WHERE "id" = $1`,
    matchId,
    updatedAt,
  )
}

export async function finishGobangMatch(params: { matchId: string; winnerId: number; updatedAt: Date }) {
  await prisma.$executeRawUnsafe(
    `UPDATE "GobangMatch" SET "status" = 'FINISHED', "winnerId" = $2, "updatedAt" = $3 WHERE "id" = $1`,
    params.matchId,
    params.winnerId,
    params.updatedAt,
  )
}

export async function finishGobangMatchNow(params: { matchId: string; winnerId: number; updatedAt?: Date }) {
  const updatedAt = params.updatedAt ?? new Date()

  await prisma.$executeRawUnsafe(
    `UPDATE "GobangMatch" SET "status" = 'FINISHED', "winnerId" = $2, "updatedAt" = $3 WHERE "id" = $1`,
    params.matchId,
    params.winnerId,
    updatedAt,
  )
}


