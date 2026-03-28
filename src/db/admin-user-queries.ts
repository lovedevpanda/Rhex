import { UserRole, UserStatus } from "@/db/types"

import type { Prisma } from "@/db/types"

import { prisma } from "@/db/client"
import { resolveCountMap } from "@/db/helpers"

export function buildAdminUserSummary(where: Prisma.UserWhereInput) {
  return resolveCountMap([
    ["total", prisma.user.count({ where })],
    ["active", prisma.user.count({ where: { ...where, status: UserStatus.ACTIVE } })],
    ["muted", prisma.user.count({ where: { ...where, status: UserStatus.MUTED } })],
    ["banned", prisma.user.count({ where: { ...where, status: UserStatus.BANNED } })],
    ["inactive", prisma.user.count({ where: { ...where, status: UserStatus.INACTIVE } })],
    ["admin", prisma.user.count({ where: { ...where, role: UserRole.ADMIN } })],
    ["moderator", prisma.user.count({ where: { ...where, role: UserRole.MODERATOR } })],
  ] as const)
}

export function findAdminUsersPage(where: Prisma.UserWhereInput, orderBy: Prisma.UserOrderByWithRelationInput[], skip: number, take: number) {
  return prisma.user.findMany({
    where,
    orderBy,
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
      favorites: true,
      loginLogs: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
    skip,
    take,
  })
}
