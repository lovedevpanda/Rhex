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

export function createConversationWithParticipants(senderId: number, recipientId: number) {
  return prisma.conversation.create({
    data: {
      participants: {
        create: [
          { userId: senderId, unreadCount: 0 },
          { userId: recipientId, unreadCount: 0 },
        ],
      },
    },
    include: {
      participants: true,
    },
  })
}

export function findConversationWithParticipants(conversationId: string) {
  return prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: true,
    },
  })
}

export async function createDirectMessageInTransaction(conversationId: string, senderId: number, recipientId: number, body: string) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.directMessage.create({
      data: {
        conversationId,
        senderId,
        body,
      },
    })

    await tx.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: created.createdAt,
      },
    })

    await tx.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId: recipientId,
      },
      data: {
        unreadCount: { increment: 1 },
      },
    })

    await tx.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId: senderId,
      },
      data: {
        unreadCount: 0,
        lastReadMessageId: created.id,
      },
    })

    return created
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
