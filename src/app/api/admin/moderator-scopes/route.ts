import { apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { updateModeratorScopes } from "@/lib/admin-moderator-scopes"

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const result = await updateModeratorScopes({
    actor: adminUser,
    body,
  })

  return apiSuccess(undefined, result.message)
}, {
  errorMessage: "保存版主管辖范围失败",
  logPrefix: "[api/admin/moderator-scopes] unexpected error",
  unauthorizedMessage: "无权操作",
})
