import { prisma } from "@/db/client"

export function countUserPointLogs(userId: number) {
  return prisma.pointLog.count({
    where: { userId },
  })
}

export function findUserPointLogsPage(userId: number, skip: number, take: number) {
  return prisma.pointLog.findMany({
    where: { userId },
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take,
  })
}

export function incrementUserPoints(userId: number, amount: number) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      points: {
        increment: amount,
      },
    },
  })
}

export function decrementUserPoints(userId: number, amount: number) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      points: {
        decrement: amount,
      },
    },
  })
}

export function createPointLog(data: {
  userId: number
  changeType: "INCREASE" | "DECREASE"
  changeValue: number
  reason: string
}) {
  return prisma.pointLog.create({
    data,
  })
}
