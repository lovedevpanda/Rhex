import Link from "next/link"

import { BadgeCenter } from "@/components/badge-center"
import { Card, CardContent } from "@/components/ui/card"
import type { SettingsPageData } from "@/app/settings/settings-page-loader"

export function BadgesSettingsSection({ data }: { data: SettingsPageData }) {
  return (
    <div className="space-y-6">
      <BadgeCenter isLoggedIn badges={data.badgeDisplayItems} />

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">如何获得更多勋章</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">围绕发帖、回复、获赞、邀请、等级、签到和 VIP 成长来积累你的社区身份。达成条件后记得回来手动领取。</p>
            </div>

            <Link href="/write" className="inline-flex rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90">
              去参与社区
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
