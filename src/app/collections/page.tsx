import Link from "next/link"
import type { Metadata } from "next"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { HomeSidebarPanels } from "@/components/home/home-sidebar-panels"
import { PageNumberPagination } from "@/components/page-number-pagination"
import { SiteHeader } from "@/components/site-header"
import { getHomeAnnouncements } from "@/lib/announcements"
import { getCurrentUser } from "@/lib/auth"
import { getFavoriteCollectionDirectoryPage } from "@/lib/favorite-collections"
import { getFriendLinkListData } from "@/lib/friend-links"
import { getBoards } from "@/lib/boards"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { getHomeSidebarStats } from "@/lib/home-sidebar-stats"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones } from "@/lib/zones"

function parsePage(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value
  const page = Number(rawValue)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function buildCollectionDirectoryHref(page: number) {
  return page <= 1 ? "/collections" : `/collections?page=${page}`
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()
  return {
    title: `${settings.siteName} - 收藏合集`,
    description: "浏览社区公开的收藏合集。",
  }
}

export default async function FavoriteCollectionDirectoryPage(props: {
  searchParams?: Promise<{ page?: string | string[] }>
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined
  const currentPage = parsePage(searchParams?.page)
  const [currentUser, settings, boards, zones] = await Promise.all([
    getCurrentUser(),
    getSiteSettings(),
    getBoards(),
    getZones(),
  ])
  const data = await getFavoriteCollectionDirectoryPage({
    page: currentPage,
    currentUserId: currentUser?.id,
  })
  const [sidebarUser, hotTopics, announcements, friendLinks, sidebarStats] = await Promise.all([
    resolveSidebarUser(currentUser, settings),
    getHomeSidebarHotTopics(settings.homeSidebarHotTopicsCount),
    getHomeAnnouncements(3),
    getFriendLinkListData(),
    settings.homeSidebarStatsCardEnabled ? getHomeSidebarStats() : Promise.resolve(null),
  ])

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1">
        <AddonSlotRenderer slot="collections.page.before" />
        <AddonSurfaceRenderer surface="collections.page" props={{ data, settings }}>
        <ForumPageShell
          zones={zones}
          boards={boards}
          main={(
            <div className="mt-6 pb-12">
              <AddonSlotRenderer slot="collections.content.before" />
              <AddonSlotRenderer slot="collections.hero.before" />
              <AddonSurfaceRenderer surface="collections.hero" props={{ data, settings }}>
                <section className="rounded-[24px] border border-border bg-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h1 className="text-xl font-semibold">收藏合集</h1>
                      <p className="mt-1 text-sm text-muted-foreground">浏览公开合集，也可以把收藏帖子继续归档到允许投稿的合集里。</p>
                    </div>
                    <Link href="/settings?tab=post-management&postTab=collections" className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                      我的合集
                    </Link>
                  </div>
                </section>
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="collections.hero.after" />
              <AddonSurfaceRenderer surface="collections.content" props={{ data, settings }}>
                <section className="rounded-[24px] border border-border bg-card p-4 sm:p-5">
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {data.items.length === 0 ? <div className="rounded-[18px] border border-dashed border-border bg-secondary/10 px-4 py-7 text-sm text-muted-foreground">当前没有可展示的合集。</div> : null}
                    {data.items.map((item) => (
                      <Link key={item.id} href={`/collections/${item.id}`} className="block rounded-[18px] border border-border bg-secondary/10 px-4 py-3 transition-colors hover:bg-accent/30">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h2 className="line-clamp-1 text-sm font-medium">{item.title}</h2>
                            <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">{item.visibility === "PUBLIC" ? "公开" : "私有"}</span>
                          </div>
                          {item.description ? <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">{item.description}</p> : null}
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="truncate">创建者 {item.ownerName}</span>
                            <span>帖子 {item.postCount}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                            {item.allowOtherUsersToContribute ? <span>{item.requireContributionApproval ? "允许投稿 / 需审核" : "允许投稿 / 免审核"}</span> : <span>仅创建者维护</span>}
                            <span>·</span>
                            <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>

                  {data.pagination.totalPages > 1 ? (
                    <div className="mt-5">
                      <PageNumberPagination
                        page={data.pagination.page}
                        totalPages={data.pagination.totalPages}
                        hasPrevPage={data.pagination.hasPrevPage}
                        hasNextPage={data.pagination.hasNextPage}
                        buildHref={buildCollectionDirectoryHref}
                      />
                    </div>
                  ) : null}
                </section>
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="collections.content.after" />
            </div>
          )}
          rightSidebar={(
            <div className="mt-6 hidden pb-12 lg:block">
              <AddonSlotRenderer slot="collections.sidebar.before" />
              <AddonSurfaceRenderer surface="collections.sidebar" props={{ announcements, friendLinks, hotTopics, settings, sidebarStats }}>
                <HomeSidebarPanels
                  user={sidebarUser}
                  hotTopics={hotTopics}
                  postLinkDisplayMode={settings.postLinkDisplayMode}
                  announcements={announcements}
                  showAnnouncements={settings.homeSidebarAnnouncementsEnabled}
                  friendLinks={friendLinks.compact}
                  friendLinksEnabled={settings.friendLinksEnabled}
                  stats={sidebarStats}
                  siteName={settings.siteName}
                  siteDescription={settings.siteDescription}
                  siteLogoPath={settings.siteLogoPath}
                  siteIconPath={settings.siteIconPath}
                />
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="collections.sidebar.after" />
            </div>
          )}
        />
        </AddonSurfaceRenderer>
        <AddonSlotRenderer slot="collections.page.after" />
      </div>
    </div>
  )
}
