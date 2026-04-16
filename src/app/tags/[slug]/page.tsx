import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { ForumPostStream } from "@/components/forum/forum-post-stream"
import { FollowToggleButton } from "@/components/follow-toggle-button"
import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { HomeSidebarPanels } from "@/components/home/home-sidebar-panels"
import { RssSubscribeButton } from "@/components/rss/rss-subscribe-button"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { getBoards } from "@/lib/boards"
import { isUserFollowingTarget } from "@/lib/follows"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"

import { getSiteSettings } from "@/lib/site-settings"
import { getTagBySlug, getTagPosts } from "@/lib/tags"
import { getZones } from "@/lib/zones"

export const dynamic = "force-dynamic"

export async function generateMetadata(props: PageProps<"/tags/[slug]">): Promise<Metadata> {
  const params = await props.params;
  const [tag, settings] = await Promise.all([getTagBySlug(params.slug), getSiteSettings()])

  if (!tag) {
    return { title: `标签不存在 - ${settings.siteName}` }
  }

  return {
    title: `${tag.name} - ${settings.siteName}`,
    description: `浏览标签 ${tag.name} 下的内容与讨论。`,
    alternates: {
      canonical: `/tags/${tag.slug}`,
      types: {
        "application/rss+xml": `/tags/${tag.slug}/rss.xml`,
      },
    },
  }
}

export default async function TagPage(props: PageProps<"/tags/[slug]">) {
  const params = await props.params;
  const tag = await getTagBySlug(params.slug)

  if (!tag) {
    notFound()
  }

  const settingsPromise = getSiteSettings()
  const [posts, boards, zones, currentUser, hotTopics, settings] = await Promise.all([
    getTagPosts(params.slug),
    getBoards(),
    getZones(),
    getCurrentUser(),
    settingsPromise.then((settings) => getHomeSidebarHotTopics(settings.homeSidebarHotTopicsCount)),
    settingsPromise,
  ])

  const sidebarUser = await resolveSidebarUser(currentUser, settings)
  const isFollowingTag = currentUser
    ? await isUserFollowingTarget({
        userId: currentUser.id,
        targetType: "tag",
        targetId: tag.id,
      })
    : false



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
              <AddonSlotRenderer slot="tag.page.before" />
              <AddonSurfaceRenderer surface="tag.page" props={{ posts, settings, tag }}>
                <>
              <AddonSlotRenderer slot="tag.hero.before" />
              <AddonSurfaceRenderer surface="tag.hero" props={{ isFollowingTag, settings, tag }}>
                <Card className="overflow-hidden border-none bg-linear-to-r from-[#1f1b16] via-[#2e261f] to-[#382c22] text-white shadow-soft">
                <CardContent className="p-8">
                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-sm text-white/70">标签页</p>
                      <h1 className="mt-2 text-3xl font-semibold">#{tag.name}</h1>
                      <p className="mt-3 text-sm leading-7 text-white/75">当前标签共关联 {tag.count} 篇内容。</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <RssSubscribeButton
                        href={`/tags/${tag.slug}/rss.xml`}
                        label="订阅标签 RSS"
                        className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white transition-colors hover:border-white/30 hover:bg-white/15"
                      />
                      <FollowToggleButton
                        targetType="tag"
                        targetId={tag.id}
                        initialFollowed={isFollowingTag}
                        activeLabel="已关注标签"
                        inactiveLabel="关注标签"
                        className="self-start border-white/20 bg-white/10 text-white hover:border-white/30 hover:bg-white/15 hover:text-white"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="tag.hero.after" />

              <AddonSlotRenderer slot="tag.content.before" />
              <AddonSurfaceRenderer surface="tag.content" props={{ posts, tag }}>
                <>
                  <ForumPostStream posts={posts} compactFirstItem={false} />
                  {posts.length === 0 ? <div className="rounded-md border bg-background p-8 text-sm text-muted-foreground">当前标签下还没有内容。</div> : null}
                </>
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="tag.content.after" />
                </>
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="tag.page.after" />
            </div>
            </main>
          )}
          rightSidebar={(
            <aside className="mt-6 hidden pb-12 lg:block">
              <AddonSlotRenderer slot="tag.sidebar.before" />
              <AddonSurfaceRenderer surface="tag.sidebar" props={{ hotTopics, settings, tag }}>
                <HomeSidebarPanels user={sidebarUser} hotTopics={hotTopics} siteName={settings.siteName} siteDescription={settings.siteDescription} siteLogoPath={settings.siteLogoPath} siteIconPath={settings.siteIconPath} />
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="tag.sidebar.after" />
            </aside>
          )}
        />
      </div>
    </div>
  )
}

