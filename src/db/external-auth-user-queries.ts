import type { Prisma } from "@/db/types"

import { prisma } from "@/db/client"

type DbClient = Prisma.TransactionClient | typeof prisma

function resolveClient(client?: DbClient) {
  return client ?? prisma
}

export function findUserIdByUsername(username: string, client?: DbClient) {
  return resolveClient(client).user.findUnique({
    where: { username },
    select: { id: true },
  })
}

export function findUsersByUsernames(usernames: string[], client?: DbClient) {
  return resolveClient(client).user.findMany({
    where: {
      username: {
        in: usernames,
      },
    },
    select: {
      username: true,
    },
  })
}

export function findUserIdByEmail(email: string, client?: DbClient) {
  return resolveClient(client).user.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: { id: true },
  })
}

export function findAuthUserStatusById(userId: number, client?: DbClient) {
  return resolveClient(client).user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      status: true,
    },
  })
}

export function findAuthenticatedUserSummaryById(userId: number, client?: DbClient) {
  return resolveClient(client).user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      status: true,
      lastLoginIp: true,
    },
  })
}

export function findExternalAuthLoginCandidate(login: string, client?: DbClient) {
  return resolveClient(client).user.findFirst({
    where: {
      OR: [
        { username: login },
        {
          email: {
            equals: login,
            mode: "insensitive",
          },
        },
      ],
    },
    select: {
      id: true,
      username: true,
      passwordHash: true,
      status: true,
    },
  })
}

export function findInviteCodeRegistrationContext(code: string, client?: DbClient) {
  return resolveClient(client).inviteCode.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      usedById: true,
      createdBy: {
        select: {
          id: true,
          username: true,
          points: true,
        },
      },
    },
  })
}

export function createExternalAuthUserRecord(input: {
  username: string
  passwordHash: string
  email: string | null
  emailVerifiedAt: Date | null
  nickname: string
  lastLoginAt: Date
  lastLoginIp: string | null
  inviterId?: number | null
  client?: DbClient
}) {
  return resolveClient(input.client).user.create({
    data: {
      username: input.username,
      passwordHash: input.passwordHash,
      email: input.email,
      emailVerifiedAt: input.emailVerifiedAt,
      nickname: input.nickname,
      lastLoginAt: input.lastLoginAt,
      lastLoginIp: input.lastLoginIp,
      inviterId: input.inviterId,
      points: 0,
    },
    select: {
      id: true,
      username: true,
    },
  })
}

export function markInviteCodeAsUsed(inviteCodeId: string, usedById: number, client?: DbClient) {
  return resolveClient(client).inviteCode.update({
    where: { id: inviteCodeId },
    data: {
      usedById,
      usedAt: new Date(),
    },
  })
}

export function incrementUserInviteCount(userId: number, client?: DbClient) {
  return resolveClient(client).user.update({
    where: { id: userId },
    data: {
      inviteCount: { increment: 1 },
    },
  })
}

export function createUserLoginLogEntry(userId: number, ip: string | null, userAgent: string | null, client?: DbClient) {
  return resolveClient(client).userLoginLog.create({
    data: {
      userId,
      ip,
      userAgent,
    },
  })
}

export async function recordSuccessfulExternalLoginByUserId(userId: number, loginIp: string | null, userAgent: string | null, client?: DbClient) {
  if (client) {
    await client.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: loginIp,
      },
    })

    await createUserLoginLogEntry(userId, loginIp, userAgent, client)

    return
  }

  await prisma.$transaction(async (tx) => {
    await recordSuccessfulExternalLoginByUserId(userId, loginIp, userAgent, tx)
  })
}

export function runExternalAuthTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(callback)
}
