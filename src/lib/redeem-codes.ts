import { randomBytes } from "crypto"

import {

  countRedeemedCodesByUserCategoryWithTx,
  createRedeemCodeRecords,
  findRedeemCodeByCode,
  findRedeemCodeByCodeWithTx,
  findUserBaseById,
  findUserPointsByIdWithTx,
  listRedeemCodes,
  listRedeemCodesByCodes,
  markRedeemCodeUsedWithTx,
  type RedeemCodeCoreRow,
  type RedeemCodeListRow,
  runRedeemCodeTransaction,
} from "@/db/redeem-code-queries"


import { PublicRouteError } from "@/lib/public-route-error"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { getSiteSettings } from "@/lib/site-settings"


const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const DEFAULT_CODE_LENGTH = 10
const REDEEM_CODE_BAD_REQUEST_STATUS = 400

function throwRedeemCodeError(message: string): never {
  throw new PublicRouteError(message, REDEEM_CODE_BAD_REQUEST_STATUS)
}

interface RedeemCodeCategoryFields {
  codeCategory?: string | null
  categoryUserLimit?: number | null
}

type RedeemCodeRowWithRelations = RedeemCodeListRow & RedeemCodeCategoryFields





export interface RedeemCodeItem {
  id: string
  code: string
  points: number
  codeCategory: string
  categoryUserLimit: number | null
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

function normalizeRedeemCodeCategory(category: string | null | undefined) {
  const normalized = category?.trim() || "default"
  if (!normalized) {
    throwRedeemCodeError("兑换码分类不能为空")
  }
  if (normalized.length > 32) {
    throwRedeemCodeError("兑换码分类不能超过32个字符")
  }

  return normalized
}

function normalizeCategoryUserLimit(limit: number | null | undefined) {
  if (limit === null || limit === undefined || limit === 0) {
    return null
  }

  const normalized = Math.trunc(limit)
  if (!Number.isFinite(normalized) || normalized < 1) {
    throwRedeemCodeError("分类使用上限必须为正整数，或留空表示不限制")
  }

  return normalized
}


function toRedeemCodeItem(row: RedeemCodeRowWithRelations): RedeemCodeItem {
  return {
    id: row.id,
    code: row.code,
    points: row.points,
    codeCategory: row.codeCategory ?? "default",
    categoryUserLimit: row.categoryUserLimit ?? null,
    createdAt: row.createdAt.toISOString(),
    createdByUsername: row.createdBy?.username ?? null,
    redeemedAt: row.redeemedAt?.toISOString() ?? null,
    redeemedByUsername: row.redeemedBy?.username ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    note: row.note,
  }
}

function getRedeemCodeCategory(row: RedeemCodeCategoryFields | RedeemCodeCoreRow) {
  return row.codeCategory ?? "default"
}


function getCategoryUserLimit(row: RedeemCodeCategoryFields | RedeemCodeCoreRow) {

  return row.categoryUserLimit ?? null
}




export async function generateUniqueRedeemCode(length = DEFAULT_CODE_LENGTH) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = randomRedeemCode(length)
    const existing = await findRedeemCodeByCode(code)

    if (!existing) {
      return code
    }
  }

  throwRedeemCodeError("兑换码生成失败，请重试")
}


export async function createRedeemCodes(input: {
  count: number
  points: number
  codeCategory?: string | null
  categoryUserLimit?: number | null
  createdById?: number | null
  note?: string | null
  expiresAt?: Date | null
}) {
  const count = Math.min(100, Math.max(1, Math.trunc(input.count)))
  const points = Math.max(1, Math.trunc(input.points))
  const codeCategory = normalizeRedeemCodeCategory(input.codeCategory)
  const categoryUserLimit = normalizeCategoryUserLimit(input.categoryUserLimit)
  const rows: Array<{
    code: string
    points: number
    codeCategory: string
    categoryUserLimit: number | null
    createdById?: number | null
    note?: string | null
    expiresAt?: Date | null
  }> = []

  for (let index = 0; index < count; index += 1) {
    rows.push({
      code: await generateUniqueRedeemCode(),
      points,
      codeCategory,
      categoryUserLimit,
      createdById: input.createdById ?? null,
      note: input.note?.trim() || null,
      expiresAt: input.expiresAt ?? null,
    })
  }

  await createRedeemCodeRecords(rows)

  const createdRows = await listRedeemCodesByCodes(rows.map((item) => item.code))


  return createdRows.map((row) => toRedeemCodeItem(row as RedeemCodeRowWithRelations))
}

export async function getRedeemCodeList(limit = 100): Promise<RedeemCodeItem[]> {
  const rows = await listRedeemCodes(limit)

  return rows.map((row) => toRedeemCodeItem(row as RedeemCodeRowWithRelations))
}


export async function redeemPointsCode(input: { userId: number; code: string }) {
  const normalizedCode = input.code.trim().toUpperCase()

  if (!normalizedCode) {
    throwRedeemCodeError("请输入兑换码")
  }

  const [settings, user, redeemCode] = await Promise.all([
    getSiteSettings(),
    findUserBaseById(input.userId),
    findRedeemCodeByCode(normalizedCode),
  ])


  if (!user) {
    throwRedeemCodeError("用户不存在")
  }

  if (!redeemCode) {
    throwRedeemCodeError("兑换码不存在")
  }

  if (redeemCode.redeemedById) {
    throwRedeemCodeError("兑换码已被使用")
  }

  if (redeemCode.expiresAt && redeemCode.expiresAt.getTime() < Date.now()) {
    throwRedeemCodeError("兑换码已过期")
  }

  return runRedeemCodeTransaction(async (tx) => {
    const latestRedeemCode = await findRedeemCodeByCodeWithTx(tx, normalizedCode)

    if (!latestRedeemCode) {
      throwRedeemCodeError("兑换码不存在")
    }

    const activeRedeemCode: RedeemCodeCoreRow = latestRedeemCode


    if (activeRedeemCode.redeemedById) {
      throwRedeemCodeError("兑换码已被使用")
    }

    if (activeRedeemCode.expiresAt && activeRedeemCode.expiresAt.getTime() < Date.now()) {
      throwRedeemCodeError("兑换码已过期")
    }

    const latestCodeCategory = getRedeemCodeCategory(activeRedeemCode)
    const latestCategoryUserLimit = getCategoryUserLimit(activeRedeemCode)

    if (latestCategoryUserLimit !== null) {
      const redeemedCount = await countRedeemedCodesByUserCategoryWithTx(tx, {
        userId: input.userId,
        codeCategory: latestCodeCategory,
      })
      if (redeemedCount >= latestCategoryUserLimit) {
        throwRedeemCodeError(`当前分类兑换码每个用户最多可使用 ${latestCategoryUserLimit} 个`)
      }
    }

    await markRedeemCodeUsedWithTx(tx, activeRedeemCode.id, input.userId)
    const latestUser = await findUserPointsByIdWithTx(tx, input.userId)

    if (!latestUser) {
      throwRedeemCodeError("用户不存在")
    }

    const preparedReward = await prepareScopedPointDelta({
      scopeKey: "REDEEM_CODE_REWARD",
      baseDelta: activeRedeemCode.points,
      userId: input.userId,
    })

    await applyPointDelta({
      tx,
      userId: input.userId,
      beforeBalance: latestUser.points,
      prepared: preparedReward,
      pointName: settings.pointName,
      reason: `兑换码兑换获得${settings.pointName}（分类:${latestCodeCategory}）`,
      insufficientMessage: `${settings.pointName}不足，无法完成兑换`,
    })

    return {
      ...activeRedeemCode,
      codeCategory: latestCodeCategory,
      categoryUserLimit: latestCategoryUserLimit,
    }
  })
}

