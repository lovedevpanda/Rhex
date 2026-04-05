import { apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { purchaseInviteCode } from "@/lib/invite-codes"

export const POST = createUserRouteHandler(async ({ currentUser }) => {
  const inviteCode = await purchaseInviteCode(currentUser.id)
  return apiSuccess({ code: inviteCode.code }, "邀请码购买成功")
}, {
  errorMessage: "邀请码购买失败",
  logPrefix: "[api/invite-codes/purchase] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})

