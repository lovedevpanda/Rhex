import { apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
import { redeemPointsCode } from "@/lib/redeem-codes"
import { logRouteWriteSuccess } from "@/lib/route-metadata"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const code = requireStringField(body, "code", "请输入兑换码")
  const requestUrl = new URL(request.url)

  return withRequestWriteGuard(createRequestWriteGuardOptions("redeem-codes-redeem", {
    request,
    userId: currentUser.id,
    input: {
      code,
    },
  }), async () => {
    await executeAddonActionHook("redeem-code.redeem.before", {
      userId: currentUser.id,
      username: currentUser.username,
      code,
    }, {
      request,
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
      throwOnError: true,
    })

    const redeemCode = await redeemPointsCode({
      userId: currentUser.id,
      code,
    })

    await executeAddonActionHook("redeem-code.redeem.after", {
      userId: currentUser.id,
      username: currentUser.username,
      code: redeemCode.code,
      points: redeemCode.points,
      codeCategory: redeemCode.codeCategory,
      categoryUserLimit: redeemCode.categoryUserLimit,
    }, {
      request,
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
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

    revalidateUserSurfaceCache(currentUser.id)

    return apiSuccess({
      code: redeemCode.code,
      points: redeemCode.points,
    }, "兑换成功")
  })
}, {
  errorMessage: "兑换失败",
  logPrefix: "[api/redeem-codes/redeem] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
