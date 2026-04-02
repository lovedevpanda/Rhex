import { FaqPageFrame } from "@/components/faq-page-frame"
import { LevelIcon } from "@/components/level-icon"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { describeBadgeRules, getAllBadges } from "@/lib/badges"
import { buildFaqMetadata } from "@/lib/faq"

export async function generateMetadata() {
  return buildFaqMetadata("勋章系统", "查看勋章系统的领取规则、展示机制与当前启用勋章。")
}

export default async function BadgeSystemFaqPage() {
  const enabledBadges = (await getAllBadges()).filter((badge) => badge.status).sort((left, right) => left.sortOrder - right.sortOrder)
  const categories = Array.from(
    enabledBadges.reduce((map, badge) => {
      const key = badge.category?.trim() || "未分类"
      map.set(key, (map.get(key) ?? 0) + 1)
      return map
    }, new Map<string, number>()),
  )

  const supportedRules = [
    "注册天数",
    "注册时间范围",
    "发帖数",
    "回复数",
    "获赞数",
    "邀请人数",
    "指定 UID",
    "等级",
    "签到天数",
    "VIP 等级",
  ]

  return (
    <FaqPageFrame
      currentPath="/faq/badge-system"
      eyebrow="Badge System"
      title="勋章系统"
      description="勋章负责把用户的长期成就、特殊身份和活动参与经历展示出来。当前系统支持按规则判定资格、手动领取，以及前台佩戴展示。"
    >
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5 text-sm leading-7 text-muted-foreground">
            <p className="font-semibold text-foreground">领取方式</p>
            <p className="mt-2">达成规则后，用户需要到勋章中心手动领取，不是自动直接佩戴。</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-sm leading-7 text-muted-foreground">
            <p className="font-semibold text-foreground">展示方式</p>
            <p className="mt-2">领取后的勋章可单独控制是否展示，评论区和资料页会读取已展示勋章。</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-sm leading-7 text-muted-foreground">
            <p className="font-semibold text-foreground">规则来源</p>
            <p className="mt-2">后台可以按成长、签到、邀请、等级、VIP 等多种维度组合出领取门槛。</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>当前勋章分类</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {categories.length > 0 ? categories.map(([category, count]) => (
            <div key={category} className="rounded-[20px] bg-secondary/50 p-4">
              <p className="text-xs text-muted-foreground">{category}</p>
              <p className="mt-2 text-2xl font-semibold">{count}</p>
              <p className="mt-1 text-sm text-muted-foreground">当前分类下已启用勋章</p>
            </div>
          )) : <p className="text-sm text-muted-foreground">当前还没有启用的勋章。</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>支持的领取条件</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {supportedRules.map((rule) => (
            <span key={rule} className="rounded-full bg-secondary px-3 py-1.5 text-sm text-secondary-foreground">
              {rule}
            </span>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>当前启用勋章</CardTitle>
        </CardHeader>
        <CardContent>
          {enabledBadges.length === 0 ? (
            <p className="text-sm text-muted-foreground">当前没有已启用的勋章。</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {enabledBadges.map((badge) => (
                <div key={badge.id} className="rounded-[24px] border border-border bg-card p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ backgroundColor: `${badge.color}18`, color: badge.color }}>
                      <LevelIcon icon={badge.iconText ?? "🏅"} color={badge.color} className="h-6 w-6 text-[22px]" emojiClassName="text-inherit" svgClassName="[&>svg]:block" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold">{badge.name}</p>
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground">{badge.category || "未分类"}</span>
                      </div>
                      {badge.description ? <p className="mt-2 text-sm leading-7 text-muted-foreground">{badge.description}</p> : null}
                      <div className="mt-3 rounded-[18px] bg-secondary/40 p-3">
                        <p className="text-xs font-medium text-foreground">领取条件</p>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">{describeBadgeRules(badge.rules)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </FaqPageFrame>
  )
}
