"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Heart, Plus, RotateCcw, Settings, Star, Trophy, Users, Wallet, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useCurrentUser } from "@/components/current-user-provider"
import { showConfirm } from "@/components/ui/alert-dialog"
import { Modal } from "@/components/ui/modal"
import { LevelBadge } from "@/components/level-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipRoot, TooltipTrigger } from "@/components/ui/tooltip"
import { UserAvatar } from "@/components/user/user-avatar"
import { UserStatusBadge } from "@/components/user/user-status-badge"
import { VipBadge } from "@/components/vip/vip-badge"
import { Button } from "@/components/ui/rbutton"
import { toast } from "@/components/ui/toast"
import { getCheckInMakeUpEarliestDateKey } from "@/lib/check-in-policy"
import { getLocalDateKey, getMonthKey, getMonthTitle } from "@/lib/date-key"
import { buildLoginHrefWithRedirect } from "@/lib/auth-redirect"
import { formatCompactNumber, formatCompactPointValue, formatNumber } from "@/lib/formatters"
import { resolveSiteIconPath } from "@/lib/site-branding"
import type { PublicUserRoleBadge } from "@/lib/user-presentation"
import { cn } from "@/lib/utils"
import { getVipLevel, getVipNameClass, isVipActive } from "@/lib/vip-status"

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
  currentStreak: number
  maxStreak: number
  makeUpEnabled: boolean
  makeUpCountsTowardStreak: boolean
  makeUpOldestDayLimit: number
  checkInReward: number
  checkInRewardText: string
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
  displayName?: string | null
  avatarPath?: string | null
  role?: "USER" | "MODERATOR" | "ADMIN" | null
  roleBadge?: PublicUserRoleBadge | null
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
  checkInRewardText?: string
  checkInMakeUpEnabled?: boolean
  checkInMakeUpCardPrice?: number
  checkInVipMakeUpCardPrice?: number
  checkInVip1MakeUpCardPrice?: number
  checkInVip2MakeUpCardPrice?: number
  checkInVip3MakeUpCardPrice?: number
  checkInMakeUpCountsTowardStreak?: boolean
  checkInMakeUpOldestDayLimit?: number
  checkedInToday?: boolean
  currentCheckInStreak?: number
  maxCheckInStreak?: number
}

function formatRewardAmountLabel(reward: number) {
  if (reward > 0) {
    return `+${formatCompactPointValue(reward)}`
  }

  if (reward < 0) {
    return `-${formatCompactPointValue(Math.abs(reward))}`
  }

  return "0"
}

function formatRewardRangeLabel(rewardText: string | undefined, reward: number | undefined, pointName: string) {
  if (typeof rewardText === "string" && rewardText.trim()) {
    return `${rewardText.trim()} ${pointName}`
  }

  return `${formatCompactPointValue(reward ?? 0)} ${pointName}`
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

function getDefaultRoleBadgeConfig(role?: SidebarUserCardData["role"]) {
  if (role === "ADMIN") {
    return {
      label: "管理员",
      title: "管理员",
      className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
    }
  }

  if (role === "MODERATOR") {
    return {
      label: "版主",
      title: "版主",
      className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
    }
  }

  return null
}

function getRoleBadgeToneClassName(roleBadge: PublicUserRoleBadge) {
  if (roleBadge.key === "admin" || roleBadge.tone === "danger") {
    return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200"
  }

  if (roleBadge.key === "moderator" || roleBadge.tone === "sky") {
    return "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200"
  }

  if (roleBadge.tone === "warning") {
    return "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-200"
  }

  if (roleBadge.tone === "vip") {
    return "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200"
  }

  if (roleBadge.tone === "level") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
  }

  if (roleBadge.tone === "orange") {
    return "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200"
  }

  return "bg-secondary text-muted-foreground dark:bg-white/6 dark:text-slate-300"
}

function getRoleBadgeConfig(
  roleBadge: SidebarUserCardData["roleBadge"] | undefined,
  role?: SidebarUserCardData["role"],
) {
  if (roleBadge === null) {
    return null
  }

  if (roleBadge === undefined) {
    return getDefaultRoleBadgeConfig(role)
  }

  return {
    label: roleBadge.label,
    title: roleBadge.tooltip?.trim() || roleBadge.label,
    className: getRoleBadgeToneClassName(roleBadge),
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

type CheckInState = {
  points: number
  checkedInToday: boolean
  currentCheckInStreak: number
  maxCheckInStreak: number
}

function CalendarPendingStatusIcon({
  type,
  pointName,
  makeUpPrice,
}: {
  type: "today" | "make-up"
  pointName: string
  makeUpPrice: number
}) {
  if (type === "today") {
    return (
      <span
        aria-label="今天可签到"
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200"
      >
        <span className="size-1.5 rounded-full bg-current" />
      </span>
    )
  }

  return (
    <span
      aria-label={`可补签，需 ${formatCompactPointValue(makeUpPrice)} ${pointName}`}
      className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
    >
      <Wallet className="h-2.5 w-2.5" />
    </span>
  )
}

export function SidebarUserCard({ user, createPostHref = "/write", siteName = "知识型兴趣社区", siteDescription = "把时间浪费在你真正热爱的事情上。这里更适合持续浏览、慢慢讨论、围绕兴趣沉淀长期内容。", siteLogoPath, siteIconPath }: { user: SidebarUserCardData | null; createPostHref?: string; siteName?: string; siteDescription?: string; siteLogoPath?: string | null; siteIconPath?: string | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { refresh: refreshCurrentUser } = useCurrentUser()
  const currentUser = user
  const currentSearch = searchParams.toString()
  const currentPath = `${pathname}${currentSearch ? `?${currentSearch}` : ""}`
  const loginHref = buildLoginHrefWithRedirect(currentPath)
  const userPoints = user?.points ?? 0
  const userCheckedInToday = Boolean(user?.checkedInToday)
  const userCurrentCheckInStreak = user?.currentCheckInStreak ?? 0
  const userMaxCheckInStreak = user?.maxCheckInStreak ?? 0
  const checkInStateSource = JSON.stringify([
    userPoints,
    userCheckedInToday,
    userCurrentCheckInStreak,
    userMaxCheckInStreak,
  ])
  const initialCheckInState = useMemo(
    () => ({
      points: userPoints,
      checkedInToday: userCheckedInToday,
      currentCheckInStreak: userCurrentCheckInStreak,
      maxCheckInStreak: userMaxCheckInStreak,
    }),
    [userCheckedInToday, userCurrentCheckInStreak, userMaxCheckInStreak, userPoints],
  )
  const [storedCheckInState, setStoredCheckInState] = useState(() => ({
    source: checkInStateSource,
    value: initialCheckInState,
  }))
  const checkInState = storedCheckInState.source === checkInStateSource
    ? storedCheckInState.value
    : initialCheckInState
  const [loading, setLoading] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(getMonthKey())
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [calendarData, setCalendarData] = useState<CheckInCalendarResponse | null>(null)
  const calendarRequestIdRef = useRef(0)
  const makeUpConfirmPendingRef = useRef(false)
  const calendarEntries = useMemo(() => new Map((calendarData?.entries ?? []).map((item) => [item.date, item])), [calendarData?.entries])
  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth])
  const { points, checkedInToday, currentCheckInStreak, maxCheckInStreak } = checkInState
  const syncCheckInState = useCallback((next: Partial<CheckInState>) => {
    setStoredCheckInState((current) => ({
      source: checkInStateSource,
      value: {
        ...(current.source === checkInStateSource ? current.value : initialCheckInState),
        ...next,
      },
    }))
  }, [checkInStateSource, initialCheckInState])

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

      if (result.data) {
        syncCheckInState({
          currentCheckInStreak: result.data.currentStreak ?? currentCheckInStreak,
          maxCheckInStreak: result.data.maxStreak ?? maxCheckInStreak,
        })
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
  }, [currentCheckInStreak, maxCheckInStreak, syncCheckInState])

  useEffect(() => {
    if (!calendarOpen || !currentUser?.checkInEnabled) {
      return
    }

    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        void loadCalendar(calendarMonth)
      }
    })

    return () => {
      cancelled = true
    }
  }, [calendarMonth, calendarOpen, currentUser?.checkInEnabled, loadCalendar])

  if (!currentUser) {
    return (
      <div className="mobile-sidebar-section overflow-hidden rounded-xl border border-border bg-card shadow-xs shadow-black/5 dark:shadow-black/30">
        <div className="sidebar-user-card-header p-4">
          <div className="flex items-center gap-3">
            {siteLogoPath ? (
              <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-border bg-background">
                <Image src={siteLogoPath} alt={`${siteName} Logo`} fill sizes="40px" unoptimized className="object-contain p-1.5" />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl">
                <Image src={resolveSiteIconPath(siteIconPath)} alt="" width={18} height={18} className="h-10 w-10" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold">{siteName}</h3>
              <p className="mt-1 text-[11px] text-muted-foreground">登录后即可签到、查看积分与快捷发帖</p>
            </div>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-sm leading-6 text-muted-foreground">{siteDescription}</p>
          <div className="grid grid-cols-2 gap-2 border-t border-border/80 pt-3">
            <Link href={loginHref} className="block">
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
  const displayName = safeUser.displayName ?? safeUser.nickname ?? safeUser.username
  const pointName = safeUser.pointName ?? "积分"
  const vipActive = isVipActive(safeUser)

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

  const roleBadge = getRoleBadgeConfig(safeUser.roleBadge, safeUser.role)
  const isRestrictedUser = safeUser.status === "BANNED" || safeUser.status === "MUTED"
  const effectiveMakeUpPrice = resolveCurrentMakeUpPrice(safeUser)
  const normalMakeUpPrice = calendarData?.normalMakeUpPrice ?? (safeUser.checkInMakeUpCardPrice ?? 0)
  const vip1MakeUpPrice = calendarData?.vip1MakeUpPrice ?? (safeUser.checkInVip1MakeUpCardPrice ?? safeUser.checkInVipMakeUpCardPrice ?? 0)
  const vip2MakeUpPrice = calendarData?.vip2MakeUpPrice ?? (safeUser.checkInVip2MakeUpCardPrice ?? safeUser.checkInVipMakeUpCardPrice ?? 0)
  const vip3MakeUpPrice = calendarData?.vip3MakeUpPrice ?? (safeUser.checkInVip3MakeUpCardPrice ?? safeUser.checkInVipMakeUpCardPrice ?? 0)
  const makeUpEnabled = calendarData?.makeUpEnabled ?? safeUser.checkInMakeUpEnabled ?? true
  const makeUpOldestDayLimit = calendarData?.makeUpOldestDayLimit ?? safeUser.checkInMakeUpOldestDayLimit ?? 0
  const checkInRewardDescription = vipActive
    ? `当前按 VIP${getVipLevel(safeUser)} 奖励发放`
    : "当前按普通用户奖励发放"
  const makeUpPriceDescription = vipActive
    ? `当前按 VIP${getVipLevel(safeUser)} 价结算，普通 ${formatCompactPointValue(normalMakeUpPrice)} / VIP1 ${formatCompactPointValue(vip1MakeUpPrice)} / VIP2 ${formatCompactPointValue(vip2MakeUpPrice)} / VIP3 ${formatCompactPointValue(vip3MakeUpPrice)}`
    : `普通账号价 ${formatCompactPointValue(normalMakeUpPrice)}，VIP1 ${formatCompactPointValue(vip1MakeUpPrice)} / VIP2 ${formatCompactPointValue(vip2MakeUpPrice)} / VIP3 ${formatCompactPointValue(vip3MakeUpPrice)}`
  const checkInStreakDescription = (calendarData?.makeUpCountsTowardStreak ?? safeUser.checkInMakeUpCountsTowardStreak)
    ? "补签会计入连续签到"
    : "补签不会计入连续签到"
  const activeRewardLabel = formatRewardRangeLabel(
    calendarData?.checkInRewardText ?? safeUser.checkInRewardText,
    calendarData?.checkInReward ?? safeUser.checkInReward,
    pointName,
  )
  const todayKey = getLocalDateKey()
  const earliestMakeUpDate = getCheckInMakeUpEarliestDateKey(todayKey, makeUpOldestDayLimit)
  const hasCalendarDataForMonth = calendarData?.month === calendarMonth
  const showCalendarSkeleton = calendarLoading && !hasCalendarDataForMonth
  const checkInButtonTooltip = checkedInToday
    ? `今日已完成签到，${checkInRewardDescription}`
    : `点击可获得 ${activeRewardLabel}，${checkInRewardDescription}`

  function handleOpenCalendar() {
    if (!hasCalendarDataForMonth) {
      setCalendarLoading(true)
    }

    setCalendarOpen(true)
  }

  function changeCalendarMonth(delta: number) {
    const nextMonth = getMonthKey(addMonths(new Date(`${calendarMonth}-01T00:00:00`), delta))
    if (nextMonth === calendarMonth) {
      return
    }

    setCalendarLoading(true)
    setCalendarMonth(nextMonth)
  }

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
        currentCheckInStreak: result.data?.currentStreak ?? currentCheckInStreak,
        maxCheckInStreak: result.data?.maxStreak ?? maxCheckInStreak,
      })
      if (result.data?.alreadyCheckedIn) {
        toast.success(result.message ?? "今天已经签到过了", "签到提示")
        void loadCalendar(calendarMonth)
        void refreshCurrentUser()
        router.refresh()
        return
      }
      upsertCalendarEntry({
        date: checkedInDate,
        reward: result.data?.reward ?? safeUser.checkInReward ?? 0,
        isMakeUp: false,
        makeUpCost: 0,
        createdAt: new Date().toISOString(),
      })
      toast.success(result.message ?? "签到成功", "签到成功")
      void loadCalendar(calendarMonth)
      void refreshCurrentUser()
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleMakeUp(date: string) {
    if (loading || makeUpConfirmPendingRef.current || !makeUpEnabled) {
      return
    }

    const makeUpPrice = calendarData?.makeUpPrice ?? effectiveMakeUpPrice
    const rewardLabel = formatRewardRangeLabel(
      calendarData?.checkInRewardText ?? safeUser.checkInRewardText,
      calendarData?.checkInReward ?? safeUser.checkInReward,
      pointName,
    )
    makeUpConfirmPendingRef.current = true

    try {
      const confirmed = await showConfirm({
        title: "确认补签",
        description: `确认补签 ${date} 吗？\n${makeUpPrice > 0 ? `需消耗：${formatCompactPointValue(makeUpPrice)} ${pointName}` : "本次补签免费"}\n可获得：${rewardLabel}\n${checkInStreakDescription}`,
        confirmText: "确认补签",
      })

      if (!confirmed) {
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
        const makeUpCost = result.data?.makeUpCost ?? makeUpPrice
        const reward = result.data?.reward ?? safeUser.checkInReward ?? 0

        syncCheckInState({
          points: result.data?.points ?? points,
          checkedInToday: checkedInDate === todayKey ? true : checkedInToday,
          currentCheckInStreak: result.data?.currentStreak ?? currentCheckInStreak,
          maxCheckInStreak: result.data?.maxStreak ?? maxCheckInStreak,
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
        void refreshCurrentUser()
        router.refresh()
      } finally {
        setLoading(false)
      }
    } finally {
      makeUpConfirmPendingRef.current = false
    }
  }

  return (
    <>
      <div className="mobile-sidebar-section overflow-hidden rounded-xl border border-border bg-card shadow-xs shadow-black/5 dark:shadow-black/30">
        <div className="sidebar-user-card-header p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <Link href={`/users/${currentUser.username}`} className={cn("shrink-0", isRestrictedUser && "grayscale")}>
                <UserAvatar name={displayName} avatarPath={currentUser.avatarPath} size="md" isVip={vipActive} vipLevel={currentUser.vipLevel} />
              </Link>
              <div className={cn("min-w-0 flex-1", isRestrictedUser && "grayscale")}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link href={`/users/${currentUser.username}`} className={cn("truncate text-sm font-semibold", getVipNameClass(vipActive, currentUser.vipLevel, { interactive: true }))}>
                    {displayName}
                  </Link>
                  {vipActive ? <VipBadge level={getVipLevel(currentUser)} compact /> : null}
                  {isRestrictedUser ? <UserStatusBadge status={currentUser.status} compact /> : null}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {currentUser.level && currentUser.levelName && currentUser.levelColor && currentUser.levelIcon ? (
                    <LevelBadge level={currentUser.level} name={currentUser.levelName} color={currentUser.levelColor} icon={currentUser.levelIcon} compact />
                  ) : null}
                  {roleBadge ? (
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${roleBadge.className}`}
                      title={roleBadge.title}
                    >
                      {roleBadge.label}
                    </span>
                  ) : null}
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

          <div className="flex items-center justify-between gap-3">
            <Link href="/settings?tab=points" className="flex min-w-0 items-center gap-2 text-amber-900 transition-opacity hover:opacity-80 dark:text-amber-100">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 text-amber-600 shadow-xs shadow-amber-950/5 dark:bg-amber-50/10 dark:text-amber-200">
                <Wallet className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-amber-800/80 dark:text-amber-200/80">{pointName}</p>
                <p className="truncate text-sm font-semibold" title={`${formatNumber(points)} ${pointName}`}>{formatCompactPointValue(points)}</p>
              </div>
            </Link>

            {safeUser.checkInEnabled ? (
              <Button
                className={checkedInToday ? "h-9 shrink-0 rounded-lg gap-1.5 px-3 text-xs bg-muted text-muted-foreground hover:bg-muted" : "h-9 shrink-0 rounded-lg gap-1.5 px-3 text-xs"}
                onClick={handleOpenCalendar}
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

      <Modal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        size="md"
        title="签到日历"
        description={`连续签到:${currentCheckInStreak}天，最长连续:${Math.max(maxCheckInStreak, currentCheckInStreak)}天，${checkInStreakDescription}`}
        hideHeaderCloseButtonOnMobile
      >
        <div className="space-y-3">
  

          <div className="flex flex-col gap-3 rounded-xl border border-border p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex w-full items-center justify-center gap-2 md:w-auto md:justify-start">
              <Button type="button" variant="outline" className="h-9 rounded-lg px-3" onClick={() => changeCalendarMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[120px] text-center text-sm font-semibold">{getMonthTitle(calendarMonth)}</div>
              <Button type="button" variant="outline" className="h-9 rounded-lg px-3" onClick={() => changeCalendarMonth(1)} disabled={calendarMonth >= getMonthKey()}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <Tooltip
                content={checkInButtonTooltip}
                align="center"
              >
                <Button type="button" className="h-9 min-w-0 flex-1 rounded-lg px-3 text-xs sm:w-auto sm:flex-none sm:px-4" onClick={handleCheckIn} disabled={checkedInToday || loading}>
                  {checkedInToday ? (
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      已签到
                    </span>
                  ) : loading ? "签到中..." : "签到"}
                </Button>
              </Tooltip>
              <Button
                type="button"
                variant="outline"
                className="size-8 shrink-0 rounded-lg p-0 sm:h-9 sm:w-9"
                onClick={() => void loadCalendar(calendarMonth)}
                disabled={calendarLoading}
                aria-label={calendarLoading ? "签到日历加载中" : "刷新签到日历"}
                title={calendarLoading ? "签到日历加载中" : "刷新签到日历"}
              >
                <RotateCcw className={cn("h-3.5 w-3.5", calendarLoading && "animate-spin")} />
                <span className="sr-only">{calendarLoading ? "加载中" : "刷新"}</span>
              </Button>
              <Link
                href="/leaderboards/check-in"
                aria-label="签到排行榜"
                title="签到排行榜"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border transition-colors hover:bg-accent hover:text-foreground sm:h-9 sm:w-9"
              >
                <Trophy className="h-3.5 w-3.5" />
                <span className="sr-only">签到排行榜</span>
              </Link>
              <Button
                type="button"
                variant="ghost"
                className="size-8 shrink-0 rounded-lg p-0 sm:hidden"
                onClick={() => setCalendarOpen(false)}
                aria-label="关闭签到日历"
                title="关闭签到日历"
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">关闭</span>
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border p-3">
            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground sm:text-xs">
              {['日', '一', '二', '三', '四', '五', '六'].map((label) => (
                <div key={label}>{label}</div>
              ))}
            </div>

            {showCalendarSkeleton ? (
              <div className="grid grid-cols-7 gap-1" aria-hidden="true">
                {calendarDays.map((cell, index) => (
                  <div
                    key={cell.date ?? `skeleton-${index}`}
                    className="aspect-square rounded-lg border border-border bg-background p-1"
                  >
                    <div className="flex h-full flex-col items-center justify-center gap-1">
                      <Skeleton className="h-3.5 w-4 sm:h-4 sm:w-5" />
                      <Skeleton className="size-4 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((cell, index) => {
                  if (!cell.date || !cell.day) {
                    return <div key={`empty-${index}`} className="aspect-square rounded-lg border border-dashed border-border/60 bg-muted/20" />
                  }

                  const activeDate = cell.date
                  const entry = calendarEntries.get(activeDate)
                  const isToday = activeDate === todayKey
                  const isPast = activeDate < todayKey
                  const withinMakeUpWindow = !earliestMakeUpDate || activeDate >= earliestMakeUpDate
                  const canMakeUp = !entry && isPast && Boolean(currentUser.checkInEnabled) && makeUpEnabled && withinMakeUpWindow
                  const cellTooltip = entry
                    ? `${activeDate} 获得 ${formatCompactPointValue(entry.reward)} ${pointName}${entry.makeUpCost > 0 ? `，消耗 ${formatCompactPointValue(entry.makeUpCost)} ${pointName}` : ""}`
                    : isToday
                      ? `${activeDate} 可签到，预计获得 ${activeRewardLabel}`
                      : !isPast || !currentUser.checkInEnabled
                        ? undefined
                        : !makeUpEnabled
                          ? "补签功能未开启"
                          : !withinMakeUpWindow
                            ? `当前仅允许补签 ${earliestMakeUpDate}（含）之后的历史日期`
                            : `${activeDate} 可补签，需 ${formatCompactPointValue(calendarData?.makeUpPrice ?? effectiveMakeUpPrice)} ${pointName}。${makeUpPriceDescription}`

                  const cellButton = (
                    <button
                      type="button"
                      aria-label={cellTooltip}
                      disabled={!canMakeUp || loading}
                      onClick={() => {
                        if (canMakeUp) {
                          void handleMakeUp(activeDate)
                        }
                      }}
                      className={cn(
                        "h-full w-full rounded-lg border p-1 text-center transition",
                        entry
                          ? entry.isMakeUp
                            ? "border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100"
                            : "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100"
                          : "border-border bg-background",
                        canMakeUp ? "hover:border-amber-300 hover:bg-amber-50/60 dark:hover:border-amber-400/30 dark:hover:bg-amber-400/10" : "cursor-default",
                        isToday && !entry ? "border-amber-300 bg-amber-50/70 dark:border-amber-400/30 dark:bg-amber-400/10" : null,
                        !canMakeUp && !entry ? "opacity-80" : null,
                      )}
                    >
                      <div className="flex h-full flex-col items-center justify-center gap-0.5">
                        <span className="text-xs font-semibold leading-none sm:text-sm">{cell.day}</span>
                        <div className="flex h-5 items-center justify-center">
                          {entry ? (
                            <span className={cn(
                              "max-w-full truncate text-[11px] font-semibold leading-none sm:text-xs",
                              entry.isMakeUp
                                ? "text-amber-700 dark:text-amber-100"
                                : "text-emerald-700 dark:text-emerald-100",
                            )}
                            >
                              {formatRewardAmountLabel(entry.reward)}
                            </span>
                          ) : canMakeUp ? (
                            <CalendarPendingStatusIcon
                              type="make-up"
                              pointName={pointName}
                              makeUpPrice={calendarData?.makeUpPrice ?? effectiveMakeUpPrice}
                            />
                          ) : isToday ? (
                            <CalendarPendingStatusIcon
                              type="today"
                              pointName={pointName}
                              makeUpPrice={calendarData?.makeUpPrice ?? effectiveMakeUpPrice}
                            />
                          ) : null}
                        </div>
                      </div>
                    </button>
                  )

                  if (!cellTooltip) {
                    return (
                      <div key={activeDate} className="aspect-square">
                        {cellButton}
                      </div>
                    )
                  }

                  return (
                    <TooltipRoot key={activeDate}>
                      <TooltipTrigger render={<div className="aspect-square" />}>
                        {cellButton}
                      </TooltipTrigger>
                      <TooltipContent align="center">
                        {cellTooltip}
                      </TooltipContent>
                    </TooltipRoot>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}

function InlineStatBlock({ label, value, icon, href }: { label: string; value: number; icon: React.ReactNode; href?: string }) {
  const content = (
    <>
      <div className="flex items-center justify-center gap-1 text-sm font-semibold leading-none text-foreground">
        <span className="flex size-4 items-center justify-center rounded-full bg-background text-muted-foreground">
          {icon}
        </span>
        <span className="tabular-nums" title={`${formatNumber(value)} ${label}`}>{formatCompactNumber(value)}</span>
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
