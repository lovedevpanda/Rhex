import { DbTransaction, withDbTransaction } from "@/db/helpers"
import {
  findConversationByIdForParticipant,
  findConversationDetailById,
  findDirectConversationByUsers,
  findConversationListItems,
  findLatestMessageByConversationId,
  getUnreadConversationCount,
  updateConversationReadState,
} from "@/db/message-read-queries"
import {
  createDirectMessageInTransaction,
  findConversationHistoryBatch,
  findConversationParticipantByUser,
  findMessageHistoryAnchor,
  findMessageRecipientById,
} from "@/db/message-write-queries"

import { Prisma, ConversationKind, UserStatus } from "@/db/types"



import { apiError } from "@/lib/api-route"
import { enforceSensitiveText } from "@/lib/content-safety"
import { formatMonthDayTime } from "@/lib/formatters"
import { messageEventBus } from "@/lib/message-event-bus"
import { getUserDisplayName } from "@/lib/user-display"
import { ensureUsersCanInteract } from "@/lib/user-blocks"
import type {


  MessageBubbleItem,
  MessageCenterData,
  MessageConversationDetail,
  MessageConversationListItem,
  MessageHistoryResult,
  MessageParticipantProfile,
} from "@/lib/message-types"



type MessageTransactionClient = DbTransaction





const INITIAL_MESSAGE_PAGE_SIZE = 20
const MESSAGE_HISTORY_BATCH_SIZE = 50

type MessageRecipientRecord = NonNullable<Awaited<ReturnType<typeof findMessageRecipientById>>>

type ResolvedConversationReference =
  | { kind: "database"; conversationId: string }
  | { kind: "draft"; recipient: MessageRecipientRecord }

function mapUserProfile(
  user: {
    id: number
    username: string
    nickname: string | null
    avatarPath: string | null
  },
  currentUserId: number,
): MessageParticipantProfile {
  return {
    id: user.id,
    username: user.username,
    displayName: user.id === currentUserId ? "我" : getUserDisplayName(user),
    avatarPath: user.avatarPath,
    isCurrentUser: user.id === currentUserId,
  }
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
  return mapUserProfile(participant.user, currentUserId)
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
    occurredAt: message.createdAt.toISOString(),
    senderId: message.senderId,
    senderName: message.senderId === currentUserId ? "我" : getUserDisplayName(message.sender),
    senderAvatarPath: message.sender.avatarPath,
    isMine: message.senderId === currentUserId,
  }
}

async function removeConversationForUser(tx: MessageTransactionClient, conversationId: string, currentUserId: number) {
  await tx.conversationParticipant.updateMany({
    where: {
      conversationId,
      userId: currentUserId,
      archivedAt: null,
    },
    data: {
      archivedAt: new Date(),
      unreadCount: 0,
    },
  })
}

async function restoreConversationForUser(tx: MessageTransactionClient, conversationId: string, currentUserId: number) {
  await tx.conversationParticipant.updateMany({
    where: {
      conversationId,
      userId: currentUserId,
      archivedAt: {
        not: null,
      },
    },
    data: {
      archivedAt: null,
    },
  })
}

function normalizeDirectPair(userAId: number, userBId: number) {
  return {
    userLowId: Math.min(userAId, userBId),
    userHighId: Math.max(userAId, userBId),
  }
}

function isUniqueConstraintError(error: unknown, target?: string) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false
  }

  if (!target) {
    return true
  }

  const errorTarget = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : String(error.meta?.target ?? "")
  return errorTarget.includes(target)
}

async function getOrCreateConversation(userAId: number, userBId: number) {
  const pair = normalizeDirectPair(userAId, userBId)
  const existing = await findDirectConversationByUsers(pair.userLowId, pair.userHighId)

  if (existing) {
    await withDbTransaction(async (tx) => {
      await restoreConversationForUser(tx, existing.conversationId, userAId)
    })

    return existing.conversation
  }

  try {
    return await withDbTransaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          kind: ConversationKind.DIRECT,
          participants: {
            create: [
              { userId: userAId, unreadCount: 0 },
              { userId: userBId, unreadCount: 0 },
            ],
          },
        },
        include: {
          participants: true,
        },
      })

      await tx.directConversation.create({
        data: {
          conversationId: conversation.id,
          userLowId: pair.userLowId,
          userHighId: pair.userHighId,
        },
      })

      return conversation
    })
  } catch (error) {
    if (!isUniqueConstraintError(error, "userLowId")) {
      throw error
    }

    const concurrentConversation = await findDirectConversationByUsers(pair.userLowId, pair.userHighId)
    if (!concurrentConversation) {
      throw error
    }

    await withDbTransaction(async (tx) => {
      await restoreConversationForUser(tx, concurrentConversation.conversationId, userAId)
    })

    return concurrentConversation.conversation
  }
}

async function resolveCanonicalConversationId(currentUserId: number, conversationId: string): Promise<string | undefined> {
  const conversation = await findConversationByIdForParticipant(conversationId, currentUserId)
  if (!conversation) {
    return undefined
  }

  const partnerIds = conversation.participants.map((participant) => participant.userId).filter((userId) => userId !== currentUserId)

  return partnerIds.length === 1 && conversation.participants.length === 2 ? conversation.id : undefined
}

async function getDatabaseBackedConversations(currentUserId: number): Promise<MessageConversationListItem[]> {
  const items = await findConversationListItems(currentUserId)

  return items
    .map((item) => {
      const participants = item.conversation.participants.map((participant) => mapConversationParticipant(participant, currentUserId))
      const partner = participants.find((participant) => !participant.isCurrentUser)

      if (!partner) {
        return null
      }

      const latestMessage = item.conversation.messages[0]
      const sortAt = latestMessage?.createdAt ?? item.conversation.lastMessageAt

      return {
        id: item.conversation.id,
        title: partner.displayName,
        subtitle: item.unreadCount > 0 ? `未读 ${item.unreadCount} 条` : latestMessage ? "最近互动" : "新会话",
        preview: latestMessage?.body ?? "还没有消息，发一条开始聊天吧",
        updatedAt: formatMonthDayTime(sortAt),
        unreadCount: item.unreadCount,
        participants,
        sortAt,
      }
    })
    .filter((conversation): conversation is MessageConversationListItem & { sortAt: Date } => Boolean(conversation))
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

async function getValidatedMessageRecipient(
  currentUserId: number,
  targetUserId: number,
  messages: {
    blockedMessage: string
    blockedByMessage: string
  },
): Promise<MessageRecipientRecord> {
  if (currentUserId === targetUserId) {
    apiError(400, "不能给自己发送私信")
  }

  await ensureUsersCanInteract({
    actorId: currentUserId,
    targetUserId,
    blockedMessage: messages.blockedMessage,
    blockedByMessage: messages.blockedByMessage,
  })


  const recipient = await findMessageRecipientById(targetUserId)



  if (!recipient || recipient.status !== UserStatus.ACTIVE) {
    throw new Error("接收方不存在或不可接收私信")
  }

  return recipient
}

function buildDraftConversationDetail(currentUserId: number, recipient: MessageRecipientRecord): MessageConversationDetail {
  const participant = mapUserProfile(recipient, currentUserId)

  return {
    id: `user-${recipient.id}`,
    title: participant.displayName,
    subtitle: "还没有聊天记录，发一条消息开始聊天吧",
    updatedAt: "待发送",
    participants: [participant],
    recipientId: recipient.id,
    hasMoreHistory: false,
    messages: [],
  }
}

async function resolveConversationReference(currentUserId: number, conversationId?: string): Promise<ResolvedConversationReference | undefined> {
  if (!conversationId) {
    return undefined
  }

  if (conversationId.startsWith("user-")) {
    const targetUserId = Number(conversationId.replace("user-", ""))

    if (Number.isFinite(targetUserId)) {
      const recipient = await getValidatedMessageRecipient(currentUserId, targetUserId, {
        blockedMessage: "你已拉黑该用户，无法发起私信",
        blockedByMessage: "对方已将你拉黑，无法发起私信",
      })
      const pair = normalizeDirectPair(currentUserId, targetUserId)
      const existingConversation = await findDirectConversationByUsers(pair.userLowId, pair.userHighId)

      if (existingConversation) {
        const latestMessage = await findLatestMessageByConversationId(existingConversation.conversationId)

        if (latestMessage) {
          await withDbTransaction(async (tx) => {
            await restoreConversationForUser(tx, existingConversation.conversationId, currentUserId)
          })

          return {
            kind: "database",
            conversationId: existingConversation.conversationId,
          }
        }
      }

      return {
        kind: "draft",
        recipient,
      }
    }
  }

  const canonicalConversationId = await resolveCanonicalConversationId(currentUserId, conversationId)
  if (!canonicalConversationId) {
    return undefined
  }

  return {
    kind: "database",
    conversationId: canonicalConversationId,
  }
}

export async function sendDirectMessage(senderId: number, recipientId: number, body: string) {
  const content = body.trim()

  if (!content) {
    throw new Error("消息内容不能为空")
  }

  if (content.length > 1000) {
    throw new Error("消息内容不能超过 1000 个字符")
  }

  const recipient = await getValidatedMessageRecipient(senderId, recipientId, {
    blockedMessage: "你已拉黑该用户，无法发送私信",
    blockedByMessage: "对方已将你拉黑，无法发送私信",
  })

  const contentSafety = await enforceSensitiveText({ scene: "message.body", text: content })
  const conversation = await getOrCreateConversation(senderId, recipient.id)

  const message = await createDirectMessageInTransaction(conversation.id, senderId, recipient.id, contentSafety.sanitizedText)
  const sender = await findMessageRecipientById(senderId)
  const occurredAt = message.createdAt.toISOString()
  const senderDisplayName = sender ? getUserDisplayName(sender) : "用户"
  const senderUsername = sender?.username ?? ""
  const senderAvatarPath = sender?.avatarPath ?? null

  await messageEventBus.publish({
    type: "message.created",
    conversationId: conversation.id,
    messageId: message.id,
    content: message.body,
    createdAtLabel: formatMonthDayTime(message.createdAt),
    senderId,
    senderUsername,
    senderDisplayName,
    senderAvatarPath,
    recipientId: recipient.id,
    occurredAt,
  })


  return {
    id: message.id,
    conversationId: conversation.id,
    content: message.body,
    createdAt: formatMonthDayTime(message.createdAt),
    occurredAt,
    contentAdjusted: contentSafety.wasReplaced,
  }
}

export async function getConversationHistory(currentUserId: number, conversationId: string, beforeMessageId: string): Promise<MessageHistoryResult> {
  const canonicalConversationId = await resolveCanonicalConversationId(currentUserId, conversationId)
  if (!canonicalConversationId) {
    apiError(404, "会话不存在或无权查看")
  }

  const participant = await findConversationParticipantByUser(canonicalConversationId, currentUserId)

  if (!participant) {
    apiError(404, "会话不存在或无权查看")
  }

  const anchor = await findMessageHistoryAnchor(beforeMessageId, canonicalConversationId)

  if (!anchor) {
    apiError(404, "历史消息定位失败")
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
    apiError(404, "会话不存在或无权删除")
  }


  await withDbTransaction(async (tx) => {
    await removeConversationForUser(tx, canonicalConversationId, currentUserId)
  })

}

export async function getMessageCenterData(currentUserId: number, conversationId?: string): Promise<MessageCenterData> {
  const resolvedConversation = await resolveConversationReference(currentUserId, conversationId)
  const conversations = await getDatabaseBackedConversations(currentUserId)
  const activeConversation = resolvedConversation?.kind === "database"
    ? await getDatabaseConversationDetail(currentUserId, resolvedConversation.conversationId)
    : resolvedConversation?.kind === "draft"
      ? buildDraftConversationDetail(currentUserId, resolvedConversation.recipient)
      : null

  return {
    conversations,
    activeConversation: activeConversation ?? null,
    usingDemoData: false,
  }
}
