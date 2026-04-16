import type { Metadata } from "next"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { ForumFeedList } from "@/components/forum/forum-feed-list"
import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { HomeSidebarPanels } from "@/components/home/home-sidebar-panels"
import { InfiniteForumFeed } from "@/components/forum/infinite-forum-feed"
import { PageNumberPagination } from "@/components/page-number-pagination"
import { RssUniversePageClient } from "@/components/rss/rss-universe-page-client"
import { RssUniverseFeedView } from "@/components/rss/rss-universe-feed-view"
import { SelfServeAdsSidebar } from "@/components/self-serve-ads-sidebar"
import { SiteHeader } from "@/components/site-header"
import { AutoCheckInOnHomeEnter } from "@/components/home/auto-check-in-on-home-enter"
import { getHomeAnnouncements } from "@/lib/announcements"
import { getCurrentUser } from "@/lib/auth"
import { hasHomeAutoCheckInBadgeEffect } from "@/lib/badge-functional-effects"
import { getBoards } from "@/lib/boards"
import { getLocalDateKey } from "@/lib/date-key"
import { getFriendLinkListData } from "@/lib/friend-links"
import { getLatestFeed } from "@/lib/forum-feed"
import { mapForumFeedItemsToDisplayItems } from "@/lib/forum-feed-display"
import { buildHomeFeedHref, type HomeFeedSort, parseHomeFeedPage } from "@/lib/home-feed-route"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { groupHomeSidebarPanels } from "@/lib/home-sidebar-layout"
import { getHomeSidebarStats } from "@/lib/home-sidebar-stats"
import { POST_LIST_LOAD_MODE_INFINITE } from "@/lib/post-list-load-mode"
import { getRssHomeDisplaySettings } from "@/lib/rss-harvest"
import { getRssUniverseFeedPage } from "@/lib/rss-public-feed"
import { getSelfServeAdsAppConfig, getSelfServeAdsPanelData } from "@/lib/self-serve-ads"
import { toSelfServeAdConfig } from "@/lib/self-serve-ads.shared"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones } from "@/lib/zones"

const HOME_FEED_LABELS: Record<HomeFeedSort, string> = {
  latest: "首页",
  new: "新贴",
  hot: "热门",
  following: "我的关注",
  universe: "宇宙",
}

interface HomeFeedPageProps {
  sort: HomeFeedSort
  searchParams?: Promise<{ page?: string | string[] }>
  mainTopSlot?: ReactNode
  autoCheckInOnEnter?: boolean
  enableUniverseSourceFilter?: boolean
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

export async function HomeFeedPage({
  sort,
  searchParams,
  mainTopSlot,
  autoCheckInOnEnter = false,
  enableUniverseSourceFilter = false,
}: HomeFeedPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const rawPage = resolvedSearchParams?.page
  const currentPage = parseHomeFeedPage(resolvedSearchParams?.page)

  if (rawPage !== undefined && currentPage === 1) {
    redirect(buildHomeFeedHref(sort))
  }

  const postSort = sort === "universe" ? null : sort
  const currentUserPromise = getCurrentUser()
  const settingsPromise = getSiteSettings()
  const rssHomeSettingsPromise = getRssHomeDisplaySettings()
  const hotTopicsPromise = settingsPromise.then((settings) => getHomeSidebarHotTopics(settings.homeSidebarHotTopicsCount))
  const postFeedPromise = postSort === null
    ? Promise.resolve(null)
    : Promise.all([currentUserPromise, settingsPromise]).then(([currentUser, settings]) => (
        getLatestFeed(currentPage, settings.homeFeedPostPageSize, postSort, currentUser?.id, settings.homeHotRecentWindowHours)
      ))
  const universeFeedPromise = sort !== "universe" || enableUniverseSourceFilter
    ? Promise.resolve(null)
    : rssHomeSettingsPromise.then((rssHomeSettings) => {
        if (!rssHomeSettings.homeDisplayEnabled) {
          redirect(buildHomeFeedHref("latest"))
        }
        return getRssUniverseFeedPage(currentPage, rssHomeSettings.homePageSize)
      })
  const [postFeedPage, universeFeedPage, boards, zones, currentUser, hotTopics, announcements, settings, rssHomeSettings, friendLinks, selfServeAdsConfig, selfServeAdsPanelData] = await Promise.all([
    postFeedPromise,
    universeFeedPromise,
    getBoards(),
    getZones(),
    currentUserPromise,
    hotTopicsPromise,
    getHomeAnnouncements(3),
    settingsPromise,
    rssHomeSettingsPromise,
    getFriendLinkListData(),
    getSelfServeAdsAppConfig(),
    getSelfServeAdsPanelData(),
  ])
  const selfServeAdsResolvedConfig = toSelfServeAdConfig(selfServeAdsConfig)
  const [sidebarUser, sidebarStats] = await Promise.all([
    resolveSidebarUser(currentUser, settings),
    settings.homeSidebarStatsCardEnabled ? getHomeSidebarStats() : Promise.resolve(null),
  ])
  const shouldAutoCheckIn = autoCheckInOnEnter
    && Boolean(currentUser?.id)
    && Boolean(settings.checkInEnabled)
    && !Boolean(sidebarUser?.checkedInToday)
    && await hasHomeAutoCheckInBadgeEffect(currentUser?.id)
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
  const showUniverse = rssHomeSettings.homeDisplayEnabled

  if (sort === "universe" && !showUniverse) {
    redirect(buildHomeFeedHref("latest"))
  }

  const sortBeforeSlot = sort === "new"
    ? "feed.new.before"
    : sort === "hot"
      ? "feed.hot.before"
      : sort === "following"
        ? "feed.following.before"
        : sort === "universe"
          ? "feed.universe.before"
          : "feed.latest.before"
  const sortAfterSlot = sort === "new"
    ? "feed.new.after"
    : sort === "hot"
      ? "feed.hot.after"
      : sort === "following"
        ? "feed.following.after"
        : sort === "universe"
          ? "feed.universe.after"
          : "feed.latest.after"

  return (
    <div className="min-h-screen bg-background">
      {currentUser?.id && shouldAutoCheckIn ? (
        <AutoCheckInOnHomeEnter enabled todayKey={getLocalDateKey()} userId={currentUser.id} />
      ) : null}
      <SiteHeader />

      <div className="mx-auto max-w-[1200px] px-1">
        <AddonSlotRenderer slot="feed.page.before" />
        <ForumPageShell
          zones={zones}
          boards={boards}
          main={(
            <div className="pb-12 py-1">
              <AddonSlotRenderer slot={sortBeforeSlot} />
              <AddonSurfaceRenderer surface={sortBeforeSlot.replace(".before", "")} props={{ currentPage, sort, settings }}>
                <>
                  {mainTopSlot ? <div className="mt-6 mb-4">{mainTopSlot}</div> : null}
                  <AddonSlotRenderer slot="feed.main.before" />
                  <AddonSurfaceRenderer surface="feed.main" props={{ currentPage, sort, settings }}>
                  <>
                  {sort === "universe" ? (
                    <>
                      {enableUniverseSourceFilter ? (
                        <RssUniversePageClient initialPage={currentPage} showUniverse={showUniverse} />
                      ) : universeFeedPage ? (
                        <>
                          <RssUniverseFeedView items={universeFeedPage.items} showUniverse={showUniverse} />
                          {universeFeedPage.items.length === 0 ? <div className="mt-4 rounded-md border bg-background p-8 text-sm text-muted-foreground">宇宙栏目还没有可展示的采集内容。</div> : null}
                          {universeFeedPage.pagination.totalPages > 1 ? (
                            <PageNumberPagination
                              page={universeFeedPage.pagination.page}
                              totalPages={universeFeedPage.pagination.totalPages}
                              hasPrevPage={universeFeedPage.pagination.hasPrevPage}
                              hasNextPage={universeFeedPage.pagination.hasNextPage}
                              buildHref={(targetPage) => buildHomeFeedHref(sort, targetPage)}
                            />
                          ) : null}
                        </>
                      ) : null}
                    </>
                  ) : null}
                  {sort !== "universe" && postFeedPage ? (() => {
                    const { items: feed, page, totalPages, hasPrevPage, hasNextPage } = postFeedPage

                    if (currentPage !== page) {
                      redirect(buildHomeFeedHref(sort, page))
                    }

                    const currentSort = postSort ?? "latest"
                    const feedDisplayItems = mapForumFeedItemsToDisplayItems(feed, currentSort, settings)
                    const useInfiniteFeed = settings.homeFeedPostListLoadMode === POST_LIST_LOAD_MODE_INFINITE
                    const isFollowingFeed = currentSort === "following"
                    const showPagination = isFollowingFeed ? page > 1 || feed.length > 0 : true
                    const emptyStateText = isFollowingFeed
                      ? currentUser
                        ? "你关注的节点和用户还没有可展示的帖子，或者你还没开始关注。"
                        : "登录后即可查看你关注的节点和用户最近发帖。"
                      : "当前排序下还没有可展示的帖子内容。"

                    return (
                      <>
                        {useInfiniteFeed ? (
                          <InfiniteForumFeed
                            initialItems={feedDisplayItems}
                            initialPage={page}
                            initialHasNextPage={hasNextPage}
                            currentSort={currentSort}
                            showUniverse={showUniverse}
                            listDisplayMode={settings.homeFeedPostListDisplayMode}
                            postLinkDisplayMode={settings.postLinkDisplayMode}
                          />
                        ) : (
                          <ForumFeedList items={feed} currentSort={currentSort} showUniverse={showUniverse} listDisplayMode={settings.homeFeedPostListDisplayMode} postLinkDisplayMode={settings.postLinkDisplayMode} />
                        )}

                        {feed.length === 0 ? <div className="mt-4 rounded-md border bg-background p-8 text-sm text-muted-foreground">{emptyStateText}</div> : null}

                        {showPagination && !useInfiniteFeed ? (
                          <PageNumberPagination
                            page={page}
                            totalPages={totalPages}
                            hasPrevPage={hasPrevPage}
                            hasNextPage={hasNextPage}
                            buildHref={(targetPage) => buildHomeFeedHref(sort, targetPage)}
                          />
                        ) : null}
                      </>
                    )
                  })() : null}
                  </>
                  </AddonSurfaceRenderer>
                  <AddonSlotRenderer slot="feed.main.after" />
                </>
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot={sortAfterSlot} />
            </div>
          )}
          rightSidebar={(
            <div className="mt-6 hidden pb-12 lg:block">
              <AddonSlotRenderer slot="feed.sidebar.before" />
              <AddonSurfaceRenderer surface="feed.sidebar" props={{ announcements, friendLinks, hotTopics, settings, sidebarPanels, sidebarStats }}>
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
                  siteLogoPath={settings.siteLogoPath}
                  siteIconPath={settings.siteIconPath}
                />
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="feed.sidebar.after" />
            </div>
          )}
        />
        <AddonSlotRenderer slot="feed.page.after" />
      </div>
    </div>
  )
}
