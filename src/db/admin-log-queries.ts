import type { Prisma } from "@/db/types"

import { prisma } from "@/db/client"

export function countAdminLogTabs() {
  return Promise.all([
    prisma.adminLog.count(),
    prisma.userLoginLog.count(),
    prisma.userCheckInLog.count(),
    prisma.pointLog.count(),
    prisma.upload.count(),
    prisma.paymentOrder.count(),
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

export function countUserCheckInLogs(where: Prisma.UserCheckInLogWhereInput) {
  return prisma.userCheckInLog.count({ where })
}

export function findUserCheckInLogsPage(where: Prisma.UserCheckInLogWhereInput, skip: number, take: number) {
  return prisma.userCheckInLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
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

export function countUploadLogs(where: Prisma.UploadWhereInput) {
  return prisma.upload.count({ where })
}

export function findUploadLogsPage(where: Prisma.UploadWhereInput, skip: number, take: number) {
  return prisma.upload.findMany({
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

export function countVipOrders(where: Prisma.VipOrderWhereInput) {
  return prisma.vipOrder.count({ where })
}

export function countPaymentOrders(where: Prisma.PaymentOrderWhereInput) {
  return prisma.paymentOrder.count({ where })
}

export function findPaymentOrdersPage(where: Prisma.PaymentOrderWhereInput, skip: number, take: number) {
  return prisma.paymentOrder.findMany({
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

export function findVipOrdersPage(where: Prisma.VipOrderWhereInput, skip: number, take: number) {
  return prisma.vipOrder.findMany({
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

export function createAdminLogEntry(data: {
  adminId: number
  action: string
  targetType: string
  targetId: string
  detail?: string
  ip?: string | null
}) {
  return prisma.adminLog.create({
    data: {
      adminId: data.adminId,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      detail: data.detail,
      ip: data.ip?.trim() || null,
    },
  })
}
