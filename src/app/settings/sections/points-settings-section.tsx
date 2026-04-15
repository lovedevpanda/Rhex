import Link from "next/link"
import { Receipt, Sparkles } from "lucide-react"

import { ChangeType } from "@/db/types"
import { Button } from "@/components/ui/rbutton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateTime, formatNumber } from "@/lib/formatters"
import { getPointLogEventLabel, POINT_LOG_EVENT_TYPES } from "@/lib/point-log-events"
import type { SettingsPageData } from "@/app/settings/settings-page-loader"

type PointLogList = NonNullable<SettingsPageData["pointLogs"]>

function buildPointsPageHref(pointLogs: PointLogList, cursorKey: "pointsBefore" | "pointsAfter", cursor: string | null) {
  if (!cursor) {
    return "#"
  }

  const searchParams = new URLSearchParams({
    tab: "points",
    [cursorKey]: cursor,
  })

  if (pointLogs.filters.changeType !== "ALL") {
    searchParams.set("pointsChangeType", pointLogs.filters.changeType)
  }

  if (pointLogs.filters.eventType !== "ALL") {
    searchParams.set("pointsEventType", pointLogs.filters.eventType)
  }

  return `/settings?${searchParams.toString()}`
}

export function PointsSettingsSection({ data }: { data: SettingsPageData }) {
  const { pointLogs, profile, settings } = data

  if (!pointLogs) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载积分明细，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{settings.pointName}明细</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">当前余额：{formatNumber(profile.points)}</span>
              <Link href="/topup" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                去充值 / 兑换
              </Link>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <form action="/settings" className="grid gap-3 rounded-[20px] border border-border bg-secondary/25 p-4 md:grid-cols-[180px_220px_auto_auto] md:items-end">
            <input type="hidden" name="tab" value="points" />
            <label className="space-y-2">
              <span className="text-sm font-medium">收支类型</span>
              <select
                name="pointsChangeType"
                defaultValue={pointLogs.filters.changeType}
                className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-hidden"
              >
                <option value="ALL">全部</option>
                <option value="INCREASE">收入</option>
                <option value="DECREASE">支出</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">变动场景</span>
              <select
                name="pointsEventType"
                defaultValue={pointLogs.filters.eventType}
                className="h-10 w-full rounded-[16px] border border-border bg-background px-3 text-sm outline-hidden"
              >
                <option value="ALL">全部</option>
                {Object.values(POINT_LOG_EVENT_TYPES).map((eventType) => (
                  <option key={eventType} value={eventType}>
                    {getPointLogEventLabel(eventType)}
                  </option>
                ))}
              </select>
            </label>

            <Button type="submit" className="h-10 rounded-full px-4">
              筛选
            </Button>

            <Link href="/settings?tab=points" className="inline-flex h-10 items-center justify-center rounded-full border border-border px-4 text-sm transition-colors hover:bg-accent hover:text-foreground">
              重置
            </Link>
          </form>

          {pointLogs.items.length === 0 ? <p className="text-sm text-muted-foreground">当前还没有任何积分变动记录。</p> : null}
          {pointLogs.items.map((log) => {
            const positive = log.changeType === ChangeType.INCREASE
            const effectItems = log.pointEffect?.rules ?? []

            return (
              <div key={log.id} className="rounded-[20px] border border-border px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{log.displayReason}</p>
                      {log.pointTax ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-700" title="该条记录含节点税" aria-label="该条记录含节点税">
                          <Receipt className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</p>
                    {typeof log.beforeBalance === "number" && typeof log.afterBalance === "number" ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        更改前：{formatNumber(log.beforeBalance)} · 更改后：{formatNumber(log.afterBalance)}
                      </p>
                    ) : null}
                  </div>

                  <span className={positive ? "rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700" : "rounded-full bg-rose-100 px-3 py-1 text-sm font-medium text-rose-700"}>
                    {positive ? "+" : "-"}
                    {formatNumber(log.changeValue)}
                  </span>
                </div>

                {log.pointEffect ? (
                  <div className="mt-3 rounded-[18px] border border-amber-200 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800">
                        <Sparkles className="h-3.5 w-3.5" />
                        勋章特效
                      </span>
                      <span className="text-muted-foreground">初始：{formatNumber(log.pointEffect.baseValue || 0)}</span>
                      <span className={log.pointEffect.deltaValue < 0 ? "text-rose-700" : "text-emerald-700"}>
                        特效：{log.pointEffect.deltaValue < 0 ? "-" : "+"}
                        {formatNumber(Math.abs(log.pointEffect.deltaValue || 0))}
                      </span>
                    </div>

                    {effectItems.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {effectItems.map((item, index) => (
                          <span key={`${log.id}-effect-${index}`} className="inline-flex flex-wrap items-center gap-1 rounded-full border border-amber-200 bg-background px-3 py-1 text-xs text-foreground">
                            {item.badgeName ? <span className="text-muted-foreground">{item.badgeName}</span> : null}
                            <span>{item.effectName}</span>
                            {item.adjustmentValue ? (
                              <span className={item.adjustmentValue < 0 ? "text-rose-700" : "text-emerald-700"}>
                                {item.adjustmentValue > 0 ? "+" : ""}
                                {formatNumber(item.adjustmentValue)}
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}

          {pointLogs.total > 0 ? (
            <div className="flex items-center justify-end gap-2 pt-2">
              <Link
                href={pointLogs.hasPrevPage ? buildPointsPageHref(pointLogs, "pointsBefore", pointLogs.prevCursor) : "#"}
                aria-disabled={!pointLogs.hasPrevPage}
                className={pointLogs.hasPrevPage ? "rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-accent/40" : "pointer-events-none rounded-full border border-border px-4 py-2 text-sm text-muted-foreground opacity-50"}
              >
                上一页
              </Link>
              <Link
                href={pointLogs.hasNextPage ? buildPointsPageHref(pointLogs, "pointsAfter", pointLogs.nextCursor) : "#"}
                aria-disabled={!pointLogs.hasNextPage}
                className={pointLogs.hasNextPage ? "rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-accent/40" : "pointer-events-none rounded-full border border-border px-4 py-2 text-sm text-muted-foreground opacity-50"}
              >
                下一页
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
