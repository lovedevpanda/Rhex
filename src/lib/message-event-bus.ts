export interface MessageStreamCursor {
  id: string
  createdAt: string
}

export interface MessageStreamEvent {
  type: "message.created"
  conversationId: string
  messageId: string
  senderId: number
  recipientId: number
  occurredAt: string
}

export function buildMessageEventPayload(event: MessageStreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`
}

export function buildHeartbeatPayload() {
  return `data: ${JSON.stringify({ type: "heartbeat", occurredAt: new Date().toISOString() })}\n\n`
}

export function parseMessageStreamCursor(value: string | null): MessageStreamCursor | null {
  if (!value) {
    return null
  }

  const [createdAt, id] = value.split("|")
  if (!createdAt || !id) {
    return null
  }

  const timestamp = new Date(createdAt)
  if (Number.isNaN(timestamp.getTime())) {
    return null
  }

  return {
    id,
    createdAt: timestamp.toISOString(),
  }
}

export function formatMessageStreamCursor(cursor: MessageStreamCursor) {
  return `${cursor.createdAt}|${cursor.id}`
}
