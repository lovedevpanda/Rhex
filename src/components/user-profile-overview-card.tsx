"use client"

import { useState } from "react"

import { FollowToggleButton } from "@/components/follow-toggle-button"
import { RssSubscribeButton } from "@/components/rss-subscribe-button"
import { UserStatusBadge } from "@/components/user-status-badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { PublicUserStatus } from "@/lib/users"

interface UserProfileOverviewCardProps {
  title: string
  status?: PublicUserStatus | null
  initialFollowerCount: number
  stats: Array<{
    label: string
    value: number
  }>
  rssHref: string
  rssLabel?: string
  followAction?: {
    targetId: number
    initialFollowed: boolean
    activeLabel?: string
    inactiveLabel?: string
  } | null
}

interface OverviewMetricProps {
  label: string
  value: number
}

function OverviewMetric({ label, value }: OverviewMetricProps) {
  return (
    <div className="min-w-0 rounded-xl px-3 py-2.5 text-center dark:bg-white/[0.04] lg:min-w-[76px]">
      <p className="text-base font-semibold text-foreground sm:text-[17px]">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}

export function UserProfileOverviewCard({
  title,
  status = null,
  initialFollowerCount,
  stats,
  rssHref,
  rssLabel = "订阅用户 RSS",
  followAction = null,
}: UserProfileOverviewCardProps) {
  const [followerCount, setFollowerCount] = useState(initialFollowerCount)
  const overviewStats = [...stats, { label: "粉丝", value: followerCount }]

  return (
    <Card className="rounded-2xl border border-[#e8e8e8] shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Overview</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <h2 className="text-xl font-semibold text-foreground sm:text-[22px]">{title}</h2>
              {status ? <UserStatusBadge status={status} /> : null}
            </div>
            <div className="mt-1.5 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
              <RssSubscribeButton
                href={rssHref}
                label={rssLabel}
                className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-[#f5f5f5] hover:text-foreground dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
              />
              {followAction ? (
                <FollowToggleButton
                  targetType="user"
                  targetId={followAction.targetId}
                  initialFollowed={followAction.initialFollowed}
                  activeLabel={followAction.activeLabel ?? "已关注用户"}
                  inactiveLabel={followAction.inactiveLabel ?? "关注用户"}
                  showLabel
                  className="h-10 justify-center rounded-xl px-4 text-sm"
                  onFollowStateChange={({ followed, changed }) => {
                    if (!changed) {
                      return
                    }

                    setFollowerCount((currentCount) => Math.max(0, currentCount + (followed ? 1 : -1)))
                  }}
                />
              ) : null}
            </div>
          </div>
          <div className="w-full lg:w-auto lg:max-w-[520px] lg:shrink-0">
            <div className={cn("grid gap-1.5", overviewStats.length >= 5 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:justify-end")}>
              {overviewStats.map((item) => (
                <OverviewMetric key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
