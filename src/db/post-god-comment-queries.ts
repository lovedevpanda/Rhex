import type { Prisma } from "@/db/types"

export async function lockGodCommentPost(tx: Prisma.TransactionClient, postId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Post"
    WHERE "id" = ${postId}
    FOR UPDATE
  `

  return rows[0] ?? null
}
