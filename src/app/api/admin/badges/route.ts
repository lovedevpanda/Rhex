import { BadgeRuleOperator, BadgeRuleType } from "@/db/types"

import { NextResponse } from "next/server"

import { getRequestIp, requireAdminUser, writeAdminLog } from "@/lib/admin"
import { hasDatabaseUrl } from "@/lib/db-status"
import { prisma } from "@/db/client"

async function ensureAdmin() {
  const admin = await requireAdminUser()

  if (!admin) {
    return { error: NextResponse.json({ code: 403, message: "无权执行后台操作" }, { status: 403 }) }
  }

  if (!hasDatabaseUrl()) {
    return { error: NextResponse.json({ code: 503, message: "当前未配置数据库，暂不可修改勋章配置" }, { status: 503 }) }
  }

  return { admin }
}

function normalizeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim()
}

function normalizeBoolean(value: unknown) {
  return value === true
}

function normalizeNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function isRuleType(value: string): value is BadgeRuleType {
  return Object.values(BadgeRuleType).includes(value as BadgeRuleType)
}

function isRuleOperator(value: string): value is BadgeRuleOperator {
  return Object.values(BadgeRuleOperator).includes(value as BadgeRuleOperator)
}

function parseRules(input: unknown) {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .map((item, index) => {
      const row = item as Record<string, unknown>
      const ruleType = normalizeText(row.ruleType)
      const operator = normalizeText(row.operator)
      const value = normalizeText(row.value)
      const extraValue = normalizeText(row.extraValue)

      if (!isRuleType(ruleType) || !isRuleOperator(operator) || !value) {
        return null
      }

      return {
        ruleType,
        operator,
        value,
        extraValue: extraValue || null,
        sortOrder: normalizeNumber(row.sortOrder, index),
      }
    })
    .filter(Boolean) as Array<{
      ruleType: BadgeRuleType
      operator: BadgeRuleOperator
      value: string
      extraValue: string | null
      sortOrder: number
    }>
}

export async function GET() {
  const guard = await ensureAdmin()
  if (guard.error) return guard.error

  const badges = await prisma.badge.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      rules: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      _count: {
        select: {
          users: true,
        },
      },
    },
  })

  return NextResponse.json({
    code: 0,
    data: badges.map((badge) => ({
      id: badge.id,
      name: badge.name,
      code: badge.code,
      description: badge.description,
      iconPath: badge.iconPath,
      iconText: badge.iconText,
      color: badge.color,
      imageUrl: badge.imageUrl,
      category: badge.category,
      sortOrder: badge.sortOrder,
      status: badge.status,
      isHidden: badge.isHidden,
      grantedUserCount: badge._count.users,
      createdAt: badge.createdAt.toISOString(),
      updatedAt: badge.updatedAt.toISOString(),
      rules: badge.rules,
    })),
  })
}

export async function POST(request: Request) {
  const guard = await ensureAdmin()
  if (guard.error) return guard.error
  const { admin } = guard
  const requestIp = getRequestIp(request)

  const body = await request.json()
  const name = normalizeText(body.name)
  const code = normalizeText(body.code)

  if (!name || !code) {
    return NextResponse.json({ code: 400, message: "勋章名称和标识不能为空" }, { status: 400 })
  }

  const rules = parseRules(body.rules)

  const badge = await prisma.badge.create({
    data: {
      name,
      code,
      description: normalizeText(body.description) || undefined,
      iconPath: normalizeText(body.iconPath) || undefined,
      iconText: normalizeText(body.iconText, "🏅") || "🏅",
      color: normalizeText(body.color, "#f59e0b") || "#f59e0b",
      imageUrl: normalizeText(body.imageUrl) || undefined,
      category: normalizeText(body.category, "社区成就") || "社区成就",
      sortOrder: normalizeNumber(body.sortOrder),
      status: body.status === undefined ? true : normalizeBoolean(body.status),
      isHidden: normalizeBoolean(body.isHidden),
      rules: {
        create: rules,
      },
    },
  })

  await writeAdminLog(admin.id, "badge.create", "BADGE", badge.id, `创建勋章 ${name}`, requestIp)
  return NextResponse.json({ code: 0, message: "勋章已创建", data: { id: badge.id } })
}

export async function PUT(request: Request) {
  const guard = await ensureAdmin()
  if (guard.error) return guard.error
  const { admin } = guard
  const requestIp = getRequestIp(request)

  const body = await request.json()
  const id = normalizeText(body.id)
  const name = normalizeText(body.name)
  const code = normalizeText(body.code)

  if (!id || !name || !code) {
    return NextResponse.json({ code: 400, message: "缺少必要参数" }, { status: 400 })
  }

  const rules = parseRules(body.rules)

  await prisma.$transaction(async (tx) => {
    await tx.badge.update({
      where: { id },
      data: {
        name,
        code,
        description: normalizeText(body.description) || undefined,
        iconPath: normalizeText(body.iconPath) || undefined,
        iconText: normalizeText(body.iconText, "🏅") || "🏅",
        color: normalizeText(body.color, "#f59e0b") || "#f59e0b",
        imageUrl: normalizeText(body.imageUrl) || undefined,
        category: normalizeText(body.category, "社区成就") || "社区成就",
        sortOrder: normalizeNumber(body.sortOrder),
        status: body.status === undefined ? true : normalizeBoolean(body.status),
        isHidden: normalizeBoolean(body.isHidden),
      },
    })

    await tx.badgeRule.deleteMany({ where: { badgeId: id } })

    if (rules.length > 0) {
      await tx.badgeRule.createMany({
        data: rules.map((rule) => ({
          badgeId: id,
          ruleType: rule.ruleType,
          operator: rule.operator,
          value: rule.value,
          extraValue: rule.extraValue,
          sortOrder: rule.sortOrder,
        })),
      })
    }
  })

  await writeAdminLog(admin.id, "badge.update", "BADGE", id, `更新勋章 ${name}`, requestIp)
  return NextResponse.json({ code: 0, message: "勋章已更新" })
}

export async function DELETE(request: Request) {
  const guard = await ensureAdmin()
  if (guard.error) return guard.error
  const { admin } = guard
  const requestIp = getRequestIp(request)

  const body = await request.json()
  const id = normalizeText(body.id)

  if (!id) {
    return NextResponse.json({ code: 400, message: "缺少必要参数" }, { status: 400 })
  }

  const grantedCount = await prisma.userBadge.count({ where: { badgeId: id } })
  if (grantedCount > 0) {
    return NextResponse.json({ code: 400, message: "该勋章已有用户领取记录，暂不允许删除" }, { status: 400 })
  }

  await prisma.badge.delete({ where: { id } })
  await writeAdminLog(admin.id, "badge.delete", "BADGE", id, "删除勋章", requestIp)
  return NextResponse.json({ code: 0, message: "勋章已删除" })
}
