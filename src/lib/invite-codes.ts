import { randomBytes } from "crypto"

import { createInviteCodesBatch, findInviteCodeByCode, findInviteCodeForUse, findInviteCodeList, findInviteCodesByCodes, findInvitePurchaseUser, findUserInviteResolverById, findUserInviteResolverByUsername } from "@/db/invite-code-queries"
import { purchaseInviteCodeTransaction } from "@/db/invite-code-write-queries"
import { getSiteSettings } from "@/lib/site-settings"



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


  throw new Error("邀请码生成失败，请重试")
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

export async function resolveInviter(input: { inviterUsername?: string; inviteCode?: string; username: string }) {
  const inviterUsername = input.inviterUsername?.trim() || ""
  const inviteCode = input.inviteCode?.trim().toUpperCase() || ""

  if (!inviterUsername && !inviteCode) {
    return { inviter: null, inviteCodeRecord: null as null | { id: string; code: string; createdById: number | null } }
  }

  if (inviterUsername && inviterUsername === input.username) {
    throw new Error("邀请人不能填写自己")
  }

  let inviteCodeRecord: null | { id: string; code: string; createdById: number | null } = null

  if (inviteCode) {
    const foundCode = await findInviteCodeForUse(inviteCode)


    if (!foundCode) {
      throw new Error("邀请码不存在")
    }

    if (foundCode.usedById) {
      throw new Error("邀请码已被使用")
    }

    inviteCodeRecord = { id: foundCode.id, code: foundCode.code, createdById: foundCode.createdById }
  }

  const inviter = inviterUsername
    ? await findUserInviteResolverByUsername(inviterUsername)
    : inviteCodeRecord?.createdById
      ? await findUserInviteResolverById(inviteCodeRecord.createdById)
      : null


  if (inviter && inviter.username === input.username) {
    throw new Error("邀请人不能填写自己")
  }

  if (inviterUsername && !inviter) {
    throw new Error("邀请人不存在")
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
    throw new Error("用户不存在")
  }

  if (!settings.inviteCodePurchaseEnabled) {
    throw new Error("当前未开启邀请码购买")
  }

  const price = Math.max(0, settings.inviteCodePrice)

  if (price < 1) {
    throw new Error("邀请码价格未设置")
  }

  if (user.points < price) {
    throw new Error(`${settings.pointName}不足，无法购买邀请码`)
  }

  const code = await generateUniqueInviteCode()

  return purchaseInviteCodeTransaction({
    userId,
    price,
    pointName: settings.pointName,
    code,
  })

}
