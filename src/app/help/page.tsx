import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BookOpen, CheckCircle2, Crown, Gem, HelpCircle, MessageSquareText, PenSquare, Search, ShieldCheck, Sparkles, Star, UserPlus } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { LevelIcon } from "@/components/level-icon"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { getFeaturedBoards } from "@/lib/boards"
import { getSiteSettings } from "@/lib/site-settings"

const quickNav = [
  { href: "#getting-started", label: "新手入门", icon: UserPlus },
  { href: "#posting", label: "发帖与互动", icon: PenSquare },
  { href: "#growth", label: "成长与权益", icon: Sparkles },
  { href: "#account", label: "账户与资料", icon: ShieldCheck },
  { href: "#faq", label: "常见问题", icon: HelpCircle },
]

const accountSections = [
  {
    icon: UserPlus,
    title: "注册与登录",
    items: [
      "站点可根据后台设置决定是否开放注册，也可能要求邀请码后才能完成注册。",
      "如果注册链接带有邀请人或邀请码，页面会自动带入，注册时无需重复填写。",
      "登录后才能发帖、回复、查看积分明细，以及使用更多社区功能。",
    ],
  },
  {
    icon: Search,
    title: "浏览与搜索",
    items: [
      "你可以通过首页、分区页、节点页快速浏览公开内容，也可以在顶部搜索框按标题、摘要、作者、节点名称进行检索。",
      "分区页会聚合同一分区下的全部节点内容；进入节点页后，可以继续按节点查看更垂直的话题。",
      "页面中的节点名、作者名、评论数等都支持直接跳转，帮助你更快在内容之间穿梭。",
    ],
  },
  {
    icon: MessageSquareText,
    title: "互动与反馈",
    items: [
      "你可以在帖子详情页进行点赞、评论、举报、回复，以及围绕楼层继续展开讨论。",
      "若帖子启用了悬赏、回复可见或作者可见等功能，页面会明确提示解锁条件与查看范围。",
      "管理员或版主会依据社区规则处理举报、隐藏违规内容或限制异常账户。",
    ],
  },
]

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `帮助中心 - ${settings.siteName}`,
    description: `了解 ${settings.siteName} 的注册、发帖、成长、积分、VIP 与常见使用问题。`,
    openGraph: {
      title: `帮助中心 - ${settings.siteName}`,
      description: settings.siteDescription,
      type: "website",
    },
  }
}

export default async function HelpPage() {
  const [settings, featuredBoards] = await Promise.all([getSiteSettings(), getFeaturedBoards(8)])

  const postingRules = [
    "发帖前先选择合适节点。不同节点可能配置了等级、积分或 VIP 发帖门槛。",
    "系统支持普通帖、悬赏帖、投票帖等类型，具体可发类型会随节点配置变化。",
    "帖子发布后，部分节点可能需要审核；也可能存在最短发帖间隔、等级限制或特殊查看条件。",
    "评论区支持点赞、回复、举报；如果是悬赏帖，作者还可以在评论中采纳最佳答案。",
  ]

  const growthItems = [
    {
      icon: Gem,
      title: `${settings.pointName}与签到`,
      description: `登录后可以查看 ${settings.pointName} 明细、余额与来源。若站点开启签到，每日签到可获得固定奖励。`,
      href: "/points",
      action: `查看${settings.pointName}`,
    },
    {
      icon: Star,
      title: "勋章与成就",
      description: "勋章会围绕发帖、回复、获赞、邀请、VIP、签到等行为逐步解锁，部分勋章需要手动领取。",
      href: "/badges",
      action: "查看勋章中心",
    },
    {
      icon: Sparkles,
      title: "等级成长",
      description: "等级由发帖、回复、获赞、签到等多维度共同决定，成长页会明确告诉你离下一等级还差什么。",
      href: "/level",
      action: "查看我的等级",
    },
    {
      icon: Crown,
      title: "VIP 权益",
      description: `VIP 可用于访问更高门槛节点与内容，也会在前台展示身份标识。当前支持使用 ${settings.pointName} 开通或续费。`,
      href: "/vip",
      action: "查看 VIP 说明",
    },
  ]

  const faqItems = [
    {
      question: "为什么我看不到某些分区、节点或帖子？",
      answer: `这通常是因为目标内容配置了等级、${settings.pointName}、VIP 或登录可见门槛。你可以先查看自己的等级、VIP 状态和 ${settings.pointName} 余额。`,
    },
    {
      question: "为什么我不能发帖或回复？",
      answer: "不同节点可以独立配置发帖/回复权限、发帖间隔、允许的帖子类型，以及是否需要审核。请先确认你当前进入的是正确节点。",
    },
    {
      question: "邀请码、邀请关系和注册限制是怎么工作的？",
      answer: "站点可以选择是否开放公开注册、是否需要邀请码、是否启用邀请奖励。若注册链接已附带邀请人或邀请码，系统会自动识别。",
    },
    {
      question: `我的 ${settings.pointName} 有什么用？`,
      answer: `${settings.pointName} 可用于成长体系、VIP 开通、站内兑换或其他后续扩展功能。具体规则请以 ${settings.pointName} 明细页和相关页面说明为准。`,
    },
    {
      question: "如果遇到违规内容怎么办？",
      answer: "你可以在帖子或评论处使用举报入口。管理员和版主会根据规则进行审核、驳回、下线或进一步处理。",
    },
    {
      question: "发出去的帖子还能修改吗？",
      answer: "帖子是否能修改、可修改多久，取决于系统当前策略。若已超过编辑窗口，部分内容可能需要通过追加附言的方式补充说明。",
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
                  Help Center
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                  一页看懂 {settings.siteName} 怎么注册、发帖、成长与互动。
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  这份帮助中心基于当前论坛已经上线的功能整理而成，目的是让新用户更快上手，也让老用户在遇到权限、积分、发帖和成长问题时能快速找到答案。
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90">
                  现在注册
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/funs" className="inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-3 text-sm font-medium transition-colors hover:bg-accent">
                  浏览全部节点
                </Link>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap gap-2.5">
              {quickNav.map((item) => {
                const Icon = item.icon
                return (
                  <a key={item.href} href={item.href} className="inline-flex items-center gap-2 rounded-full border border-transparent bg-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-border/70 hover:bg-accent hover:text-foreground">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </a>
                )
              })}
            </div>
          </section>

          <section id="getting-started" className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">新手第一次来到这里，建议怎么开始？</CardTitle>
                <p className="text-sm leading-7 text-muted-foreground">
                  如果你是第一次接触这个论坛，可以先按下面这条顺序走，基本不会迷路。
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {accountSections.map((section) => {
                  const Icon = section.icon
                  return (
                    <div key={section.title} className="rounded-[24px] border border-border bg-background p-5">
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-foreground">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{section.title}</h3>
                          <ul className="mt-3 space-y-2 text-sm leading-7 text-muted-foreground">
                            {section.items.map((item) => (
                              <li key={item} className="flex gap-2">
                                <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/50" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">推荐先逛这些节点</CardTitle>
                <p className="text-sm leading-7 text-muted-foreground">
                  下面这些是当前站点中的部分兴趣节点，适合先快速感受社区话题范围与内容风格。
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {featuredBoards.map((board) => (
                  <Link key={board.id} href={`/boards/${board.slug}`} className="flex items-center gap-3 rounded-[20px] border border-border bg-background px-4 py-3 transition-colors hover:bg-accent">
                    <LevelIcon icon={board.icon} className="h-5 w-5 text-xl leading-none" svgClassName="[&>svg]:block" />
                    <div className="min-w-0">

                      <div className="truncate text-sm font-medium">{board.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{board.count} 篇帖子</div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </section>

          <section id="posting" className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">发帖与互动指南</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
                {postingRules.map((item) => (
                  <div key={item} className="rounded-[22px] border border-border bg-background px-4 py-4">
                    <div className="flex gap-3">
                      <CheckCircle2 className="mt-1 h-4.5 w-4.5 shrink-0 text-emerald-600" />
                      <p>{item}</p>
                    </div>
                  </div>
                ))}
                <div className="rounded-[22px] border border-dashed border-border bg-background px-4 py-4 text-foreground">
                  <div className="text-sm font-medium">相关入口</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href="/write" className="inline-flex rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent">发布帖子</Link>
                    <Link href="/search" className="inline-flex rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent">搜索内容</Link>
                    <Link href="/funs" className="inline-flex rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent">查看全部节点</Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">发布前你最好知道的事</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <TipCard title="先选对节点" description="节点决定了你会被谁看到，也决定了你是否满足发帖权限与帖子类型限制。" icon={<BookOpen className="h-5 w-5" />} />
                <TipCard title="看清权限提示" description={`部分节点会限制浏览、发帖或回复，需要登录、等级、${settings.pointName} 或 VIP 达标。`} icon={<ShieldCheck className="h-5 w-5" />} />
                <TipCard title="善用搜索" description="发布前先搜索已有讨论，避免重复话题，也更方便你找到现成经验。" icon={<Search className="h-5 w-5" />} />
                <TipCard title="举报而不是争吵" description="遇到违规内容时优先使用举报入口，社区管理会根据规则处理。" icon={<HelpCircle className="h-5 w-5" />} />
              </CardContent>
            </Card>
          </section>

          <section id="growth" className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">成长、权益与长期参与</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                如果你准备长期使用这套论坛，下面这些机制最值得先了解清楚。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {growthItems.map((item) => {
                const Icon = item.icon
                return (
                  <Card key={item.title} className="shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 font-semibold">{item.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
                      <Link href={item.href} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline">
                        {item.action}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>

          <section id="account" className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">账户与资料维护</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
                <p>登录后，你可以在个人资料页与设置页维护头像、昵称、简介，以及与注册方式相关的账户信息。</p>
                <p>右侧用户信息面板会集中展示你当前的主题收藏、发表内容、获赞、等级、VIP 与 {settings.pointName} 状态，方便你快速判断自己的社区成长进度。</p>
                <p>如果你的账户状态发生变化，例如被禁言、封禁或受到某些内容限制，页面也会通过状态徽标与提示信息明确标识。</p>
                <div className="rounded-[22px] border border-border bg-background px-4 py-4 text-foreground">
                  <div className="text-sm font-medium">建议</div>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">完成头像、昵称和基础资料后，再去挑选几个感兴趣的节点长期参与，这样你更容易获得持续的互动反馈。</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">常用页面入口</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <QuickLink href="/settings" title="账户设置" description="维护头像、昵称、个人简介和账户资料。" />
                <QuickLink href="/points" title={`${settings.pointName}明细`} description={`查看余额、变动记录、签到奖励与兑换相关信息。`} />
                <QuickLink href="/level" title="等级成长" description="查看当前等级、成长快照与升级条件。" />
                <QuickLink href="/badges" title="勋章中心" description="查看可获得的勋章、解锁条件与领取进度。" />
              </CardContent>
            </Card>
          </section>

          <section id="faq" className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">常见问题</h2>
              <p className="mt-2 text-sm text-muted-foreground">如果你只是想快速确认一个问题，先看这里通常就够了。</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {faqItems.map((item) => (
                <Card key={item.question} className="shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-base font-semibold">{item.question}</h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="rounded-[32px] border border-border bg-muted/30 px-6 py-8 sm:px-8 lg:px-12 lg:py-10">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-semibold tracking-tight">还没开始？建议从这三步开始</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  先注册账户，再挑一个你真正感兴趣的节点浏览几篇帖子，最后尝试发一个具体的问题或经验分享。这样你会最快进入这套社区的正确节奏。
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90">
                  注册账号
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/faq" className="inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-3 text-sm font-medium transition-colors hover:bg-accent">
                  查看 FAQ
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

function TipCard({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border border-border bg-background p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-foreground">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p>
    </div>
  )
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-[22px] border border-border bg-background p-4 transition-colors hover:bg-accent/40">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{title}</p>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </Link>
  )
}
