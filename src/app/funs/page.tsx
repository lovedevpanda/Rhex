import type { Metadata } from "next"

import { HomeSidebarPanels } from "@/components/home-sidebar-panels"
import { SidebarNavigation } from "@/components/sidebar-navigation"
import { SiteHeader } from "@/components/site-header"
import { LevelIcon } from "@/components/level-icon"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { getCurrentUser } from "@/lib/auth"
import { getBoards } from "@/lib/boards"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"

import { getSiteSettings } from "@/lib/site-settings"
import { getZones } from "@/lib/zones"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `全部节点 - ${settings.siteName}`,
    description: `浏览 ${settings.siteName} 中的全部兴趣节点。`,
  }
}

export default async function FunsPage() {
  const [boards, zones, currentUser, hotTopics, settings] = await Promise.all([
    getBoards(),
    getZones(),
    getCurrentUser(),
    getHomeSidebarHotTopics(5),
    getSiteSettings(),
  ])

  const sidebarUser = await resolveSidebarUser(currentUser, settings)


  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <SidebarNavigation zones={zones} boards={boards} />

          <main className="pb-12 lg:col-span-7 py-1">
            <Card>
              <CardHeader>
                <CardTitle>全部节点</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {boards.map((board) => (
                  <a key={board.id} href={`/boards/${board.slug}`} className="rounded-[24px] border border-border p-5 transition-colors hover:bg-accent">
                    <div className="flex items-center gap-3">
                      <LevelIcon icon={board.icon} className="h-6 w-6 text-2xl" svgClassName="[&>svg]:block" />
                      <div>

                        <h2 className="font-semibold">{board.name}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{board.description}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-xs text-muted-foreground">帖子 {board.count}</p>
                  </a>
                ))}
              </CardContent>
            </Card>
          </main>

          <aside className="mt-6 hidden pb-12 lg:col-span-3 lg:block">
            <HomeSidebarPanels user={sidebarUser} hotTopics={hotTopics} />
          </aside>
        </div>
      </div>
    </div>
  )
}

