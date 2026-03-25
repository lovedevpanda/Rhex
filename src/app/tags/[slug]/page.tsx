import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ForumPostStream } from "@/components/forum-post-stream"
import { HomeSidebarPanels } from "@/components/home-sidebar-panels"
import { SidebarNavigation } from "@/components/sidebar-navigation"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { getBoards } from "@/lib/boards"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"

import { getSiteSettings } from "@/lib/site-settings"
import { getTagBySlug, getTagPosts } from "@/lib/tags"
import { getZones } from "@/lib/zones"

export const dynamic = "force-dynamic"

interface TagPageProps {
  params: {
    slug: string
  }
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const [tag, settings] = await Promise.all([getTagBySlug(params.slug), getSiteSettings()])

  if (!tag) {
    return { title: `标签不存在 - ${settings.siteName}` }
  }

  return {
    title: `${tag.name} - ${settings.siteName}`,
    description: `浏览标签 ${tag.name} 下的内容与讨论。`,
    alternates: {
      canonical: `/tags/${tag.slug}`,
    },
  }
}

export default async function TagPage({ params }: TagPageProps) {
  const tag = await getTagBySlug(params.slug)

  if (!tag) {
    notFound()
  }

  const [posts, boards, zones, currentUser, hotTopics, settings] = await Promise.all([
    getTagPosts(params.slug),
    getBoards(),
    getZones(),
    getCurrentUser(),
    getHomeSidebarHotTopics(5),
    getSiteSettings(),
  ])

  const sidebarUser = await resolveSidebarUser(currentUser, settings)



  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <SidebarNavigation zones={zones} boards={boards} />

          <main className="pb-12 lg:col-span-7 py-1">
            <div className="space-y-6">
              <Card className="overflow-hidden border-none bg-gradient-to-r from-[#1f1b16] via-[#2e261f] to-[#382c22] text-white shadow-soft">
                <CardContent className="p-8">
                  <p className="text-sm text-white/70">标签页</p>
                  <h1 className="mt-2 text-3xl font-semibold">#{tag.name}</h1>
                  <p className="mt-3 text-sm leading-7 text-white/75">当前标签共关联 {tag.count} 篇内容。</p>
                </CardContent>
              </Card>

              <ForumPostStream posts={posts} />
              {posts.length === 0 ? <div className="rounded-md border bg-background p-8 text-sm text-muted-foreground">当前标签下还没有内容。</div> : null}
            </div>
          </main>

          <aside className="mt-6 hidden pb-12 lg:col-span-3 lg:block">
            <HomeSidebarPanels user={sidebarUser} hotTopics={hotTopics} />
          </aside>
        </div>
      </div>
    </div>
  )
}

