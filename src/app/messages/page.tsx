import type { Metadata } from "next"

import { SiteHeader } from "@/components/site-header"
import { getCurrentUser } from "@/lib/auth"
import { getMessageCenterData } from "@/lib/messages"
import { readSearchParam } from "@/lib/search-params"
import { getSiteSettings } from "@/lib/site-settings"

import { MessagesClient } from "@/components/messages-client"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `私信 - ${settings.siteName}`,
  }
}

export default async function MessagesPage(props: PageProps<"/messages">) {
  const searchParams = await props.searchParams;
  const currentUser = await getCurrentUser()
  const conversationId = readSearchParam(searchParams?.conversation)
  const data = currentUser ? await getMessageCenterData(currentUser.id, conversationId) : null

  return (
    <div className="min-h-screen ">
      <SiteHeader />
      <MessagesClient currentUser={currentUser} initialData={data} conversationId={conversationId} />
    </div>
  )
}
