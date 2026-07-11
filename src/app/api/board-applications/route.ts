import { apiSuccess, createUserRouteHandler, readJsonBody } from "@/lib/api-route"
import { submitBoardApplication } from "@/lib/board-applications"
import { createPublicWriteDedupeKey, withPublicWriteGuard } from "@/lib/public-write-guard"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const zoneId = typeof body.zoneId === "string" ? body.zoneId : ""
  const name = typeof body.name === "string" ? body.name : ""
  const slug = typeof body.slug === "string" ? body.slug : ""
  const description = typeof body.description === "string" ? body.description : ""
  const icon = typeof body.icon === "string" ? body.icon : ""
  const reason = typeof body.reason === "string" ? body.reason : ""

  return withPublicWriteGuard("board-applications-submit", {
    request,
    userId: currentUser.id,
    dedupeKey: createPublicWriteDedupeKey(zoneId, name, slug, description, icon, reason),
  }, async () => {
    const result = await submitBoardApplication({
      applicantId: currentUser.id,
      zoneId,
      name,
      slug,
      description,
      icon,
      reason,
    })

    return apiSuccess(undefined, result.contentAdjusted ? "节点申请已提交，部分内容已自动替换，待管理员审核" : "节点申请已提交，待管理员审核")
  })
}, {
  errorMessage: "提交节点申请失败",
  logPrefix: "[api/board-applications] unexpected error",
  unauthorizedMessage: "请先登录后再申请新建节点",
  allowStatuses: ["ACTIVE"],
})
