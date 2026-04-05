"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Heart, Plus, Settings, Star, Users, Wallet } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { AdminModal } from "@/components/admin-modal"
import { LevelBadge } from "@/components/level-badge"
import { UserAvatar } from "@/components/user-avatar"
import { UserStatusBadge } from "@/components/user-status-badge"
import { VipBadge } from "@/components/vip-badge"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { getLocalDateKey, getMonthKey, getMonthTitle } from "@/lib/date-key"
import { cn } from "@/lib/utils"
import { getVipLevel, isVipActive } from "@/lib/vip-status"

interface CheckInCalendarEntry {
  date: string
  reward: number
  isMakeUp: boolean
  makeUpCost: number
  createdAt: string
}

interface CheckInCalendarResponse {
  month: string
  pointName: string
  checkInReward: number
  makeUpPrice: number
  vipMakeUpPrice: number
  normalMakeUpPrice: number
  vip1MakeUpPrice: number
  vip2MakeUpPrice: number
  vip3MakeUpPrice: number
  entries: CheckInCalendarEntry[]
}

export interface SidebarUserCardData {
  username: string
  nickname?: string | null
  avatarPath?: string | null
  role?: "USER" | "MODERATOR" | "ADMIN" | null
  status?: "ACTIVE" | "MUTED" | "BANNED" | "INACTIVE"
  level?: number
  levelName?: string
  levelColor?: string
  levelIcon?: string
  vipLevel?: number
  vipExpiresAt?: string | null
  boardCount: number
  favoriteCount: number
  followerCount: number
  postCount: number
  receivedLikeCount: number
  points?: number
  pointName?: string
  checkInEnabled?: boolean
  checkInReward?: number
  checkInMakeUpCardPrice?: number
  checkInVipMakeUpCardPrice?: number
  checkInVip1MakeUpCardPrice?: number
  checkInVip2MakeUpCardPrice?: number
  checkInVip3MakeUpCardPrice?: number
  checkedInToday?: boolean
}

function resolveCurrentMakeUpPrice(user: SidebarUserCardData) {
  const normalPrice = user.checkInMakeUpCardPrice ?? 0

  if (!isVipActive(user)) {
    return normalPrice
  }

  const vipLevel = getVipLevel(user)
  if (vipLevel >= 3) {
    return user.checkInVip3MakeUpCardPrice ?? user.checkInVipMakeUpCardPrice ?? 0
  }

  if (vipLevel === 2) {
    return user.checkInVip2MakeUpCardPrice ?? user.checkInVipMakeUpCardPrice ?? 0
  }

  return user.checkInVip1MakeUpCardPrice ?? user.checkInVipMakeUpCardPrice ?? 0
}

function getRoleBadgeConfig(role?: SidebarUserCardData["role"]) {
  if (role === "ADMIN") {
    return {
      label: "管理员",
      className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
    }
  }

  if (role === "MODERATOR") {
    return {
      label: "版主",
      className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
    }
  }

  return {
    label: "普通用户",
    className: "bg-secondary text-muted-foreground",
  }
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

function buildCalendarDays(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const startWeekday = firstDay.getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: Array<{ date: string | null; day: number | null }> = []

  for (let index = 0; index < startWeekday; index += 1) {
    cells.push({ date: null, day: null })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${monthKey}-${String(day).padStart(2, "0")}`
    cells.push({ date, day })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null })
  }

  return cells
}

export function SidebarUserCard({ user, createPostHref = "/write", siteName = "知识型兴趣社区", siteDescription = "把时间浪费在你真正热爱的事情上。这里更适合持续浏览、慢慢讨论、围绕兴趣沉淀长期内容。" }: { user: SidebarUserCardData | null; createPostHref?: string; siteName?: string; siteDescription?: string }) {
  const router = useRouter()
  const currentUser = user
  const [checkInState, setCheckInState] = useState(() => ({
    points: user?.points ?? 0,
    checkedInToday: Boolean(user?.checkedInToday),
  }))
  const [loading, setLoading] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(getMonthKey())
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [calendarData, setCalendarData] = useState<CheckInCalendarResponse | null>(null)
  const calendarRequestIdRef = useRef(0)
  const calendarEntries = useMemo(() => new Map((calendarData?.entries ?? []).map((item) => [item.date, item])), [calendarData?.entries])
  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth])
  const { points, checkedInToday } = checkInState

  const loadCalendar = useCallback(async (targetMonth: string) => {
    const requestId = calendarRequestIdRef.current + 1
    calendarRequestIdRef.current = requestId
    setCalendarLoading(true)

    try {
      const response = await fetch(`/api/check-in?month=${targetMonth}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      })
      const result = await response.json()

      if (calendarRequestIdRef.current !== requestId) {
        return
      }

      if (!response.ok) {
        toast.error(result.message ?? "签到日历加载失败", "加载失败")
        return
      }

      setCalendarData((current) => {
        const nextData = result.data ?? null
        if (!nextData) {
          return current
        }

        if (!current || current.month !== nextData.month) {
          return nextData
        }

        const mergedEntries = [...nextData.entries]
        for (const entry of current.entries) {
          if (!mergedEntries.some((item) => item.date === entry.date)) {
            mergedEntries.push(entry)
          }
        }
        mergedEntries.sort((left, right) => left.date.localeCompare(right.date))

        return {
          ...nextData,
          entries: mergedEntries,
        }
      })
    } catch {
      if (calendarRequestIdRef.current !== requestId) {
        return
      }
      toast.error("签到日历加载失败，请稍后再试", "加载失败")
    } finally {
      if (calendarRequestIdRef.current === requestId) {
        setCalendarLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    setCheckInState({
      points: user?.points ?? 0,
      checkedInToday: Boolean(user?.checkedInToday),
    })
  }, [user?.points, user?.checkedInToday])

  useEffect(() => {
    if (!calendarOpen || !currentUser?.checkInEnabled) {
      return
    }

    void loadCalendar(calendarMonth)
  }, [calendarMonth, calendarOpen, currentUser?.checkInEnabled, loadCalendar])

  if (!currentUser) {
    return (
      <div className="overflow-hidden rounded-[24px] border border-border bg-card shadow-sm shadow-black/5 dark:shadow-black/30">
        <div className="sidebar-user-card-header p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl">
              <Image src="/icon.svg" alt="" width={18} height={18} className="h-10 w-10" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{siteName}</h3>
              <p className="mt-1 text-[11px] text-muted-foreground">登录后即可签到、查看积分与快捷发帖</p>
            </div>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-sm leading-6 text-muted-foreground">{siteDescription}</p>
          <div className="grid grid-cols-2 gap-2 border-t border-border/80 pt-3">
            <Link href="/login" className="block">
              <Button className="h-9 w-full rounded-lg">登录</Button>
            </Link>
            <Link href="/register" className="block">
              <Button variant="outline" className="h-9 w-full rounded-lg">注册</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const safeUser = currentUser
  const pointName = safeUser.pointName ?? "积分"
  const vipActive = isVipActive(safeUser)

  function syncCheckInState(next: Partial<typeof checkInState>) {
    setCheckInState((current) => ({
      ...current,
      ...next,
    }))
  }

  function upsertCalendarEntry(entry: CheckInCalendarEntry) {
    setCalendarData((current) => {
      const entryMonth = entry.date.slice(0, 7)
      if (!current || current.month !== entryMonth) {
        return current
      }

      const entries = current.entries.filter((item) => item.date !== entry.date)
      entries.push(entry)
      entries.sort((left, right) => left.date.localeCompare(right.date))

      return {
        ...current,
        entries,
      }
    })
  }

  const roleBadge = getRoleBadgeConfig(safeUser.role)
  const isRestrictedUser = safeUser.status === "BANNED" || safeUser.status === "MUTED"
  const effectiveMakeUpPrice = resolveCurrentMakeUpPrice(safeUser)
  const normalMakeUpPrice = calendarData?.normalMakeUpPrice ?? (safeUser.checkInMakeUpCardPrice ?? 0)
  const vip1MakeUpPrice = calendarData?.vip1MakeUpPrice ?? (safeUser.checkInVip1MakeUpCardPrice ?? safeUser.checkInVipMakeUpCardPrice ?? 0)
  const vip2MakeUpPrice = calendarData?.vip2MakeUpPrice ?? (safeUser.checkInVip2MakeUpCardPrice ?? safeUser.checkInVipMakeUpCardPrice ?? 0)
  const vip3MakeUpPrice = calendarData?.vip3MakeUpPrice ?? (safeUser.checkInVip3MakeUpCardPrice ?? safeUser.checkInVipMakeUpCardPrice ?? 0)
  const checkInRewardDescription = vipActive
    ? `当前按 VIP${getVipLevel(safeUser)} 奖励发放`
    : "当前按普通用户奖励发放"
  const makeUpPriceDescription = vipActive
    ? `当前按 VIP${getVipLevel(safeUser)} 价结算，普通 ${normalMakeUpPrice} / VIP1 ${vip1MakeUpPrice} / VIP2 ${vip2MakeUpPrice} / VIP3 ${vip3MakeUpPrice}`
    : `普通账号价 ${normalMakeUpPrice}，VIP1 ${vip1MakeUpPrice} / VIP2 ${vip2MakeUpPrice} / VIP3 ${vip3MakeUpPrice}`
  const todayKey = getLocalDateKey()

  async function handleCheckIn() {
    if (!safeUser.checkInEnabled || checkedInToday || loading) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-in" }),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "签到失败", "签到失败")
        return
      }

      const checkedInDate = result.data?.date ?? todayKey
      syncCheckInState({
        points: result.data?.points ?? points,
        checkedInToday: true,
      })
      upsertCalendarEntry({
        date: checkedInDate,
        reward: safeUser.checkInReward ?? 0,
        isMakeUp: false,
        makeUpCost: 0,
        createdAt: new Date().toISOString(),
      })
      toast.success(result.message ?? "签到成功", "签到成功")
      void loadCalendar(calendarMonth)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleMakeUp(date: string) {
    if (loading) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "make-up", date }),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message ?? "补签失败", "补签失败")
        return
      }

      const checkedInDate = result.data?.date ?? date
      const reward = calendarData?.checkInReward ?? safeUser.checkInReward ?? 0
      const makeUpCost = result.data?.makeUpCost ?? calendarData?.makeUpPrice ?? effectiveMakeUpPrice

      syncCheckInState({
        points: result.data?.points ?? points,
        checkedInToday: checkedInDate === todayKey ? true : checkedInToday,
      })
      upsertCalendarEntry({
        date: checkedInDate,
        reward,
        isMakeUp: true,
        makeUpCost,
        createdAt: new Date().toISOString(),
      })
      toast.success(result.message ?? "补签成功", "补签成功")
      void loadCalendar(calendarMonth)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-[24px] border border-border bg-card shadow-sm shadow-black/5 dark:shadow-black/30">
        <div className="sidebar-user-card-header p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <Link href={`/users/${currentUser.username}`} className={cn("shrink-0", isRestrictedUser && "grayscale")}>
                <UserAvatar name={currentUser.nickname ?? currentUser.username} avatarPath={currentUser.avatarPath} size="md" isVip={vipActive} vipLevel={currentUser.vipLevel} />
              </Link>
              <div className={cn("min-w-0 flex-1", isRestrictedUser && "grayscale")}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link href={`/users/${currentUser.username}`} className="truncate text-sm font-semibold hover:underline">
                    {currentUser.nickname ?? currentUser.username}
                  </Link>
                  {vipActive ? <VipBadge level={getVipLevel(currentUser)} compact /> : null}
                  {isRestrictedUser ? <UserStatusBadge status={currentUser.status} compact /> : null}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {currentUser.level && currentUser.levelName && currentUser.levelColor && currentUser.levelIcon ? (
                    <LevelBadge level={currentUser.level} name={currentUser.levelName} color={currentUser.levelColor} icon={currentUser.levelIcon} compact />
                  ) : null}
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${roleBadge.className}`}>
                    {roleBadge.label}
                  </span>
                </div>
              </div>
            </div>
            <Link
              href="/settings"
              aria-label="前往设置"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="space-y-3.5 p-4">
          <div className="grid grid-cols-4 gap-1.5">
            <InlineStatBlock label="收藏" value={currentUser.favoriteCount} icon={<Star className="h-3 w-3" />} href="/settings?tab=post-management&postTab=favorites" />
            <InlineStatBlock label="内容" value={currentUser.postCount} icon={<Plus className="h-3 w-3" />} href="/settings?tab=post-management&postTab=posts" />
            <InlineStatBlock label="获赞" value={currentUser.receivedLikeCount} icon={<Heart className="h-3 w-3" />} />
            <InlineStatBlock label="粉丝" value={currentUser.followerCount} icon={<Users className="h-3 w-3" />} href="/settings?tab=follows&followTab=followers" />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-amber-200 bg-amber-50/70 px-3 py-2.5 dark:border-amber-400/20 dark:bg-amber-400/10">
            <Link href="/settings?tab=points" className="flex min-w-0 items-center gap-2 text-amber-900 transition-opacity hover:opacity-80 dark:text-amber-100">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 text-amber-600 shadow-sm shadow-amber-950/5 dark:bg-amber-50/10 dark:text-amber-200">
                <Wallet className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-amber-800/80 dark:text-amber-200/80">{pointName}</p>
                <p className="truncate text-sm font-semibold">{points}</p>
              </div>
            </Link>

            {safeUser.checkInEnabled ? (
              <Button
                className={checkedInToday ? "h-9 shrink-0 rounded-lg gap-1.5 px-3 text-xs bg-muted text-muted-foreground hover:bg-muted" : "h-9 shrink-0 rounded-lg gap-1.5 px-3 text-xs"}
                onClick={() => setCalendarOpen(true)}
              >
                <CalendarDays className="h-4 w-4" />
                {checkedInToday ? "已签到" : "签到"}
              </Button>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-border/80 pt-3">
            <Link href={createPostHref} className="block col-span-2">
              <Button className="h-9 w-full gap-1.5 rounded-lg text-xs">
                <Plus className="h-3.5 w-3.5" />
                创建主题
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <AdminModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        size="md"
        title="签到日历"
        description="在日历中查看签到记录，今天可直接签到，未签到的可使用补签卡。"
      >
        <div className="space-y-3">
          <div className="grid gap-2.5 md:grid-cols-3">
            <InfoPanel title="今日签到" value={`${currentUser.checkInReward ?? 0} ${pointName}`} description={checkedInToday ? `今日已完成签到，${checkInRewardDescription}` : `${checkInRewardDescription}，点击下方按钮立即领取`} />
            <InfoPanel title="补签卡价格" value={`${calendarData?.makeUpPrice ?? effectiveMakeUpPrice} ${pointName}`} description={makeUpPriceDescription} />
            <InfoPanel title="账户余额" value={`${points} ${pointName}`} description="补签时将自动从余额中扣除" />
          </div>

          <div className="flex flex-col gap-3 rounded-[20px] border border-border p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" className="h-9 rounded-lg px-3" onClick={() => setCalendarMonth((current) => getMonthKey(addMonths(new Date(`${current}-01T00:00:00`), -1)))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[120px] text-center text-sm font-semibold">{getMonthTitle(calendarMonth)}</div>
              <Button type="button" variant="outline" className="h-9 rounded-lg px-3" onClick={() => setCalendarMonth((current) => getMonthKey(addMonths(new Date(`${current}-01T00:00:00`), 1)))} disabled={calendarMonth >= getMonthKey()}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" className="h-9 rounded-lg px-4 text-xs" onClick={handleCheckIn} disabled={checkedInToday || loading}>
                {checkedInToday ? (
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    今日已签到
                  </span>
                ) : loading ? "签到中..." : "立即签到"}
              </Button>
              <Button type="button" variant="outline" className="h-9 rounded-lg px-4 text-xs" onClick={() => void loadCalendar(calendarMonth)} disabled={calendarLoading}>
                {calendarLoading ? "加载中..." : "刷新日历"}
              </Button>
            </div>
          </div>

          <div className="rounded-[20px] border border-border p-4">
            <div className="mb-3 grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
              {['日', '一', '二', '三', '四', '五', '六'].map((label) => (
                <div key={label}>{label}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((cell, index) => {
                if (!cell.date || !cell.day) {
                  return <div key={`empty-${index}`} className="aspect-square rounded-2xl border border-dashed border-border/60 bg-muted/20" />
                }

                const activeDate = cell.date
                const entry = calendarEntries.get(activeDate)
                const isToday = activeDate === todayKey
                const isPast = activeDate < todayKey
                const canMakeUp = !entry && isPast && Boolean(currentUser.checkInEnabled)

                return (
                  <button
                    key={activeDate}
                    type="button"
                    disabled={!canMakeUp || loading}
                    onClick={() => {
                      if (canMakeUp) {
                        void handleMakeUp(activeDate)
                      }
                    }}
                    className={cn(
                      "aspect-square rounded-2xl border p-2 text-left transition",
                      entry ? "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100" : "border-border bg-background",
                      canMakeUp ? "hover:border-amber-300 hover:bg-amber-50/60 dark:hover:border-amber-400/30 dark:hover:bg-amber-400/10" : "cursor-default",
                      isToday && !entry ? "border-amber-300 bg-amber-50/70 dark:border-amber-400/30 dark:bg-amber-400/10" : null,
                      !canMakeUp && !entry ? "opacity-80" : null,
                    )}
                  >
                    <div className="flex h-full flex-col justify-between">
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-sm font-semibold">{cell.day}</span>
                        {entry ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : null}
                      </div>
                      <div className="space-y-1 text-[10px] leading-4">
                        {entry ? (
                          <>
                            <div>{entry.isMakeUp ? "已补签" : "已签到"}</div>
                          </>
                        ) : canMakeUp ? (
                          <>
                            <div className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-200">
                              <Wallet className="h-2.5 w-2.5" /> 补签
                            </div>
                          </>
                        ) : isToday ? (
                          <div>可签到</div>
                        ) : (
                          <div className="text-muted-foreground">未签到</div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </AdminModal>
    </>
  )
}

function InlineStatBlock({ label, value, icon, href }: { label: string; value: number; icon: React.ReactNode; href?: string }) {
  const content = (
    <>
      <div className="flex items-center justify-center gap-1 text-sm font-semibold leading-none text-foreground">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-background text-muted-foreground">
          {icon}
        </span>
        <span>{value}</span>
      </div>
      <p className="mt-1 text-[10px] leading-none text-muted-foreground">{label}</p>
    </>
  )

  if (href) {
    return (
      <Link href={href} className="rounded-[12px] border border-border bg-secondary/25 px-2 py-1.5 text-center transition-colors hover:bg-accent/50 dark:bg-secondary/50">
        {content}
      </Link>
    )
  }

  return (
    <div className="rounded-[12px] border border-border bg-secondary/25 px-2 py-1.5 text-center dark:bg-secondary/50">
      {content}
    </div>
  )
}

function InfoPanel({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <div className="rounded-[16px] border border-border bg-secondary/20 p-2.5">
      <p className="text-[11px] text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm font-semibold sm:text-[15px]">{value}</p>
      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{description}</p>
    </div>
  )
}
