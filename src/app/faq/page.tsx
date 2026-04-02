import Link from "next/link"
import { ArrowRight, BadgeCheck, Crown, Flame, ShieldCheck, Sparkles } from "lucide-react"

import { FaqPageFrame } from "@/components/faq-page-frame"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FAQ_TABS, buildFaqMetadata } from "@/lib/faq"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata() {
  return buildFaqMetadata("系统功能 FAQ", "快速理解论坛里的等级、勋章、热度、积分、认证与社交功能。")
}

export default async function FaqPage() {
  const settings = await getSiteSettings()
  const topicTabs = FAQ_TABS.filter((tab) => tab.href !== "/faq")

  return (
    <FaqPageFrame
      currentPath="/faq"
      eyebrow="System Guide"
      title="系统功能 FAQ"
      description="快速理解论坛里的等级、勋章、热度、积分、认证与社交功能。"
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {topicTabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className="group rounded-[28px] border border-border bg-card p-5 transition-colors hover:bg-accent/40">
            <p className="text-lg font-semibold text-foreground">{tab.label}</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{tab.description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground">
              进入专题
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        {[
          {
            title: "访问与权限",
            description: `节点、分区和帖子都可以设置 ${settings.pointName}、等级或 VIP 门槛。`,
            icon: ShieldCheck,
          },
          {
            title: "成长与身份",
            description: "等级和勋章负责长期成长、身份展示与社区成就识别。",
            icon: Sparkles,
          },
          {
            title: "互动与热度",
            description: "帖子热度会综合浏览、回复、点赞与打赏表现实时变化。",
            icon: Flame,
          },
          {
            title: "权益与社交",
            description: "认证、关注、拉黑决定身份展示、关系管理和互动边界。",
            icon: Crown,
          },
        ].map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.title}>
              <CardContent className="p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>建议阅读顺序</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[ 
              { step: "1", title: "先看积分与认证", description: `先理解 ${settings.pointName} 的作用和认证展示机制，再看其它规则会更顺。` },
              { step: "2", title: "再看等级与勋章", description: "这两套决定长期成长、可见身份和成就积累。" },
              { step: "3", title: "再看帖子热度", description: "适合作者、版主和运营理解帖子为什么会变热。" },
              { step: "4", title: "最后看关注与拉黑", description: "把日常使用里的关系管理和互动边界补齐。" },
            ].map((item) => (
              <div key={item.step} className="rounded-[22px] bg-secondary/50 p-4">
                <p className="text-xs font-medium text-muted-foreground">步骤 {item.step}</p>
                <p className="mt-2 font-semibold">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>你会在 FAQ 里看到什么</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
            <div className="flex gap-3">
              <BadgeCheck className="mt-1 h-4 w-4 text-emerald-500" />
              <p>本社区的各个系统模块的功能介绍</p>
            </div>
            <div className="flex gap-3">
              <BadgeCheck className="mt-1 h-4 w-4 text-emerald-500" />
              <p>同一个功能会写清楚“是什么、怎么触发、有什么影响”。</p>
            </div>
            <div className="flex gap-3">
              <BadgeCheck className="mt-1 h-4 w-4 text-emerald-500" />
              <p>如果某些数值来自后台配置，FAQ 会直接展示当前站点实际值。</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </FaqPageFrame>
  )
}
