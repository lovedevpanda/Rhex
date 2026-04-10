import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ForumPageShell } from "@/components/forum-page-shell"
import { HelpDocumentPageContent } from "@/components/help-document-page-content"
import { HomeSidebarPanels } from "@/components/home-sidebar-panels"
import { SiteHeader } from "@/components/site-header"
import { getHomeAnnouncements } from "@/lib/announcements"
import { getCurrentUser } from "@/lib/auth"
import { getBoards } from "@/lib/boards"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { getHelpDocumentPageData } from "@/lib/site-documents"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones } from "@/lib/zones"

interface HelpPageProps {
  params: Promise<{ slug?: string[] }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: HelpPageProps): Promise<Metadata> {
  const { slug } = await params
  const [settings, helpData] = await Promise.all([
    getSiteSettings(),
    getHelpDocumentPageData(slug),
  ])

  return {
    title: helpData.activeItem ? `${helpData.activeItem.title} - 帮助文档 - ${settings.siteName}` : `帮助文档 - ${settings.siteName}`,
    description: helpData.activeItem?.content.slice(0, 120) || `查看 ${settings.siteName} 的帮助文档与使用说明。`,
    openGraph: {
      title: helpData.activeItem ? `${helpData.activeItem.title} - 帮助文档 - ${settings.siteName}` : `帮助文档 - ${settings.siteName}`,
      description: settings.siteDescription,
      type: "website",
    },
  }
}

export default async function HelpPage({ params }: HelpPageProps) {
  const { slug } = await params
  const currentUserPromise = getCurrentUser()
  const settingsPromise = getSiteSettings()
  const [helpData, settings, boards, zones, currentUser, hotTopics, announcements] = await Promise.all([
    getHelpDocumentPageData(slug),
    settingsPromise,
    getBoards(),
    getZones(),
    currentUserPromise,
    settingsPromise.then((settings) => getHomeSidebarHotTopics(settings.homeSidebarHotTopicsCount)),
    getHomeAnnouncements(3),
  ])

  if (slug?.length && !helpData.activeItem) {
    notFound()
  }

  const sidebarUser = await resolveSidebarUser(currentUser, settings)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1">
        <ForumPageShell
          zones={zones}
          boards={boards}
          main={(
            <main className="py-1 pb-12 mt-6">
              <div className="space-y-6">
                <HelpDocumentPageContent items={helpData.items} activeItem={helpData.activeItem} />
              </div>
            </main>
          )}
          rightSidebar={(
            <div className="mt-6 hidden pb-12 lg:block">
              <HomeSidebarPanels
                user={sidebarUser}
                hotTopics={hotTopics}
                announcements={announcements}
                showAnnouncements={settings.homeSidebarAnnouncementsEnabled}
                siteName={settings.siteName}
                siteDescription={settings.siteDescription}
                siteLogoPath={settings.siteLogoPath}
              />
            </div>
          )}
        />
      </div>
    </div>
  )
}
