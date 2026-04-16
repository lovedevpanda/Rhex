import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { AccessDeniedCard } from "@/components/access-denied-card"
import { BoardSidebarPanels } from "@/components/board/board-sidebar-panels"
import { BoardFollowButton } from "@/components/board/board-follow-button"
import { CollapsibleInfoCard } from "@/components/collapsible-info-card"
import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { ForumPostStream } from "@/components/forum/forum-post-stream"
import { InfiniteForumPostStream } from "@/components/forum/infinite-forum-post-stream"
import { PageNumberPagination } from "@/components/page-number-pagination"
import { RssSubscribeButton } from "@/components/rss/rss-subscribe-button"
import { SiteHeader } from "@/components/site-header"


import { getHomeAnnouncements } from "@/lib/announcements"
import { getCurrentUser } from "@/lib/auth"
import { checkBoardPermission } from "@/lib/board-access"
import { getBoardBySlug, getBoardModerators, getBoardPosts, getBoards, isUserFollowingBoard } from "@/lib/boards"
import { mapSitePostsToDisplayItems } from "@/lib/forum-post-stream-display"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { POST_LIST_LOAD_MODE_INFINITE } from "@/lib/post-list-load-mode"
import { DEFAULT_ALLOWED_POST_TYPES, normalizePostTypes } from "@/lib/post-types"
import { readSearchParam } from "@/lib/search-params"
import { buildMetadataKeywords } from "@/lib/seo"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones } from "@/lib/zones"




function buildBoardPageHref(slug: string, page = 1) {
  const normalizedPage = Math.max(1, Math.trunc(page))
  return normalizedPage <= 1 ? `/boards/${slug}` : `/boards/${slug}?page=${normalizedPage}`
}

export async function generateStaticParams() {
  const boards = await getBoards()
  return boards.map((board) => ({ slug: board.slug }))
}

export async function generateMetadata(props: PageProps<"/boards/[slug]">): Promise<Metadata> {
  const params = await props.params;
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


export default async function BoardPage(props: PageProps<"/boards/[slug]">) {
  const searchParams = await props.searchParams
  const params = await props.params
  const settingsPromise = getSiteSettings()
  const [board, currentUser, settings] = await Promise.all([getBoardBySlug(params.slug), getCurrentUser(), settingsPromise])

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
    requireCommentReview: board.requireCommentReview ?? false,
    showInHomeFeed: true,
  }, "view")

  const rawPage = readSearchParam(searchParams?.page)
  const currentPage = Math.max(1, Number(rawPage ?? "1") || 1)
  const [postsPage, boards, zones, hotTopics, announcements, moderators] = await Promise.all([
    permission.allowed
      ? getBoardPosts(params.slug, currentPage, settings.boardPostPageSize)
      : Promise.resolve({ items: [], page: 1, pageSize: settings.boardPostPageSize, total: 0, totalPages: 1, hasPrevPage: false, hasNextPage: false }),
    getBoards(),
    getZones(),
    settingsPromise.then((settings) => getHomeSidebarHotTopics(settings.homeSidebarHotTopicsCount)),
    getHomeAnnouncements(3),
    getBoardModerators(board.id),
  ])
  const { items: posts, page, totalPages, hasPrevPage, hasNextPage } = postsPage

  if (rawPage !== undefined && currentPage === 1) {
    redirect(buildBoardPageHref(params.slug))
  }

  if (currentPage !== page) {
    redirect(buildBoardPageHref(params.slug, page))
  }
  const isFollowingBoard = currentUser
    ? await isUserFollowingBoard(currentUser.id, board.id)
    : false
  const sidebarUser = await resolveSidebarUser(currentUser, settings)
  const postDisplayItems = mapSitePostsToDisplayItems(posts, settings, ["GLOBAL", "ZONE", "BOARD"])
  const useInfinitePostList = board.postListLoadMode === POST_LIST_LOAD_MODE_INFINITE



  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1">
        <AddonSlotRenderer slot="board.page.before" />
        <AddonSurfaceRenderer surface="board.page" props={{ board, settings }}>
        <ForumPageShell
          zones={zones}
          boards={boards}
          activeBoardSlug={board.slug}
          main={(
            <main className="pb-12 py-1 mt-5">
            <div className="space-y-3">
              <AddonSlotRenderer slot="board.hero.before" />
              <AddonSurfaceRenderer surface="board.hero" props={{ board, isFollowingBoard, settings }}>
                <CollapsibleInfoCard
                  badge="兴趣节点"
                  title={board.name}
                  icon={board.icon}
                  description={board.description}
                  summary={`当前共收录 ${board.count} 篇内容`}
                  summaryActions={<RssSubscribeButton href={`/boards/${board.slug}/rss.xml`} label="订阅节点 RSS" />}
                  detailAction={<BoardFollowButton boardId={board.id} initialFollowed={isFollowingBoard} showLabel className="border border-border bg-background/85 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-accent" />}
                  alwaysOpen
                  hidePills
                  pills={[]}
                />
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="board.hero.after" />

              {!permission.allowed ? (
                <AccessDeniedCard title="当前节点暂不可访问" description={`该节点设置了${settings.pointName}、等级或 VIP 浏览门槛，未满足条件的用户无法查看节点内容。`} reason={permission.message || "当前没有访问权限"} isLoggedIn={Boolean(currentUser)} />
              ) : (
                <>
                  <AddonSlotRenderer slot="board.content.before" />
                  <AddonSurfaceRenderer surface="board.content" props={{ board, hasNextPage, page, permission, posts, settings, totalPages, useInfinitePostList }}>
                    <>
                      {useInfinitePostList ? (
                        <InfiniteForumPostStream
                          apiPath={`/api/boards/${encodeURIComponent(params.slug)}/posts`}
                          initialItems={postDisplayItems}
                          initialPage={page}
                          initialHasNextPage={hasNextPage}
                          listDisplayMode={board.postListDisplayMode}
                          showBoard={false}
                          showPinnedDivider={page === 1}
                          postLinkDisplayMode={settings.postLinkDisplayMode}
                        />
                      ) : (
                        <ForumPostStream posts={posts} listDisplayMode={board.postListDisplayMode} showBoard={false} showPinnedDivider={page === 1} />
                      )}

                      {posts.length === 0 ? <div className="rounded-md border bg-background p-8 text-sm text-muted-foreground">当前节点还没有内容。</div> : null}

                      {useInfinitePostList ? null : (
                        <PageNumberPagination
                          page={page}
                          totalPages={totalPages}
                          hasPrevPage={hasPrevPage}
                          hasNextPage={hasNextPage}
                          buildHref={(targetPage) => buildBoardPageHref(params.slug, targetPage)}
                        />
                      )}
                    </>
                  </AddonSurfaceRenderer>
                  <AddonSlotRenderer slot="board.content.after" />
                </>
              )}
            </div>
            </main>
          )}
          rightSidebar={(
            <aside className="mt-6 hidden pb-12 lg:block">
              <AddonSlotRenderer slot="board.sidebar.before" />
              <AddonSurfaceRenderer surface="board.sidebar" props={{ announcements, board, hotTopics, moderators, settings }}>
                <BoardSidebarPanels
                  user={sidebarUser}
                  hotTopics={hotTopics}
                  board={board}
                  moderators={moderators}
                  announcements={announcements}
                  showAnnouncements={settings.homeSidebarAnnouncementsEnabled}
                  postLinkDisplayMode={settings.postLinkDisplayMode}
                  createPostHref={`/write?board=${board.slug}`}
                  siteName={settings.siteName}
                  siteDescription={settings.siteDescription}
                  siteLogoPath={settings.siteLogoPath}
                  siteIconPath={settings.siteIconPath}
                />
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="board.sidebar.after" />
            </aside>
          )}
        />
        </AddonSurfaceRenderer>
        <AddonSlotRenderer slot="board.page.after" />
      </div>
    </div>
  )
}
