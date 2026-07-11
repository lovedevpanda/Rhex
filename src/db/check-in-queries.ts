import { prisma } from "@/db/client"
import { withDbTransaction } from "@/db/helpers"
import { syncUserCheckInProgress } from "@/db/level-system-queries"
import { calculateCheckInStreakSummary } from "@/lib/check-in-streak"
import { getLocalDateKey } from "@/lib/date-key"
import { applyPointDelta, type PreparedPointDelta } from "@/lib/point-center"

export interface UserCheckInCalendarEntryRow {
  checkedInOn: string
  reward: number
  isMakeUp: boolean
  makeUpCost: number
  createdAt: Date
}

export interface ExecuteUserCheckInParams {
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

export interface UserCheckInStreakEntryRow {
  checkedInOn: string
  isMakeUp: boolean
}

export interface ExecuteUserCheckInResult {
  alreadyCheckedIn: boolean
  points: number
}

export async function listUserCheckInLogsInRange(params: {
  userId: number
  startDateKey: string
  endDateKey: string
}): Promise<UserCheckInCalendarEntryRow[]> {
  return prisma.userCheckInLog.findMany({
    where: {
      userId: params.userId,
      checkedInOn: {
        gte: params.startDateKey,
        lte: params.endDateKey,
      },
    },
    orderBy: [{ checkedInOn: "asc" }],
    select: {
      checkedInOn: true,
      reward: true,
      isMakeUp: true,
      makeUpCost: true,
      createdAt: true,
    },
  })
}

export async function executeUserCheckIn(params: ExecuteUserCheckInParams): Promise<ExecuteUserCheckInResult | null> {
  return withDbTransaction(async (tx) => {
    const dbUser = await tx.user.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        points: true,
      },
    })

    if (!dbUser) {
      return null
    }

    // The unique key is the concurrency authority for a user/day. A read
    // followed by create races under normal read-committed isolation; use an
    // insert-if-absent so a duplicate request cannot run either settlement.
    const created = await tx.userCheckInLog.createMany({
      data: {
        userId: dbUser.id,
        reward: params.reward,
        checkedInOn: params.dateKey,
        isMakeUp: params.isMakeUp,
        makeUpCost: params.makeUpCost,
      },
      skipDuplicates: true,
    })

    if (created.count === 0) {
      const currentUser = await tx.user.findUnique({
        where: { id: dbUser.id },
        select: { points: true },
      })
      return { alreadyCheckedIn: true, points: currentUser?.points ?? dbUser.points }
    }

    let pointBalanceCursor = dbUser.points

    if (params.makeUpCostDelta.finalDelta !== 0) {
      const makeUpCostResult = await applyPointDelta({
        tx,
        userId: dbUser.id,
        beforeBalance: pointBalanceCursor,
        prepared: params.makeUpCostDelta,
        pointName: params.pointName,
        insufficientMessage: `${params.pointName}不足，无法补签`,
        reason: `购买签到补签卡，消耗${params.pointName}`,
      })
      pointBalanceCursor = makeUpCostResult.afterBalance
    }

    if (params.rewardDelta.finalDelta !== 0) {
      const rewardResult = await applyPointDelta({
        tx,
        userId: dbUser.id,
        beforeBalance: pointBalanceCursor,
        prepared: params.rewardDelta,
        pointName: params.pointName,
        insufficientMessage: `${params.pointName}不足，无法完成签到结算`,
        reason: params.isMakeUp ? `补签获得${params.pointName}` : `每日签到获得${params.pointName}`,
      })
      pointBalanceCursor = rewardResult.afterBalance
    }

    const streakEntries = await tx.userCheckInLog.findMany({
      where: { userId: dbUser.id },
      orderBy: [{ checkedInOn: "asc" }],
      select: {
        checkedInOn: true,
        isMakeUp: true,
      },
    })
    const streakSummary = calculateCheckInStreakSummary(streakEntries, {
      includeMakeUps: params.makeUpCountsTowardStreak,
      todayKey: getLocalDateKey(),
    })

    await syncUserCheckInProgress(dbUser.id, {
      checkInDays: streakEntries.length,
      currentCheckInStreak: streakSummary.currentStreak,
      maxCheckInStreak: streakSummary.maxStreak,
      lastCheckInDate: streakSummary.lastCheckInDate,
    }, tx)

    return { alreadyCheckedIn: false, points: pointBalanceCursor }
  })
}

export async function listUserCheckInStreakEntries(userId: number): Promise<UserCheckInStreakEntryRow[]> {
  return prisma.userCheckInLog.findMany({
    where: { userId },
    orderBy: [{ checkedInOn: "asc" }],
    select: {
      checkedInOn: true,
      isMakeUp: true,
    },
  })
}

export async function updateUserCheckInReward(params: {
  userId: number
  dateKey: string
  reward: number
}) {
  return prisma.userCheckInLog.update({
    where: {
      userId_checkedInOn: {
        userId: params.userId,
        checkedInOn: params.dateKey,
      },
    },
    data: {
      reward: params.reward,
    },
  })
}
