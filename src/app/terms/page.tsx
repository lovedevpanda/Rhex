import type { Metadata } from "next"
import Link from "next/link"
import { BookCheck, Crown, FileText, MessageSquareText, Scale, ShieldAlert } from "lucide-react"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { HomeSidebarPanels } from "@/components/home/home-sidebar-panels"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { getBoards } from "@/lib/boards"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones } from "@/lib/zones"
import { getHomeAnnouncements } from "@/lib/announcements"

const highlights = [
  {
    icon: BookCheck,
    title: "社区规则优先",
    description: "协议用于明确论坛秩序、使用边界与处理原则，所有账户和内容活动都默认受其约束。",
  },
  {
    icon: ShieldAlert,
    title: "内容责任明确",
    description: "用户需要对自己发布、评论、上传、引用与传播的内容负责，平台会对违规内容进行处理。",
  },
  {
    icon: Scale,
    title: "管理措施公开",
    description: "禁言、拉黑、审核、下线、小黑屋展示等处理机制都属于社区治理的一部分。",
  },
]

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `论坛协议 - ${settings.siteName}`,
    description: `查看 ${settings.siteName} 的社区使用协议、内容规范、账户责任与处理规则。`,
    openGraph: {
      title: `论坛协议 - ${settings.siteName}`,
      description: settings.siteDescription,
      type: "website",
    },
  }
}

export default async function TermsPage() {
  const settingsPromise = getSiteSettings()
  const [settings, boards, zones, currentUser, hotTopics, announcements] = await Promise.all([
    settingsPromise,
    getBoards(),
    getZones(),
    getCurrentUser(),
    settingsPromise.then((settings) => getHomeSidebarHotTopics(settings.homeSidebarHotTopicsCount)),
    getHomeAnnouncements(3)
  ])
  const sidebarUser = await resolveSidebarUser(currentUser, settings)

  const sections = [
    {
      id: "general",
      title: "一、协议适用范围",
      content: [
        `${settings.siteName} 是一个围绕兴趣讨论、内容沉淀与社区互动建立的论坛系统。无论用户通过首页、分区、节点、搜索、邀请链接还是第三方分享链接进入，只要继续浏览、注册、登录、发帖、评论、点赞、收藏、上传、举报或使用其他功能，即视为已阅读并接受本协议。`,
        "本协议适用于全部公开页面、注册账户、站内互动、用户生成内容，以及后续新增但未单独立约的社区功能。若站点另有单独页面对某项能力作出补充说明，则该说明与本协议共同构成完整规则。",
      ],
    },
    {
      id: "account",
      title: "二、账户注册与使用",
      content: [
        "站点可根据运营策略调整是否开放注册，也可能要求邀请码、邀请关系或其他前置条件。注册链接若自动带入邀请人或邀请码，系统可据此建立注册来源关系。",
        "用户应保证注册、登录与资料维护过程中提供的信息真实、可归属、可负责，不得冒用他人身份、伪造关系、批量注册、绕过限制或利用漏洞获取不当权益。",
        "账户仅限本人使用。若因共享账户、借用身份、泄露登录状态或其他个人保管不当导致损失、封禁、内容追责或权益异常，责任由账户实际控制人承担。",
      ],
    },
    {
      id: "content",
      title: "三、内容发布与互动规范",
      content: [
        "用户发布的帖子、评论、回复、投票、悬赏内容、附言、隐藏内容、图片与其他资料，均应符合基本法律法规、平台规则及公序良俗，不得发布违法、侵权、骚扰、侮辱、恶意引战、虚假欺诈、恶意营销或其他破坏社区秩序的内容。",
        "不同节点可独立配置浏览、发帖、回复权限，以及允许的帖子类型、发帖频率、审核要求、等级门槛、积分门槛与 VIP 条件。用户进入某节点并尝试发帖或互动时，应主动遵守该节点实时生效的规则。",
        "站内的点赞、评论、举报、收藏、搜索、回复、采纳答案等功能，应当以正常交流和信息沉淀为目的，不得用于刷量、骚扰、恶意攻击、引战或规避审核。",
      ],
    },
    {
      id: "moderation",
      title: "四、审核、下线与管理处置",
      content: [
        "平台有权根据内容安全规则、节点配置、举报结果或人工判断，对帖子、评论、用户资料与其他公开信息进行审核、延迟发布、隐藏、驳回、下线、限制传播或进一步处理。",
        "若账户或内容违反社区规范，平台可视情况采取提醒、拒绝发布、撤销展示、限制功能、禁言、拉黑、公开进入“小黑屋”等措施。上述措施可按行为严重程度、重复违规情况和社区影响综合判断。",
        "小黑屋、状态徽标、公开不可见提示等页面或模块，属于平台治理透明化的一部分。平台会在合理范围内展示必要的状态结果，但不承诺公开全部后台证据、处理细节或管理流程。",
      ],
    },
    {
      id: "growth",
      title: "五、积分、等级、勋章与 VIP",
      content: [
        `${settings.pointName}、等级、勋章与 VIP 均属于社区成长与权限体系的一部分。它们的获取方式、扣减方式、解锁条件与展示效果，均以后台当前配置与页面说明为准。`,
        `${settings.pointName} 可能用于签到奖励、发帖成本、悬赏冻结、VIP 开通、兑换或后续扩展功能。平台保留在不违反已承诺权益前提下，对成长规则、权重、价格、奖励与可见条件进行调整的权利。`,
        "勋章、等级与 VIP 徽标更多用于身份展示、成长记录和部分权限控制，不构成现实财产权、永久资格或不可撤销权益。若用户存在违规行为，平台有权限制、回收或调整相关展示与使用状态。",
      ],
    },
    {
      id: "privacy",
      title: "六、资料上传与隐私边界",
      content: [
        "用户上传头像、图片和其他素材时，应保证拥有相应权利或合法使用基础，不得上传违法、侵权、违规、恶意或可能危害平台运行安全的文件。",
        "平台会在账号系统、内容展示、审核管理、风控识别和功能实现所必需的范围内处理站内数据。对于昵称、头像、公开资料、发帖记录、互动行为与状态信息，用户应知晓这些内容可能在前台公开展示。",
        "对于仅用于功能实现、审核排查、风控或日志记录的数据，平台会按系统需要进行最小化处理；但用户仍应理解，任何公开发布到论坛的信息都天然存在被其他用户读取、引用或传播的可能。",
      ],
    },
    {
      id: "rights",
      title: "七、平台权利与责任边界",
      content: [
        "平台会尽力维持社区正常运行，但不对任何特定内容、互动结果、搜索可见性、成长效率、历史记录永久保留、第三方访问稳定性或特定功能持续开放作出绝对承诺。",
        "出于维护秩序、系统升级、安全修复、数据迁移、策略调整或其他合理运营目的，平台可中断、暂停、限制、下线或修改部分功能与页面，并在必要时更新相关规则内容。",
        "对于用户之间因发言、引用、转载、交易、误导、纠纷或线下接触而产生的争议，平台可在社区规则范围内进行必要管理，但不当然承担一切连带责任。",
      ],
    },
    {
      id: "update",
      title: "八、协议更新与继续使用",
      content: [
        "平台可根据社区运营需要对本协议进行更新。更新后的协议一经在站内公开，即对后续使用行为生效。",
        "若用户在协议更新后继续访问、登录、浏览、发帖、评论、上传、互动或使用任何相关功能，视为同意更新后的内容；若不同意，应停止继续使用相关服务。",
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1">
        <AddonSlotRenderer slot="terms.page.before" />
        <AddonSurfaceRenderer surface="terms.page" props={{ sections, settings }}>
        <ForumPageShell
          zones={zones}
          boards={boards}
          main={(
            <main className="py-1 pb-12 mt-6">
              <div className="space-y-6">
          <AddonSlotRenderer slot="terms.hero.before" />
          <AddonSurfaceRenderer surface="terms.hero" props={{ settings }}>
          <section className="rounded-[28px] border border-border bg-card px-5 py-6 shadow-xs sm:px-7 sm:py-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                  Terms of Service
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {settings.siteName} 论坛使用协议
                </h1>
        
              </div>


            </div>
          </section>
          </AddonSurfaceRenderer>
          <AddonSlotRenderer slot="terms.hero.after" />

          <AddonSlotRenderer slot="terms.content.before" />
          <AddonSurfaceRenderer surface="terms.content" props={{ highlights, sections, settings }}>
          <>
          <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {highlights.map((item) => {
              const Icon = item.icon
              return (
                <Card key={item.title} className="shadow-xs">
                  <CardContent className="p-4">
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

          <section className="rounded-[24px] border border-border bg-card p-4 shadow-xs">
            <div className="flex flex-wrap gap-2.5">
              {sections.map((section) => (
                <a key={section.id} href={`#${section.id}`} className="inline-flex items-center gap-2 rounded-full border border-transparent bg-transparent px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-border/70 hover:bg-accent hover:text-foreground">
                  <FileText className="h-4 w-4" />
                  {section.title}
                </a>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            {sections.map((section) => (
              <Card key={section.id} id={section.id} className="shadow-xs">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-foreground">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
                      <ul className="mt-4 space-y-2.5 text-sm leading-7 text-muted-foreground sm:text-[15px]">
                        {section.content.map((paragraph) => (
                          <li key={paragraph} className="flex gap-2">
                            <span className="mt-[0.7rem] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/45" />
                            <span>{paragraph}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card className="shadow-xs">
              <CardContent className="p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-foreground">
                  <MessageSquareText className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-xl font-semibold">和帮助中心的关系</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  协议页面负责明确边界、责任与管理原则；帮助中心负责说明功能如何使用；FAQ 负责快速问答和专题规则。三者共同构成完整的社区文档体系。
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/help" className="inline-flex rounded-full border border-border bg-background px-4 py-2 text-sm transition-colors hover:bg-accent">帮助中心</Link>
                  <Link href="/faq" className="inline-flex rounded-full border border-border bg-background px-4 py-2 text-sm transition-colors hover:bg-accent">FAQ</Link>
                  <Link href="/prison" className="inline-flex rounded-full border border-border bg-background px-4 py-2 text-sm transition-colors hover:bg-accent">小黑屋</Link>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardContent className="p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-foreground">
                  <Crown className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-xl font-semibold">继续使用即视为同意</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  若你继续注册、登录、浏览、发帖、评论、上传资料、参与互动或使用站内成长体系，即表示你接受当前公开展示的协议条款及其后续更新版本。
                </p>
                <div className="mt-4 rounded-[22px] border border-dashed border-border bg-background px-4 py-4 text-sm leading-7 text-muted-foreground">
                  如果你不同意本协议的任何部分，请停止继续使用相关服务与功能。
                </div>
              </CardContent>
            </Card>
          </section>
          </>
          </AddonSurfaceRenderer>
          <AddonSlotRenderer slot="terms.content.after" />

              </div>
            </main>
          )}
          rightSidebar={(
            <aside className="mt-6 hidden pb-12 lg:block">
              <AddonSlotRenderer slot="terms.sidebar.before" />
              <AddonSurfaceRenderer surface="terms.sidebar" props={{ announcements, hotTopics, settings }}>
                <HomeSidebarPanels user={sidebarUser} hotTopics={hotTopics} announcements={announcements}
                  showAnnouncements={settings.homeSidebarAnnouncementsEnabled} siteName={settings.siteName} siteDescription={settings.siteDescription} siteLogoPath={settings.siteLogoPath} siteIconPath={settings.siteIconPath} />
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="terms.sidebar.after" />
            </aside>
          )}
        />
        </AddonSurfaceRenderer>
        <AddonSlotRenderer slot="terms.page.after" />
      </div>
    </div>
  )
}
