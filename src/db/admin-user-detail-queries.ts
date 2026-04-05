import { prisma } from "@/db/client"

const ADMIN_USER_DETAIL_LOG_LIMIT = 8

export function findAdminUserDetailById(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      inviter: {
        select: {
          username: true,
          nickname: true,
        },
      },
      levelProgress: {
        select: {
          checkInDays: true,
        },
      },
      _count: {
        select: {
          favorites: true,
        },
      },
      moderatedZoneScopes: {
        orderBy: [{ zone: { sortOrder: "asc" } }, { createdAt: "asc" }],
        include: {
          zone: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
      moderatedBoardScopes: {
        orderBy: [{ board: { sortOrder: "asc" } }, { createdAt: "asc" }],
        include: {
          board: {
            select: {
              id: true,
              name: true,
              slug: true,
              zoneId: true,
              zone: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      },
    },
  })
}

export function countAdminUserLoginLogs(userId: number) {
  return prisma.userLoginLog.count({
    where: { userId },
  })
}

export function findAdminUserLoginLogs(userId: number, take = ADMIN_USER_DETAIL_LOG_LIMIT) {
  return prisma.userLoginLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  })
}

export function countAdminUserCheckInLogs(userId: number) {
  return prisma.userCheckInLog.count({
    where: { userId },
  })
}

export function findAdminUserCheckInLogs(userId: number, take = ADMIN_USER_DETAIL_LOG_LIMIT) {
  return prisma.userCheckInLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  })
}

export function countAdminUserPointLogs(userId: number) {
  return prisma.pointLog.count({
    where: { userId },
  })
}

export function findAdminUserPointLogs(userId: number, take = ADMIN_USER_DETAIL_LOG_LIMIT) {
  return prisma.pointLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  })
}

export function countAdminUserUploads(userId: number) {
  return prisma.upload.count({
    where: { userId },
  })
}

export function findAdminUserUploads(userId: number, take = ADMIN_USER_DETAIL_LOG_LIMIT) {
  return prisma.upload.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  })
}

export function countAdminUserActionLogs(userId: number) {
  return prisma.adminLog.count({
    where: {
      targetType: "USER",
      targetId: String(userId),
    },
  })
}

export function findAdminUserActionLogs(userId: number, take = ADMIN_USER_DETAIL_LOG_LIMIT) {
  return prisma.adminLog.findMany({
    where: {
      targetType: "USER",
      targetId: String(userId),
    },
    orderBy: { createdAt: "desc" },
    include: {
      admin: {
        select: {
          username: true,
          nickname: true,
        },
      },
    },
    take,
  })
}
