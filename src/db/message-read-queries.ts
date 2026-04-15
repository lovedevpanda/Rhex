import { prisma } from "@/db/client"
import { ConversationKind } from "@/db/types"

export function findDirectConversationByUsers(userLowId: number, userHighId: number) {
  return prisma.directConversation.findUnique({
    where: {
      userLowId_userHighId: {
        userLowId,
        userHighId,
      },
    },
    include: {
      conversation: {
        include: {
          participants: true,
        },
      },
    },
  })
}

export function findConversationByIdForParticipant(conversationId: string, currentUserId: number) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      kind: ConversationKind.DIRECT,
      messages: {
        some: {},
      },
      participants: {
        some: {
          userId: currentUserId,
          archivedAt: null,
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
    where: {
      userId: currentUserId,
      archivedAt: null,
      conversation: {
        kind: ConversationKind.DIRECT,
        messages: {
          some: {},
        },
      },
    },
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
      archivedAt: null,
      conversation: {
        kind: ConversationKind.DIRECT,
      },
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
      archivedAt: null,
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
      kind: ConversationKind.DIRECT,
      messages: {
        some: {},
      },
      participants: {
        some: {
          userId: currentUserId,
          archivedAt: null,
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
