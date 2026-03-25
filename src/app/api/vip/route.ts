import { ChangeType } from "@/db/types"
import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/db/client"
import { getSiteSettings } from "@/lib/site-settings"

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const body = await request.json()
  const action = String(body.action ?? "")

  if (!user) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser) {
    return NextResponse.json({ code: 404, message: "用户不存在" }, { status: 404 })
  }

  const settings = await getSiteSettings()
  const currentExpiresAt = dbUser.vipExpiresAt && dbUser.vipExpiresAt.getTime() > Date.now() ? dbUser.vipExpiresAt : new Date()

  const vipPlanMap = {
    "purchase.month": { days: 30, level: 1, points: settings.vipMonthlyPrice, label: "月卡 VIP1" },
    "purchase.quarter": { days: 90, level: 2, points: settings.vipQuarterlyPrice, label: "季卡 VIP2" },
    "purchase.year": { days: 365, level: 3, points: settings.vipYearlyPrice, label: "年卡 VIP3" },
  } as const



  if (action in vipPlanMap) {
    const plan = vipPlanMap[action as keyof typeof vipPlanMap]
    if (dbUser.points < plan.points) {
      return NextResponse.json({ code: 400, message: `${settings.pointName}不足，无法购买${plan.label}` }, { status: 400 })
    }


    const nextExpiresAt = addDays(currentExpiresAt, plan.days)

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: dbUser.id },
        data: {
          vipLevel: Math.max(dbUser.vipLevel || 0, plan.level),
          vipExpiresAt: nextExpiresAt,
          points: {
            decrement: plan.points,
          },
        },

      })
      await tx.pointLog.create({
        data: {
          userId: dbUser.id,
          changeType: ChangeType.DECREASE,
          changeValue: plan.points,
          reason: `${settings.pointName}购买${plan.label}`,
        },
      })
      await tx.vipOrder.create({
        data: {
          userId: dbUser.id,
          orderType: action,
          pointsCost: plan.points,
          days: plan.days,
          vipLevel: Math.max(dbUser.vipLevel || 0, plan.level),
          expiresAt: nextExpiresAt,
          remark: `${settings.pointName}购买 / 续费 ${plan.label}`,
        },
      })
    })

    return NextResponse.json({ code: 0, message: `已成功使用${settings.pointName}开通 / 续费 ${plan.label}` })

  }


  return NextResponse.json({ code: 400, message: "不支持的 VIP 操作" }, { status: 400 })
}
