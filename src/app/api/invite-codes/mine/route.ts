import { apiSuccess, createUserRouteHandler } from "@/lib/api-route"
import { getPurchasedInviteCodePage } from "@/lib/invite-codes"

export const dynamic = "force-dynamic"

export const GET = createUserRouteHandler(async ({ request, currentUser }) => {
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get("page") ?? "1")
  const pageSize = Number(searchParams.get("pageSize") ?? "10")

  return apiSuccess(await getPurchasedInviteCodePage(currentUser.id, { page, pageSize }))
}, {
  errorMessage: "加载已购买邀请码失败",
  logPrefix: "[api/invite-codes/mine] unexpected error",
  unauthorizedMessage: "请先登录",
  allowStatuses: ["ACTIVE", "MUTED"],
})
