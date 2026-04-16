import type { Metadata } from "next"

import { AddonSlotRenderer } from "@/addons-host"
import { SiteHeader } from "@/components/site-header"
import { FriendLinkPageContent } from "@/components/friend-links/friend-link-page-content"
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
      <main className="mx-auto max-w-[1200px] px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
        <AddonSlotRenderer slot="friend-links.page.before" />
        <FriendLinkPageContent links={data.links} announcement={data.announcement} applicationEnabled={data.applicationEnabled && data.enabled} />
        <AddonSlotRenderer slot="friend-links.page.after" />
      </main>
    </div>
  )
}
