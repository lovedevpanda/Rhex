import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { AccessDeniedCard } from "@/components/access-denied-card"
import { CollapsibleInfoCard } from "@/components/collapsible-info-card"
import { ForumPageShell } from "@/components/forum-page-shell"
import { ForumPostStream } from "@/components/forum-post-stream"
import { PageNumberPagination } from "@/components/page-number-pagination"

import { HomeSidebarPanels } from "@/components/home-sidebar-panels"
import { SiteHeader } from "@/components/site-header"


import { getCurrentUser } from "@/lib/auth"
import { checkBoardPermission } from "@/lib/board-access"
import { getBoards } from "@/lib/boards"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"

import { DEFAULT_ALLOWED_POST_TYPES } from "@/lib/post-types"
import { readSearchParam } from "@/lib/search-params"
import { buildMetadataKeywords } from "@/lib/seo"
import { getSiteSettings } from "@/lib/site-settings"
import { getZoneBoards, getZoneBySlug, getZonePosts, getZones } from "@/lib/zones"
import { RssSubscribeButton } from "@/components/rss-subscribe-button"


function buildZonePageHref(slug: string, page = 1) {
  const normalizedPage = Math.max(1, Math.trunc(page))
  return normalizedPage <= 1 ? `/zones/${slug}` : `/zones/${slug}?page=${normalizedPage}`
}

export async function generateStaticParams() {
  const zones = await getZones()
  return zones.map((zone) => ({ slug: zone.slug }))
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
  const [zone, currentUser, settings] = await Promise.all([getZoneBySlug(params.slug), getCurrentUser(), getSiteSettings()])

  if (!zone) {
    notFound()
  }

  const permission = checkBoardPermission(currentUser, {
    postPointDelta: 0,
    replyPointDelta: 0,
    postIntervalSeconds: 120,
    replyIntervalSeconds: 3,
    allowedPostTypes: DEFAULT_ALLOWED_POST_TYPES,
    minViewPoints: zone.minViewPoints ?? 0,
    minViewLevel: zone.minViewLevel ?? 0,
    minPostPoints: 0,
    minPostLevel: 0,
    minReplyPoints: 0,
    minReplyLevel: 0,
    minViewVipLevel: zone.minViewVipLevel ?? 0,

    minPostVipLevel: 0,
    minReplyVipLevel: 0,
    requirePostReview: zone.requirePostReview ?? false,
  }, "view")

  const rawPage = readSearchParam(searchParams?.page)
  const currentPage = Math.max(1, Number(rawPage ?? "1") || 1)
  const [zoneBoards, postsPage, allBoards, allZones, hotTopics] = await Promise.all([
    getZoneBoards(params.slug),
    permission.allowed
      ? getZonePosts(params.slug, currentPage, 20)
      : Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1, hasPrevPage: false, hasNextPage: false }),
    getBoards(),
    getZones(),
    getHomeSidebarHotTopics(5),
  ])
  const { items: posts, page, totalPages, hasPrevPage, hasNextPage } = postsPage

  if (rawPage !== undefined && currentPage === 1) {
    redirect(buildZonePageHref(params.slug))
  }

  if (currentPage !== page) {
    redirect(buildZonePageHref(params.slug, page))
  }
  const sidebarUser = await resolveSidebarUser(currentUser, settings)



  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1">
        <ForumPageShell
          zones={allZones}
          boards={allBoards}
          activeZoneSlug={zone.slug}
          main={(
            <main className="pb-12 py-1">
            <div className="space-y-3">

              <CollapsibleInfoCard
                badge="论坛分区"
                title={zone.name}
                icon={zone.icon}
                description={zone.description}
                summary={`当前分区共覆盖 ${zoneBoards.length} 个节点，累计 ${zone.count} 篇内容`}
                summaryActions={<RssSubscribeButton href={`/zones/${zone.slug}/rss.xml`} label="订阅分区 RSS" />}
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


              {!permission.allowed ? (

                <AccessDeniedCard title="当前分区暂不可访问" description={`该分区设置了${settings.pointName}、等级或 VIP 浏览门槛，未满足条件的用户无法查看分区内容。`} reason={permission.message || "当前没有访问权限"} isLoggedIn={Boolean(currentUser)} />
              ) : (
                <>

                  <ForumPostStream posts={posts} listDisplayMode={zone.postListDisplayMode} visiblePinScopes={["GLOBAL", "ZONE"]} showPinnedDivider={page === 1} />

                  {posts.length === 0 ? <div className="rounded-md border bg-background p-8 text-sm text-muted-foreground">当前分区下还没有公开内容。</div> : null}

                  <PageNumberPagination
                    page={page}
                    totalPages={totalPages}
                    hasPrevPage={hasPrevPage}
                    hasNextPage={hasNextPage}
                    buildHref={(targetPage) => buildZonePageHref(params.slug, targetPage)}
                  />
                </>
              )}
            </div>
            </main>
          )}
          rightSidebar={(
            <aside className="mt-6 hidden pb-12 lg:block">
              <HomeSidebarPanels user={sidebarUser} hotTopics={hotTopics} postLinkDisplayMode={settings.postLinkDisplayMode} createPostHref={zoneBoards[0] ? `/write?board=${zoneBoards[0].slug}` : "/write"} siteName={settings.siteName} siteDescription={settings.siteDescription} />
            </aside>
          )}
        />
      </div>
    </div>
  )
}

