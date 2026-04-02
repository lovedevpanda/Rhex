import { toggleUserBlock } from "@/db/block-queries"
import { apiError, apiSuccess, createUserRouteHandler, readJsonBody, requireStringField } from "@/lib/api-route"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const targetId = requireStringField(body, "targetId", "缺少拉黑目标")
  const desiredBlocked = typeof body.desiredBlocked === "boolean" ? body.desiredBlocked : undefined

  const result = await toggleUserBlock({
    blockerId: currentUser.id,
    targetId,
    desiredBlocked,
  })

  if (result.status === "invalid") {
    apiError(400, "拉黑目标不合法")
  }

  if (result.status === "self") {
    apiError(400, "不能拉黑自己")
  }

  if (result.status === "missing") {
    apiError(404, "目标用户不存在")
  }

  return apiSuccess(
    {
      blocked: result.blocked,
      changed: result.changed,
    },
    result.blocked ? "已拉黑该用户" : "已取消拉黑",
  )
}, {
  errorMessage: "拉黑操作失败",
  logPrefix: "[api/blocks/toggle] unexpected error",
  unauthorizedMessage: "请先登录后再拉黑用户",
  allowStatuses: ["ACTIVE", "MUTED", "BANNED", "INACTIVE"],
})
