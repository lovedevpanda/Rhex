import { apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { redeemPointsCode } from "@/lib/redeem-codes"
import { logRouteWriteSuccess } from "@/lib/route-metadata"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const code = requireStringField(body, "code", "请输入兑换码")

  const redeemCode = await redeemPointsCode({
    userId: currentUser.id,
    code,
  })

  logRouteWriteSuccess({
    scope: "redeem-codes-redeem",
    action: "redeem-points-code",
  }, {
    userId: currentUser.id,
    targetId: redeemCode.code,
    extra: {
      points: redeemCode.points,
    },
  })

  return apiSuccess({
    code: redeemCode.code,
    points: redeemCode.points,
  }, "兑换成功")
}, {
  errorMessage: "兑换失败",
  logPrefix: "[api/redeem-codes/redeem] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED", "BANNED", "INACTIVE"],
})
