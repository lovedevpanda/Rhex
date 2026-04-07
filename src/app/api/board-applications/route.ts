import { apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { submitBoardApplication } from "@/lib/board-applications"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)

  await submitBoardApplication({
    applicantId: currentUser.id,
    zoneId: typeof body.zoneId === "string" ? body.zoneId : "",
    name: typeof body.name === "string" ? body.name : "",
    slug: typeof body.slug === "string" ? body.slug : "",
    description: typeof body.description === "string" ? body.description : "",
    icon: typeof body.icon === "string" ? body.icon : "",
    reason: typeof body.reason === "string" ? body.reason : "",
  })

  return apiSuccess(undefined, "节点申请已提交，待管理员审核")
}, {
  errorMessage: "提交节点申请失败",
  logPrefix: "[api/board-applications] unexpected error",
  unauthorizedMessage: "请先登录后再申请新建节点",
  allowStatuses: ["ACTIVE"],
})
