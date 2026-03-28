import { UserRole, UserStatus } from "@/db/types"

import { prisma } from "@/db/client"

export function updateUserStatus(userId: number, status: UserStatus) {
  return prisma.user.update({
    where: { id: userId },
    data: { status },
  })
}

export function updateUserRole(userId: number, role: UserRole, status?: UserStatus) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      role,
      status,
    },
  })
}

export function updateUserPoints(userId: number, points: number) {
  return prisma.user.update({
    where: { id: userId },
    data: { points },
  })
}

export function findUserUsername(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  })
}

export function updateUserPasswordHash(userId: number, passwordHash: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  })
}

export function findUserVipState(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { vipLevel: true, vipExpiresAt: true },
  })
}

export function updateUserVip(userId: number, vipLevel: number, vipExpiresAt: Date | null) {
  return prisma.user.update({
    where: { id: userId },
    data: { vipLevel, vipExpiresAt },
  })
}
