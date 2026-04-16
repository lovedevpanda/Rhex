import { apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { executeAddonActionHook } from "@/addons-host/runtime/hooks"
import { purchaseInviteCode } from "@/lib/invite-codes"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { createRequestWriteGuardOptions } from "@/lib/write-guard-policies"
import { withRequestWriteGuard } from "@/lib/write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const requestUrl = new URL(request.url)

  return withRequestWriteGuard(createRequestWriteGuardOptions("invite-codes-purchase", {
    request,
    userId: currentUser.id,
    input: {},
  }), async () => {
    await executeAddonActionHook("invite-code.purchase.before", {
      userId: currentUser.id,
      username: currentUser.username,
    }, {
      request,
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
      throwOnError: true,
    })

    const inviteCode = await purchaseInviteCode(currentUser.id)

    await executeAddonActionHook("invite-code.purchase.after", {
      userId: currentUser.id,
      username: currentUser.username,
      code: inviteCode.code,
    }, {
      request,
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
    })

    revalidateUserSurfaceCache(currentUser.id)
    return apiSuccess({ code: inviteCode.code }, "邀请码购买成功")
  })
}, {
  errorMessage: "邀请码购买失败",
  logPrefix: "[api/invite-codes/purchase] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})

