import type { Prisma } from "@/db/types"

import { prisma } from "@/db/client"

type DbClient = Prisma.TransactionClient | typeof prisma

function resolveClient(client?: DbClient) {
  return client ?? prisma
}

export function findUserIdByUsername(username: string, client?: DbClient) {
  return resolveClient(client).user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive",
      },
    },
    select: { id: true },
  })
}

export function findUsersByUsernames(usernames: string[], client?: DbClient) {
  return resolveClient(client).user.findMany({
    where: {
      OR: usernames.map((username) => ({
        username: {
          equals: username,
          mode: "insensitive" as const,
        },
      })),
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
      username: true,
      status: true,
      statusExpiresAt: true,
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
      statusExpiresAt: true,
      lastLoginIp: true,
    },
  })
}

export function findUserLoginCandidate(login: string, client?: DbClient) {
  return resolveClient(client).user.findFirst({
    where: {
      OR: [
        {
          username: {
            equals: login,
            mode: "insensitive",
          },
        },
        {
          email: {
            equals: login,
            mode: "insensitive",
          },
        },
        {
          phone: login,
        },
      ],
    },
    select: {
      id: true,
      username: true,
      passwordHash: true,
      status: true,
      statusExpiresAt: true,
      lastLoginIp: true,
    },
  })
}

export function findExternalAuthLoginCandidate(login: string, client?: DbClient) {
  return findUserLoginCandidate(login, client)
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

/**
 * 标记邀请码已被使用 —— **条件更新**，不是无条件 update。
 *
 * 调用方是「先 findUnique 查 usedById，再调用本函数」的两步写法。若这里用
 * 无条件 update，两个并发注册请求（用户名不同 -> 去重键不同 -> 守卫放行）会
 * 双双通过检查，各自开出账号：一码两号，邀请人还会拿到两份邀请奖励。
 *
 * 这里把 `usedById 仍为 null` 作为更新条件，让数据库来做并发权威 ——
 * 与 redeem-code-queries.ts 的 markRedeemCodeUsedWithTx 同一模式。
 * 返回 false 表示已被别人抢先使用，调用方必须整体回滚。
 */
export async function markInviteCodeAsUsed(
  inviteCodeId: string,
  usedById: number,
  client?: DbClient,
): Promise<boolean> {
  const claimed = await resolveClient(client).inviteCode.updateMany({
    where: {
      id: inviteCodeId,
      usedById: null,
    },
    data: {
      usedById,
      usedAt: new Date(),
    },
  })

  return claimed.count === 1
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
