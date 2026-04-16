import type { Metadata } from "next"

import { AddonSlotRenderer, AddonSurfaceRenderBoundary } from "@/addons-host"
import { SettingsPageContent } from "@/app/settings/settings-page-content"
import { loadSettingsPageData, resolveSettingsRoute, settingsTabTitles } from "@/app/settings/settings-page-loader"
import { SettingsShell } from "@/components/settings/settings-shell"
import { SiteHeader } from "@/components/site-header"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata(props: PageProps<"/settings">): Promise<Metadata> {
  const [searchParams, settings] = await Promise.all([props.searchParams, getSiteSettings()])
  const route = resolveSettingsRoute(searchParams)
  const currentTab = !settings.boardApplicationEnabled && route.currentTab === "board-applications"
    ? "profile"
    : route.currentTab

  return {
    title: `${settingsTabTitles[currentTab]} - ${settings.siteName}`,
  }
}

export default async function SettingsPage(props: PageProps<"/settings">) {
  const searchParams = await props.searchParams
  const data = await loadSettingsPageData(searchParams)

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1240px] px-4 sm:py-8 lg:px-6">
        <AddonSlotRenderer slot="settings.page.before" />
        <AddonSurfaceRenderBoundary surface="settings.page" props={{ data }}>
          <SettingsShell
            profile={data.profile}
            pointName={data.settings.pointName}
            boardApplicationEnabled={data.settings.boardApplicationEnabled}
            sidebarTop={<AddonSlotRenderer slot="settings.sidebar.top" />}
            sidebarBottom={<AddonSlotRenderer slot="settings.sidebar.bottom" />}
            contentBefore={<AddonSlotRenderer slot="settings.content.before" />}
            contentAfter={<AddonSlotRenderer slot="settings.content.after" />}
          >
            <SettingsPageContent data={data} />
          </SettingsShell>
        </AddonSurfaceRenderBoundary>
        <AddonSlotRenderer slot="settings.page.after" />
      </main>
    </div>
  )
}
