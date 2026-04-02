import type { Metadata } from "next"

import { SiteHeader } from "@/components/site-header"
import { FriendLinkPageContent } from "@/components/friend-link-page-content"
import { getFriendLinkPageData } from "@/lib/friend-links"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `${settings.siteName} - 友情链接`,
    description: settings.friendLinkAnnouncement,
  }
}

export default async function FriendLinkPage() {
  const data = await getFriendLinkPageData()

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-1 py-6">
        <FriendLinkPageContent links={data.links} announcement={data.announcement} applicationEnabled={data.applicationEnabled && data.enabled} />
      </main>
    </div>
  )
}
