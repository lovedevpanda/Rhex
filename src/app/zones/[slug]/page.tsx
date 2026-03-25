import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { AccessDeniedCard } from "@/components/access-denied-card"
import { CollapsibleInfoCard } from "@/components/collapsible-info-card"
import { ForumPostStream } from "@/components/forum-post-stream"

import { HomeSidebarPanels } from "@/components/home-sidebar-panels"
import { SidebarNavigation } from "@/components/sidebar-navigation"
import { SiteHeader } from "@/components/site-header"


import { getCurrentUser } from "@/lib/auth"
import { checkBoardPermission } from "@/lib/board-access"
import { getBoards } from "@/lib/boards"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"

import { DEFAULT_ALLOWED_POST_TYPES } from "@/lib/post-types"
import { buildMetadataKeywords } from "@/lib/seo"
import { getSiteSettings } from "@/lib/site-settings"
import { getZoneBoards, getZoneBySlug, getZonePosts, getZones } from "@/lib/zones"


interface ZonePageProps {
  params: {
    slug: string
  }
  searchParams?: {
    page?: string
  }
}

export async function generateStaticParams() {
  const zones = await getZones()
  return zones.map((zone) => ({ slug: zone.slug }))
}

export async function generateMetadata({ params }: ZonePageProps): Promise<Metadata> {
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


export default async function ZonePage({ params, searchParams }: ZonePageProps) {
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

  const currentPage = Math.max(1, Number(searchParams?.page ?? "1") || 1)
  const [zoneBoards, posts, allBoards, allZones, hotTopics] = await Promise.all([
    getZoneBoards(params.slug),
    permission.allowed ? getZonePosts(params.slug, currentPage, 10) : Promise.resolve([]),
    getBoards(),
    getZones(),
    getHomeSidebarHotTopics(5),
  ])
  const prevPage = Math.max(1, currentPage - 1)
  const nextPage = currentPage + 1
  const sidebarUser = await resolveSidebarUser(currentUser, settings)



  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <SidebarNavigation zones={allZones} boards={allBoards} activeZoneSlug={zone.slug} />

          <main className="pb-12 lg:col-span-7 py-1">
            <div className="space-y-3">

              <CollapsibleInfoCard
                badge="论坛分区"
                title={zone.name}
                icon={zone.icon}
                description={zone.description}
                summary={`当前分区共覆盖 ${zoneBoards.length} 个节点，累计 ${zone.count} 篇内容`}
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

                <AccessDeniedCard title="当前分区暂不可访问" description={`该分区设置了${settings.pointName}、等级或 VIP 浏览门槛，未满足条件的用户无法查看分区内容。`} reason={permission.message || "当前没有访问权限"} />
              ) : (
                <>

                  <ForumPostStream posts={posts} />

                  {posts.length === 0 ? <div className="rounded-md border bg-background p-8 text-sm text-muted-foreground">当前分区下还没有公开内容。</div> : null}

                  <div className="flex items-center justify-between pt-2">
                    <Link href={`/zones/${params.slug}?page=${prevPage}`} className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}>
                      <span className="rounded-full border border-border bg-card px-4 py-2 text-sm">上一页</span>
                    </Link>
                    <span className="text-sm text-muted-foreground">第 {currentPage} 页</span>
                    <Link href={`/zones/${params.slug}?page=${nextPage}`}>
                      <span className="rounded-full border border-border bg-card px-4 py-2 text-sm">下一页</span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </main>

          <aside className="mt-6 hidden pb-12 lg:col-span-3 lg:block">
            <HomeSidebarPanels user={sidebarUser} hotTopics={hotTopics} createPostHref={zoneBoards[0] ? `/write?board=${zoneBoards[0].slug}` : "/write"} />

          </aside>
        </div>
      </div>
    </div>
  )
}

