import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { AccessDeniedCard } from "@/components/access-denied-card"
import { BoardFollowButton } from "@/components/board-follow-button"
import { CollapsibleInfoCard } from "@/components/collapsible-info-card"
import { ForumPostStream } from "@/components/forum-post-stream"

import { HomeSidebarPanels } from "@/components/home-sidebar-panels"
import { SidebarNavigation } from "@/components/sidebar-navigation"
import { SiteHeader } from "@/components/site-header"


import { getCurrentUser } from "@/lib/auth"
import { checkBoardPermission } from "@/lib/board-access"
import { getBoardBySlug, getBoardPosts, getBoards, isUserFollowingBoard } from "@/lib/boards"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { DEFAULT_ALLOWED_POST_TYPES, normalizePostTypes } from "@/lib/post-types"
import { buildMetadataKeywords } from "@/lib/seo"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones } from "@/lib/zones"




interface BoardPageProps {
  params: {
    slug: string
  }
  searchParams?: {
    page?: string
  }
}

export async function generateStaticParams() {
  const boards = await getBoards()
  return boards.map((board) => ({ slug: board.slug }))
}

export async function generateMetadata({ params }: BoardPageProps): Promise<Metadata> {
  const [board, settings] = await Promise.all([getBoardBySlug(params.slug), getSiteSettings()])

  if (!board) {
    return {
      title: `节点不存在 - ${settings.siteName}`,
    }
  }

  return {
    title: `${board.name} - ${settings.siteName}`,
    description: board.description,
    keywords: buildMetadataKeywords(settings.siteSeoKeywords, [board.name, board.slug, board.description, "节点", "论坛节点"]),
    alternates: {
      canonical: `/boards/${board.slug}`,
    },
    openGraph: {
      title: `${board.name} - ${settings.siteName}`,
      description: board.description,
      type: "website",
    },
  }
}


export default async function BoardPage({ params, searchParams }: BoardPageProps) {
  const [board, currentUser, settings] = await Promise.all([getBoardBySlug(params.slug), getCurrentUser(), getSiteSettings()])

  if (!board) {
    notFound()
  }

  const permission = checkBoardPermission(currentUser, {
    postPointDelta: 0,
    replyPointDelta: 0,
    postIntervalSeconds: 120,
    replyIntervalSeconds: 3,
    allowedPostTypes: board.allowedPostTypes ? normalizePostTypes(board.allowedPostTypes.join(",")) : DEFAULT_ALLOWED_POST_TYPES,
    minViewPoints: board.minViewPoints ?? 0,
    minViewLevel: board.minViewLevel ?? 0,
    minPostPoints: board.minPostPoints ?? 0,
    minPostLevel: board.minPostLevel ?? 0,
    minReplyPoints: board.minReplyPoints ?? 0,
    minReplyLevel: board.minReplyLevel ?? 0,
    minViewVipLevel: board.minViewVipLevel ?? 0,

    minPostVipLevel: board.minPostVipLevel ?? 0,
    minReplyVipLevel: board.minReplyVipLevel ?? 0,
    requirePostReview: board.requirePostReview ?? false,
  }, "view")

  const currentPage = Number(searchParams?.page ?? "1") || 1
  const [posts, boards, zones, hotTopics] = await Promise.all([
    permission.allowed ? getBoardPosts(params.slug, currentPage, 10) : Promise.resolve([]),
    getBoards(),
    getZones(),
    getHomeSidebarHotTopics(5),
  ])
  const zoneBoards = board.zoneId ? boards.filter((item) => item.zoneId === board.zoneId) : []
  const parentZone = board.zoneId ? zones.find((item) => item.id === board.zoneId) ?? null : null
  const isFollowingBoard = currentUser
    ? await isUserFollowingBoard(currentUser.id, board.id)
    : false

  const nextPage = currentPage + 1


  const prevPage = Math.max(1, currentPage - 1)
  const sidebarUser = await resolveSidebarUser(currentUser, settings)



  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <SidebarNavigation zones={zones} boards={boards} activeBoardSlug={board.slug} />

          <main className="pb-12 lg:col-span-7 py-1">
            <div className="space-y-3">

              <CollapsibleInfoCard
                badge="兴趣节点"
                title={board.name}
                icon={board.icon}
                description={board.description}
                summary={`当前共收录 ${board.count} 篇内容`}
                actions={<BoardFollowButton boardId={board.id} initialFollowed={isFollowingBoard} />}
                pills={[
                  {
                    id: `zone-${parentZone?.id ?? board.id}`,
                    label: "全部",
                    icon: parentZone?.icon ?? "📚",
                    href: parentZone ? `/zones/${parentZone.slug}` : "/funs",
                    active: false,
                  },
                  ...zoneBoards.map((item) => ({
                    id: item.id,
                    label: item.name,
                    icon: item.icon,
                    href: `/boards/${item.slug}`,
                    active: item.slug === board.slug,
                  })),
                ]}
              />



              {!permission.allowed ? (
                <AccessDeniedCard title="当前节点暂不可访问" description={`该节点设置了${settings.pointName}、等级或 VIP 浏览门槛，未满足条件的用户无法查看节点内容。`} reason={permission.message || "当前没有访问权限"} />
              ) : (
                <>
         

                  <ForumPostStream posts={posts} showBoard={false} />



                  {posts.length === 0 ? <div className="rounded-md border bg-background p-8 text-sm text-muted-foreground">当前节点还没有内容。</div> : null}

                  <div className="flex items-center justify-between pt-2">
                    <Link href={`/boards/${params.slug}?page=${prevPage}`} className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}>
                      <span className="rounded-full border border-border bg-card px-4 py-2 text-sm">上一页</span>
                    </Link>
                    <span className="text-sm text-muted-foreground">第 {currentPage} 页</span>
                    <Link href={`/boards/${params.slug}?page=${nextPage}`}>
                      <span className="rounded-full border border-border bg-card px-4 py-2 text-sm">下一页</span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </main>

          <aside className="mt-6 hidden pb-12 lg:col-span-3 lg:block">
            <HomeSidebarPanels user={sidebarUser} hotTopics={hotTopics} createPostHref={`/write?board=${board.slug}`} />

          </aside>
        </div>
      </div>
    </div>
  )
}

