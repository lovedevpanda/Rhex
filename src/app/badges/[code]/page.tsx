import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"

import { AddonSlotRenderer, AddonSurfaceRenderer } from "@/addons-host"
import { ForumPageShell } from "@/components/forum/forum-page-shell"
import { HomeSidebarPanels } from "@/components/home/home-sidebar-panels"
import { LevelIcon } from "@/components/level-icon"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/rbutton"
import { Tooltip } from "@/components/ui/tooltip"
import { getHomeAnnouncements } from "@/lib/announcements"
import { getCurrentUser } from "@/lib/auth"
import { describeBadgeRule, getBadgeCenterData } from "@/lib/badges"
import { getBoards } from "@/lib/boards"
import { getHomeSidebarHotTopics, resolveSidebarUser } from "@/lib/home-sidebar"
import { getSiteSettings } from "@/lib/site-settings"
import { getZones } from "@/lib/zones"

export const dynamic = "force-dynamic"

interface BadgeDetailPageProps {
  params: Promise<{
    code: string
  }>
}

export async function generateMetadata(props: BadgeDetailPageProps): Promise<Metadata> {
  const { code } = await props.params
  const settingsPromise = getSiteSettings()
  const [settings, badges] = await Promise.all([
    settingsPromise,
    getBadgeCenterData(null),
  ])
  const badge = badges.find((item) => item.code === code)

  if (!badge) {
    return {
      title: `勋章不存在 - ${settings.siteName}`,
    }
  }

  return {
    title: `${badge.name} - ${settings.siteName}`,
    description: badge.description?.trim() || `查看 ${badge.name} 的领取条件、领取人数与佩戴信息。`,
    alternates: {
      canonical: `/badges/${badge.code}`,
    },
  }
}

export default async function BadgeDetailPage(props: BadgeDetailPageProps) {
  const { code } = await props.params
  const settingsPromise = getSiteSettings()
  const currentUserPromise = getCurrentUser()
  const [settings, boards, zones, currentUser, announcements] = await Promise.all([
    settingsPromise,
    getBoards(),
    getZones(),
    currentUserPromise,
    getHomeAnnouncements(3),
  ])
  const [sidebarUser, hotTopics, badges] = await Promise.all([
    resolveSidebarUser(currentUser, settings),
    getHomeSidebarHotTopics(settings.homeSidebarHotTopicsCount),
    getBadgeCenterData(currentUser?.id ?? null),
  ])

  const badge = badges.find((item) => item.code === code)

  if (!badge) {
    notFound()
  }

  const badgeRules = badge.rules.map((rule) => ({
    id: rule.id,
    text: describeBadgeRule(rule),
  }))
  const alreadyGranted = badge.eligibility.alreadyGranted
  const eligibleNow = badge.eligibility.eligible
  const canDisplay = badge.display.canDisplay
  const isDisplayed = badge.display.isDisplayed
  const currentStatusLabel = alreadyGranted
    ? "你已领取"
    : eligibleNow
      ? badge.eligibility.purchaseRequired
        ? badge.eligibility.canAffordPurchase
          ? `已达成，领取需支付 ${badge.eligibility.pointsCost} ${settings.pointName}`
          : `条件已达成，但当前 ${settings.pointName} 不足`
        : "你当前已满足领取条件"
      : "你当前还未满足领取条件"
  const personalStatusSummary = !currentUser
    ? "登录后查看"
    : alreadyGranted
      ? "已领取"
      : eligibleNow
        ? "可领取"
        : "未达成"
  const effectSummary = badge.effects.length > 0 ? `${badge.effects.length} 项特效` : "无特效"
  const visibilitySummary = `${badge.status ? "启用" : "停用"} · ${badge.isHidden ? "隐藏" : "公开"}`

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-[1200px] px-1">
        <AddonSlotRenderer slot="badge.page.before" />
        <AddonSurfaceRenderer surface="badge.page" props={{ badge, settings }}>
        <ForumPageShell
          zones={zones}
          boards={boards}
          main={(
            <main className="mt-6 pb-12">
              <div className="space-y-6">
                <AddonSlotRenderer slot="badge.hero.before" />
                <AddonSurfaceRenderer surface="badge.hero" props={{ badge, badgeRules, settings }}>
                <section className="rounded-[28px] border border-border bg-card px-5 py-6 shadow-xs sm:px-7 sm:py-8">
                  <div className="mx-auto max-w-3xl text-center">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      Badge Detail
                    </p>
                    <div
                      className="mx-auto mt-5 flex h-28 w-28 items-center justify-center rounded-[32px] text-6xl sm:h-32 sm:w-32"
                      style={{
                        color: badge.color,
                        background: `linear-gradient(180deg, ${badge.color}20, ${badge.color}10)`,
                      }}
                    >
                      <LevelIcon
                        icon={badge.iconText}
                        color={badge.color}
                        className="h-14 w-14 text-[56px] sm:h-16 sm:w-16 sm:text-[64px]"
                        emojiClassName="text-inherit"
                        svgClassName="[&>svg]:block"
                      />
                    </div>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                        {badge.category || "社区成就"}
                      </span>
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                        编号 {badge.code}
                      </span>
                    </div>
                    <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                      {badge.name}
                    </h1>
                    <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
                      {badge.description?.trim() || "这枚勋章用于展示你的成长、经历或社区身份。"}
                    </p>
                    <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
                      <BadgeStatCard label="领取人数" value={`${badge.grantedUserCount ?? 0} 人`} />
                      <BadgeStatCard label="领取成本" value={badge.pointsCost > 0 ? `${badge.pointsCost} ${settings.pointName}` : "免费领取"} />
                      <BadgeStatCard
                        label="领取条件"
                        value={badgeRules.length === 0 ? (
                          <p>登录即可领取，无额外门槛。</p>
                        ) : (
                          <div className="space-y-1">
                            {badgeRules.map((rule) => (
                              <p key={rule.id}>{rule.text}</p>
                            ))}
                          </div>
                        )}
                        valueClassName="mt-2 text-sm leading-6 text-foreground"
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <DetailHoverChip
                        label="勋章状态"
                        value={visibilitySummary}
                        tooltip={(
                          <div className="space-y-2">
                            <p className="text-sm font-semibold">勋章状态</p>
                            <p className="text-[12px] leading-5">
                              当前这枚勋章{badge.status ? "处于启用状态，可正常领取与展示。" : "当前未启用，前台不会按正常路径发放。"}
                            </p>
                            <p className="text-[12px] leading-5">
                              {badge.isHidden ? "它被标记为隐藏勋章，通常不会在常规公开列表中强调展示。" : "它属于公开勋章，会正常出现在勋章相关页面与展示位。"}
                            </p>
                          </div>
                        )}
                      />
                      <DetailHoverChip
                        label="我的状态"
                        value={personalStatusSummary}
                        tooltip={(
                          <div className="space-y-2">
                            <p className="text-sm font-semibold">我的状态</p>
                            {currentUser ? (
                              <>
                                <p className="text-[12px] leading-5">{currentStatusLabel}</p>
                                <p className="text-[12px] leading-5">
                                  {canDisplay
                                    ? isDisplayed
                                      ? `当前已佩戴，顺序第 ${badge.display.displayOrder || 1} 位。`
                                      : "已具备佩戴资格，但当前未佩戴。"
                                    : "当前还不能佩戴这枚勋章。"}
                                </p>
                              </>
                            ) : (
                              <p className="text-[12px] leading-5">登录后可查看自己是否已领取、是否已达成，以及是否已佩戴。</p>
                            )}
                          </div>
                        )}
                      />
                      <DetailHoverChip
                        label="勋章特效"
                        value={effectSummary}
                        tooltip={(
                          <div className="space-y-2">
                            <p className="text-sm font-semibold">勋章特效</p>
                            {badge.effects.length > 0 ? (
                              <div className="space-y-1.5">
                                {badge.effects.map((effect) => (
                                  <div key={effect.id} className="text-[12px] leading-5">
                                    <div className="font-medium text-background">{effect.name}</div>
                                    <div className="text-background/75">
                                      {effect.description?.trim() || "该勋章挂载了一个可用的站内特效规则。"}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[12px] leading-5">这枚勋章当前没有附加特效。</p>
                            )}
                          </div>
                        )}
                      />
                    </div>
      
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                      <Link href="/settings?tab=badges">
                        <Button variant="outline" className="rounded-full px-5">
                          前往勋章中心
                        </Button>
                      </Link>
                      {currentUser ? (
                        <span className="rounded-full bg-secondary px-4 py-2 text-sm text-muted-foreground">
                          {currentStatusLabel}
                        </span>
                      ) : (
                        <Link href="/login">
                          <Button className="rounded-full px-5">
                            登录后查看我的状态
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </section>
                </AddonSurfaceRenderer>
                <AddonSlotRenderer slot="badge.hero.after" />
              </div>
            </main>
          )}
          rightSidebar={(
            <aside className="mt-6 hidden pb-12 lg:block">
              <AddonSlotRenderer slot="badge.sidebar.before" />
              <AddonSurfaceRenderer surface="badge.sidebar" props={{ announcements, hotTopics, settings }}>
                <HomeSidebarPanels
                  user={sidebarUser}
                  hotTopics={hotTopics}
                  announcements={announcements}
                  showAnnouncements={settings.homeSidebarAnnouncementsEnabled}
                  siteName={settings.siteName}
                  siteDescription={settings.siteDescription}
                  siteLogoPath={settings.siteLogoPath}
                  siteIconPath={settings.siteIconPath}
                />
              </AddonSurfaceRenderer>
              <AddonSlotRenderer slot="badge.sidebar.after" />
            </aside>
          )}
        />
        </AddonSurfaceRenderer>
        <AddonSlotRenderer slot="badge.page.after" />
      </div>
    </div>
  )
}

function BadgeStatCard({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: ReactNode
  valueClassName?: string
}) {
  return (
    <div className="rounded-[22px] border border-border bg-background/70 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className={valueClassName ?? "mt-2 text-base font-semibold text-foreground"}>
        {value}
      </div>
    </div>
  )
}

function DetailHoverChip({
  label,
  value,
  tooltip,
}: {
  label: string
  value: string
  tooltip: React.ReactNode
}) {
  return (
    <Tooltip
      content={tooltip}
      contentClassName="max-w-[320px] items-start px-3 py-2 text-left"
    >
      <span className="inline-flex cursor-help items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-2 text-xs text-foreground">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </span>
    </Tooltip>
  )
}
