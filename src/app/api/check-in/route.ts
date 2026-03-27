import { ChangeType } from "@/db/types"

import { requireActiveCurrentUserRecord } from "@/db/current-user"
import { apiError, apiSuccess, createCustomRouteHandler, readJsonBody, readOptionalStringField } from "@/lib/api-route"
import { prisma } from "@/db/client"
import { getLocalDateKey, getMonthKey } from "@/lib/date-key"

import { recordUserCheckInGrowth } from "@/lib/level-system"
import { getSiteSettings } from "@/lib/site-settings"
import { isVipActive } from "@/lib/vip-status"


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
    return null
  }

  const firstDay = new Date(`${month}-01T00:00:00`)
  if (Number.isNaN(firstDay.getTime())) {
    return null
  }

  const nextMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 1)
  return {
    start: `${month}-01`,
    end: getLocalDateKey(new Date(nextMonth.getTime() - 24 * 60 * 60 * 1000)),
  }
}

async function buildCalendarData(userId: number, month: string) {
  const bounds = getMonthBounds(month)
  if (!bounds) {
    throw new Error("月份格式不正确")
  }

  const logs = await prisma.userCheckInLog.findMany({
    where: {
      userId,
      checkedInOn: {
        gte: bounds.start,
        lte: bounds.end,
      },
    },
    orderBy: [{ checkedInOn: "asc" }],
  })

  return logs.map((item) => ({
    date: item.checkedInOn,
    reward: item.reward,
    isMakeUp: item.isMakeUp,
    makeUpCost: item.makeUpCost,
    createdAt: item.createdAt.toISOString(),
  }))
}

async function performCheckIn(params: {
  userId: number
  dateKey: string
  reward: number
  pointName: string
  makeUpCost: number
  isMakeUp: boolean
}) {
  const result = await prisma.$transaction(async (tx) => {
    const dbUser = await tx.user.findUnique({ where: { id: params.userId } })
    if (!dbUser) {
      throw new Error("用户不存在")
    }

    const existing = await tx.userCheckInLog.findUnique({
      where: {
        userId_checkedInOn: {
          userId: dbUser.id,
          checkedInOn: params.dateKey,
        },
      },
    })

    if (existing) {
      return { alreadyCheckedIn: true, points: dbUser.points }
    }

    if (params.isMakeUp && params.makeUpCost > 0 && dbUser.points < params.makeUpCost) {
      throw new Error(`${params.pointName}不足，无法补签`)
    }

    const pointDelta = params.reward - params.makeUpCost
    const updatedUser = await tx.user.update({
      where: { id: dbUser.id },
      data: {
        points: {
          increment: pointDelta,
        },
      },
    })

    await tx.userCheckInLog.create({
      data: {
        userId: dbUser.id,
        reward: params.reward,
        checkedInOn: params.dateKey,
        isMakeUp: params.isMakeUp,
        makeUpCost: params.makeUpCost,
      },
    })

    if (params.makeUpCost > 0) {
      await tx.pointLog.create({
        data: {
          userId: dbUser.id,
          changeType: ChangeType.DECREASE,
          changeValue: params.makeUpCost,
          reason: `购买签到补签卡，消耗${params.pointName}`,
        },
      })
    }

    if (params.reward > 0) {
      await tx.pointLog.create({
        data: {
          userId: dbUser.id,
          changeType: ChangeType.INCREASE,
          changeValue: params.reward,
          reason: params.isMakeUp ? `补签获得${params.pointName}` : `每日签到获得${params.pointName}`,
        },
      })
    }

    return { alreadyCheckedIn: false, points: updatedUser.points }
  })

  if (!result.alreadyCheckedIn) {
    await recordUserCheckInGrowth(params.userId)
  }

  return result
}

async function buildCheckInContext() {
  try {
    return await requireActiveCurrentUserRecord()
  } catch {
    apiError(403, "当前账号状态不可执行该操作")
  }
}

export const GET = createCustomRouteHandler(async ({ request, context: user }) => {
  const settings = await getSiteSettings()
  if (!settings.checkInEnabled) {
    apiError(403, "签到功能暂未开启")
  }

  const month = new URL(request.url).searchParams.get("month") || getMonthKey()
  const entries = await buildCalendarData(user.id, month)
  const vipActive = isVipActive(user)
  const makeUpPrice = vipActive ? settings.checkInVipMakeUpCardPrice : settings.checkInMakeUpCardPrice

  return apiSuccess({
    month,
    pointName: settings.pointName,
    checkInReward: settings.checkInReward,
    makeUpPrice,
    vipMakeUpPrice: settings.checkInVipMakeUpCardPrice,
    normalMakeUpPrice: settings.checkInMakeUpCardPrice,
    entries,
  })
}, {
  buildContext: buildCheckInContext,
  errorMessage: "获取签到日历失败",
  logPrefix: "[api/check-in:GET] unexpected error",
})

export const POST = createCustomRouteHandler(async ({ request, context: user }) => {
  const settings = await getSiteSettings()
  if (!settings.checkInEnabled) {
    apiError(403, "签到功能暂未开启")
  }

  let body: { action?: string; date?: string } = {}
  try {
    body = await readJsonBody<{ action?: string; date?: string }>(request)
  } catch {
    body = {}
  }

  const action = body.action === "make-up" ? "make-up" : "check-in"
  const todayKey = getLocalDateKey()
  const reward = Math.max(0, settings.checkInReward)

  if (action === "check-in") {
    const result = await performCheckIn({
      userId: user.id,
      dateKey: todayKey,
      reward,
      pointName: settings.pointName,
      makeUpCost: 0,
      isMakeUp: false,
    })

    if (result.alreadyCheckedIn) {
      return apiSuccess({ points: result.points, alreadyCheckedIn: true, date: todayKey }, "今天已经签到过了")
    }

    return apiSuccess({ points: result.points, alreadyCheckedIn: false, date: todayKey }, `签到成功，获得 ${reward} ${settings.pointName}`)
  }

  const targetDate = readOptionalStringField(body as Record<string, unknown>, "date")
  const parsedDate = parseDateKey(targetDate)
  if (!parsedDate) {
    apiError(400, "补签日期格式不正确")
  }

  const targetDateKey = getLocalDateKey(parsedDate)
  if (targetDateKey >= todayKey) {
    apiError(400, "只能补签今天之前的日期")
  }

  const vipActive = isVipActive(user)
  const makeUpCost = Math.max(0, vipActive ? settings.checkInVipMakeUpCardPrice : settings.checkInMakeUpCardPrice)

  const result = await performCheckIn({
    userId: user.id,
    dateKey: targetDateKey,
    reward,
    pointName: settings.pointName,
    makeUpCost,
    isMakeUp: true,
  })

  if (result.alreadyCheckedIn) {
    apiError(400, "该日期已经签到过了")
  }

  return apiSuccess({
    points: result.points,
    alreadyCheckedIn: false,
    makeUpCost,
    date: targetDateKey,
  }, makeUpCost > 0
    ? `补签成功，消耗 ${makeUpCost} ${settings.pointName}，获得 ${reward} ${settings.pointName}`
    : `补签成功，获得 ${reward} ${settings.pointName}`)
}, {
  buildContext: buildCheckInContext,
  errorMessage: "签到失败",
  logPrefix: "[api/check-in:POST] unexpected error",
})
