import { randomBytes } from "crypto"

import { countInviteCodesByCreator, createInviteCodesBatch, deleteInviteCodeById, deleteInviteCodesByScope, findInviteCodeByCode, findInviteCodeForUse, findInviteCodeList, findInviteCodesByCodes, findInviteCodesByCreator, findInvitePurchaseUser, findUserInviteResolverById, findUserInviteResolverByUsername, type InviteCodeUsageStatus } from "@/db/invite-code-queries"
import { purchaseInviteCodeTransaction } from "@/db/invite-code-write-queries"
import { apiError } from "@/lib/api-route"
import { ensureAdminActorPermission } from "@/lib/admin-scope-permissions"
import { requireSiteAdminActor } from "@/lib/moderator-permissions"
import { getSiteSettings } from "@/lib/site-settings"
import { getVipLevel, isVipActive } from "@/lib/vip-status"




const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const DEFAULT_CODE_LENGTH = 8
const MAX_INVITE_CODE_PURCHASE_COUNT = 10
const MAX_UNUSED_INVITE_CODE_HOLDINGS = 100

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
  await ensureAdminActorPermission(
    await requireSiteAdminActor(),
    "admin.operations.manage",
    "无权操作邀请码",
  )

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
  await ensureAdminActorPermission(
    await requireSiteAdminActor(),
    "admin.operations.manage",
    "无权限访问邀请码",
  )

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

export async function deleteInviteCodes(input: { scope: "single" | "used" | "unused" | "all"; id?: string }) {
  await ensureAdminActorPermission(
    await requireSiteAdminActor(),
    "admin.operations.manage",
    "无权操作邀请码",
  )

  if (input.scope === "single") {
    const id = input.id?.trim()
    if (!id) {
      apiError(400, "请选择要删除的邀请码")
    }

    const result = await deleteInviteCodeById(id)
    return result.count
  }

  const result = await deleteInviteCodesByScope(input.scope)
  return result.count
}

function normalizeInviteCodeUsageStatus(status: unknown): InviteCodeUsageStatus {
  return status === "used" || status === "unused" ? status : "all"
}

export async function getPurchasedInviteCodePage(userId: number, options?: { page?: number; pageSize?: number; status?: unknown }): Promise<InviteCodePageData> {
  const requestedPage = Math.max(1, Math.trunc(options?.page ?? 1))
  const pageSize = Math.max(1, Math.min(Math.trunc(options?.pageSize ?? 10), 1000))
  const status = normalizeInviteCodeUsageStatus(options?.status)
  const total = await countInviteCodesByCreator(userId, status)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const rows = await findInviteCodesByCreator(userId, { page, pageSize, status })

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

export async function purchaseInviteCode(userId: number, options?: { count?: number }) {
  const requestedCount = Number(options?.count ?? 1)
  const count = Number.isFinite(requestedCount)
    ? Math.max(1, Math.min(Math.trunc(requestedCount), MAX_INVITE_CODE_PURCHASE_COUNT))
    : 1
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

  const unusedCount = await countInviteCodesByCreator(userId, "unused")

  if (unusedCount + count > MAX_UNUSED_INVITE_CODE_HOLDINGS) {
    apiError(409, `一次最多购买 ${MAX_INVITE_CODE_PURCHASE_COUNT} 个邀请码，最多持有 ${MAX_UNUSED_INVITE_CODE_HOLDINGS} 个未使用邀请码。你当前已有 ${unusedCount} 个未使用邀请码`)
  }

  const totalPrice = price * count

  if (user.points < totalPrice) {
    apiError(409, `${settings.pointName}不足，无法购买 ${count} 个邀请码`)
  }

  const codes: string[] = []
  const seenCodes = new Set<string>()

  while (codes.length < count) {
    const code = await generateUniqueInviteCode()
    if (seenCodes.has(code)) {
      continue
    }
    seenCodes.add(code)
    codes.push(code)
  }

  return purchaseInviteCodeTransaction({
    userId,
    price,
    count,
    maxUnusedHoldings: MAX_UNUSED_INVITE_CODE_HOLDINGS,
    pointName: settings.pointName,
    codes,
  })

}
