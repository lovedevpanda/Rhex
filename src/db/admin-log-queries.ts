import type { Prisma } from "@/db/types"

import { prisma } from "@/db/client"

export function countAdminLogTabs() {
  return Promise.all([
    prisma.adminLog.count(),
    prisma.userLoginLog.count(),
    prisma.pointLog.count(),
    prisma.upload.count(),
    prisma.vipOrder.count(),
  ])
}

export function countAdminLogs(where: Prisma.AdminLogWhereInput) {
  return prisma.adminLog.count({ where })
}

export function findAdminLogsPage(where: Prisma.AdminLogWhereInput, skip: number, take: number) {
  return prisma.adminLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      admin: {
        select: {
          username: true,
          nickname: true,
        },
      },
    },
    skip,
    take,
  })
}

export function countUserLoginLogs(where: Prisma.UserLoginLogWhereInput) {
  return prisma.userLoginLog.count({ where })
}

export function findUserLoginLogsPage(where: Prisma.UserLoginLogWhereInput, skip: number, take: number) {
  return prisma.userLoginLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          username: true,
          nickname: true,
          email: true,
          status: true,
        },
      },
    },
    skip,
    take,
  })
}

export function countPointLogs(where: Prisma.PointLogWhereInput) {
  return prisma.pointLog.count({ where })
}

export function findPointLogsPage(where: Prisma.PointLogWhereInput, skip: number, take: number) {
  return prisma.pointLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          username: true,
          nickname: true,
        },
      },
    },
    skip,
    take,
  })
}

export function findUploadLogs() {
  return prisma.upload.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          username: true,
          nickname: true,
        },
      },
    },
  })
}

export function findVipOrders() {
  return prisma.vipOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          username: true,
          nickname: true,
        },
      },
    },
  })
}
