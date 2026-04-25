import Link from "next/link"
import { Receipt, Sparkles } from "lucide-react"

import { ChangeType } from "@/db/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/rbutton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateTime, formatNumber } from "@/lib/formatters"
import { getPointLogEventLabel, POINT_LOG_EVENT_TYPES } from "@/lib/point-log-events"
import { buildSettingsHref } from "@/app/settings/settings-page-loader"
import type { SettingsPageData } from "@/app/settings/settings-page-loader"

type PointLogList = NonNullable<SettingsPageData["pointLogs"]>
type PointLogItem = PointLogList["items"][number]

function buildPointsPageHref(route: SettingsPageData["route"], pointLogs: PointLogList, cursorKey: "pointsBefore" | "pointsAfter", cursor: string | null) {
  if (!cursor) {
    return "#"
  }

  return buildSettingsHref(route, {
    tab: "points",
    [cursorKey]: cursor,
    pointsChangeType: pointLogs.filters.changeType !== "ALL" ? pointLogs.filters.changeType : undefined,
    pointsEventType: pointLogs.filters.eventType !== "ALL" ? pointLogs.filters.eventType : undefined,
  })
}

function renderPointEffectSummary(log: PointLogItem) {
  const effectItems = log.pointEffect?.rules ?? []

  if (!log.pointEffect && !log.pointTax) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {log.pointEffect ? (
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
              <Sparkles className="h-3 w-3" />
              勋章特效
            </span>
            <span className="text-muted-foreground">初始：{formatNumber(log.pointEffect.baseValue || 0)}</span>
            <span className={log.pointEffect.deltaValue < 0 ? "text-rose-700" : "text-emerald-700"}>
              特效：{log.pointEffect.deltaValue < 0 ? "-" : "+"}
              {formatNumber(Math.abs(log.pointEffect.deltaValue || 0))}
            </span>
          </>
        ) : null}
        {log.pointTax ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-700">
            <Receipt className="h-3 w-3" />
            节点税
          </span>
        ) : null}
      </div>

      {effectItems.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {effectItems.map((item, index) => (
            <span key={`${log.id}-effect-${index}`} className="inline-flex flex-wrap items-center gap-1 rounded-full border border-amber-200 bg-background px-2 py-0.5 text-xs text-foreground">
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
  )
}

function renderPointBalance(log: PointLogItem) {
  if (typeof log.beforeBalance !== "number" || typeof log.afterBalance !== "number") {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <span className="text-xs leading-5 text-muted-foreground">
      {formatNumber(log.beforeBalance)} {"->"} {formatNumber(log.afterBalance)}
    </span>
  )
}

export function PointsSettingsSection({ data }: { data: SettingsPageData }) {
  const { pointLogs, profile, route, settings } = data

  if (!pointLogs) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载积分明细，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
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

        <CardContent className="flex flex-col gap-4">
          <form action="/settings" className="grid gap-3 rounded-xl border border-border bg-secondary/25 p-3 md:grid-cols-[180px_220px_auto_auto] md:items-end">
            <input type="hidden" name="tab" value="points" />
            {route.mobileView === "detail" ? <input type="hidden" name="mobile" value="detail" /> : null}
            <label className="flex flex-col gap-2">
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

            <label className="flex flex-col gap-2">
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

            <Link href={buildSettingsHref(route, { tab: "points" })} className="inline-flex h-10 items-center justify-center rounded-full border border-border px-4 text-sm transition-colors hover:bg-accent hover:text-foreground">
              重置
            </Link>
          </form>

          {pointLogs.items.length === 0 ? <p className="text-sm text-muted-foreground">当前还没有任何积分变动记录。</p> : null}
          {pointLogs.items.length > 0 ? (
            <>
              <div className="overflow-hidden rounded-xl border border-border md:hidden">
                <div className="flex flex-col divide-y divide-border">
                  {pointLogs.items.map((log) => {
                    const positive = log.changeType === ChangeType.INCREASE

                    return (
                      <div key={log.id} className="flex flex-col gap-2 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm leading-5 font-medium">{log.displayReason}</span>
                              {log.pointTax ? (
                                <span className="inline-flex size-5 items-center justify-center rounded-full bg-sky-100 text-sky-700" title="该条记录含节点税" aria-label="该条记录含节点税">
                                  <Receipt className="h-3 w-3" />
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-muted-foreground">{formatDateTime(log.createdAt)}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <Badge variant="secondary" className="h-5 px-2 text-[11px]">
                                {getPointLogEventLabel(log.eventType)}
                              </Badge>
                            </div>
                          </div>
                          <span className={positive ? "shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700" : "shrink-0 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700"}>
                            {positive ? "+" : "-"}
                            {formatNumber(log.changeValue)}
                          </span>
                        </div>

                        <div className="text-xs leading-5 text-muted-foreground">
                          {renderPointBalance(log)}
                        </div>

                        {log.pointEffect || log.pointTax ? renderPointEffectSummary(log) : null}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="hidden overflow-hidden rounded-xl border border-border md:block">
                <Table className="w-full table-auto">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-9 px-3 text-xs whitespace-nowrap">时间</TableHead>
                      <TableHead className="h-9 px-3 text-xs">说明</TableHead>
                      <TableHead className="h-9 px-3 text-xs whitespace-nowrap">场景</TableHead>
                      <TableHead className="h-9 px-3 text-xs whitespace-nowrap">变动</TableHead>
                      <TableHead className="h-9 px-3 text-xs whitespace-nowrap">余额</TableHead>
                      <TableHead className="h-9 max-w-[220px] px-3 text-xs">附加信息</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pointLogs.items.map((log) => {
                      const positive = log.changeType === ChangeType.INCREASE

                      return (
                        <TableRow key={log.id}>
                          <TableCell className="px-3 py-2 align-top text-xs leading-5 text-muted-foreground whitespace-nowrap">
                            {formatDateTime(log.createdAt)}
                          </TableCell>
                          <TableCell className="px-3 py-2 align-top">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm leading-5 font-medium">{log.displayReason}</span>
                              {log.pointTax ? (
                                <span className="inline-flex size-5 items-center justify-center rounded-full bg-sky-100 text-sky-700" title="该条记录含节点税" aria-label="该条记录含节点税">
                                  <Receipt className="h-3 w-3" />
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-2 align-top">
                            <Badge variant="secondary" className="h-5 px-2 text-[11px]">
                              {getPointLogEventLabel(log.eventType)}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-3 py-2 align-top">
                            <span className={positive ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700" : "inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700"}>
                              {positive ? "+" : "-"}
                              {formatNumber(log.changeValue)}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-2 align-top">
                            {renderPointBalance(log)}
                          </TableCell>
                          <TableCell className="max-w-[220px] px-3 py-2 align-top">
                            {renderPointEffectSummary(log)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}

          {pointLogs.total > 0 ? (
            <div className="flex items-center justify-end gap-2 pt-2">
              <Link
                href={pointLogs.hasPrevPage ? buildPointsPageHref(route, pointLogs, "pointsBefore", pointLogs.prevCursor) : "#"}
                aria-disabled={!pointLogs.hasPrevPage}
                className={pointLogs.hasPrevPage ? "rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-accent/40" : "pointer-events-none rounded-full border border-border px-4 py-2 text-sm text-muted-foreground opacity-50"}
              >
                上一页
              </Link>
              <Link
                href={pointLogs.hasNextPage ? buildPointsPageHref(route, pointLogs, "pointsAfter", pointLogs.nextCursor) : "#"}
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
