import { Prisma } from "@/db/types"

import { parsePositiveSafeInteger } from "@/lib/shared/safe-integer"

export function incrementBoardTreasuryPoints(
  tx: Prisma.TransactionClient,
  boardId: string,
  amount: number,
) {
  const normalizedAmount = parsePositiveSafeInteger(amount)

  if (!normalizedAmount) {
    return Promise.resolve(0)
  }

  return tx.$executeRaw(Prisma.sql`
    UPDATE "Board"
    SET "treasuryPoints" = "treasuryPoints" + ${normalizedAmount}
    WHERE "id" = ${boardId}
  `)
}

export async function decrementBoardTreasuryPointsIfEnough(
  tx: Prisma.TransactionClient,
  boardId: string,
  amount: number,
) {
  const normalizedAmount = parsePositiveSafeInteger(amount)

  if (!normalizedAmount) {
    return false
  }

  const result = await tx.board.updateMany({
    where: {
      id: boardId,
      treasuryPoints: {
        gte: normalizedAmount,
      },
    },
    data: {
      treasuryPoints: {
        decrement: normalizedAmount,
      },
    },
  })

  return result.count > 0
}
