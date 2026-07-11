import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { buildHomeSidebarCurrentUserSettings, HomeSidebarPanels } from "@/components/home/home-sidebar-panels"
import { SiteHeader } from "@/components/site-header"
import { getHomeAnnouncements } from "@/lib/announcements"
import { getCurrentUser } from "@/lib/auth"
import { getBoards } from "@/lib/boards"
import type { CustomPageItem } from "@/lib/custom-pages"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones } from "@/lib/zones"

export async function CustomPageRenderer({
  page,
  routePath,
}: {
  page: CustomPageItem
  routePath: string
}) {
  const settingsPromise = getSiteSettings()
  const boardsPromise = page.includeLeftSidebar ? getBoards() : Promise.resolve([])
  const zonesPromise = page.includeLeftSidebar ? getZones() : Promise.resolve([])
  const currentUserPromise = page.includeRightSidebar ? getCurrentUser() : Promise.resolve(null)
  const hotTopicsPromise = page.includeRightSidebar
    ? settingsPromise.then((settings) => getHomeSidebarHotTopics(settings.homeSidebarHotTopicsCount))
    : Promise.resolve([])
  const announcementsPromise = page.includeRightSidebar ? getHomeAnnouncements(3) : Promise.resolve([])

  const [settings, boards, zones, currentUser, hotTopics, announcements] = await Promise.all([
    settingsPromise,
    boardsPromise,
    zonesPromise,
    currentUserPromise,
    hotTopicsPromise,
    announcementsPromise,
  ])

  const sidebarUser = page.includeRightSidebar
    ? await resolveSidebarUser(currentUser, settings)
    : null
  const customPageSlotProps = {
    pageId: page.id,
    title: page.title,
    routePath,
    includeHeader: page.includeHeader,
    includeLeftSidebar: page.includeLeftSidebar,
    includeRightSidebar: page.includeRightSidebar,
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {page.includeHeader ? <SiteHeader /> : null}
      <div className="mx-auto max-w-[1200px] px-1">
        <AddonSlotRenderer slot="custom-page.page.before" props={customPageSlotProps} />
        <AddonSurfaceRenderer surface="custom-page.page" props={customPageSlotProps}>
          <ForumPageShell
            zones={zones}
            boards={boards}
            rightSidebar={page.includeRightSidebar ? (
              <div className="mt-6 hidden pb-12 lg:block">
                <AddonSlotRenderer slot="custom-page.sidebar.before" props={customPageSlotProps} />
                <AddonSurfaceRenderer surface="custom-page.sidebar" props={customPageSlotProps}>
                  <HomeSidebarPanels
                    user={sidebarUser}
                    currentUserSettings={currentUser ? buildHomeSidebarCurrentUserSettings(settings) : undefined}
                    hotTopics={hotTopics}
                    announcements={announcements}
                    showAnnouncements={settings.homeSidebarAnnouncementsEnabled}
                    siteName={settings.siteName}
                    siteDescription={settings.siteDescription}
                    siteLogoPath={settings.siteLogoPath}
                    siteIconPath={settings.siteIconPath}
                    stickyTopClass={page.includeHeader ? "top-20" : "top-4"}
                  />
                </AddonSurfaceRenderer>
                <AddonSlotRenderer slot="custom-page.sidebar.after" props={customPageSlotProps} />
              </div>
            ) : null}
            leftSidebarDisplayModeOverride={page.includeLeftSidebar ? undefined : "HIDDEN"}
            sidebarStickyTopClass={page.includeHeader ? "top-14" : "top-4"}
            main={(
              <main className={page.includeHeader ? "py-1 pb-12 mt-6" : "py-3 pb-12"}>
                <AddonSlotRenderer slot="custom-page.content.before" props={customPageSlotProps} />
                <AddonSurfaceRenderer surface="custom-page.content" props={{ ...customPageSlotProps, htmlContent: page.htmlContent }}>
                  {/* Custom-page HTML is a trusted administrator capability. It is deliberately not sanitized; never bind ordinary user content here. */}
                  <div
                    className="custom-page-html min-w-0 [&_iframe]:max-w-full [&_img]:max-w-full [&_table]:max-w-full"
                    dangerouslySetInnerHTML={{ __html: page.htmlContent }}
                  />
                </AddonSurfaceRenderer>
                <AddonSlotRenderer slot="custom-page.content.after" props={customPageSlotProps} />
              </main>
            )}
          />
        </AddonSurfaceRenderer>
        <AddonSlotRenderer slot="custom-page.page.after" props={customPageSlotProps} />
      </div>
    </div>
  )
}
