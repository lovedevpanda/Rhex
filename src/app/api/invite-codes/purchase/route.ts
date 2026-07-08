import { apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
import { purchaseInviteCode } from "@/lib/invite-codes"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const requestUrl = new URL(request.url)
  const body = await readJsonBody(request)
  const requestedCount = Number(body.count ?? 1)
  const count = Number.isFinite(requestedCount)
    ? Math.max(1, Math.min(Math.trunc(requestedCount), 10))
    : 1

  return withRequestWriteGuard(createRequestWriteGuardOptions("invite-codes-purchase", {
    request,
    userId: currentUser.id,
    input: { count },
  }), async () => {
    await executeAddonActionHook("invite-code.purchase.before", {
      userId: currentUser.id,
      username: currentUser.username,
      count,
    }, {
      request,
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
      throwOnError: true,
    })

    const inviteCode = await purchaseInviteCode(currentUser.id, { count })

    await executeAddonActionHook("invite-code.purchase.after", {
      userId: currentUser.id,
      username: currentUser.username,
      code: inviteCode.code,
      codes: inviteCode.codes,
      count,
    }, {
      request,
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
    })

    revalidateUserSurfaceCache(currentUser.id)
    return apiSuccess(
      { code: inviteCode.code, codes: inviteCode.codes, count, balance: inviteCode.balance },
      count > 1 ? `已购买 ${count} 个邀请码` : "邀请码购买成功",
    )
  })
}, {
  errorMessage: "邀请码购买失败",
  logPrefix: "[api/invite-codes/purchase] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
