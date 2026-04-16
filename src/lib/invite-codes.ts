import { randomBytes } from "crypto"

import { countInviteCodesByCreator, createInviteCodesBatch, findInviteCodeByCode, findInviteCodeForUse, findInviteCodeList, findInviteCodesByCodes, findInviteCodesByCreator, findInvitePurchaseUser, findUserInviteResolverById, findUserInviteResolverByUsername } from "@/db/invite-code-queries"
import { purchaseInviteCodeTransaction } from "@/db/invite-code-write-queries"
import { apiError } from "@/lib/api-route"
import { getSiteSettings } from "@/lib/site-settings"
import { getVipLevel, isVipActive } from "@/lib/vip-status"




const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const DEFAULT_CODE_LENGTH = 8

export interface InviteCodeItem {
  id: string
  code: string
  createdAt: string
  createdByUsername: string | null
  usedAt: string | null
  usedByUsername: string | null
  note: string | null
}

export interface InviteCodePageData {
  items: Array<{
    id: string
    code: string
    createdAt: string
    usedAt: string | null
    usedByUsername: string | null
  }>
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
}

function randomInviteCode(length = DEFAULT_CODE_LENGTH) {
  const buffer = randomBytes(length)
  let code = ""

  for (let index = 0; index < length; index += 1) {
    code += CODE_ALPHABET[buffer[index] % CODE_ALPHABET.length]
  }

  return code
}

export async function generateUniqueInviteCode(length = DEFAULT_CODE_LENGTH) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = randomInviteCode(length)
    const existing = await findInviteCodeByCode(code)
    if (!existing) {
      return code
    }
  }

  apiError(500, "邀请码生成失败，请重试")
}


export async function createInviteCodes(input: { count: number; createdById?: number | null; note?: string | null }) {
  const count = Math.min(100, Math.max(1, Math.trunc(input.count)))
  const rows = [] as { code: string; createdById?: number | null; note?: string | null }[]

  for (let index = 0; index < count; index += 1) {
    rows.push({
      code: await generateUniqueInviteCode(),
      createdById: input.createdById ?? null,
      note: input.note?.trim() || null,
    })
  }

  await createInviteCodesBatch(rows)

  return findInviteCodesByCodes(rows.map((item) => item.code))

}

export async function getInviteCodeList(limit = 100): Promise<InviteCodeItem[]> {
  const rows = await findInviteCodeList(limit)


  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    createdAt: row.createdAt.toISOString(),
    createdByUsername: row.createdBy?.username ?? null,
    usedAt: row.usedAt?.toISOString() ?? null,
    usedByUsername: row.usedBy?.username ?? null,
    note: row.note,
  }))
}

export async function getPurchasedInviteCodePage(userId: number, options?: { page?: number; pageSize?: number }): Promise<InviteCodePageData> {
  const requestedPage = Math.max(1, Math.trunc(options?.page ?? 1))
  const pageSize = Math.max(1, Math.min(Math.trunc(options?.pageSize ?? 10), 50))
  const total = await countInviteCodesByCreator(userId)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const rows = await findInviteCodesByCreator(userId, { page, pageSize })

  return {
    items: rows.map((row) => ({
      id: row.id,
      code: row.code,
      createdAt: row.createdAt.toISOString(),
      usedAt: row.usedAt?.toISOString() ?? null,
      usedByUsername: row.usedBy?.username ?? null,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    },
  }
}

export async function resolveInviter(input: { inviterUsername?: string; inviteCode?: string; username: string }) {
  const inviterUsername = input.inviterUsername?.trim() || ""
  const inviteCode = input.inviteCode?.trim().toUpperCase() || ""

  if (!inviterUsername && !inviteCode) {
    return { inviter: null, inviteCodeRecord: null as null | { id: string; code: string; createdById: number | null } }
  }

  if (inviterUsername && inviterUsername === input.username) {
    apiError(400, "邀请人不能填写自己")
  }

  let inviteCodeRecord: null | { id: string; code: string; createdById: number | null } = null

  if (inviteCode) {
    const foundCode = await findInviteCodeForUse(inviteCode)

    if (!foundCode) {
      apiError(404, "邀请码不存在")
    }

    if (foundCode.usedById) {
      apiError(409, "邀请码已被使用")
    }

    inviteCodeRecord = { id: foundCode.id, code: foundCode.code, createdById: foundCode.createdById }
  }

  const inviter = inviterUsername
    ? await findUserInviteResolverByUsername(inviterUsername)
    : inviteCodeRecord?.createdById
      ? await findUserInviteResolverById(inviteCodeRecord.createdById)
      : null

  if (inviter && inviter.username === input.username) {
    apiError(400, "邀请人不能填写自己")
  }

  if (inviterUsername && !inviter) {
    apiError(404, "邀请人不存在")
  }


  return {
    inviter,
    inviteCodeRecord,
  }
}

export async function purchaseInviteCode(userId: number) {
  const [settings, user] = await Promise.all([
    getSiteSettings(),
    findInvitePurchaseUser(userId),
  ])

  if (!user) {
    apiError(404, "用户不存在")
  }

  if (!settings.inviteCodePurchaseEnabled) {
    apiError(400, "当前未开启邀请码购买")
  }

  const price = isVipActive(user)
    ? getVipLevel(user) >= 3
      ? Math.max(0, settings.inviteCodeVip3Price)
      : getVipLevel(user) === 2
        ? Math.max(0, settings.inviteCodeVip2Price)
        : Math.max(0, settings.inviteCodeVip1Price)
    : Math.max(0, settings.inviteCodePrice)

  if (price < 1) {
    apiError(400, "邀请码价格未设置")
  }

  if (user.points < price) {
    apiError(409, `${settings.pointName}不足，无法购买邀请码`)
  }


  const code = await generateUniqueInviteCode()

  return purchaseInviteCodeTransaction({
    userId,
    price,
    pointName: settings.pointName,
    code,
  })

}
