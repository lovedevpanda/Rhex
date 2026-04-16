import type { CurrentUserRecord } from "@/db/current-user"
import { executeUserCheckIn, listUserCheckInLogsInRange } from "@/db/check-in-queries"

import { apiError } from "@/lib/api-route"
import { getCheckInMakeUpEarliestDateKey, normalizeCheckInMakeUpOldestDayLimit } from "@/lib/check-in-policy"
import { getUserCheckInStreakSummary } from "@/lib/check-in-streak-service"
import { getLocalDateKey, getMonthKey } from "@/lib/date-key"
import { evaluateUserLevelProgress } from "@/lib/level-system"
import { prepareScopedPointDelta, type PreparedPointDelta } from "@/lib/point-center"
import { getSiteSettings } from "@/lib/site-settings"
import { getVipLevel, isVipActive } from "@/lib/vip-status"

interface CheckInSettingsSnapshot {
  pointName: string
  checkInMakeUpEnabled: boolean
  checkInMakeUpCountsTowardStreak: boolean
  checkInMakeUpOldestDayLimit: number
  checkInReward: number
  checkInVip1Reward: number
  checkInVip2Reward: number
  checkInVip3Reward: number
  checkInMakeUpCardPrice: number
  checkInVip1MakeUpCardPrice: number
  checkInVip2MakeUpCardPrice: number
  checkInVip3MakeUpCardPrice: number
}

interface BuildCheckInCalendarOptions {
  userId: number
  month: string
}

interface ExecuteCheckInOptions {
  userId: number
  dateKey: string
  reward: number
  rewardDelta: PreparedPointDelta
  pointName: string
  makeUpCost: number
  makeUpCostDelta: PreparedPointDelta
  isMakeUp: boolean
  makeUpCountsTowardStreak: boolean
}

interface CheckInActionPayload {
  action: "check-in" | "make-up"
  date?: string
}

export interface CheckInCalendarEntry {
  date: string
  reward: number
  isMakeUp: boolean
  makeUpCost: number
  createdAt: string
}

export interface CheckInOverview {
  month: string
  pointName: string
  currentStreak: number
  maxStreak: number
  makeUpEnabled: boolean
  makeUpCountsTowardStreak: boolean
  makeUpOldestDayLimit: number
  checkInReward: number
  vip1CheckInReward: number
  vip2CheckInReward: number
  vip3CheckInReward: number
  makeUpPrice: number
  vipMakeUpPrice: number
  normalMakeUpPrice: number
  vip1MakeUpPrice: number
  vip2MakeUpPrice: number
  vip3MakeUpPrice: number
  entries: CheckInCalendarEntry[]
}

export interface CheckInActionResult {
  points: number
  alreadyCheckedIn: boolean
  date: string
  currentStreak: number
  maxStreak: number
  makeUpCost?: number
  message: string
}

function parseDateKey(input: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return null
  }

  const date = new Date(`${input}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

function getMonthBounds(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    apiError(400, "月份格式不正确")
  }

  const firstDay = new Date(`${month}-01T00:00:00`)
  if (Number.isNaN(firstDay.getTime())) {
    apiError(400, "月份格式不正确")
  }

  const nextMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 1)
  return {
    start: `${month}-01`,
    end: getLocalDateKey(new Date(nextMonth.getTime() - 24 * 60 * 60 * 1000)),
  }
}

function assertCheckInEnabled(settings: { checkInEnabled: boolean }) {
  if (!settings.checkInEnabled) {
    apiError(403, "签到功能暂未开启")
  }
}

function readCheckInSettingsSnapshot(settings: CheckInSettingsSnapshot) {
  return {
    pointName: settings.pointName,
    checkInMakeUpEnabled: settings.checkInMakeUpEnabled,
    checkInMakeUpCountsTowardStreak: settings.checkInMakeUpCountsTowardStreak,
    checkInMakeUpOldestDayLimit: normalizeCheckInMakeUpOldestDayLimit(settings.checkInMakeUpOldestDayLimit),
    normalReward: Math.max(0, settings.checkInReward),
    vip1Reward: Math.max(0, settings.checkInVip1Reward),
    vip2Reward: Math.max(0, settings.checkInVip2Reward),
    vip3Reward: Math.max(0, settings.checkInVip3Reward),
    normalMakeUpPrice: Math.max(0, settings.checkInMakeUpCardPrice),
    vip1MakeUpPrice: Math.max(0, settings.checkInVip1MakeUpCardPrice),
    vip2MakeUpPrice: Math.max(0, settings.checkInVip2MakeUpCardPrice),
    vip3MakeUpPrice: Math.max(0, settings.checkInVip3MakeUpCardPrice),
  }
}

function resolveUserCheckInReward(
  snapshot: ReturnType<typeof readCheckInSettingsSnapshot>,
  user: Pick<CurrentUserRecord, "vipLevel" | "vipExpiresAt">,
) {
  if (!isVipActive(user)) {
    return snapshot.normalReward
  }

  const vipLevel = getVipLevel(user)
  if (vipLevel >= 3) {
    return snapshot.vip3Reward
  }

  if (vipLevel === 2) {
    return snapshot.vip2Reward
  }

  return snapshot.vip1Reward
}

function resolveUserMakeUpPrice(
  snapshot: ReturnType<typeof readCheckInSettingsSnapshot>,
  user: Pick<CurrentUserRecord, "vipLevel" | "vipExpiresAt">,
) {
  if (!isVipActive(user)) {
    return snapshot.normalMakeUpPrice
  }

  const vipLevel = getVipLevel(user)
  if (vipLevel >= 3) {
    return snapshot.vip3MakeUpPrice
  }

  if (vipLevel === 2) {
    return snapshot.vip2MakeUpPrice
  }

  return snapshot.vip1MakeUpPrice
}

async function buildCalendarData(options: BuildCheckInCalendarOptions): Promise<CheckInCalendarEntry[]> {
  const bounds = getMonthBounds(options.month)
  const logs = await listUserCheckInLogsInRange({
    userId: options.userId,
    startDateKey: bounds.start,
    endDateKey: bounds.end,
  })

  return logs.map((item) => ({
    date: item.checkedInOn,
    reward: item.reward,
    isMakeUp: item.isMakeUp,
    makeUpCost: item.makeUpCost,
    createdAt: item.createdAt.toISOString(),
  }))
}

async function executeCheckIn(options: ExecuteCheckInOptions) {
  const result = await executeUserCheckIn(options)

  if (!result) {
    apiError(404, "用户不存在")
  }

  if (options.isMakeUp && options.makeUpCost > 0 && !result.alreadyCheckedIn && result.points < 0) {
    apiError(409, `${options.pointName}不足，无法补签`)
  }

  if (!result.alreadyCheckedIn) {
    await evaluateUserLevelProgress(options.userId, { notifyOnUpgrade: true })
  }

  return result
}

function parseCheckInActionPayload(body: unknown): CheckInActionPayload {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { action: "check-in" }
  }

  const record = body as Record<string, unknown>
  const action = record.action === "make-up" ? "make-up" : "check-in"
  const date = typeof record.date === "string" ? record.date.trim() : ""

  return action === "make-up"
    ? { action, ...(date ? { date } : {}) }
    : { action }
}

export async function getCheckInOverview(user: CurrentUserRecord, month = getMonthKey()): Promise<CheckInOverview> {
  const settings = await getSiteSettings()
  assertCheckInEnabled(settings)

  const snapshot = readCheckInSettingsSnapshot(settings)
  const [entries, streakSummary] = await Promise.all([
    buildCalendarData({ userId: user.id, month }),
    getUserCheckInStreakSummary(user.id),
  ])

  return {
    month,
    pointName: snapshot.pointName,
    currentStreak: streakSummary.currentStreak,
    maxStreak: streakSummary.maxStreak,
    makeUpEnabled: snapshot.checkInMakeUpEnabled,
    makeUpCountsTowardStreak: streakSummary.makeUpCountsTowardStreak,
    makeUpOldestDayLimit: snapshot.checkInMakeUpOldestDayLimit,
    checkInReward: resolveUserCheckInReward(snapshot, user),
    vip1CheckInReward: snapshot.vip1Reward,
    vip2CheckInReward: snapshot.vip2Reward,
    vip3CheckInReward: snapshot.vip3Reward,
    makeUpPrice: resolveUserMakeUpPrice(snapshot, user),
    vipMakeUpPrice: snapshot.vip1MakeUpPrice,
    normalMakeUpPrice: snapshot.normalMakeUpPrice,
    vip1MakeUpPrice: snapshot.vip1MakeUpPrice,
    vip2MakeUpPrice: snapshot.vip2MakeUpPrice,
    vip3MakeUpPrice: snapshot.vip3MakeUpPrice,
    entries,
  }
}

export async function submitCheckInAction(user: CurrentUserRecord, body: unknown): Promise<CheckInActionResult> {
  const settings = await getSiteSettings()
  assertCheckInEnabled(settings)

  const snapshot = readCheckInSettingsSnapshot(settings)
  const payload = parseCheckInActionPayload(body)
  const todayKey = getLocalDateKey()
  const reward = resolveUserCheckInReward(snapshot, user)
  const rewardDelta = await prepareScopedPointDelta({
    scopeKey: "CHECK_IN_REWARD",
    baseDelta: reward,
    userId: user.id,
  })

  if (payload.action === "check-in") {
    const result = await executeCheckIn({
      userId: user.id,
      dateKey: todayKey,
      reward,
      rewardDelta,
      pointName: snapshot.pointName,
      makeUpCost: 0,
      makeUpCostDelta: {
        scopeKey: "CHECK_IN_MAKE_UP_COST",
        baseDelta: 0,
        finalDelta: 0,
        appliedRules: [],
      },
      isMakeUp: false,
      makeUpCountsTowardStreak: snapshot.checkInMakeUpCountsTowardStreak,
    })
    const streakSummary = await getUserCheckInStreakSummary(user.id)

    return {
      points: result.points,
      alreadyCheckedIn: result.alreadyCheckedIn,
      date: todayKey,
      currentStreak: streakSummary.currentStreak,
      maxStreak: streakSummary.maxStreak,
      message: result.alreadyCheckedIn
        ? "今天已经签到过了"
        : rewardDelta.finalDelta !== 0
          ? `签到成功，相关${snapshot.pointName}已结算`
          : "签到成功",
    }
  }

  const parsedDate = parseDateKey(payload.date ?? "")
  if (!parsedDate) {
    apiError(400, "补签日期格式不正确")
  }

  const targetDateKey = getLocalDateKey(parsedDate)
  if (targetDateKey >= todayKey) {
    apiError(400, "只能补签今天之前的日期")
  }

  if (!snapshot.checkInMakeUpEnabled) {
    apiError(403, "补签功能暂未开启")
  }

  const earliestMakeUpDateKey = getCheckInMakeUpEarliestDateKey(todayKey, snapshot.checkInMakeUpOldestDayLimit)
  if (earliestMakeUpDateKey && targetDateKey < earliestMakeUpDateKey) {
    apiError(400, `当前仅允许补签最近 ${snapshot.checkInMakeUpOldestDayLimit} 天内的历史日期`)
  }

  const makeUpCost = resolveUserMakeUpPrice(snapshot, user)
  const makeUpCostDelta = await prepareScopedPointDelta({
    scopeKey: "CHECK_IN_MAKE_UP_COST",
    baseDelta: -makeUpCost,
    userId: user.id,
  })
  if (makeUpCostDelta.finalDelta < 0 && user.points < Math.abs(makeUpCostDelta.finalDelta)) {
    apiError(409, `${snapshot.pointName}不足，无法补签`)
  }

  const result = await executeCheckIn({
    userId: user.id,
    dateKey: targetDateKey,
    reward,
    rewardDelta,
    pointName: snapshot.pointName,
    makeUpCost,
    makeUpCostDelta,
    isMakeUp: true,
    makeUpCountsTowardStreak: snapshot.checkInMakeUpCountsTowardStreak,
  })

  if (result.alreadyCheckedIn) {
    apiError(409, "该日期已经签到过了")
  }
  const streakSummary = await getUserCheckInStreakSummary(user.id)

  return {
    points: result.points,
    alreadyCheckedIn: false,
    date: targetDateKey,
    currentStreak: streakSummary.currentStreak,
    maxStreak: streakSummary.maxStreak,
    makeUpCost,
    message: makeUpCostDelta.finalDelta !== 0 || rewardDelta.finalDelta !== 0
      ? `补签成功，相关${snapshot.pointName}已结算`
      : "补签成功",
  }
}
