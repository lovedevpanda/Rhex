import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Crown, Flame, Heart, MessageSquareText, Sparkles } from "lucide-react"

import { LevelBadge } from "@/components/level-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buildSettingsHref } from "@/app/settings/settings-page-loader"
import type { SettingsPageData } from "@/app/settings/settings-page-loader"

export function LevelSettingsSection({ data }: { data: SettingsPageData }) {
  const { levelView, route, settings } = data

  if (!levelView) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">暂时无法加载等级进度，请稍后刷新重试。</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-none bg-[linear-gradient(135deg,rgba(37,99,235,0.10),rgba(124,58,237,0.10),rgba(249,115,22,0.08))] shadow-soft">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[11px] font-medium text-slate-700 backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                <Sparkles className="h-3.5 w-3.5" />
                我的成长等级
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">当前已达到 Lv.{levelView.currentLevel.level}</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">这里会展示你当前等级、成长进度，以及升级到下一等级还差哪些条件。</p>
            </div>

            <div className="rounded-[28px] border border-white/60 bg-white/75 p-5 shadow-xs backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
              <LevelBadge
                level={levelView.currentLevel.level}
                name={levelView.currentLevel.name}
                color={levelView.currentLevel.color}
                icon={levelView.currentLevel.icon}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="累计发帖" value={levelView.snapshot.postCount} hint="公开发帖数量" icon={<Flame className="h-4 w-4" />} />
        <StatCard title="累计回复" value={levelView.snapshot.commentCount} hint="公开回复数量" icon={<MessageSquareText className="h-4 w-4" />} />
        <StatCard title="累计获赞" value={levelView.snapshot.likeReceivedCount} hint="收到的点赞总数" icon={<Heart className="h-4 w-4" />} />
        <StatCard title="累计签到" value={levelView.snapshot.checkInDays} hint="已完成签到天数" icon={<CheckCircle2 className="h-4 w-4" />} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <StatCard
          title="当前连续签到"
          value={levelView.snapshot.currentCheckInStreak}
          hint={levelView.streakSettings.makeUpCountsTowardStreak ? "补签会计入连续签到" : "补签不会计入连续签到"}
          icon={<Sparkles className="h-4 w-4" />}
        />
        <StatCard title="最长连续签到" value={levelView.snapshot.maxCheckInStreak} hint="历史最佳连续签到纪录" icon={<Crown className="h-4 w-4" />} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{levelView.nextLevel ? `升级到 Lv.${levelView.nextLevel.level} · ${levelView.nextLevel.name}` : "已达到最高等级"}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          {levelView.nextLevel ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <LevelBadge
                  level={levelView.nextLevel.level}
                  name={levelView.nextLevel.name}
                  color={levelView.nextLevel.color}
                  icon={levelView.nextLevel.icon}
                />
                <span className="text-sm text-muted-foreground">升级条件为“且”关系，需要同时满足下面所有门槛。</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <ProgressItem title="签到天数" current={levelView.completion?.checkInDays.current ?? 0} required={levelView.completion?.checkInDays.required ?? 0} remaining={levelView.completion?.checkInDays.remaining ?? 0} completed={Boolean(levelView.completion?.checkInDays.completed)} />
                <ProgressItem title="发帖数量" current={levelView.completion?.postCount.current ?? 0} required={levelView.completion?.postCount.required ?? 0} remaining={levelView.completion?.postCount.remaining ?? 0} completed={Boolean(levelView.completion?.postCount.completed)} />
                <ProgressItem title="回复数量" current={levelView.completion?.commentCount.current ?? 0} required={levelView.completion?.commentCount.required ?? 0} remaining={levelView.completion?.commentCount.remaining ?? 0} completed={Boolean(levelView.completion?.commentCount.completed)} />
                <ProgressItem title="收到点赞数" current={levelView.completion?.likeReceivedCount.current ?? 0} required={levelView.completion?.likeReceivedCount.required ?? 0} remaining={levelView.completion?.likeReceivedCount.remaining ?? 0} completed={Boolean(levelView.completion?.likeReceivedCount.completed)} />
              </div>
            </>
          ) : (
            <div className="rounded-[24px] border border-dashed border-border px-4 py-8 text-center">
              <Crown className="mx-auto h-8 w-8 text-amber-500" />
              <p className="mt-3 text-base font-semibold">你已经达到当前站点的最高等级</p>
              <p className="mt-2 text-sm text-muted-foreground">后续如果后台新增更高等级，你的成长页会自动展示新的升级目标。</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>快速入口</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <QuickLink href="/write" title="去发帖" description="发布主题会推动成长进度。" />
          <QuickLink href={buildSettingsHref(route, { tab: "points" })} title={`查看${settings.pointName}明细`} description={`顺便查看当前 ${settings.pointName} 账户情况。`} />
          <QuickLink href={buildSettingsHref(route, { tab: "badges" })} title="前往勋章中心" description="查看哪些社区勋章已经达成。" />
        </CardContent>
      </Card>
    </div>
  )
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-[22px] border border-border bg-card px-5 py-4 transition-colors hover:bg-accent/40">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  )
}

function StatCard({ title, value, hint, icon }: { title: string; value: number; hint: string; icon: ReactNode }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function ProgressItem({ title, current, required, remaining, completed }: { title: string; current: number; required: number; remaining: number; completed: boolean }) {
  const progress = required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 100

  return (
    <div className="rounded-[24px] border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{title}</p>
        <span className={completed ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700" : "rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground"}>
          {completed ? "已完成" : `还差 ${remaining}`}
        </span>
      </div>
      <div className="mt-4 h-2 rounded-full bg-secondary">
        <div className="h-2 rounded-full bg-foreground transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {current} / {required}
      </p>
    </div>
  )
}
