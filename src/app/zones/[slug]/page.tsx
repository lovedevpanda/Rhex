import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { AccessDeniedCard } from "@/components/access-denied-card"
import { CollapsibleInfoCard } from "@/components/collapsible-info-card"
import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { InfiniteForumPostStream } from "@/components/forum/infinite-forum-post-stream"
import { PageNumberPagination } from "@/components/page-number-pagination"

import { HomeSidebarPanels } from "@/components/home/home-sidebar-panels"
import { SiteHeader } from "@/components/site-header"

import { getHomeAnnouncements } from "@/lib/announcements"
import { getCurrentUser } from "@/lib/auth"
import { checkBoardPermission } from "@/lib/board-access"
import { getBoards } from "@/lib/boards"
import { buildAddonHookSearchParams, buildHookedPostStreamDisplayItems } from "@/lib/addon-feed-posts"
import { DEFAULT_TAXONOMY_POST_SORT, normalizeTaxonomyPostSort, type TaxonomyPostSort } from "@/lib/forum-taxonomy-sort"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"

import { POST_LIST_DISPLAY_MODE_GALLERY } from "@/lib/post-list-display"
import { DEFAULT_ALLOWED_POST_TYPES } from "@/lib/post-types"
import { POST_LIST_LOAD_MODE_INFINITE } from "@/lib/post-list-load-mode"
import { readSearchParam } from "@/lib/search-params"
import { buildMetadataKeywords } from "@/lib/seo"
import { getSiteSettings } from "@/lib/site-settings"
import { getZoneBoards, getZoneBySlug, getZonePosts, getZones } from "@/lib/zones"
import { RssSubscribeButton } from "@/components/rss/rss-subscribe-button"
import { ForumPostStreamView } from "@/components/forum/forum-post-stream-view"
import { resolveContentVisibleAdminActor } from "@/lib/admin-scope-permissions"

export const dynamic = "force-dynamic"


function buildZonePageHref(slug: string, page = 1, sort: TaxonomyPostSort = DEFAULT_TAXONOMY_POST_SORT) {
  const normalizedPage = Math.max(1, Math.trunc(page))
  const query = new URLSearchParams()

  if (sort !== DEFAULT_TAXONOMY_POST_SORT) {
    query.set("sort", sort)
  }

  if (normalizedPage > 1) {
    query.set("page", String(normalizedPage))
  }

  const queryString = query.toString()
  return queryString ? `/zones/${slug}?${queryString}` : `/zones/${slug}`
}

function buildZonePostsApiPath(slug: string, sort: TaxonomyPostSort) {
  const query = new URLSearchParams()

  if (sort !== DEFAULT_TAXONOMY_POST_SORT) {
    query.set("sort", sort)
  }

  const queryString = query.toString()
  return queryString ? `/api/zones/${encodeURIComponent(slug)}/posts?${queryString}` : `/api/zones/${encodeURIComponent(slug)}/posts`
}

export async function generateMetadata(props: PageProps<"/zones/[slug]">): Promise<Metadata> {
  const params = await props.params;
  const [zone, settings] = await Promise.all([getZoneBySlug(params.slug), getSiteSettings()])

  if (!zone) {
    return { title: `分区不存在 - ${settings.siteName}` }
  }

  return {
    title: `${zone.name} - ${settings.siteName}`,
    description: zone.description,
    keywords: buildMetadataKeywords(settings.siteSeoKeywords, [zone.name, zone.slug, zone.description, "分区", "论坛分区"]),
    alternates: {
      canonical: `/zones/${zone.slug}`,
    },
  }
}


export default async function ZonePage(props: PageProps<"/zones/[slug]">) {
  const searchParams = await props.searchParams
  const params = await props.params
  const settingsPromise = getSiteSettings()
  const [zone, currentUser, settings] = await Promise.all([getZoneBySlug(params.slug), getCurrentUser(), settingsPromise])

  if (!zone) {
    notFound()
  }

  const permission = checkBoardPermission(currentUser, {
    postPointDelta: 0,
    replyPointDelta: 0,
    postIntervalSeconds: 120,
    replyIntervalSeconds: 3,
    allowedPostTypes: DEFAULT_ALLOWED_POST_TYPES,
    allowUserPost: zone.allowUserPost ?? true,
    allowUserReply: zone.allowUserReply ?? true,
    allowPostAuthorOfflineComment: zone.allowPostAuthorOfflineComment ?? false,
    allowUserOfflineOwnComment: zone.allowUserOfflineOwnComment ?? false,
    minViewPoints: zone.minViewPoints ?? 0,
    minViewLevel: zone.minViewLevel ?? 0,
    minPostPoints: 0,
    minPostLevel: 0,
    minReplyPoints: 0,
    minReplyLevel: 0,
    minViewVipLevel: zone.minViewVipLevel ?? 0,

    minPostVipLevel: 0,
    minReplyVipLevel: 0,
    postRequiredVerificationTypeIds: [],
    postRequiredBadgeIds: [],
    replyRequiredVerificationTypeIds: [],
    replyRequiredBadgeIds: [],
    requirePostReview: zone.requirePostReview ?? false,
    requireCommentReview: zone.requireCommentReview ?? false,
    showInHomeFeed: true,
  }, "view", settings.pointName)

  const rawPage = readSearchParam(searchParams?.page)
  const rawSort = readSearchParam(searchParams?.sort)
  const currentPage = Math.max(1, Number(rawPage ?? "1") || 1)
  const currentSort = normalizeTaxonomyPostSort(rawSort)
  const postListViewer = {
    userId: currentUser?.id ?? null,
    adminActor: await resolveContentVisibleAdminActor(currentUser),
  }
  const [zoneBoards, postsPage, allBoards, allZones, hotTopics, announcements] = await Promise.all([
    getZoneBoards(params.slug),
    permission.allowed
      ? getZonePosts(params.slug, currentPage, settings.zonePostPageSize, currentSort, postListViewer)
      : Promise.resolve({ items: [], page: 1, pageSize: settings.zonePostPageSize, total: 0, totalPages: 1, hasPrevPage: false, hasNextPage: false }),
    getBoards(),
    getZones(),
    settingsPromise.then((settings) => getHomeSidebarHotTopics(settings.homeSidebarHotTopicsCount)),
    getHomeAnnouncements(3),
  ])
  const { items: posts, page, totalPages, hasPrevPage, hasNextPage } = postsPage
  const canonicalPage = currentPage !== page ? page : currentPage

  if (
    currentPage !== page
    || (rawPage !== undefined && currentPage === 1)
    || (rawSort !== undefined && currentSort === DEFAULT_TAXONOMY_POST_SORT)
  ) {
    redirect(buildZonePageHref(params.slug, canonicalPage, currentSort))
  }
  const sidebarUser = await resolveSidebarUser(currentUser, settings)
  const postDisplayItems = await buildHookedPostStreamDisplayItems({
    posts,
    settings,
    sort: currentSort,
    listDisplayMode: zone.postListDisplayMode,
    visiblePinScopes: ["GLOBAL", "ZONE"],
    pathname: `/zones/${zone.slug}`,
    searchParams: buildAddonHookSearchParams(searchParams),
  })
  const useInfinitePostList = zone.postListLoadMode === POST_LIST_LOAD_MODE_INFINITE
  const emptyStateText = currentSort === "featured" ? "当前分区下还没有精华内容。" : "当前分区下还没有公开内容。"
  const sortLinks = {
    currentSort,
    latestHref: buildZonePageHref(params.slug, 1, "latest"),
    newHref: buildZonePageHref(params.slug, 1, "new"),
    featuredHref: buildZonePageHref(params.slug, 1, "featured"),
  }
  const zonePostsApiPath = buildZonePostsApiPath(params.slug, currentSort)
  const shouldShowRightSidebar = zone.postListDisplayMode !== POST_LIST_DISPLAY_MODE_GALLERY
  const zoneSlotProps = {
    zoneId: zone.id,
    zoneSlug: zone.slug,
    zoneName: zone.name,
    boardCount: zoneBoards.length,
    postCount: zone.count,
    currentSort,
    currentPage: page,
    totalPages,
    totalPosts: postsPage.total,
    canView: permission.allowed,
  }



  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1">
        <AddonSlotRenderer slot="zone.page.before" props={zoneSlotProps} />
        <AddonSurfaceRenderer surface="zone.page" props={zoneSlotProps}>
          <ForumPageShell
            zones={allZones}
            boards={allBoards}
            activeZoneSlug={zone.slug}
            main={(
              <main className="pb-12 py-1 mt-5">
              <div className="space-y-3">

              <AddonSlotRenderer slot="zone.hero.before" props={zoneSlotProps} />
              <AddonSurfaceRenderer surface="zone.hero" props={zoneSlotProps}>
                <CollapsibleInfoCard
                  badge="论坛分区"
                  title={zone.name}
                  icon={zone.icon}
                  description={zone.description}
                  summary={`当前分区共覆盖 ${zoneBoards.length} 个节点，累计 ${zone.count} 篇内容`}
                  summaryActions={<RssSubscribeButton href={`/zones/${zone.slug}/rss.xml`} label="RSS" />}
                  defaultVisibleCount={zoneBoards.length + 1}
                  pills={[

                    {
                      id: `zone-${zone.id}`,
                      label: "全部",
                      icon: zone.icon,
                      href: `/zones/${params.slug}`,
                      active: true,
                    },
                    ...zoneBoards.map((board: (typeof zoneBoards)[number]) => ({

                      id: board.id,
                      label: board.name,
                      icon: board.icon,
                      href: `/boards/${board.slug}`,
                      active: false,
                    })),
                  ]}
                />
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="zone.hero.after" props={zoneSlotProps} />

              <AddonSurfaceRenderer surface="zone.content" props={{ ...zoneSlotProps, posts }}>
                {!permission.allowed ? (

                  <AccessDeniedCard title="当前分区暂不可访问" description={`该分区设置了${settings.pointName}、等级或 VIP 浏览门槛，未满足条件的用户无法查看分区内容。`} reason={permission.message || "当前没有访问权限"} isLoggedIn={Boolean(currentUser)} redirectTarget={`/zones/${params.slug}`} />
                ) : (
                  <>

                    <AddonSlotRenderer slot="zone.content.before" props={zoneSlotProps} />
                    {useInfinitePostList ? (
                      <InfiniteForumPostStream
                        apiPath={zonePostsApiPath}
                        initialItems={postDisplayItems}
                        initialPage={page}
                        initialHasNextPage={hasNextPage}
                        listDisplayMode={zone.postListDisplayMode}
                        showPinnedDivider={page === 1}
                        postLinkDisplayMode={settings.postLinkDisplayMode}
                        sortLinks={sortLinks}
                      />
                    ) : (
                      <ForumPostStreamView
                        items={postDisplayItems}
                        listDisplayMode={zone.postListDisplayMode}
                        showPinnedDivider={page === 1}
                        postLinkDisplayMode={settings.postLinkDisplayMode}
                        sortLinks={sortLinks}
                      />
                    )}

                    {posts.length === 0 ? <div className="rounded-md border bg-background p-8 text-sm text-muted-foreground">{emptyStateText}</div> : null}

                    {useInfinitePostList ? null : (
                      <PageNumberPagination
                        page={page}
                        totalPages={totalPages}
                        hasPrevPage={hasPrevPage}
                        hasNextPage={hasNextPage}
                        buildHref={(targetPage) => buildZonePageHref(params.slug, targetPage, currentSort)}
                      />
                    )}
                    <AddonSlotRenderer slot="zone.content.after" props={zoneSlotProps} />
                  </>
                )}
              </AddonSurfaceRenderer>
              </div>
              </main>
            )}
            rightSidebar={shouldShowRightSidebar ? (
              <aside className="mt-6 hidden pb-12 lg:block">
              <AddonSlotRenderer slot="zone.sidebar.before" props={zoneSlotProps} />
              <AddonSurfaceRenderer surface="zone.sidebar" props={zoneSlotProps}>
                <HomeSidebarPanels
                  user={sidebarUser}
                  hotTopics={hotTopics}
                  postLinkDisplayMode={settings.postLinkDisplayMode}
                  announcements={announcements}
                  showAnnouncements={settings.homeSidebarAnnouncementsEnabled}
                  createPostHref={zoneBoards[0] ? `/write?board=${zoneBoards[0].slug}` : "/write"}
                  siteName={settings.siteName}
                  siteDescription={settings.siteDescription}
                  siteLogoPath={settings.siteLogoPath}
                  siteIconPath={settings.siteIconPath}
                />
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="zone.sidebar.after" props={zoneSlotProps} />
              </aside>
            ) : null}
          />
        </AddonSurfaceRenderer>
        <AddonSlotRenderer slot="zone.page.after" props={zoneSlotProps} />
      </div>
    </div>
  )
}
