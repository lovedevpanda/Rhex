import { DbTransaction, withDbTransaction } from "@/db/helpers"
import {
  findConversationByIdForParticipant,
  findConversationDetailById,
  findConversationListItems,
  findConversationParticipantsWithConversation,
  findDirectConversationCandidates,
  findLatestMessageByConversationId,
  getUnreadConversationCount,
  updateConversationReadState,
} from "@/db/message-read-queries"
import {
  createConversationWithParticipants,
  createDirectMessageInTransaction,
  findConversationHistoryBatch,
  findConversationParticipantByUser,
  findConversationWithParticipants,
  findMessageHistoryAnchor,
  findMessageRecipientById,
} from "@/db/message-write-queries"





import { UserStatus } from "@/db/types"



import { formatMonthDayTime } from "@/lib/formatters"
import type {

  MessageBubbleItem,
  MessageCenterData,
  MessageConversationDetail,
  MessageConversationListItem,
  MessageHistoryResult,
  MessageParticipantProfile,
} from "@/lib/message-types"
import { getUserDisplayName } from "@/lib/users"



type MessageTransactionClient = DbTransaction





const INITIAL_MESSAGE_PAGE_SIZE = 20
const MESSAGE_HISTORY_BATCH_SIZE = 50

function getDisplayName(user: { username: string; nickname?: string | null }) {
  return user.nickname?.trim() || user.username
}


function mapConversationParticipant(
  participant: {
    userId: number
    unreadCount: number
    user: {
      id: number
      username: string
      nickname: string | null
      avatarPath: string | null
    }
  },
  currentUserId: number,
): MessageParticipantProfile {
  return {
    id: participant.user.id,
    username: participant.user.username,
    displayName: participant.userId === currentUserId ? "我" : getDisplayName(participant.user),
    avatarPath: participant.user.avatarPath,
    isCurrentUser: participant.userId === currentUserId,
  }
}

function mapMessageBubble(
  message: {
    id: string
    body: string
    createdAt: Date
    senderId: number
    sender: {
      id: number
      username: string
      nickname: string | null
      avatarPath: string | null
    }
  },
  currentUserId: number,
): MessageBubbleItem {
  return {
    id: message.id,
    body: message.body,
    createdAt: formatMonthDayTime(message.createdAt),
    senderId: message.senderId,
    senderName: message.senderId === currentUserId ? "我" : getUserDisplayName(message.sender),
    senderAvatarPath: message.sender.avatarPath,
    isMine: message.senderId === currentUserId,
  }
}

async function removeConversationForUser(tx: MessageTransactionClient, conversationId: string, currentUserId: number) {
  const participant = await tx.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: currentUserId,
      },
    },
    select: {
      id: true,
    },
  })

  if (!participant) {
    return
  }

  await tx.conversationParticipant.delete({
    where: { id: participant.id },
  })

  const remainingCount = await tx.conversationParticipant.count({
    where: { conversationId },
  })

  if (remainingCount <= 0) {
    await tx.conversation.delete({
      where: { id: conversationId },
    })
  }
}

async function cleanupMalformedConversations(currentUserId: number) {
  const participants = await findConversationParticipantsWithConversation(currentUserId)


  const invalidConversationIds = participants
    .filter((item) => {
      const participantUserIds = item.conversation.participants.map((participant) => participant.userId)
      const otherUserIds = participantUserIds.filter((userId) => userId !== currentUserId)
      return otherUserIds.length === 0
    })
    .map((item) => item.conversationId)

  if (invalidConversationIds.length === 0) {
    return
  }

  await withDbTransaction(async (tx) => {
    for (const conversationId of invalidConversationIds) {
      await removeConversationForUser(tx, conversationId, currentUserId)
    }
  })

}

async function normalizeDirectConversations(currentUserId: number) {
  await cleanupMalformedConversations(currentUserId)

  const participants = await findConversationParticipantsWithConversation(currentUserId)


  const partnerIds = new Set<number>()

  for (const item of participants) {
    const currentPartnerIds = item.conversation.participants.map((participant) => participant.userId).filter((userId) => userId !== currentUserId)

    if (currentPartnerIds.length !== 1 || item.conversation.participants.length !== 2) {
      continue
    }

    partnerIds.add(currentPartnerIds[0])
  }

  for (const partnerId of partnerIds) {
    await mergeDuplicateDirectConversations(currentUserId, partnerId)
  }
}


async function findDirectConversations(userAId: number, userBId: number) {
  const candidates = await findDirectConversationCandidates(userAId, userBId)

  return candidates
    .filter((conversation) => {
      if (conversation.participants.length !== 2) {
        return false
      }

      const userIds = conversation.participants.map((participant) => participant.userId).sort((left, right) => left - right)
      return userIds[0] === Math.min(userAId, userBId) && userIds[1] === Math.max(userAId, userBId)
    })
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
}


async function mergeDuplicateDirectConversations(userAId: number, userBId: number) {
  const conversations = await findDirectConversations(userAId, userBId)

  if (conversations.length <= 1) {
    return conversations[0] ?? null
  }

  const canonical = conversations[0]
  const duplicates = conversations.slice(1)

  await withDbTransaction(async (tx) => {
    for (const duplicate of duplicates) {

      const duplicateMessages = await tx.directMessage.findMany({
        where: { conversationId: duplicate.id },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      })

      await tx.directMessage.updateMany({
        where: { conversationId: duplicate.id },
        data: { conversationId: canonical.id },
      })

      for (const participant of duplicate.participants) {
        const existingParticipant = canonical.participants.find((item) => item.userId === participant.userId)

        if (!existingParticipant) {
          await tx.conversationParticipant.update({
            where: { id: participant.id },
            data: {
              conversationId: canonical.id,
            },
          })
          continue
        }

        const mergedLastReadMessageId = existingParticipant.lastReadMessageId ?? participant.lastReadMessageId ?? null

        await tx.conversationParticipant.update({
          where: { id: existingParticipant.id },
          data: {
            unreadCount: Math.max(existingParticipant.unreadCount, participant.unreadCount),
            lastReadMessageId: mergedLastReadMessageId,
          },
        })
      }

      const latestMessageAt = duplicateMessages.at(-1)?.createdAt
      if (latestMessageAt && latestMessageAt.getTime() > canonical.lastMessageAt.getTime()) {
        await tx.conversation.update({
          where: { id: canonical.id },
          data: { lastMessageAt: latestMessageAt },
        })
      }

      await tx.conversation.delete({ where: { id: duplicate.id } })
    }
  })

  return findConversationWithParticipants(canonical.id)
}


async function getOrCreateConversation(senderId: number, recipientId: number) {
  const merged = await mergeDuplicateDirectConversations(senderId, recipientId)
  if (merged) {
    return merged
  }

  return createConversationWithParticipants(senderId, recipientId)
}


async function resolveCanonicalConversationId(currentUserId: number, conversationId: string): Promise<string | undefined> {
  const conversation = await findConversationByIdForParticipant(conversationId, currentUserId)


  if (!conversation) {
    return undefined
  }

  const partnerIds = conversation.participants.map((participant) => participant.userId).filter((userId) => userId !== currentUserId)

  if (partnerIds.length === 0) {
    await withDbTransaction(async (tx) => {
      await removeConversationForUser(tx, conversation.id, currentUserId)
    })
    return undefined
  }


  if (partnerIds.length === 1 && conversation.participants.length === 2) {
    const canonical = await getOrCreateConversation(currentUserId, partnerIds[0])
    return canonical.id
  }

  return conversation.id
}

async function getDatabaseBackedConversations(currentUserId: number): Promise<MessageConversationListItem[]> {
  const items = await findConversationListItems(currentUserId)


  const deduped = new Map<number, MessageConversationListItem & { sortAt: Date }>()

  for (const item of items) {
    const participants = item.conversation.participants.map((participant) => mapConversationParticipant(participant, currentUserId))
    const partner = participants.find((participant) => !participant.isCurrentUser)

    if (!partner) {
      continue
    }

    const latestMessage = item.conversation.messages[0]
    const sortAt = latestMessage?.createdAt ?? item.conversation.lastMessageAt
    const existing = deduped.get(partner.id)

    const nextItem = {
      id: item.conversation.id,
      title: partner.displayName,
      subtitle: item.unreadCount > 0 ? `未读 ${item.unreadCount} 条` : latestMessage ? "最近互动" : "新会话",
      preview: latestMessage?.body ?? "还没有消息，发一条开始聊天吧",
      updatedAt: formatMonthDayTime(sortAt),
      unreadCount: item.unreadCount,
      participants,
      sortAt,
    }

    if (!existing || sortAt.getTime() > existing.sortAt.getTime()) {
      deduped.set(partner.id, nextItem)
    }
  }

  return [...deduped.values()]
    .sort((left, right) => right.sortAt.getTime() - left.sortAt.getTime())
    .map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      subtitle: conversation.subtitle,
      preview: conversation.preview,
      updatedAt: conversation.updatedAt,
      unreadCount: conversation.unreadCount,
      participants: conversation.participants,
    }))
}

export async function getUnreadMessageConversationCount(currentUserId: number) {
  return getUnreadConversationCount(currentUserId)
}


export async function markConversationAsRead(conversationId: string, currentUserId: number) {
  const canonicalConversationId = await resolveCanonicalConversationId(currentUserId, conversationId)
  if (!canonicalConversationId) {
    return
  }

  const latestMessage = await findLatestMessageByConversationId(canonicalConversationId)

  await updateConversationReadState(canonicalConversationId, currentUserId, latestMessage?.id)
}


async function getDatabaseConversationDetail(currentUserId: number, conversationId: string): Promise<MessageConversationDetail | null> {
  const canonicalConversationId = await resolveCanonicalConversationId(currentUserId, conversationId)
  if (!canonicalConversationId) {
    return null
  }

  const conversation = await findConversationDetailById(canonicalConversationId, currentUserId, INITIAL_MESSAGE_PAGE_SIZE)


  if (!conversation) {
    return null
  }

  const participants = conversation.participants.map((participant) => mapConversationParticipant(participant, currentUserId))
  const partner = participants.find((participant) => !participant.isCurrentUser)

  if (!partner) {
    await withDbTransaction(async (tx) => {
      await removeConversationForUser(tx, conversation.id, currentUserId)
    })

    return null
  }

  const orderedMessages = [...conversation.messages].reverse()
  const hasMoreHistory = orderedMessages.length > INITIAL_MESSAGE_PAGE_SIZE
  const visibleMessages = hasMoreHistory ? orderedMessages.slice(1) : orderedMessages

  await markConversationAsRead(conversation.id, currentUserId)

  return {
    id: conversation.id,
    title: partner.displayName,
    subtitle: visibleMessages.length > 0 ? "实时会话" : "还没有聊天记录，发一条消息开始聊天吧",
    updatedAt: formatMonthDayTime(visibleMessages.at(-1)?.createdAt ?? conversation.lastMessageAt),
    participants,
    recipientId: partner.id,
    hasMoreHistory,
    messages: visibleMessages.map((message) => mapMessageBubble(message, currentUserId)),
  }
}

export async function ensureConversationWithUser(currentUserId: number, targetUserId: number) {
  if (currentUserId === targetUserId) {
    throw new Error("不能给自己发送私信")
  }

  const recipient = await findMessageRecipientById(targetUserId)



  if (!recipient || recipient.status !== UserStatus.ACTIVE) {
    throw new Error("接收方不存在或不可接收私信")
  }

  const conversation = await getOrCreateConversation(currentUserId, targetUserId)
  return conversation.id
}

async function resolveConversationId(currentUserId: number, conversationId?: string) {
  if (!conversationId) {
    return undefined
  }

  if (conversationId.startsWith("user-")) {
    const targetUserId = Number(conversationId.replace("user-", ""))

    if (Number.isFinite(targetUserId)) {
      return ensureConversationWithUser(currentUserId, targetUserId)
    }
  }

  return resolveCanonicalConversationId(currentUserId, conversationId)
}

export async function sendDirectMessage(senderId: number, recipientId: number, body: string) {
  const content = body.trim()

  if (!content) {
    throw new Error("消息内容不能为空")
  }

  if (content.length > 1000) {
    throw new Error("消息内容不能超过 1000 个字符")
  }

  const conversation = await getOrCreateConversation(senderId, recipientId)

  const message = await createDirectMessageInTransaction(conversation.id, senderId, recipientId, content)


  return {
    id: message.id,
    conversationId: conversation.id,
    content: message.body,
    createdAt: formatMonthDayTime(message.createdAt),
    occurredAt: message.createdAt.toISOString(),
  }
}

export async function getConversationHistory(currentUserId: number, conversationId: string, beforeMessageId: string): Promise<MessageHistoryResult> {
  const canonicalConversationId = await resolveCanonicalConversationId(currentUserId, conversationId)
  if (!canonicalConversationId) {
    throw new Error("会话不存在或无权查看")
  }

  const participant = await findConversationParticipantByUser(canonicalConversationId, currentUserId)


  if (!participant) {
    throw new Error("会话不存在或无权查看")
  }

  const anchor = await findMessageHistoryAnchor(beforeMessageId, canonicalConversationId)


  if (!anchor) {
    throw new Error("历史消息定位失败")
  }

  const history = await findConversationHistoryBatch(canonicalConversationId, anchor.createdAt, MESSAGE_HISTORY_BATCH_SIZE)


  const hasMoreHistory = history.length > MESSAGE_HISTORY_BATCH_SIZE
  const visibleHistory = hasMoreHistory ? history.slice(0, MESSAGE_HISTORY_BATCH_SIZE) : history

  return {
    messages: visibleHistory.reverse().map((message) => mapMessageBubble(message, currentUserId)),
    hasMoreHistory,
  }
}

export async function deleteConversationForUser(conversationId: string, currentUserId: number) {
  const canonicalConversationId = await resolveCanonicalConversationId(currentUserId, conversationId)
  if (!canonicalConversationId) {
    throw new Error("会话不存在或无权删除")
  }

  await withDbTransaction(async (tx) => {
    await removeConversationForUser(tx, canonicalConversationId, currentUserId)
  })

}

export async function getMessageCenterData(currentUserId: number, conversationId?: string): Promise<MessageCenterData> {
  await normalizeDirectConversations(currentUserId)

  const resolvedConversationId = await resolveConversationId(currentUserId, conversationId)
  const conversations = await getDatabaseBackedConversations(currentUserId)
  const activeId = resolvedConversationId
  const activeConversation = activeId ? await getDatabaseConversationDetail(currentUserId, activeId) : null

  return {
    conversations,
    activeConversation: activeConversation ?? null,
    usingDemoData: false,
  }
}
