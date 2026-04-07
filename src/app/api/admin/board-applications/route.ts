import { apiError, apiSuccess, createAdminRouteHandler, readJsonBody } from "@/lib/api-route"
import { getRequestIp, writeAdminLog } from "@/lib/admin"
import { reviewBoardApplication } from "@/lib/board-applications"

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request)
  const action = body.action === "approve" || body.action === "reject" || body.action === "update"
    ? body.action
    : null

  if (!action) {
    apiError(400, "不支持的审核动作")
  }

  const result = await reviewBoardApplication({
    applicationId: typeof body.id === "string" ? body.id : "",
    reviewerId: adminUser.id,
    action,
    zoneId: typeof body.zoneId === "string" ? body.zoneId : "",
    name: typeof body.name === "string" ? body.name : "",
    slug: typeof body.slug === "string" ? body.slug : "",
    description: typeof body.description === "string" ? body.description : "",
    icon: typeof body.icon === "string" ? body.icon : "",
    reason: typeof body.reason === "string" ? body.reason : "",
    reviewNote: typeof body.reviewNote === "string" ? body.reviewNote : "",
  })

  await writeAdminLog(
    adminUser.id,
    `board-application.${action}`,
    "BOARD_APPLICATION",
    typeof body.id === "string" ? body.id : "",
    result.message,
    getRequestIp(request),
  )

  return apiSuccess("data" in result ? result.data : undefined, result.message)
}, {
  errorMessage: "处理节点申请失败",
  logPrefix: "[api/admin/board-applications] unexpected error",
  unauthorizedMessage: "仅管理员可审核节点申请",
  allowModerator: false,
})
