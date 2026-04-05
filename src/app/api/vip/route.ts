import { getCurrentUserRecord } from "@/db/current-user"
import { prisma } from "@/db/client"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { getSiteSettings } from "@/lib/site-settings"

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export const POST = createUserRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const action = requireStringField(body, "action", "不支持的 VIP 操作")

  const dbUser = await getCurrentUserRecord()

  if (!dbUser) {
    apiError(404, "用户不存在")
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
    const preparedPurchase = await prepareScopedPointDelta({
      scopeKey: "VIP_PURCHASE",
      baseDelta: -plan.points,
      userId: dbUser.id,
    })

    if (preparedPurchase.finalDelta < 0 && dbUser.points < Math.abs(preparedPurchase.finalDelta)) {
      apiError(400, `${settings.pointName}不足，无法购买${plan.label}`)
    }

    const nextExpiresAt = addDays(currentExpiresAt, plan.days)

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: dbUser.id },
        data: {
          vipLevel: Math.max(dbUser.vipLevel || 0, plan.level),
          vipExpiresAt: nextExpiresAt,
        },
      })
      await applyPointDelta({
        tx,
        userId: dbUser.id,
        beforeBalance: dbUser.points,
        prepared: preparedPurchase,
        pointName: settings.pointName,
        insufficientMessage: `${settings.pointName}不足，无法购买${plan.label}`,
        reason: `购买${plan.label}`,
      })
      await tx.vipOrder.create({
        data: {
          userId: dbUser.id,
          orderType: action,
          pointsCost: Math.max(0, -preparedPurchase.finalDelta),
          days: plan.days,
          vipLevel: Math.max(dbUser.vipLevel || 0, plan.level),
          expiresAt: nextExpiresAt,
          remark: `${settings.pointName}购买 / 续费 ${plan.label}`,
        },
      })
    })

    return apiSuccess(undefined, `已成功开通 / 续费 ${plan.label}`)
  }

  apiError(400, "不支持的 VIP 操作")
}, {
  errorMessage: "VIP 操作失败",
  logPrefix: "[api/vip] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
