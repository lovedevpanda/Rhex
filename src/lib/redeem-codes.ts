import { randomBytes } from "crypto"

import { prisma } from "@/db/client"
import { getSiteSettings } from "@/lib/site-settings"

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const DEFAULT_CODE_LENGTH = 10

export interface RedeemCodeItem {
  id: string
  code: string
  points: number
  createdAt: string
  createdByUsername: string | null
  redeemedAt: string | null
  redeemedByUsername: string | null
  expiresAt: string | null
  note: string | null
}

function randomRedeemCode(length = DEFAULT_CODE_LENGTH) {
  const buffer = randomBytes(length)
  let code = ""

  for (let index = 0; index < length; index += 1) {
    code += CODE_ALPHABET[buffer[index] % CODE_ALPHABET.length]
  }

  return code
}

export async function generateUniqueRedeemCode(length = DEFAULT_CODE_LENGTH) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = randomRedeemCode(length)
    const existing = await prisma.redeemCode.findUnique({ where: { code } })
    if (!existing) {
      return code
    }
  }

  throw new Error("兑换码生成失败，请重试")
}

export async function createRedeemCodes(input: { count: number; points: number; createdById?: number | null; note?: string | null; expiresAt?: Date | null }) {
  const count = Math.min(100, Math.max(1, Math.trunc(input.count)))
  const points = Math.max(1, Math.trunc(input.points))
  const rows = [] as { code: string; points: number; createdById?: number | null; note?: string | null; expiresAt?: Date | null }[]

  for (let index = 0; index < count; index += 1) {
    rows.push({
      code: await generateUniqueRedeemCode(),
      points,
      createdById: input.createdById ?? null,
      note: input.note?.trim() || null,
      expiresAt: input.expiresAt ?? null,
    })
  }

  await prisma.redeemCode.createMany({ data: rows })

  return prisma.redeemCode.findMany({
    where: {
      code: {
        in: rows.map((item) => item.code),
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getRedeemCodeList(limit = 100): Promise<RedeemCodeItem[]> {
  const rows = await prisma.redeemCode.findMany({
    orderBy: [{ redeemedAt: "asc" }, { createdAt: "desc" }],
    take: Math.max(1, Math.min(limit, 200)),
    include: {
      createdBy: { select: { username: true } },
      redeemedBy: { select: { username: true } },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    points: row.points,
    createdAt: row.createdAt.toISOString(),
    createdByUsername: row.createdBy?.username ?? null,
    redeemedAt: row.redeemedAt?.toISOString() ?? null,
    redeemedByUsername: row.redeemedBy?.username ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    note: row.note,
  }))
}

export async function redeemPointsCode(input: { userId: number; code: string }) {
  const normalizedCode = input.code.trim().toUpperCase()

  if (!normalizedCode) {
    throw new Error("请输入兑换码")
  }

  const [settings, user, redeemCode] = await Promise.all([
    getSiteSettings(),
    prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } }),
    prisma.redeemCode.findUnique({ where: { code: normalizedCode } }),
  ])

  if (!user) {
    throw new Error("用户不存在")
  }

  if (!redeemCode) {
    throw new Error("兑换码不存在")
  }

  if (redeemCode.redeemedById) {
    throw new Error("兑换码已被使用")
  }

  if (redeemCode.expiresAt && redeemCode.expiresAt.getTime() < Date.now()) {
    throw new Error("兑换码已过期")
  }

  return prisma.$transaction(async (tx) => {
    const latestRedeemCode = await tx.redeemCode.findUnique({ where: { code: normalizedCode } })

    if (!latestRedeemCode) {
      throw new Error("兑换码不存在")
    }

    if (latestRedeemCode.redeemedById) {
      throw new Error("兑换码已被使用")
    }

    if (latestRedeemCode.expiresAt && latestRedeemCode.expiresAt.getTime() < Date.now()) {
      throw new Error("兑换码已过期")
    }

    await tx.redeemCode.update({
      where: { id: latestRedeemCode.id },
      data: {
        redeemedById: input.userId,
        redeemedAt: new Date(),
      },
    })

    await tx.user.update({
      where: { id: input.userId },
      data: {
        points: {
          increment: latestRedeemCode.points,
        },
      },
    })

    await tx.pointLog.create({
      data: {
        userId: input.userId,
        changeType: "INCREASE",
        changeValue: latestRedeemCode.points,
        reason: `兑换码兑换获得${settings.pointName}`,
      },
    })

    return latestRedeemCode
  })
}
