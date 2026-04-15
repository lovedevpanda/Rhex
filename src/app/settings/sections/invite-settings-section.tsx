import { InviteCodePurchaseCard } from "@/components/invite-code-purchase-card"
import { InviteLinkCopyButton } from "@/components/invite-link-copy-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber } from "@/lib/formatters"
import type { SettingsPageData } from "@/app/settings/settings-page-loader"

export function InviteSettingsSection({ data }: { data: SettingsPageData }) {
  const { profile, settings, invitePath, inviteCodePrice, inviteCodePriceDescription } = data

  return (
    <Card>
      <CardHeader>
        <CardTitle>邀请中心</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[20px] bg-secondary/60 p-4">
            <p className="text-2xl font-semibold">{profile.inviteCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">已邀请注册</p>
          </div>
          <div className="rounded-[20px] bg-secondary/60 p-4">
            <p className="text-2xl font-semibold">{profile.inviterUsername ?? "-"}</p>
            <p className="mt-1 text-sm text-muted-foreground">邀请人</p>
          </div>
          <div className="rounded-[20px] bg-secondary/60 p-4">
            <p className="text-2xl font-semibold">{formatNumber(settings.inviteRewardInviter)}</p>
            <p className="mt-1 text-sm text-muted-foreground">邀请成功可得 {settings.pointName}</p>
          </div>
        </div>

        <div className="space-y-3 rounded-[24px] border border-border px-4 py-4 text-sm">
          <div>
            <p className="font-medium">我的邀请链接</p>
            <div className="mt-2 break-all text-muted-foreground">
              <InviteLinkCopyButton path={invitePath} />
            </div>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">把这个链接发给好友，对方注册时会自动带上你的邀请信息。</p>
          </div>
        </div>

        <InviteCodePurchaseCard
          enabled={settings.inviteCodePurchaseEnabled}
          price={inviteCodePrice}
          priceDescription={inviteCodePriceDescription}
          pointName={settings.pointName}
        />
      </CardContent>
    </Card>
  )
}
