import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BookOpen, Flame, HelpCircle, MessageSquareText, Search, ShieldCheck, Sparkles } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getLevelDefinitions } from "@/lib/level-system"
import { getSiteSettings } from "@/lib/site-settings"

const faqHighlights = [
  {
    icon: HelpCircle,
    title: "快速解决使用问题",
    description: "把注册、发帖、权限、积分、成长与互动中的常见疑问集中整理，优先帮你快速定位答案。",
  },
  {
    icon: Search,
    title: "专题化沉淀规则说明",
    description: "对一些比较技术化或规则化的功能，比如帖子热度、成长条件等，单独拆成专题页说明。",
  },
  {
    icon: Sparkles,
    title: "和帮助中心互补",
    description: "帮助中心更偏向完整上手指南，FAQ 更偏向快速问答与专题索引，二者互相补充。",
  },
]

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `FAQ - ${settings.siteName}`,
    description: `查看 ${settings.siteName} 的常见问题与专题说明页面。`,
    openGraph: {
      title: `FAQ - ${settings.siteName}`,
      description: settings.siteDescription,
      type: "website",
    },
  }
}

export default async function FaqPage() {
  const [settings, levels] = await Promise.all([getSiteSettings(), getLevelDefinitions()])


  const faqCards = [
    {
      icon: Flame,
      title: "帖子热度 FAQ",
      description: "解释帖子列表中回复数按钮颜色、热度分数算法、阶段阈值与颜色档位，适合做规则说明与后台调整参考。",
      href: "/faq/post-heat",
      action: "查看热度说明",
    },
    {
      icon: MessageSquareText,
      title: "发帖与回复常见问题",
      description: "如果你想知道为什么不能发帖、为什么需要审核、为什么有些帖子可见范围不同，建议先去帮助中心查看完整说明。",
      href: "/help#posting",
      action: "查看发帖说明",
    },
    {
      icon: ShieldCheck,
      title: "权限与账户常见问题",
      description: `如果你遇到分区不可见、节点不可发、${settings.pointName} 或等级门槛等问题，帮助中心里已经整理了对应解释。`,
      href: "/help#faq",
      action: "查看常见问题",
    },
    {
      icon: BookOpen,
      title: "帮助中心总览",
      description: "适合第一次接触这套论坛的用户，从注册、浏览、发帖、成长到权益，一次性建立完整理解。",
      href: "/help",
      action: "打开帮助中心",
    },
  ]

  const quickQuestions = [
    {
      question: "为什么我看不到某些分区、节点或帖子？",
      answer: `通常是因为内容配置了登录、等级、${settings.pointName} 或 VIP 门槛。先去帮助中心确认自己当前的账户状态与权限说明。`,
    },
    {
      question: "为什么我不能发帖或回复？",
      answer: "节点可独立配置发帖权限、发帖间隔、审核状态和可用帖子类型，请优先确认当前节点的发帖条件。",
    },
    {
      question: `帖子热度颜色是怎么来的？`,
      answer: "热度颜色来自浏览、回复、点赞、打赏次数和打赏积分共同计算出的热度分数。详细算法见帖子热度 FAQ 专题页。",
    },
    {
      question: `我的 ${settings.pointName}、等级、勋章和 VIP 有什么关系？`,
      answer: `这几套机制分别承担成长、权限、身份标识和权益管理的作用。建议直接从帮助中心的“成长与权益”部分开始看。`,
    },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto max-w-[1200px] px-4 py-10 lg:px-6 lg:py-14">
        <div className="space-y-8">
          <section className="rounded-[32px] border border-border bg-card px-6 py-8 shadow-sm sm:px-8 sm:py-10 lg:px-12 lg:py-14">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                  FAQ Index
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                  常见问题与专题说明入口。
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  如果帮助中心更像完整的新手手册，那么 FAQ 更像一个快速检索入口。这里会集中放置高频问题，以及像“帖子热度”这种适合单独展开讲清楚的专题页。
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link href="/help" className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90">
                  打开帮助中心
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/faq/post-heat" className="inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-3 text-sm font-medium transition-colors hover:bg-accent">
                  先看热度 FAQ
                </Link>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {faqHighlights.map((item) => {
              const Icon = item.icon
              return (
                <Card key={item.title} className="shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-foreground">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h2 className="mt-4 font-semibold">{item.title}</h2>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </section>

          <section className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">FAQ 专题入口</h2>
              <p className="mt-2 text-sm text-muted-foreground">这里不只是问答列表，也会挂一些更适合单页展开的规则说明。</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {faqCards.map((item) => {
                const Icon = item.icon
                return (
                  <Card key={item.title} className="shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-foreground">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold">{item.title}</h3>
                          <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
                          <Link href={item.href} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline">
                            {item.action}
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>

          <section className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">高频问题速览</h2>
              <p className="mt-2 text-sm text-muted-foreground">如果你只是想快速确认几个最常见的问题，先看这里即可。</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {quickQuestions.map((item) => (
                <Card key={item.question} className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">{item.question}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-sm leading-7 text-muted-foreground">
                    {item.answer}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">系统等级总览</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  下表展示当前系统全部等级与升级门槛。等级越高，通常意味着需要更多签到天数、发帖、回复和获赞积累。
                </p>
              </div>
              <div className="rounded-full border border-border bg-card px-4 py-2 text-xs text-muted-foreground">
                共 {levels.length} 个等级
              </div>
            </div>

            <Card className="overflow-hidden shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="bg-secondary/40 text-left text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">等级</th>
                        <th className="px-4 py-3">名称</th>
                        <th className="px-4 py-3">签到天数</th>
                        <th className="px-4 py-3">发帖数</th>
                        <th className="px-4 py-3">回复数</th>
                        <th className="px-4 py-3">获赞数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {levels.map((level, index) => (
                        <tr key={level.id} className="border-t border-border bg-card align-middle">
                          <td className="whitespace-nowrap px-4 py-3 font-semibold">Lv.{level.level}</td>
                          <td className="px-4 py-3">
                            <div className="flex min-w-[180px] items-center gap-3">
                              <span
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-lg"
                                style={{
                                  color: level.color,
                                  backgroundColor: `${level.color}14`,
                                  borderColor: `${level.color}33`,
                                }}
                              >
                                {level.icon || "⭐"}
                              </span>
                              <div className="min-w-0">
                                <div className="font-medium" style={{ color: level.color }}>{level.name}</div>
                                <div className="text-xs text-muted-foreground">{index === 0 ? "初始等级" : "满足以下条件后可升级"}</div>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{level.requireCheckInDays}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{level.requirePostCount}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{level.requireCommentCount}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{level.requireLikeCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="rounded-[32px] border border-border bg-muted/30 px-6 py-8 sm:px-8 lg:px-12 lg:py-10">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-semibold tracking-tight">FAQ 和帮助中心怎么分工？</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  简单来说：帮助中心负责“完整上手”，FAQ 负责“快速解答”和“专题解释”。如果你是第一次使用论坛，建议先看帮助中心；如果你已经知道自己卡在哪个点，直接从 FAQ 进入更快。
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/help" className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90">
                  去帮助中心
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/faq/post-heat" className="inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-3 text-sm font-medium transition-colors hover:bg-accent">
                  查看热度专题
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
