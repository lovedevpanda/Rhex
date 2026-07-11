import { prisma } from "@/db/client"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { applyPointDelta, prepareScopedPointDelta } from "@/lib/point-center"
import { getSiteSettings } from "@/lib/site-settings"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const action = requireStringField(body, "action", "不支持的 VIP 操作")
  const requestId = typeof body.requestId === "string" && body.requestId.trim()
    ? body.requestId.trim()
    : crypto.randomUUID()

  return withRequestWriteGuard(createRequestWriteGuardOptions("vip-action", {
    request,
    userId: currentUser.id,
    input: {
      action,
      requestId,
    },
  }), async () => {
    const settings = await getSiteSettings()
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
        userId: currentUser.id,
      })

      const purchase = await prisma.$transaction(async (tx) => {
        // Use the latest committed expiry and balance, not the request-time user snapshot.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`vip:user:${currentUser.id}`}))`
        const dbUser = await tx.user.findUnique({
          where: { id: currentUser.id },
          select: {
            id: true,
            points: true,
            vipLevel: true,
            vipExpiresAt: true,
          },
        })
        if (!dbUser) {
          apiError(404, "用户不存在")
        }

        const vipWasActive = Boolean(dbUser.vipExpiresAt && dbUser.vipExpiresAt.getTime() > Date.now())
        const currentExpiresAt = vipWasActive && dbUser.vipExpiresAt ? dbUser.vipExpiresAt : new Date()
        const nextExpiresAt = addDays(currentExpiresAt, plan.days)
        const nextVipLevel = Math.max(dbUser.vipLevel || 0, plan.level)

        await applyPointDelta({
          tx,
          userId: dbUser.id,
          beforeBalance: dbUser.points,
          prepared: preparedPurchase,
          pointName: settings.pointName,
          insufficientMessage: `${settings.pointName}不足，无法购买${plan.label}`,
          reason: `购买${plan.label}`,
        })
        await tx.user.update({
          where: { id: dbUser.id },
          data: {
            vipLevel: nextVipLevel,
            vipExpiresAt: nextExpiresAt,
          },
        })
        await tx.vipOrder.create({
          data: {
            userId: dbUser.id,
            orderType: action,
            pointsCost: Math.max(0, -preparedPurchase.finalDelta),
            days: plan.days,
            vipLevel: nextVipLevel,
            expiresAt: nextExpiresAt,
            remark: `${settings.pointName}购买 / 续费 ${plan.label}`,
          },
        })

        return { nextExpiresAt, vipWasActive }
      })

      revalidateUserSurfaceCache(currentUser.id)

      return apiSuccess({
        expiresAt: purchase.nextExpiresAt.toISOString(),
        mode: purchase.vipWasActive ? "renew" : "activate",
      }, purchase.vipWasActive ? "续费成功" : "开通成功")
    }

    apiError(400, "不支持的 VIP 操作")
  })
}, {
  errorMessage: "VIP 操作失败",
  logPrefix: "[api/vip] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
