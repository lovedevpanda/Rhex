import type { Metadata } from "next"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"

import {
  AddonRenderBlock,
  AddonSlotRenderer,
  AddonSurfaceRenderer,
} from "@/addons-host"
import { ForumFeedView } from "@/components/forum/forum-feed-view"
import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { InfiniteForumFeed } from "@/components/forum/infinite-forum-feed"
import { AutoCheckInOnHomeEnterCurrentUser } from "@/components/home/auto-check-in-on-home-enter-current-user"
import { HomeFeedTabs } from "@/components/home/home-feed-tabs"
import {
  buildHomeSidebarCurrentUserSettings,
  HomeSidebarPanels,
} from "@/components/home/home-sidebar-panels"
import { PageNumberPagination } from "@/components/page-number-pagination"
import { RssUniverseFeedView } from "@/components/rss/rss-universe-feed-view"
import { RssUniversePageClient } from "@/components/rss/rss-universe-page-client"
import { SelfServeAdsSidebar } from "@/components/self-serve-ads-sidebar"
import { SiteHeader } from "@/components/site-header"
import { getHomeAnnouncements } from "@/lib/announcements"
import {
  buildAddonHookSearchParams,
  buildHookedFeedDisplayItems,
} from "@/lib/addon-feed-posts"
import {
  getAddonHomeFeedMetadata,
  listAddonHomeFeedTabs,
  renderAddonHomeFeedTab,
} from "@/lib/addon-home-feed-providers"
import { getCurrentUser } from "@/lib/auth"
import { getBoards } from "@/lib/boards"
import { getLocalDateKey } from "@/lib/date-key"
import { getFriendLinkListData } from "@/lib/friend-links"
import { getLatestFeed } from "@/lib/forum-feed"
import {
  buildAddonHomeFeedHref,
  buildHomeFeedHref,
  type HomeFeedSort,
  parseHomeFeedPage,
} from "@/lib/home-feed-route"
import {
  buildResolvedHomeFeedTabs,
  resolveDefaultAddonHomeFeedTab,
} from "@/lib/home-feed-tabs"
import { getHomeSidebarHotTopics } from "@/lib/home-sidebar"
import { groupHomeSidebarPanels } from "@/lib/home-sidebar-layout"
import { getHomeSidebarStats } from "@/lib/home-sidebar-stats"
import { POST_LIST_DISPLAY_MODE_GALLERY } from "@/lib/post-list-display"
import { POST_LIST_LOAD_MODE_INFINITE } from "@/lib/post-list-load-mode"
import {
  attachPostListTipSummaries,
  shouldAttachPostListTipSummaries,
} from "@/lib/post-list-tipping"
import { resolveContentVisibleAdminActor } from "@/lib/admin-scope-permissions"
import { getRssHomeDisplaySettings } from "@/lib/rss-harvest"
import { getRssUniverseFeedPage } from "@/lib/rss-public-feed"
import {
  getSelfServeAdsAppConfig,
  getSelfServeAdsPanelData,
} from "@/lib/self-serve-ads"
import { toSelfServeAdConfig } from "@/lib/self-serve-ads.shared"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones } from "@/lib/zones"

const HOME_FEED_LABELS: Record<HomeFeedSort, string> = {
  latest: "首页",
  new: "新贴",
  hot: "热门",
  featured: "精华",
  following: "我的关注",
  universe: "宇宙",
}

interface HomeFeedPageProps {
  sort?: HomeFeedSort
  addonTabSlug?: string
  page?: number | string | string[]
  searchParams?: Promise<{ page?: string | string[]; source?: string | string[] }>
  mainTopSlot?: ReactNode
  autoCheckInOnEnter?: boolean
  enableUniverseSourceFilter?: boolean
}

export async function generateHomeFeedMetadata(
  sort: HomeFeedSort,
): Promise<Metadata> {
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

export async function generateAddonHomeFeedMetadata(
  slug: string,
  pathname = `/feed/${slug}`,
): Promise<Metadata> {
  const [settings, addonTabs, metadata] = await Promise.all([
    getSiteSettings(),
    listAddonHomeFeedTabs(),
    getAddonHomeFeedMetadata({
      slug,
      pathname,
    }),
  ])
  const tab = addonTabs.find((item) => item.slug === slug) ?? null
  const pageTitle = metadata?.title?.trim() || tab?.label || "首页"
  const pageDescription =
    metadata?.description?.trim() || tab?.description || settings.siteDescription

  return {
    title: `${settings.siteName} - ${pageTitle}`,
    description: pageDescription,
    openGraph: {
      title: `${settings.siteName} - ${pageTitle}`,
      description: pageDescription,
      type: "website",
    },
  }
}

export async function HomeFeedPage({
  sort,
  addonTabSlug,
  page,
  searchParams,
  mainTopSlot,
  autoCheckInOnEnter = false,
  enableUniverseSourceFilter = false,
}: HomeFeedPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const rawPage = resolvedSearchParams?.page ?? page
  const rawUniverseSource = resolvedSearchParams?.source
  const currentPage = parseHomeFeedPage(rawPage)
  const currentUniverseSourceId = typeof rawUniverseSource === "string" ? rawUniverseSource.trim() : ""

  if (!sort && !addonTabSlug) {
    throw new Error("HomeFeedPage requires sort or addonTabSlug")
  }

  const settingsPromise = getSiteSettings()
  const rssHomeSettingsPromise = getRssHomeDisplaySettings()
  const addonTabsPromise = listAddonHomeFeedTabs()
  const hotTopicsPromise = settingsPromise.then((settings) =>
    getHomeSidebarHotTopics(settings.homeSidebarHotTopicsCount),
  )

  const [
    boards,
    zones,
    hotTopics,
    announcements,
    settings,
    rssHomeSettings,
    friendLinks,
    selfServeAdsConfig,
    selfServeAdsPanelData,
    addonTabs,
  ] = await Promise.all([
    getBoards(),
    getZones(),
    hotTopicsPromise,
    getHomeAnnouncements(3),
    settingsPromise,
    rssHomeSettingsPromise,
    getFriendLinkListData(10),
    getSelfServeAdsAppConfig(),
    getSelfServeAdsPanelData(),
    addonTabsPromise,
  ])

  const showUniverse = rssHomeSettings.homeDisplayEnabled
  const defaultAddonTab = resolveDefaultAddonHomeFeedTab(addonTabs)
  const currentAddonTab = addonTabSlug
    ? addonTabs.find((item) => item.slug === addonTabSlug) ?? null
    : null
  const currentSort = currentAddonTab ? null : (sort ?? "latest")
  const currentTabKey = currentAddonTab?.slug ?? currentSort ?? "latest"
  const homeFeedTabs = buildResolvedHomeFeedTabs({
    addonTabs,
    showUniverse,
    rootAddonSlug: defaultAddonTab?.slug ?? null,
  })

  if (rawPage !== undefined && currentPage === 1) {
    if (currentAddonTab) {
      redirect(
        buildAddonHomeFeedHref(
          currentAddonTab.slug,
          1,
          currentAddonTab.slug === defaultAddonTab?.slug,
        ),
      )
    }

    if (currentSort) {
      redirect(buildHomeFeedHref(currentSort))
    }
  }

  if (addonTabSlug && !currentAddonTab) {
    redirect(buildHomeFeedHref("latest"))
  }

  if (currentSort === "universe" && !showUniverse) {
    redirect(buildHomeFeedHref("latest"))
  }

  const needsServerCurrentUser =
    currentSort === "following"
    || (currentSort === "universe" && !enableUniverseSourceFilter)
    || Boolean(currentSort && shouldAttachPostListTipSummaries(settings.homeFeedPostListDisplayMode))
  const currentUser = needsServerCurrentUser ? await getCurrentUser() : null
  const addonHookSearchParams = buildAddonHookSearchParams(resolvedSearchParams)
  const adminActor = currentUser ? await resolveContentVisibleAdminActor(currentUser) : null
  const postListViewer = currentUser
    ? {
        userId: currentUser.id,
        adminActor,
      }
    : null
  const postFeedPage =
    currentSort && currentSort !== "universe"
      ? await getLatestFeed(
          currentPage,
          settings.homeFeedPostPageSize,
          currentSort,
          currentUser?.id,
          settings.homeHotRecentWindowHours,
          postListViewer,
        )
      : null
  const universeFeedPage =
    currentSort === "universe" && !enableUniverseSourceFilter
      ? await getRssUniverseFeedPage(currentPage, rssHomeSettings.homePageSize, null, currentUser?.id)
      : null
  const addonFeedResult = currentAddonTab
    ? await renderAddonHomeFeedTab({
        slug: currentAddonTab.slug,
        page: currentPage,
        pathname:
          currentAddonTab.slug === defaultAddonTab?.slug
            ? "/"
            : `/feed/${currentAddonTab.slug}`,
        searchParams: addonHookSearchParams,
      })
    : null

  const homeFeedDisplayItems =
    currentSort && currentSort !== "universe" && postFeedPage
      ? await (async () => {
          if (currentPage !== postFeedPage.page) {
            redirect(buildHomeFeedHref(currentSort, postFeedPage.page))
          }

          const feedPathname =
            currentSort === "new"
              ? "/new"
              : currentSort === "hot"
                ? "/hot"
                : currentSort === "following"
                  ? "/following"
                  : "/"

          const displayItems = await buildHookedFeedDisplayItems({
            items: postFeedPage.items,
            sort: currentSort,
            settings,
            listDisplayMode: settings.homeFeedPostListDisplayMode,
            pathname: feedPathname,
            searchParams: addonHookSearchParams,
          })

          return shouldAttachPostListTipSummaries(settings.homeFeedPostListDisplayMode)
            ? attachPostListTipSummaries(displayItems, currentUser?.id)
            : displayItems
        })()
      : null

  const selfServeAdsResolvedConfig = toSelfServeAdConfig(selfServeAdsConfig)
  const sidebarStats = settings.homeSidebarStatsCardEnabled
    ? await getHomeSidebarStats()
    : null
  const sidebarPanels = groupHomeSidebarPanels(
    selfServeAdsPanelData
      && selfServeAdsResolvedConfig.enabled
      && selfServeAdsResolvedConfig.visibleOnHome
      ? [
          {
            id: "self-serve-ads",
            slot: selfServeAdsResolvedConfig.sidebarSlot,
            order: selfServeAdsResolvedConfig.sidebarOrder,
            content: (
              <SelfServeAdsSidebar
                AppId="self-serve-ads"
                config={selfServeAdsConfig}
                panelData={selfServeAdsPanelData}
              />
            ),
          },
        ]
      : [],
  )
  const shouldShowRightSidebar = settings.homeFeedPostListDisplayMode !== POST_LIST_DISPLAY_MODE_GALLERY

  const sortBeforeSlot =
    currentSort === "new"
      ? "feed.new.before"
      : currentSort === "hot"
        ? "feed.hot.before"
        : currentSort === "following"
          ? "feed.following.before"
          : currentSort === "universe"
            ? "feed.universe.before"
            : "feed.latest.before"
  const sortAfterSlot =
    currentSort === "new"
      ? "feed.new.after"
      : currentSort === "hot"
        ? "feed.hot.after"
        : currentSort === "following"
          ? "feed.following.after"
          : currentSort === "universe"
            ? "feed.universe.after"
            : "feed.latest.after"
  const feedSlotProps = {
    addonTabSlug,
    currentPage,
    settings,
    sort: currentSort,
  }

  const feedPanel = (
    <div className="overflow-hidden rounded-md bg-background">
      <HomeFeedTabs currentKey={currentTabKey} tabs={homeFeedTabs} />

      {currentAddonTab ? (
        <div className="lg:pl-4">
          {addonFeedResult ? (
            <AddonRenderBlock
              addonId={addonFeedResult.addonId}
              blockKey={`${addonFeedResult.addonId}:${addonFeedResult.providerCode}:home-feed:${addonFeedResult.tab.slug}`}
              result={addonFeedResult.result}
            />
          ) : (
            <div className="rounded-md p-8 text-sm text-muted-foreground">
              当前插件入口暂时没有可展示的内容。
            </div>
          )}
        </div>
      ) : currentSort === "universe" ? (
        <>
          {enableUniverseSourceFilter ? (
            <RssUniversePageClient initialPage={currentPage} initialSourceId={currentUniverseSourceId || null} />
          ) : universeFeedPage ? (
            <>
              <RssUniverseFeedView items={universeFeedPage.items} support={universeFeedPage.support} />
              {universeFeedPage.items.length === 0 ? (
                <div className="mt-4 rounded-md border bg-background p-8 text-sm text-muted-foreground">
                  宇宙栏目还没有可展示的采集内容。
                </div>
              ) : null}
              {universeFeedPage.pagination.totalPages > 1 ? (
                <PageNumberPagination
                  page={universeFeedPage.pagination.page}
                  totalPages={universeFeedPage.pagination.totalPages}
                  hasPrevPage={universeFeedPage.pagination.hasPrevPage}
                  hasNextPage={universeFeedPage.pagination.hasNextPage}
                  buildHref={(targetPage) =>
                    buildHomeFeedHref("universe", targetPage)
                  }
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : postFeedPage && homeFeedDisplayItems && currentSort ? (
        (() => {
          const {
            items: feed,
            page,
            totalPages,
            hasPrevPage,
            hasNextPage,
          } = postFeedPage
          const useInfiniteFeed =
            settings.homeFeedPostListLoadMode === POST_LIST_LOAD_MODE_INFINITE
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
                  initialItems={homeFeedDisplayItems}
                  initialPage={page}
                  initialHasNextPage={hasNextPage}
                  currentSort={currentSort}
                  listDisplayMode={settings.homeFeedPostListDisplayMode}
                  postLinkDisplayMode={settings.postLinkDisplayMode}
                />
              ) : (
                <ForumFeedView
                  items={homeFeedDisplayItems}
                  listDisplayMode={settings.homeFeedPostListDisplayMode}
                  postLinkDisplayMode={settings.postLinkDisplayMode}
                />
              )}

              {feed.length === 0 ? (
                <div className="mt-4 rounded-md border bg-background p-8 text-sm text-muted-foreground">
                  {emptyStateText}
                </div>
              ) : null}

              {showPagination && !useInfiniteFeed ? (
                <PageNumberPagination
                  page={page}
                  totalPages={totalPages}
                  hasPrevPage={hasPrevPage}
                  hasNextPage={hasNextPage}
                  buildHref={(targetPage) =>
                    buildHomeFeedHref(currentSort, targetPage)
                  }
                />
              ) : null}
            </>
          )
        })()
      ) : null}
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <AutoCheckInOnHomeEnterCurrentUser
        enabled={autoCheckInOnEnter && settings.checkInEnabled}
        todayKey={getLocalDateKey()}
      />
      <SiteHeader />

      <div className="mx-auto max-w-[1200px] px-1">
        <AddonSlotRenderer slot="feed.page.before" props={feedSlotProps} />
        <AddonSurfaceRenderer surface="feed.page" props={feedSlotProps}>
          <ForumPageShell
            zones={zones}
            boards={boards}
            main={(
              <div className="pb-12 py-1">
                {currentSort ? <AddonSlotRenderer slot={sortBeforeSlot} props={feedSlotProps} /> : null}
                {currentSort ? (
                  <AddonSurfaceRenderer
                    surface={sortBeforeSlot.replace(".before", "")}
                    props={feedSlotProps}
                  >
                    <>
                      {mainTopSlot ? <div className="mb-4 mt-6">{mainTopSlot}</div> : null}
                      <AddonSlotRenderer slot="feed.main.before" props={feedSlotProps} />
                      <AddonSurfaceRenderer surface="feed.main" props={feedSlotProps}>
                        {feedPanel}
                      </AddonSurfaceRenderer>
                      <AddonSlotRenderer slot="feed.main.after" props={feedSlotProps} />
                    </>
                  </AddonSurfaceRenderer>
                ) : (
                  <>
                    {mainTopSlot ? <div className="mb-4 mt-6">{mainTopSlot}</div> : null}
                    <AddonSlotRenderer slot="feed.main.before" props={feedSlotProps} />
                    <AddonSurfaceRenderer surface="feed.main" props={feedSlotProps}>
                      {feedPanel}
                    </AddonSurfaceRenderer>
                    <AddonSlotRenderer slot="feed.main.after" props={feedSlotProps} />
                  </>
                )}
                {currentSort ? <AddonSlotRenderer slot={sortAfterSlot} props={feedSlotProps} /> : null}
              </div>
            )}
            rightSidebar={shouldShowRightSidebar ? (
              <div className="mt-6 hidden pb-12 lg:block">
                <AddonSlotRenderer slot="feed.sidebar.before" props={feedSlotProps} />
                <AddonSurfaceRenderer
                  surface="feed.sidebar"
                  props={{
                    announcements,
                    friendLinks,
                    hotTopics,
                    settings,
                    sidebarPanels,
                    sidebarStats,
                  }}
                >
                  <HomeSidebarPanels
                    user={null}
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
                    currentUserSettings={buildHomeSidebarCurrentUserSettings(settings)}
                    selfServeAdsSurface={false}
                  />
                </AddonSurfaceRenderer>
                <AddonSlotRenderer slot="feed.sidebar.after" props={feedSlotProps} />
              </div>
            ) : null}
          />
        </AddonSurfaceRenderer>
        <AddonSlotRenderer slot="feed.page.after" props={feedSlotProps} />
      </div>
    </div>
  )
}
