import { prisma } from "@/db/client"

export function findConversationParticipantsWithConversation(userId: number) {
  return prisma.conversationParticipant.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          participants: {
            select: {
              userId: true,
            },
          },
        },
      },
    },
  })
}

export function findDirectConversationCandidates(userAId: number, userBId: number) {
  return prisma.conversation.findMany({
    where: {
      participants: {
        some: {
          userId: {
            in: [userAId, userBId],
          },
        },
      },
    },
    include: {
      participants: {
        select: {
          id: true,
          userId: true,
          unreadCount: true,
          lastReadMessageId: true,
        },
      },
    },
  })
}

export function findConversationByIdForParticipant(conversationId: string, currentUserId: number) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: {
        some: {
          userId: currentUserId,
        },
      },
    },
    include: {
      participants: {
        select: {
          userId: true,
        },
      },
    },
  })
}

export function findConversationListItems(currentUserId: number) {
  return prisma.conversationParticipant.findMany({
    where: { userId: currentUserId },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  nickname: true,
                  avatarPath: true,
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
    take: 160,
  })
}

export async function getUnreadConversationCount(currentUserId: number) {
  const result = await prisma.conversationParticipant.aggregate({
    where: {
      userId: currentUserId,
      unreadCount: {
        gt: 0,
      },
    },
    _sum: {
      unreadCount: true,
    },
  })

  return result._sum.unreadCount ?? 0
}

export function findLatestMessageByConversationId(conversationId: string) {
  return prisma.directMessage.findFirst({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })
}

export function updateConversationReadState(conversationId: string, currentUserId: number, lastReadMessageId?: string) {
  return prisma.conversationParticipant.updateMany({
    where: {
      conversationId,
      userId: currentUserId,
    },
    data: {
      unreadCount: 0,
      lastReadMessageId,
    },
  })
}

export function findConversationDetailById(conversationId: string, currentUserId: number, initialMessagePageSize: number) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: {
        some: {
          userId: currentUserId,
        },
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              avatarPath: true,
            },
          },
        },
      },
      messages: {
        orderBy: {
          createdAt: "desc",
        },
        take: initialMessagePageSize + 1,
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
      },
    },
  })
}
