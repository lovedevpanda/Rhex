import { prisma } from "@/db/client"

import type { Prisma } from "@/db/types"

export function findRegistrationConflict(input: {
  username: string
  email?: string
  phone?: string
  nickname?: string
}) {
  const or: Prisma.UserWhereInput[] = [{ username: input.username }]

  if (input.email) {
    or.push({ email: input.email })
  }

  if (input.phone) {
    or.push({ phone: input.phone })
  }

  if (input.nickname) {
    or.push({ nickname: input.nickname })
  }

  return prisma.user.findFirst({
    where: { OR: or },
    select: {
      username: true,
      email: true,
      phone: true,
      nickname: true,
    },
  })
}

export function findRegisterInviterByUsername(username: string, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma
  return client.user.findUnique({
    where: { username },
    select: { id: true, username: true, points: true },
  })
}

export function createRegisteredUserRecord(input: {
  username: string
  email: string | null
  phone: string | null
  emailVerifiedAt: Date | null
  phoneVerifiedAt: Date | null
  passwordHash: string
  nickname: string
  gender: string | null
  inviterId?: number | null
  lastLoginAt: Date
  lastLoginIp: string | null
  tx?: Prisma.TransactionClient
}) {
  const client = input.tx ?? prisma
  return client.user.create({
    data: {
      username: input.username,
      email: input.email,
      phone: input.phone,
      emailVerifiedAt: input.emailVerifiedAt,
      phoneVerifiedAt: input.phoneVerifiedAt,
      passwordHash: input.passwordHash,
      nickname: input.nickname,
      gender: input.gender,
      status: "ACTIVE",
      role: "USER",
      inviterId: input.inviterId,
      lastLoginAt: input.lastLoginAt,
      lastLoginIp: input.lastLoginIp,
      points: 0,
    },
    select: {
      id: true,
      username: true,
    },
  })
}

export function runRegisterTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(callback)
}

