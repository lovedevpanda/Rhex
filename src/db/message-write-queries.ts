import { prisma } from "@/db/client"

export function findMessageRecipientById(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      nickname: true,
      avatarPath: true,
      status: true,
    },
  })
}


export function findConversationParticipantByUser(conversationId: string, userId: number) {
  return prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      userId,
    },
    select: { id: true },
  })
}

export function findMessageHistoryAnchor(messageId: string, conversationId: string) {
  return prisma.directMessage.findFirst({
    where: {
      id: messageId,
      conversationId,
    },
    select: { createdAt: true },
  })
}

export function findConversationHistoryBatch(conversationId: string, beforeCreatedAt: Date, batchSize: number) {
  return prisma.directMessage.findMany({
    where: {
      conversationId,
      createdAt: {
        lt: beforeCreatedAt,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: batchSize + 1,
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          nickname: true,
          avatarPath: true,
        },
      },
    },
  })
}
