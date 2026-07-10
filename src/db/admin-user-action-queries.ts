import { UserRole, UserStatus } from "@/db/types"

import { prisma } from "@/db/client"

export function updateUserStatus(userId: number, status: UserStatus, statusExpiresAt?: Date | null, statusReason?: string | null) {
  const shouldStoreReason = status === UserStatus.MUTED || status === UserStatus.BANNED

  return prisma.user.update({
    where: { id: userId },
    data: {
      status,
      statusExpiresAt: shouldStoreReason ? statusExpiresAt ?? null : null,
      statusReason: shouldStoreReason ? (statusReason?.trim() || null) : null,
      // A status change must take effect for every existing session, including
      // muted accounts whose stale UI/session could otherwise keep operating.
      sessionInvalidBefore: new Date(),
    },
  })
}

export function updateUserRole(userId: number, role: UserRole, status?: UserStatus) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      role,
      status,
      ...(status ? { statusExpiresAt: null, statusReason: null } : {}),
      sessionInvalidBefore: new Date(),
    },
  })
}

export function invalidateUserSessions(userId: number) {
  return prisma.user.update({
    where: { id: userId },
    data: { sessionInvalidBefore: new Date() },
  })
}

export function updateUserPoints(userId: number, points: number) {
  return prisma.user.update({
    where: { id: userId },
    data: { points },
  })
}

export function updateUserBasicProfile(params: {
  userId: number
  nickname: string
  email: string | null
  phone: string | null
  bio: string | null
  gender: string | null
  signature: string | null
}) {
  return prisma.user.update({
    where: { id: params.userId },
    data: {
      nickname: params.nickname,
      email: params.email,
      phone: params.phone,
      bio: params.bio,
      gender: params.gender,
      signature: params.signature,
    },
  })
}

export function updateUserAvatarPath(userId: number, avatarPath: string | null) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      avatarPath,
    },
  })
}

export function findUserAvatarProfile(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      nickname: true,
      avatarPath: true,
    },
  })
}

export function findUserUsername(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      nickname: true,
      email: true,
      phone: true,
      bio: true,
      gender: true,
      signature: true,
    },
  })
}

export function findUserStatus(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true, statusExpiresAt: true, statusReason: true },
  })
}

export async function findFounderAdminId() {
  const founder = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN },
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" },
    ],
    select: { id: true },
  })

  return founder?.id ?? null
}

export function updateUserPasswordHash(userId: number, passwordHash: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      sessionInvalidBefore: new Date(),
    },
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

export function promoteUserToAdmin(userId: number) {
  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        statusExpiresAt: null,
        statusReason: null,
        sessionInvalidBefore: new Date(),
      },
    })
    await tx.moderatorZoneScope.deleteMany({ where: { moderatorId: userId } })
    await tx.moderatorBoardScope.deleteMany({ where: { moderatorId: userId } })
  })
}

export function demoteUserToUser(userId: number) {
  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        role: UserRole.USER,
        sessionInvalidBefore: new Date(),
      },
    })
    await tx.adminPermissionGrant.deleteMany({ where: { userId } })
    await tx.moderatorZoneScope.deleteMany({ where: { moderatorId: userId } })
    await tx.moderatorBoardScope.deleteMany({ where: { moderatorId: userId } })
  })
}
