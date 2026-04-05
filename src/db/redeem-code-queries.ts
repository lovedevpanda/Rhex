import { Prisma } from "@prisma/client"

import { prisma } from "@/db/client"

export const redeemCodeListInclude = {

  createdBy: { select: { username: true } },
  redeemedBy: { select: { username: true } },
} as const

export interface RedeemCodeListRow {
  id: string
  code: string
  points: number
  codeCategory: string | null
  categoryUserLimit: number | null
  createdAt: Date
  updatedAt: Date
  createdById: number | null
  redeemedById: number | null
  redeemedAt: Date | null
  expiresAt: Date | null
  note: string | null
  createdBy: { username: string } | null
  redeemedBy: { username: string } | null
}





export async function findRedeemCodeByCode(code: string) {
  return prisma.redeemCode.findUnique({
    where: { code },
  })
}

export async function findUserBaseById(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })
}

export async function createRedeemCodeRecords(data: Array<{
  code: string
  points: number
  codeCategory: string
  categoryUserLimit: number | null
  createdById?: number | null
  note?: string | null
  expiresAt?: Date | null
}>) {
  await prisma.redeemCode.createMany({
    data: data as never,
  })
}

export async function listRedeemCodesByCodes(codes: string[]) {
  return prisma.redeemCode.findMany({
    where: {
      code: {
        in: codes,
      },
    },
    orderBy: { createdAt: "desc" },
    include: redeemCodeListInclude,
  })
}

export async function listRedeemCodes(limit = 100) {
  return prisma.redeemCode.findMany({
    orderBy: [{ redeemedAt: "asc" }, { createdAt: "desc" }],
    take: Math.max(1, Math.min(limit, 200)),
    include: redeemCodeListInclude,
  })
}

export interface RedeemCodeCoreRow {
  id: string
  code: string
  points: number
  codeCategory: string | null
  categoryUserLimit: number | null
  createdById: number | null
  redeemedById: number | null
  redeemedAt: Date | null
  expiresAt: Date | null
  note: string | null
  createdAt: Date
  updatedAt: Date
}

export async function findRedeemCodeByCodeWithTx(tx: Prisma.TransactionClient, code: string): Promise<RedeemCodeCoreRow | null> {
  return tx.redeemCode.findUnique({
    where: { code },
  }) as Promise<RedeemCodeCoreRow | null>
}

export async function listRedeemedCodesByUserWithTx(tx: Prisma.TransactionClient, userId: number): Promise<RedeemCodeCoreRow[]> {
  return tx.redeemCode.findMany({
    where: {
      redeemedById: userId,
    },
  }) as Promise<RedeemCodeCoreRow[]>
}

export function countRedeemedCodesByUserCategoryWithTx(
  tx: Prisma.TransactionClient,
  params: {
    userId: number
    codeCategory: string
  },
) {
  return tx.$queryRaw<Array<{ count: number | string | bigint }>>(Prisma.sql`
    SELECT COUNT(*)::int AS "count"
    FROM "RedeemCode"
    WHERE "redeemedById" = ${params.userId}
      AND ${
        params.codeCategory === "default"
          ? Prisma.sql`("codeCategory" = 'default' OR "codeCategory" IS NULL)`
          : Prisma.sql`"codeCategory" = ${params.codeCategory}`
      }
  `).then((rows) => Number(rows[0]?.count ?? 0))
}

export function findUserPointsByIdWithTx(tx: Prisma.TransactionClient, userId: number) {
  return tx.user.findUnique({
    where: { id: userId },
    select: { id: true, points: true },
  })
}

export function runRedeemCodeTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(callback)
}


export async function markRedeemCodeUsedWithTx(tx: Prisma.TransactionClient, redeemCodeId: string, userId: number) {
  return tx.redeemCode.update({
    where: { id: redeemCodeId },
    data: {
      redeemedById: userId,
      redeemedAt: new Date(),
    },
  })
}
