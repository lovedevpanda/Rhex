import type { ReactNode } from "react"

import { ForumPageShell } from "@/components/forum-page-shell"
import { HomeSidebarPanels } from "@/components/home-sidebar-panels"
import { SiteHeader } from "@/components/site-header"
import { getCurrentUser } from "@/lib/auth"
import { getBoards } from "@/lib/boards"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones } from "@/lib/zones"

export const dynamic = "force-dynamic"

export default async function FaqLayout({ children }: { children: ReactNode }) {
  const [boards, zones, currentUser, hotTopics, settings] = await Promise.all([
    getBoards(),
    getZones(),
    getCurrentUser(),
    getHomeSidebarHotTopics(5),
    getSiteSettings(),
  ])
  const sidebarUser = await resolveSidebarUser(currentUser, settings)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1">
        <ForumPageShell
          zones={zones}
          boards={boards}
          main={<main className="py-1 pb-12">{children}</main>}
          rightSidebar={(
            <aside className="mt-6 hidden pb-12 lg:block">
              <HomeSidebarPanels user={sidebarUser} hotTopics={hotTopics} createPostHref="/write" siteName={settings.siteName} siteDescription={settings.siteDescription} />
            </aside>
          )}
        />
      </div>
    </div>
  )
}
