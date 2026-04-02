import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Compass, HeartHandshake, LibraryBig, MessageSquareText, Sparkles } from "lucide-react"

import { ForumPageShell } from "@/components/forum-page-shell"
import { HomeSidebarPanels } from "@/components/home-sidebar-panels"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { getCurrentUser } from "@/lib/auth"
import { getBoards } from "@/lib/boards"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones } from "@/lib/zones"

const principles = [

  {
    icon: Compass,
    title: "兴趣优先",
    description: "我们相信，真正可持续的社区，不靠追热点，而靠长期稳定的兴趣沉淀与真实交流。",
  },
  {
    icon: LibraryBig,
    title: "经验可复用",
    description: "从新手入门、装备选择到进阶实践，把零散经验整理成别人也能看懂、能接住的内容。",
  },
  {
    icon: HeartHandshake,
    title: "交流有分寸",
    description: "鼓励表达，也尊重差异。比起情绪化争吵，我们更欢迎具体、克制、有信息量的讨论。",
  },
]

const highlights = [
  {
    icon: Sparkles,
    title: "找到同频的人",
    description: "无论你热爱器材、技术、手作还是生活方式，都能在这里找到愿意认真交流的人。",
  },
  {
    icon: MessageSquareText,
    title: "把想做的事真的做起来",
    description: "从一句提问、一篇分享，到一次长期记录，让兴趣从“以后再说”变成正在发生。",
  },
]

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `关于我们 - ${settings.siteName}`,
    description: `了解 ${settings.siteName} 的定位、氛围与社区愿景。`,
    openGraph: {
      title: `关于我们 - ${settings.siteName}`,
      description: settings.siteDescription,
      type: "website",
    },
  }
}

export default async function AboutPage() {
  const [settings, boards, zones, currentUser, hotTopics] = await Promise.all([
    getSiteSettings(),
    getBoards(),
    getZones(),
    getCurrentUser(),
    getHomeSidebarHotTopics(5),
  ])
  const sidebarUser = await resolveSidebarUser(currentUser, settings)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1">
        <ForumPageShell
          zones={zones}
          boards={boards}
          main={(
            <main className="py-1 pb-12 mt-6">
              <div className="space-y-6 ">
          <section className="rounded-[28px] border border-border bg-card px-5 py-6 shadow-sm sm:px-7 sm:py-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                  About {settings.siteName}
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  一个围绕长期兴趣、真实经验与克制交流建立的社区。
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  {settings.siteName} 不是一个只追逐流量的内容广场，而是一个让兴趣爱好真正落地、生长并被认真讨论的地方。
                  我们希望把 {settings.siteDescription} 这件事，做成一个可以长期回访、持续积累的线上社区。
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                  现在加入
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/funs"
                  className="inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-3 text-sm font-medium transition-colors hover:bg-accent"
                >
                  浏览全部节点
                </Link>
              </div>
            </div>
          </section>

          <section className="grid gap-5 2xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">这是什么样的社区</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
                <p>
                  {settings.siteName} 更适合那些不满足于碎片化刷内容，而是想认真了解一个爱好、记录一次实践、分享一套经验的人。
                </p>
                <p>
                  如果你希望讨论氛围更稳定、表达更具体、信息密度更高，这里会比单纯追热点的内容广场更适合长期停留。
                </p>
                <div className="rounded-[18px] border border-dashed border-border bg-background p-4 text-foreground">
                  <div className="text-sm font-medium">一句话介绍</div>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {settings.siteName}，一个让兴趣被持续实践、整理和交流的地方。
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {highlights.map((item) => {
                const Icon = item.icon
                return (
                  <Card key={item.title} className="shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-foreground">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-base font-semibold">{item.title}</h2>
                          <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">我们的社区原则</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                页面不追求堆满信息，而是希望每一块都能准确传达社区气质。
              </p>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              {principles.map((item) => {
                const Icon = item.icon
                return (
                  <Card key={item.title} className="shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 font-semibold">{item.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>

    
              </div>
            </main>
          )}
          rightSidebar={(
            <aside className="mt-6 hidden pb-12 lg:block">
              <HomeSidebarPanels user={sidebarUser} hotTopics={hotTopics} siteName={settings.siteName} siteDescription={settings.siteDescription} />
            </aside>
          )}
        />
      </div>
    </div>
  )
}
