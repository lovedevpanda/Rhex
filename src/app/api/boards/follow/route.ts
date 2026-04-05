import { toggleFollowTarget } from "@/db/follow-queries"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"
import { withRequestWriteGuard } from "@/lib/write-guard"


export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const boardId = requireStringField(body, "boardId", "缺少节点参数")

  return withRequestWriteGuard({
    request,
    userId: currentUser.id,
    scope: "boards-follow-toggle",
    cooldownMs: 1_500,
    dedupeKey: `${currentUser.id}:${boardId}`,
  }, async () => {
    const result = await toggleFollowTarget({
      userId: currentUser.id,
      targetType: "board",
      targetId: boardId,
    })

    if (result.status === "missing") {
      apiError(404, "节点不存在")
    }

    if (result.status !== "ok") {
      apiError(400, "关注节点失败")
    }

    return apiSuccess({ followed: result.followed }, result.followed ? "关注节点成功" : "已取消关注节点")
  })
}, {

  errorMessage: "关注节点失败",
  logPrefix: "[api/boards/follow] unexpected error",
  unauthorizedMessage: "请先登录后再关注节点",
  allowStatuses: ["ACTIVE", "MUTED"],
})
