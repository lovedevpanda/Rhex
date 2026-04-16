import type { Metadata } from "next"
import Link from "next/link"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { HomeSidebarPanels } from "@/components/home/home-sidebar-panels"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { getBoards } from "@/lib/boards"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { readSearchParam } from "@/lib/search-params"
import { getSiteSettings } from "@/lib/site-settings"
import { type TagListSort, getTagListPage } from "@/lib/tags"
import { cn } from "@/lib/utils"
import { getZones } from "@/lib/zones"

export const dynamic = "force-dynamic"

function normalizeSort(sort?: string): TagListSort {
  return sort === "new" ? "new" : "hot"
}

function buildTagsPageHref(page: number, sort: TagListSort) {
  const query = new URLSearchParams()

  if (sort !== "hot") {
    query.set("sort", sort)
  }

  if (page > 1) {
    query.set("page", String(page))
  }

  const queryString = query.toString()
  return queryString ? `/tags?${queryString}` : "/tags"
}

function sortTabClassName(active: boolean) {
  return cn(
    "inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors",
    active ? "border-transparent bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  )
}

export async function generateMetadata(props: PageProps<"/tags">): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const settings = await getSiteSettings()
  const currentSort = normalizeSort(readSearchParam(searchParams?.sort))
  const sortLabel = currentSort === "hot" ? "热门标签" : "新标签"

  return {
    title: `${sortLabel} - ${settings.siteName}`,
    description: `浏览 ${settings.siteName} 的全部标签，支持按帖子关联数量或创建时间查看。`,
    alternates: {
      canonical: currentSort === "hot" ? "/tags" : `/tags?sort=${currentSort}`,
    },
  }
}

export default async function TagsPage(props: PageProps<"/tags">) {
  const searchParams = await props.searchParams;
  const currentPage = Math.max(1, Number(readSearchParam(searchParams?.page) ?? "1") || 1)
  const currentSort = normalizeSort(readSearchParam(searchParams?.sort))
  const settingsPromise = getSiteSettings()

  const [tagPage, boards, zones, currentUser, hotTopics, settings] = await Promise.all([
    getTagListPage(currentPage, 24, currentSort),
    getBoards(),
    getZones(),
    getCurrentUser(),
    settingsPromise.then((settings) => getHomeSidebarHotTopics(settings.homeSidebarHotTopicsCount)),
    settingsPromise,
  ])

  const sidebarUser = await resolveSidebarUser(currentUser, settings)
  const pageTitle = currentSort === "hot" ? "热门标签" : "新标签"
  const pageDescription = currentSort === "hot"
    ? "默认按照每个标签关联的帖子数量排序，帮助快速发现讨论最集中的主题。"
    : "按照标签创建时间排序，方便查看社区刚刚出现的新话题。"

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1">
        <ForumPageShell
          zones={zones}
          boards={boards}
          main={(
            <main className="pb-12 py-1 mt-5">
            <div className="space-y-6">
              <AddonSlotRenderer slot="tags.page.before" />
              <AddonSurfaceRenderer surface="tags.page" props={{ currentSort, settings, tagPage }}>
                <>
              <AddonSlotRenderer slot="tags.hero.before" />
              <AddonSurfaceRenderer surface="tags.hero" props={{ currentSort, settings, tagPage }}>
                <Card className="overflow-hidden border-none bg-linear-to-r from-[#1f1b16] via-[#2e261f] to-[#382c22] text-white shadow-soft">
                <CardContent className="space-y-5 p-8">
                  <div>
                    <p className="text-sm text-white/70">标签广场</p>
                    <h1 className="mt-2 text-3xl font-semibold">{pageTitle}</h1>
                    <p className="mt-3 text-sm leading-7 text-white/75">{pageDescription}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/tags" className={sortTabClassName(currentSort === "hot")}>热门标签</Link>
                    <Link href="/tags?sort=new" className={sortTabClassName(currentSort === "new")}>新标签</Link>
                  </div>
                </CardContent>
              </Card>
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="tags.hero.after" />

              <AddonSlotRenderer slot="tags.content.before" />
              <AddonSurfaceRenderer surface="tags.content" props={{ currentSort, settings, tagPage }}>
              <Card>
                <CardContent className="space-y-6 p-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">共 {tagPage.pagination.total} 个标签，第 {tagPage.pagination.page} / {tagPage.pagination.totalPages} 页</p>
                    <p className="text-sm text-muted-foreground">当前展示 {currentSort === "hot" ? "按帖子数排序" : "按创建时间排序"}</p>
                  </div>

                  {tagPage.items.length === 0 ? (
                    <div className="rounded-md border bg-background p-8 text-sm text-muted-foreground">当前还没有可展示的标签。</div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {tagPage.items.map((tag, index) => (
                        <Link
                          key={tag.id}
                          href={`/tags/${tag.slug}`}
                          className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-accent/60"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-foreground transition-colors group-hover:text-accent-foreground">#{tag.name}</p>
                              <p className="mt-2 text-sm text-muted-foreground">关联 {tag.count} 篇帖子</p>
                            </div>
                            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                              {currentSort === "hot" ? `TOP ${index + 1 + (tagPage.pagination.page - 1) * tagPage.pagination.pageSize}` : "NEW"}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">第 {tagPage.pagination.page} / {tagPage.pagination.totalPages} 页</p>
                    <div className="flex items-center gap-3">
                      <Link
                        href={buildTagsPageHref(tagPage.pagination.page - 1, currentSort)}
                        aria-disabled={!tagPage.pagination.hasPrevPage}
                        className={cn(
                          "inline-flex h-10 items-center justify-center rounded-full border border-border px-5 text-sm font-medium transition-colors",
                          tagPage.pagination.hasPrevPage ? "bg-card hover:bg-accent hover:text-accent-foreground" : "pointer-events-none cursor-not-allowed opacity-50",
                        )}
                      >
                        上一页
                      </Link>
                      <Link
                        href={buildTagsPageHref(tagPage.pagination.page + 1, currentSort)}
                        aria-disabled={!tagPage.pagination.hasNextPage}
                        className={cn(
                          "inline-flex h-10 items-center justify-center rounded-full border border-border px-5 text-sm font-medium transition-colors",
                          tagPage.pagination.hasNextPage ? "bg-card hover:bg-accent hover:text-accent-foreground" : "pointer-events-none cursor-not-allowed opacity-50",
                        )}
                      >
                        下一页
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="tags.content.after" />
                </>
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="tags.page.after" />
            </div>
            </main>
          )}
          rightSidebar={(
            <aside className="mt-6 hidden pb-12 lg:block">
              <AddonSlotRenderer slot="tags.sidebar.before" />
              <AddonSurfaceRenderer surface="tags.sidebar" props={{ hotTopics, settings }}>
                <HomeSidebarPanels user={sidebarUser} hotTopics={hotTopics} siteName={settings.siteName} siteDescription={settings.siteDescription} siteLogoPath={settings.siteLogoPath} siteIconPath={settings.siteIconPath} />
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="tags.sidebar.after" />
            </aside>
          )}
        />
      </div>
    </div>
  )
}
