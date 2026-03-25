export interface MessageParticipantProfile {
  id: number
  username: string
  displayName: string
  avatarPath?: string | null
  isCurrentUser?: boolean
}

export interface MessageConversationListItem {
  id: string
  title: string
  subtitle: string
  preview: string
  updatedAt: string
  unreadCount: number
  participants: MessageParticipantProfile[]
}

export interface MessageBubbleItem {
  id: string
  body: string
  createdAt: string
  senderId: number
  senderName: string
  senderAvatarPath?: string | null
  isMine: boolean
}

export interface MessageConversationDetail {
  id: string
  title: string
  subtitle: string
  updatedAt: string
  participants: MessageParticipantProfile[]
  messages: MessageBubbleItem[]
  recipientId?: number
  hasMoreHistory: boolean
}

export interface MessageSendResult {
  id: string
  conversationId: string
  content: string
  createdAt: string
  occurredAt: string
}

export interface MessageHistoryResult {
  messages: MessageBubbleItem[]
  hasMoreHistory: boolean
}

export interface MessageStreamEvent {
  type: "message.created" | "conversation.read" | "heartbeat"
  conversationId?: string
  messageId?: string
  senderId?: number
  recipientId?: number
  occurredAt: string
}

export interface MessageCenterData {
  conversations: MessageConversationListItem[]
  activeConversation: MessageConversationDetail | null
  usingDemoData: boolean
}
