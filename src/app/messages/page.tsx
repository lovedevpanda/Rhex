import { SiteHeader } from "@/components/site-header"
import { getCurrentUser } from "@/lib/auth"
import { getMessageCenterData } from "@/lib/messages"

import { MessagesClient } from "@/components/messages-client"

interface MessagesPageProps {
  searchParams?: {
    conversation?: string
  }
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const currentUser = await getCurrentUser()
  const conversationId = searchParams?.conversation
  const data = currentUser ? await getMessageCenterData(currentUser.id, conversationId) : null

  return (
    <div className="min-h-screen ">
      <SiteHeader />
      <MessagesClient currentUser={currentUser} initialData={data} conversationId={conversationId} />
    </div>
  )
}
