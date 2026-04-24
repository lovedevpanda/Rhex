import type { InboxStreamEvent } from "@/lib/message-types"

export interface InboxUnreadCounts {
  unreadMessageCount: number
  unreadNotificationCount: number
}

export function applyInboxStreamEvent(
  previous: InboxUnreadCounts,
  event: InboxStreamEvent,
  activeUserId: number | null,
): InboxUnreadCounts {
  switch (event.type) {
    case "inbox.snapshot":
      return {
        unreadMessageCount: event.unreadMessageCount,
        unreadNotificationCount: event.unreadNotificationCount,
      }
    case "message.created":
      if (activeUserId && event.recipientId === activeUserId && typeof event.recipientUnreadMessageCount === "number") {
        return {
          ...previous,
          unreadMessageCount: event.recipientUnreadMessageCount,
        }
      }
      return previous
    case "conversation.read":
    case "conversation.deleted":
      if (activeUserId && event.userId === activeUserId) {
        return {
          ...previous,
          unreadMessageCount: event.unreadMessageCount,
        }
      }
      return previous
    case "notification.count":
      if (activeUserId && event.userId === activeUserId) {
        return {
          ...previous,
          unreadNotificationCount: event.unreadNotificationCount,
        }
      }
      return previous
    case "heartbeat":
      return previous
  }
}

export function shouldPlayInboxPrompt(
  event: InboxStreamEvent,
  activeUserId: number | null,
  previous: InboxUnreadCounts,
): boolean {
  if (!activeUserId) {
    return false
  }

  switch (event.type) {
    case "message.created":
      return event.recipientId === activeUserId && event.senderId !== activeUserId
    case "notification.count":
      return (
        event.userId === activeUserId
        && (event.reason === "created" || event.reason === "created-batch")
        && event.unreadNotificationCount > previous.unreadNotificationCount
      )
    default:
      return false
  }
}
