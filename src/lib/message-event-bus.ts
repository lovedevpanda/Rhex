type MessageListener = (payload: string) => void

interface StreamClient {
  id: string
  userId: number
  push: MessageListener
}

const globalForMessageEvents = globalThis as typeof globalThis & {
  messageStreamClients?: Map<string, StreamClient>
}

const clients = globalForMessageEvents.messageStreamClients ?? new Map<string, StreamClient>()

globalForMessageEvents.messageStreamClients = clients

function getClientId(userId: number) {
  return `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function subscribeMessageEvents(userId: number, push: MessageListener) {
  const id = getClientId(userId)
  clients.set(id, { id, userId, push })

  return () => {
    clients.delete(id)
  }
}

export function publishMessageEvent(userIds: number[], event: Record<string, unknown>) {
  const payload = `data: ${JSON.stringify(event)}\n\n`
  const targetIds = new Set(userIds)

  clients.forEach((client) => {
    if (targetIds.has(client.userId)) {
      client.push(payload)
    }
  })
}
