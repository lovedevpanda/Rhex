import { ChangeType } from "@/db/types"
import { NextRequest, NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { recordUserCheckInGrowth } from "@/lib/level-system"
import { prisma } from "@/db/client"
import { getSiteSettings } from "@/lib/site-settings"
import { isVipActive } from "@/lib/vip-status"

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
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

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  const settings = await getSiteSettings()
  if (!settings.checkInEnabled) {
    return NextResponse.json({ code: 403, message: "签到功能暂未开启" }, { status: 403 })
  }

  const month = request.nextUrl.searchParams.get("month") || getLocalDateKey().slice(0, 7)

  try {
    const entries = await buildCalendarData(user.id, month)
    const vipActive = isVipActive(user)
    const makeUpPrice = vipActive ? settings.checkInVipMakeUpCardPrice : settings.checkInMakeUpCardPrice

    return NextResponse.json({
      code: 0,
      data: {
        month,
        pointName: settings.pointName,
        checkInReward: settings.checkInReward,
        makeUpPrice,
        vipMakeUpPrice: settings.checkInVipMakeUpCardPrice,
        normalMakeUpPrice: settings.checkInMakeUpCardPrice,
        entries,
      },
    })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "获取签到日历失败" }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  const settings = await getSiteSettings()
  if (!settings.checkInEnabled) {
    return NextResponse.json({ code: 403, message: "签到功能暂未开启" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as { action?: string; date?: string }
  const action = body.action === "make-up" ? "make-up" : "check-in"
  const todayKey = getLocalDateKey()
  const reward = Math.max(0, settings.checkInReward)

  try {
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
        return NextResponse.json({ code: 0, message: "今天已经签到过了", data: { points: result.points, alreadyCheckedIn: true } })
      }

      return NextResponse.json({ code: 0, message: `签到成功，获得 ${reward} ${settings.pointName}`, data: { points: result.points, alreadyCheckedIn: false } })
    }

    const targetDate = String(body.date ?? "").trim()
    const parsedDate = parseDateKey(targetDate)
    if (!parsedDate) {
      return NextResponse.json({ code: 400, message: "补签日期格式不正确" }, { status: 400 })
    }

    const targetDateKey = getLocalDateKey(parsedDate)
    if (targetDateKey >= todayKey) {
      return NextResponse.json({ code: 400, message: "只能补签今天之前的日期" }, { status: 400 })
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
      return NextResponse.json({ code: 400, message: "该日期已经签到过了", data: { points: result.points, alreadyCheckedIn: true } }, { status: 400 })
    }

    return NextResponse.json({
      code: 0,
      message: makeUpCost > 0
        ? `补签成功，消耗 ${makeUpCost} ${settings.pointName}，获得 ${reward} ${settings.pointName}`
        : `补签成功，获得 ${reward} ${settings.pointName}`,
      data: {
        points: result.points,
        alreadyCheckedIn: false,
        makeUpCost,
        date: targetDateKey,
      },
    })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "签到失败" }, { status: 400 })
  }
}
