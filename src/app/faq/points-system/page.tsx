import { FaqPageFrame } from "@/components/faq-page-frame"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buildFaqMetadata } from "@/lib/faq"
import { getSiteSettings } from "@/lib/site-settings"

export async function generateMetadata() {
  return buildFaqMetadata("积分系统", "查看积分系统的来源、用途、价格和与权限的关系。")
}

export default async function PointsSystemFaqPage() {
  const settings = await getSiteSettings()
  const spendItems = [
    { label: "普通签到奖励", value: `${settings.checkInReward} ${settings.pointName}` },
    { label: "VIP1 / VIP2 / VIP3 签到", value: `${settings.checkInVip1Reward} / ${settings.checkInVip2Reward} / ${settings.checkInVip3Reward}` },
    { label: "普通 / VIP1 / VIP2 / VIP3 补签", value: `${settings.checkInMakeUpCardPrice} / ${settings.checkInVip1MakeUpCardPrice} / ${settings.checkInVip2MakeUpCardPrice} / ${settings.checkInVip3MakeUpCardPrice}` },
    { label: "普通 / VIP1 / VIP2 / VIP3 改昵称", value: `${settings.nicknameChangePointCost} / ${settings.nicknameChangeVip1PointCost} / ${settings.nicknameChangeVip2PointCost} / ${settings.nicknameChangeVip3PointCost}` },
    { label: "普通 / VIP1 / VIP2 / VIP3 邀请码", value: `${settings.inviteCodePrice} / ${settings.inviteCodeVip1Price} / ${settings.inviteCodeVip2Price} / ${settings.inviteCodeVip3Price}` },
    { label: "普通 / VIP1 / VIP2 / VIP3 下线帖子", value: `${settings.postOfflinePrice} / ${settings.postOfflineVip1Price} / ${settings.postOfflineVip2Price} / ${settings.postOfflineVip3Price}` },
  ]

  return (
    <FaqPageFrame
      currentPath="/faq/points-system"
      eyebrow="Points System"
      title={`${settings.pointName}系统`}
      description={`${settings.pointName} 是站内通用结算与门槛单位。它既可以决定你能不能看、能不能发，也会参与购买 VIP、邀请码、补签、改昵称、作者下线帖子等功能。`}
    >
      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="font-semibold">它能决定什么</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">节点、分区和帖子都可以配置最低浏览或发帖积分门槛，不满足时无法继续访问或互动。</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="font-semibold">它能购买什么</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">VIP、邀请码、补签、改昵称、作者下线帖子、付费隐藏内容，都可以直接用 {settings.pointName} 结算。</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="font-semibold">它能参与什么</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">悬赏帖会冻结 {settings.pointName}，打赏、红包、付费内容购买等功能也会产生日志变动。</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>常见获得方式</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[20px] bg-secondary/40 p-4 text-sm leading-7 text-muted-foreground">每日签到会直接发放奖励，VIP 用户按自己的 VIP 档位拿更高奖励。</div>
          <div className="rounded-[20px] bg-secondary/40 p-4 text-sm leading-7 text-muted-foreground">邀请注册成功后，邀请人和被邀请人都可以拿到后台配置的注册奖励。</div>
          <div className="rounded-[20px] bg-secondary/40 p-4 text-sm leading-7 text-muted-foreground">节点和分区可以独立配置“发帖积分”和“回复积分”，既可以奖励，也可以扣除。</div>
          <div className="rounded-[20px] bg-secondary/40 p-4 text-sm leading-7 text-muted-foreground">帖子被打赏、隐藏内容被购买、红包被触发时，也会产生对应的积分收入。</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>当前关键价格与奖励</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {spendItems.map((item) => (
            <div key={item.label} className="flex items-start justify-between gap-3 rounded-[20px] border border-border px-4 py-4">
              <p className="font-medium">{item.label}</p>
              <p className="text-sm text-muted-foreground">{item.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>和其它系统的关系</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm leading-7 text-muted-foreground md:grid-cols-3">
          <div className="rounded-[20px] bg-secondary/40 p-4">和等级不同，{settings.pointName} 更偏即时结算与消费能力；等级更偏长期成长门槛。</div>
          <div className="rounded-[20px] bg-secondary/40 p-4">{settings.pointName} 会直接影响 VIP 购买、邀请码购买、补签和改昵称这些付费型功能。</div>
          <div className="rounded-[20px] bg-secondary/40 p-4">如果想追踪每一笔变化，可以到个人设置里的“{settings.pointName}记录”查看完整明细。</div>
        </CardContent>
      </Card>
    </FaqPageFrame>
  )
}
