import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"

import { ForumFeedList } from "@/components/forum-feed-list"
import { ForumPageShell } from "@/components/forum-page-shell"
import { HomeSidebarPanels } from "@/components/home-sidebar-panels"
import { SelfServeAdsSidebar } from "@/components/self-serve-ads-sidebar"
import { SiteHeader } from "@/components/site-header"
import { getHomeAnnouncements } from "@/lib/announcements"
import { getCurrentUser } from "@/lib/auth"
import { getBoards } from "@/lib/boards"
import { getFriendLinkListData } from "@/lib/friend-links"
import { getLatestFeed } from "@/lib/forum-feed"
import { buildHomeFeedHref, type HomeFeedSort, parseHomeFeedPage } from "@/lib/home-feed-route"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { groupHomeSidebarPanels } from "@/lib/home-sidebar-layout"
import { getHomeSidebarStats } from "@/lib/home-sidebar-stats"
import { getSelfServeAdsAppConfig, getSelfServeAdsPanelData } from "@/lib/self-serve-ads"
import { toSelfServeAdConfig } from "@/lib/self-serve-ads.shared"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones } from "@/lib/zones"

const HOME_FEED_LABELS: Record<HomeFeedSort, string> = {
  latest: "首页",
  new: "新贴",
  hot: "热门",
  following: "我的关注",
}

interface HomeFeedPageProps {
  sort: HomeFeedSort
  searchParams?: Promise<{ page?: string | string[] }>
  mainTopSlot?: ReactNode
}

export async function generateHomeFeedMetadata(sort: HomeFeedSort): Promise<Metadata> {
  const settings = await getSiteSettings()
  const pageTitle = HOME_FEED_LABELS[sort]

  return {
    title: `${settings.siteName} - ${pageTitle}`,
    description: settings.siteDescription,
    openGraph: {
      title: `${settings.siteName} - ${pageTitle}`,
      description: settings.siteDescription,
      type: "website",
    },
  }
}

export async function HomeFeedPage({ sort, searchParams, mainTopSlot }: HomeFeedPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const rawPage = resolvedSearchParams?.page
  const currentPage = parseHomeFeedPage(resolvedSearchParams?.page)

  if (rawPage !== undefined && currentPage === 1) {
    redirect(buildHomeFeedHref(sort))
  }

  const currentUserPromise = getCurrentUser()
  const feedPromise = currentUserPromise.then((currentUser) => getLatestFeed(currentPage, 35, sort, currentUser?.id))
  const [feed, boards, zones, currentUser, hotTopics, announcements, settings, friendLinks, selfServeAdsConfig, selfServeAdsPanelData] = await Promise.all([
    feedPromise,
    getBoards(),
    getZones(),
    currentUserPromise,
    getHomeSidebarHotTopics(5),
    getHomeAnnouncements(3),
    getSiteSettings(),
    getFriendLinkListData(),
    getSelfServeAdsAppConfig(),
    getSelfServeAdsPanelData(),
  ])

  const nextPage = currentPage + 1
  const prevPage = Math.max(1, currentPage - 1)
  const isFollowingFeed = sort === "following"
  const showPagination = isFollowingFeed ? currentPage > 1 || feed.length > 0 : true
  const hasNextPage = isFollowingFeed ? feed.length >= 35 : true
  const emptyStateText = isFollowingFeed
    ? currentUser
      ? "你关注的节点和用户还没有可展示的帖子，或者你还没开始关注。"
      : "登录后即可查看你关注的节点和用户最近发帖。"
    : "当前排序下还没有可展示的帖子内容。"
  const selfServeAdsResolvedConfig = toSelfServeAdConfig(selfServeAdsConfig)
  const [sidebarUser, sidebarStats] = await Promise.all([
    resolveSidebarUser(currentUser, settings),
    settings.homeSidebarStatsCardEnabled ? getHomeSidebarStats() : Promise.resolve(null),
  ])
  const sidebarPanels = groupHomeSidebarPanels(
    selfServeAdsPanelData && selfServeAdsResolvedConfig.enabled && selfServeAdsResolvedConfig.visibleOnHome
      ? [{
          id: "self-serve-ads",
          slot: selfServeAdsResolvedConfig.sidebarSlot,
          order: selfServeAdsResolvedConfig.sidebarOrder,
          content: <SelfServeAdsSidebar AppId="self-serve-ads" config={selfServeAdsConfig} panelData={selfServeAdsPanelData} />,
        }]
      : [],
  )

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <div className="mx-auto max-w-[1200px] px-1">
        <ForumPageShell
          zones={zones}
          boards={boards}
          main={(
            <div className="pb-12 py-1">
              {mainTopSlot ? <div className="mt-6 mb-4">{mainTopSlot}</div> : null}
              <ForumFeedList items={feed} currentSort={sort} listDisplayMode={settings.homeFeedPostListDisplayMode} postLinkDisplayMode={settings.postLinkDisplayMode} />

              {feed.length === 0 ? <div className="mt-4 rounded-md border bg-background p-8 text-sm text-muted-foreground">{emptyStateText}</div> : null}

              {showPagination ? <nav className="mx-auto flex w-full justify-center py-4" aria-label="pagination">
                <ul className="flex flex-row items-center gap-1">
                  <li>
                    <Link href={buildHomeFeedHref(sort, prevPage)} aria-disabled={currentPage <= 1} className={currentPage <= 1 ? "pointer-events-none inline-flex h-9 items-center justify-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium opacity-50 sm:pl-2.5" : "inline-flex h-9 items-center justify-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium hover:bg-accent sm:pl-2.5"}>
                      <span className="hidden sm:block">上一页</span>
                    </Link>
                  </li>
                  <li>
                    <span className="inline-flex size-9 items-center justify-center rounded-md border bg-background text-sm font-medium">{currentPage}</span>
                  </li>
                  <li>
                    <Link href={buildHomeFeedHref(sort, nextPage)} aria-disabled={!hasNextPage} className={!hasNextPage ? "pointer-events-none inline-flex h-9 items-center justify-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium opacity-50 sm:pr-2.5" : "inline-flex h-9 items-center justify-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium hover:bg-accent sm:pr-2.5"}>
                      <span className="hidden sm:block">下一页</span>
                    </Link>
                  </li>
                </ul>
              </nav> : null}
            </div>
          )}
          rightSidebar={(
            <div className="mt-6 hidden pb-12 lg:block">
              <HomeSidebarPanels
                user={sidebarUser}
                hotTopics={hotTopics}
                postLinkDisplayMode={settings.postLinkDisplayMode}
                announcements={announcements}
                showAnnouncements={settings.homeSidebarAnnouncementsEnabled}
                friendLinks={friendLinks.compact}
                friendLinksEnabled={settings.friendLinksEnabled}
                topPanels={sidebarPanels.top}
                middlePanels={sidebarPanels.middle}
                bottomPanels={sidebarPanels.bottom}
                stats={sidebarStats}
                siteName={settings.siteName}
                siteDescription={settings.siteDescription}
              />
            </div>
          )}
        />
      </div>
    </div>
  )
}
