import { prisma } from "@/db/client"
import { Prisma } from "@/db/types"

export type RssInteractionTx = Prisma.TransactionClient

const rssEntryInteractionSelect = {
  id: true,
  title: true,
  reviewStatus: true,
  likeCount: true,
  tipCount: true,
  tipTotalPoints: true,
  source: {
    select: {
      id: true,
      siteName: true,
    },
  },
} satisfies Prisma.RssEntrySelect

export type RssEntryInteractionRecord = Prisma.RssEntryGetPayload<{ select: typeof rssEntryInteractionSelect }>

const rssTipSenderSelect = {
  id: true,
  username: true,
  nickname: true,
  avatarPath: true,
  status: true,
  points: true,
} satisfies Prisma.UserSelect

export type RssTipSenderRecord = Prisma.UserGetPayload<{ select: typeof rssTipSenderSelect }>

export function runRssInteractionTransaction<T>(task: (tx: RssInteractionTx) => Promise<T>) {
  return prisma.$transaction(task)
}

// RSS tips have per-sender daily and per-entry limits. Locking the sender row
// makes the count-and-create sequence a single concurrency boundary without
// serializing unrelated senders.
export async function lockRssTipSender(tx: RssInteractionTx, senderId: number) {
  await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
    SELECT "id"
    FROM "User"
    WHERE "id" = ${senderId}
    FOR UPDATE
  `)
}

export function findRssEntryForInteraction(entryId: string, client: RssInteractionTx = prisma) {
  return client.rssEntry.findUnique({
    where: { id: entryId },
    select: rssEntryInteractionSelect,
  })
}

export function findRssTipSender(senderId: number, client: RssInteractionTx = prisma) {
  return client.user.findUnique({
    where: { id: senderId },
    select: rssTipSenderSelect,
  })
}

export function findRssTipUserPoints(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      points: true,
    },
  })
}

export function findRssEntryLike(entryId: string, userId: number, client: RssInteractionTx = prisma) {
  return client.rssEntryLike.findUnique({
    where: {
      entryId_userId: {
        entryId,
        userId,
      },
    },
    select: {
      id: true,
    },
  })
}

export function countRssEntryTipsBySender(params: {
  senderId: number
  entryId?: string
  start?: Date
  end?: Date
  client?: RssInteractionTx
}) {
  const client = params.client ?? prisma
  return client.rssEntryTip.count({
    where: {
      senderId: params.senderId,
      ...(params.entryId ? { entryId: params.entryId } : {}),
      ...(params.start && params.end
        ? {
            createdAt: {
              gte: params.start,
              lt: params.end,
            },
          }
        : {}),
    },
  })
}

export function listRssEntryTipSupportAggregates(entryId: string, take = 10) {
  return prisma.rssEntryTip.groupBy({
    by: ["senderId"],
    where: { entryId },
    _sum: {
      amount: true,
    },
    orderBy: {
      _sum: {
        amount: "desc",
      },
    },
    take,
  })
}

export function findRssTipSupportersByIds(userIds: number[]) {
  if (userIds.length === 0) {
    return Promise.resolve([])
  }

  return prisma.user.findMany({
    where: {
      id: {
        in: userIds,
      },
    },
    select: rssTipSenderSelect,
  })
}
