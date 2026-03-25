import Link from "next/link"
import { Crown, ShieldCheck } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { VipActionPanel } from "@/components/vip-action-panel"
import { VipBadge } from "@/components/vip-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { getSiteSettings } from "@/lib/site-settings"
import { getVipLevel, isVipActive } from "@/lib/vip-status"


const vipMilestones = (pointName: string) => [
  { level: 1, title: "VIP 1", requirement: `使用${pointName}购买月卡`, privilege: "可访问 VIP 专属节点与帖子" },
  { level: 2, title: "VIP 2", requirement: `使用${pointName}购买季卡`, privilege: "可扩展更高等级节点 / 活动资格" },
  { level: 3, title: "VIP 3", requirement: `使用${pointName}购买年卡`, privilege: "可扩展专属身份样式与高级权益" },
]



export default async function VipPage() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSiteSettings()])
  const vipUser = user
    ? {
        vipLevel: (user as { vipLevel?: number | null }).vipLevel ?? 0,
        vipExpiresAt: (user as { vipExpiresAt?: string | Date | null }).vipExpiresAt ?? null,
      }
    : null
  const profileName = user ? ((user as { nickname?: string | null; username?: string }).nickname ?? (user as { username?: string }).username ?? "用户") : "用户"
  const currentLevel = getVipLevel(vipUser)
  const vipActive = isVipActive(vipUser)
  const milestones = vipMilestones(settings.pointName)



  return (

    <div className="min-h-screen ">
      <SiteHeader />
      <main className="mx-auto max-w-[1000px] px-4 py-8 lg:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="overflow-hidden border-none bg-gradient-to-r from-violet-700 via-fuchsia-700 to-purple-700 text-white shadow-soft">
            <CardContent className="p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                  <Crown className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-white/70">会员成长体系</p>
                  <h1 className="mt-1 text-3xl font-semibold">超级VIP</h1>
                </div>
              </div>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/80">VIP 体系用于控制部分节点、帖子和回复权限，同时也在前台通过紫色昵称与徽章进行身份展示。当前版本已支持后台定价配置，以及前台使用{settings.pointName}购买 / 续费 VIP。</p>

              {user ? (
                <div className="mt-6 rounded-[24px] bg-white/10 p-5">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-white/70">你的当前状态</span>
                    {vipActive ? <VipBadge level={currentLevel} /> : null}


                  </div>
                  <p className="mt-3 text-xl font-semibold">{profileName}</p>
                  <p className="mt-1 text-sm text-white/75">{vipActive ? `你当前已开通 VIP${currentLevel}，可进入受限内容区域。` : `你当前还不是 VIP，可直接在下方使用${settings.pointName}购买开通。`}</p>


                  <p className="mt-2 text-sm text-white/75">到期时间：{vipUser?.vipExpiresAt ? new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(vipUser.vipExpiresAt)) : "长期有效 / 暂未设置"}</p>

                </div>
              ) : (
                <div className="mt-6 flex gap-3">
                  <Link href="/login">
                    <Button className="bg-white text-violet-700 hover:bg-white/90">登录查看我的 VIP</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>当前权益</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
              <div className="flex gap-3 rounded-[24px] border border-border px-4 py-4 dark:bg-secondary/20">
                <ShieldCheck className="mt-1 h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                <p>访问 VIP 专属节点、帖子与回复区域，获得更完整的社区内容访问权限。</p>
              </div>
              <div className="flex gap-3 rounded-[24px] border border-border px-4 py-4 dark:bg-secondary/20">
                <ShieldCheck className="mt-1 h-5 w-5 text-violet-600 dark:text-violet-300" />
                <p>前台昵称高亮显示，并展示对应 VIP 徽章，方便在讨论区快速识别身份。</p>
              </div>
              <div className="flex gap-3 rounded-[24px] border border-border px-4 py-4 dark:bg-secondary/20">
                <ShieldCheck className="mt-1 h-5 w-5 text-fuchsia-600 dark:text-fuchsia-300" />
                <p>可按月卡、季卡、年卡套餐持续续费，维持当前 VIP 身份与对应权限。</p>
              </div>

            </CardContent>
          </Card>
        </div>

        {user ? <VipActionPanel vipMonthlyPrice={settings.vipMonthlyPrice} vipQuarterlyPrice={settings.vipQuarterlyPrice} vipYearlyPrice={settings.vipYearlyPrice} pointName={settings.pointName} userPoints={user.points} vipExpiresAt={(vipUser?.vipExpiresAt as string | Date | null | undefined)?.toString?.() ?? null} /> : null}






        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {milestones.map((item) => (

            <Card key={item.level}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base font-semibold">{item.title}</p>
                  <VipBadge level={item.level} compact />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">成长方式：{item.requirement}</p>
                <p className="mt-2 text-sm text-muted-foreground">权益说明：{item.privilege}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}

