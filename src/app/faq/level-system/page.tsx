import { LevelIcon } from "@/components/level-icon"
import { FaqPageFrame } from "@/components/faq-page-frame"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buildFaqMetadata } from "@/lib/faq"
import { getLevelDefinitions } from "@/lib/level-system"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata() {
  return buildFaqMetadata("等级系统", "查看等级系统的成长条件、升级逻辑和全部等级定义。")
}

export default async function LevelSystemFaqPage() {
  const [levels, settings] = await Promise.all([getLevelDefinitions(), getSiteSettings()])

  return (
    <FaqPageFrame
      currentPath="/faq/level-system"
      eyebrow="Level System"
      title="等级系统"
      description={`等级是社区长期成长体系，核心依据是签到、发帖、回复和获赞。它和 ${settings.pointName} 不是一回事，更多承担“资格门槛”和“成长身份”的作用。`}
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { title: "签到天数", description: "签到会累计成长进度，决定长期活跃度。" },
          { title: "发帖数量", description: "公开发帖数量会计入等级升级条件。" },
          { title: "回复数量", description: "参与讨论的回复总数会推动等级成长。" },
          { title: "获赞数量", description: "收到的点赞总数也会参与等级判断。" },
        ].map((item) => (
          <Card key={item.title}>
            <CardContent className="p-5">
              <p className="text-base font-semibold">{item.title}</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>当前站点等级表</CardTitle>
        </CardHeader>
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
                      <div className="flex min-w-[190px] items-center gap-3">
                        <span
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-lg"
                          style={{
                            color: level.color,
                            backgroundColor: `${level.color}14`,
                            borderColor: `${level.color}33`,
                          }}
                        >
                          <LevelIcon icon={level.icon} color={level.color} className="h-5 w-5 text-[18px]" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium" style={{ color: level.color }}>{level.name}</div>
                          <div className="text-xs text-muted-foreground">{index === 0 ? "初始等级" : "满足全部条件后自动升级"}</div>
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

      <Card>
        <CardHeader>
          <CardTitle>等级的实际用途</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm leading-7 text-muted-foreground md:grid-cols-3">
          <div className="rounded-[20px] bg-secondary/40 p-4">节点、分区和帖子可以单独配置最低等级门槛，未达到时将无法浏览或发帖。</div>
          <div className="rounded-[20px] bg-secondary/40 p-4">勋章系统可以直接把“等级”作为领取规则之一，成长和身份会互相联动。</div>
          <div className="rounded-[20px] bg-secondary/40 p-4">等级在用户资料、评论区和系统展示中都会出现，是社区长期活跃度的核心标识。</div>
        </CardContent>
      </Card>
    </FaqPageFrame>
  )
}
