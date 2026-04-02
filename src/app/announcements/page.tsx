import type { Metadata } from "next"

import { AnnouncementPageContent } from "@/components/announcement-page-content"
import { SiteHeader } from "@/components/site-header"
import { getAnnouncementPageData } from "@/lib/announcements"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `${settings.siteName} - 站点文档`,
    description: "查看公告类型的站点文档、维护通知与运营消息。",
  }
}

export default async function AnnouncementsPage() {
  const [data] = await Promise.all([getAnnouncementPageData(), getSiteSettings()])

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-1 py-6">
        <AnnouncementPageContent items={data.items} />



      </main>
    </div>
  )
}
