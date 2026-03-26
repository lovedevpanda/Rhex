import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Compass, HeartHandshake, LibraryBig, MessageSquareText, Sparkles } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { LevelIcon } from "@/components/level-icon"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { getBoards } from "@/lib/boards"
import { getSiteSettings } from "@/lib/site-settings"



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
  const [settings, boards] = await Promise.all([getSiteSettings(), getBoards()])
  const featuredBoards = boards.slice(0, 12)

  return (

    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto max-w-[1200px] px-4 py-10 lg:px-6 lg:py-14">
        <div className="space-y-8">
          <section className="rounded-[32px] border border-border bg-card px-6 py-8 shadow-sm sm:px-8 sm:py-10 lg:px-12 lg:py-14">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                  About {settings.siteName}
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                  一个围绕长期兴趣、真实经验与克制交流建立的社区。
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  {settings.siteName} 不是一个只追逐流量的内容广场，而是一个让兴趣爱好真正落地、生长并被认真讨论的地方。
                  我们希望把 {settings.siteDescription} 这件事，做成一个可以长期回访、持续积累的线上社区。
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
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

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">我们关注什么</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  这里展示社区当前开放的部分节点，帮助你快速理解我们正在认真讨论哪些兴趣与生活主题。
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {featuredBoards.map((board) => (
                <Link
                  key={board.id}
                  href={`/boards/${board.slug}`}
                  className="flex flex-col gap-2 rounded-[24px] border border-border bg-card px-4 py-4 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-accent"
                >
                  <div className="flex items-center gap-3">
                    <LevelIcon icon={board.icon} className="h-6 w-6 text-2xl leading-none" svgClassName="[&>svg]:block" />
                    <span className="text-sm font-medium text-foreground">{board.name}</span>
                  </div>

                  <p className="line-clamp-2 text-xs leading-6 text-muted-foreground">{board.description}</p>
                  <span className="text-xs text-muted-foreground">{board.count} 篇帖子</span>
                </Link>
              ))}
            </div>
          </section>


          <section className="grid gap-6 lg:grid-cols-2">
            {highlights.map((item) => {
              const Icon = item.icon
              return (
                <Card key={item.title} className="shadow-sm">
                  <CardHeader className="space-y-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-foreground">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{item.title}</CardTitle>
                      <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
                    </div>
                  </CardHeader>
                </Card>
              )
            })}
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">我们的社区原则</CardTitle>
                <p className="text-sm leading-7 text-muted-foreground">
                  我们不追求把页面写得很满，而是更在意每个版块都能准确传达社区气质：长期、具体、可沉淀。
                </p>
              </CardHeader>
              <CardContent className="grid gap-4">
                {principles.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.title} className="rounded-[24px] border border-border bg-background p-5">
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-foreground">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{item.title}</h3>
                          <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">适合谁加入</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
                <p>
                  如果你不满足于碎片化刷内容，而是想认真了解一个爱好、记录一次实践、分享一套经验，{settings.siteName} 会更适合你。
                </p>
                <p>
                  如果你正在寻找一个讨论氛围更稳定、表达更具体、信息密度更高的中文兴趣社区，这里就是为你准备的。
                </p>
                <div className="rounded-[24px] border border-dashed border-border bg-background p-5 text-foreground">
                  <div className="text-sm font-medium">一句话介绍</div>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {settings.siteName}，一个让兴趣不只停留在想法阶段，而是被持续实践、整理与交流的地方。
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="rounded-[32px] border border-border bg-muted/30 px-6 py-8 sm:px-8 lg:px-12 lg:py-10">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-semibold tracking-tight">准备好开始你的兴趣档案了吗？</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  注册后，你可以发帖、回复、收藏、获得勋章与成长记录，也可以在不同节点中找到更具体的同好与话题。
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                  注册账号
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-3 text-sm font-medium transition-colors hover:bg-accent"
                >
                  先随便逛逛
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
