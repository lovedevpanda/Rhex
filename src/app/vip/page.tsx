import type { Metadata } from "next"
import Link from "next/link"
import { Crown, ShieldCheck } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { VipActionPanel } from "@/components/vip-action-panel"
import { VipBadge } from "@/components/vip-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { formatDateTime } from "@/lib/formatters"
import { getSiteSettings } from "@/lib/site-settings"
import { getVipLevel, isVipActive } from "@/lib/vip-status"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: `VIP - ${settings.siteName}`,
    description: `查看 ${settings.siteName} 的 VIP 权益、会员等级说明与开通方式。`,
  }
}

function formatPointValue(value: number, pointName: string, suffix: string) {
  return value > 0 ? `${value} ${pointName}${suffix}` : `免费${suffix}`
}

const vipMilestones = (settings: Awaited<ReturnType<typeof getSiteSettings>>) => [
  {
    level: 1,
    title: "VIP 1",
    requirement: `使用 ${settings.vipMonthlyPrice} ${settings.pointName} 购买月卡，生效 30 天`,
    privileges: [
      "可访问 VIP 专属节点、帖子与回复区域",
      `签到奖励：${settings.checkInVip1Reward} ${settings.pointName} / 次`,
      `补签价格：${formatPointValue(settings.checkInVip1MakeUpCardPrice, settings.pointName, " / 次")}`,
      `修改昵称：${formatPointValue(settings.nicknameChangeVip1PointCost, settings.pointName, " / 次")}`,
      `购买邀请码：${settings.inviteCodePurchaseEnabled ? formatPointValue(settings.inviteCodeVip1Price, settings.pointName, " / 个") : "未开启"}`,
      `作者下线帖子：${formatPointValue(settings.postOfflineVip1Price, settings.pointName, " / 次")}`,
    ],
  },
  {
    level: 2,
    title: "VIP 2",
    requirement: `使用 ${settings.vipQuarterlyPrice} ${settings.pointName} 购买季卡，生效 90 天`,
    privileges: [
      "包含 VIP1 全部权益，并可进入更高等级权限节点",
      `签到奖励：${settings.checkInVip2Reward} ${settings.pointName} / 次`,
      `补签价格：${formatPointValue(settings.checkInVip2MakeUpCardPrice, settings.pointName, " / 次")}`,
      `修改昵称：${formatPointValue(settings.nicknameChangeVip2PointCost, settings.pointName, " / 次")}`,
      `购买邀请码：${settings.inviteCodePurchaseEnabled ? formatPointValue(settings.inviteCodeVip2Price, settings.pointName, " / 个") : "未开启"}`,
      `作者下线帖子：${formatPointValue(settings.postOfflineVip2Price, settings.pointName, " / 次")}`,
    ],
  },
  {
    level: 3,
    title: "VIP 3",
    requirement: `使用 ${settings.vipYearlyPrice} ${settings.pointName} 购买年卡，生效 365 天`,
    privileges: [
      "包含 VIP1、VIP2 全部权益，并享受最高档位身份能力",
      `签到奖励：${settings.checkInVip3Reward} ${settings.pointName} / 次`,
      `补签价格：${formatPointValue(settings.checkInVip3MakeUpCardPrice, settings.pointName, " / 次")}`,
      `修改昵称：${formatPointValue(settings.nicknameChangeVip3PointCost, settings.pointName, " / 次")}`,
      `购买邀请码：${settings.inviteCodePurchaseEnabled ? formatPointValue(settings.inviteCodeVip3Price, settings.pointName, " / 个") : "未开启"}`,
      `作者下线帖子：${formatPointValue(settings.postOfflineVip3Price, settings.pointName, " / 次")}`,
    ],
  },
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
  const milestones = vipMilestones(settings)



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


                  <p className="mt-2 text-sm text-white/75">到期时间：{vipUser?.vipExpiresAt ? formatDateTime(vipUser.vipExpiresAt) : "长期有效 / 暂未设置"}</p>


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
                <div className="mt-3 rounded-[18px] border border-border bg-secondary/20 px-3 py-3">
                  <p className="text-xs font-medium text-foreground">权益详情</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                    {item.privileges.map((privilege) => (
                      <li key={`${item.level}-${privilege}`}>{privilege}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}

