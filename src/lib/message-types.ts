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
  occurredAt?: string
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
  contentAdjusted?: boolean
}

export interface MessageHistoryResult {
  messages: MessageBubbleItem[]
  hasMoreHistory: boolean
}

export interface MessageCreatedStreamEvent {
  type: "message.created"
  conversationId: string
  messageId: string
  content: string
  createdAtLabel: string
  senderId: number
  senderUsername: string
  senderDisplayName: string
  senderAvatarPath: string | null
  recipientId: number
  recipientUnreadMessageCount?: number
  occurredAt: string
}

export interface ConversationReadStreamEvent {
  type: "conversation.read"
  conversationId: string
  userId: number
  unreadMessageCount: number
  occurredAt: string
}

export interface ConversationDeletedStreamEvent {
  type: "conversation.deleted"
  conversationId: string
  userId: number
  unreadMessageCount: number
  occurredAt: string
}

export interface NotificationCountStreamEvent {
  type: "notification.count"
  userId: number
  unreadNotificationCount: number
  reason: "created" | "created-batch" | "read" | "read-all"
  notificationId?: string
  occurredAt: string
}

export interface InboxSnapshotStreamEvent {
  type: "inbox.snapshot"
  unreadMessageCount: number
  unreadNotificationCount: number
  occurredAt: string
}

export interface HeartbeatStreamEvent {
  type: "heartbeat"
  occurredAt: string
}

export type InboxStreamEvent =
  | MessageCreatedStreamEvent
  | ConversationReadStreamEvent
  | ConversationDeletedStreamEvent
  | NotificationCountStreamEvent
  | InboxSnapshotStreamEvent
  | HeartbeatStreamEvent

export type MessageStreamEvent = InboxStreamEvent

export interface MessageCenterData {
  conversations: MessageConversationListItem[]
  activeConversation: MessageConversationDetail | null
  usingDemoData: boolean
  errorMessage?: string | null
}
