import { apiError, apiSuccess, createAdminRouteHandler, requireSearchParam } from "@/lib/api-route"
import { getAdminUserDetail } from "@/lib/admin-user-details"
import { normalizePositiveUserId } from "@/lib/admin-action-types"

export const GET = createAdminRouteHandler(async ({ request }) => {
  const rawUserId = requireSearchParam(request, "userId", "缺少用户标识")
  const userId = normalizePositiveUserId(rawUserId)

  if (!userId) {
    apiError(400, "用户标识不合法")
  }

  const data = await getAdminUserDetail(userId)
  return apiSuccess(data)
}, {
  errorMessage: "加载用户详情失败",
  logPrefix: "[api/admin/users/detail] unexpected error",
})
